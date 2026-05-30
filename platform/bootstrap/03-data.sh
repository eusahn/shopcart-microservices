#!/usr/bin/env bash
# Provisions a Postgres cluster per service via CloudNativePG, plus Redis and Kafka.
set -euo pipefail

# Wait for operators *AND their CRDs*. "Deployment Available" can land seconds
# before the CRDs finish establishing, so applying CRs immediately races.
kubectl -n cnpg-system wait --for=condition=Available deploy/cnpg-controller-manager --timeout=180s
kubectl -n kafka       wait --for=condition=Available deploy/strimzi-cluster-operator --timeout=180s

echo "waiting for CRDs to be established…"
kubectl wait --for=condition=established --timeout=120s \
  crd/clusters.postgresql.cnpg.io \
  crd/kafkas.kafka.strimzi.io \
  crd/kafkanodepools.kafka.strimzi.io \
  crd/kafkatopics.kafka.strimzi.io

# --- Per-service Postgres clusters ---
for svc in catalog user order inventory; do
  cat <<EOF | kubectl apply -f -
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ${svc}-pg
  namespace: shopcart
spec:
  instances: 1
  storage:
    size: 1Gi
  bootstrap:
    initdb:
      database: ${svc}
      owner: ${svc}
EOF
done

# CNPG creates a secret named "<cluster>-app" with the right URL.
# Map it to the name our services expect.
for svc in catalog user order inventory; do
  kubectl -n shopcart wait --for=condition=Ready cluster.postgresql.cnpg.io/${svc}-pg --timeout=300s || true
  # Build an envFrom-friendly secret that exposes DATABASE_URL
  PG_HOST="${svc}-pg-rw.shopcart.svc.cluster.local"
  kubectl -n shopcart create secret generic ${svc}-db \
    --from-literal=DATABASE_URL="postgresql://${svc}:\$(${svc}-pg-app-password)@${PG_HOST}:5432/${svc}" \
    --dry-run=client -o yaml | kubectl apply -f -
  # CNPG's <name>-app secret carries password; we link via an envFrom in a follow-up.
done

# Simpler approach: use CNPG's generated secret directly via envFrom for libpq vars.
# We re-create the *-db secrets to point at CNPG's pre-built URI field.
for svc in catalog user order inventory; do
  kubectl -n shopcart get secret ${svc}-pg-app -o jsonpath='{.data.uri}' | base64 -d > /tmp/uri
  kubectl -n shopcart create secret generic ${svc}-db \
    --from-file=DATABASE_URL=/tmp/uri \
    --dry-run=client -o yaml | kubectl apply -f -
done

# --- Redis for cart-service ---
helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null
helm repo update >/dev/null
helm upgrade --install cart-redis bitnami/redis \
  --namespace shopcart \
  --set auth.enabled=false \
  --set architecture=standalone \
  --set master.persistence.size=512Mi

kubectl -n shopcart create secret generic cart-redis \
  --from-literal=REDIS_URL="redis://cart-redis-master.shopcart.svc.cluster.local:6379/0" \
  --dry-run=client -o yaml | kubectl apply -f -

# --- Kafka (KRaft) ---
cat <<EOF | kubectl apply -f -
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaNodePool
metadata:
  name: dual-role
  namespace: kafka
  labels:
    strimzi.io/cluster: kafka
spec:
  replicas: 1
  roles: [controller, broker]
  storage:
    type: jbod
    volumes:
      - id: 0
        type: persistent-claim
        size: 5Gi
        deleteClaim: true
---
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: kafka
  namespace: kafka
  annotations:
    strimzi.io/node-pools: enabled
    strimzi.io/kraft: enabled
spec:
  kafka:
    version: 3.8.0
    metadataVersion: 3.8-IV0
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
    config:
      offsets.topic.replication.factor: 1
      transaction.state.log.replication.factor: 1
      transaction.state.log.min.isr: 1
      default.replication.factor: 1
      min.insync.replicas: 1
  entityOperator:
    topicOperator: {}
    userOperator: {}
EOF

# Topics
for topic in orders.events inventory.events payments.events notifications.events; do
cat <<EOF | kubectl apply -f -
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: ${topic}
  namespace: kafka
  labels: { strimzi.io/cluster: kafka }
spec:
  partitions: 3
  replicas: 1
  config:
    retention.ms: 604800000
EOF
done

echo "data layer provisioned."
