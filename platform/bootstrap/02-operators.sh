#!/usr/bin/env bash
# Installs operators we depend on: CloudNativePG (Postgres-per-service), Strimzi (Kafka),
# Sealed Secrets, Chaos Mesh, OpenFeature flagd.
set -euo pipefail

# --- CloudNativePG ---
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.24/releases/cnpg-1.24.1.yaml

# --- Strimzi (Kafka) ---
kubectl create namespace kafka --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n kafka -f \
  https://strimzi.io/install/latest?namespace=kafka

# --- Sealed Secrets ---
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets >/dev/null
helm repo update >/dev/null
helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system

# --- Chaos Mesh ---
helm repo add chaos-mesh https://charts.chaos-mesh.org >/dev/null
helm repo update >/dev/null
kubectl create namespace chaos-mesh --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace chaos-mesh \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \
  --version 2.7.0

# --- flagd (OpenFeature) ---
kubectl apply -n platform -f - <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: flagd-config
data:
  flags.json: |
    {
      "flags": {
        "checkout-emit-funnel-metrics": {
          "state": "ENABLED",
          "variants": { "on": true, "off": false },
          "defaultVariant": "on"
        },
        "catalog-experimental-ranking": {
          "state": "ENABLED",
          "variants": { "on": true, "off": false },
          "defaultVariant": "off"
        }
      }
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flagd
spec:
  replicas: 1
  selector: { matchLabels: { app: flagd } }
  template:
    metadata:
      labels: { app: flagd }
      annotations: { linkerd.io/inject: enabled }
    spec:
      containers:
        - name: flagd
          image: ghcr.io/open-feature/flagd:v0.11.5
          args: ["start", "--uri", "file:/etc/flagd/flags.json"]
          ports:
            - { containerPort: 8013, name: grpc }
            - { containerPort: 8014, name: ofrep }
          volumeMounts:
            - { name: flags, mountPath: /etc/flagd }
      volumes:
        - name: flags
          configMap: { name: flagd-config }
---
apiVersion: v1
kind: Service
metadata:
  name: flagd
spec:
  selector: { app: flagd }
  ports:
    - { name: grpc,  port: 8013, targetPort: grpc }
    - { name: ofrep, port: 8014, targetPort: ofrep }
EOF

echo "operators installed."
