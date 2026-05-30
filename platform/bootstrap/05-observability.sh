#!/usr/bin/env bash
# Installs kube-prometheus-stack, Loki, Tempo, and the OpenTelemetry Collector.
set -euo pipefail

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo add grafana               https://grafana.github.io/helm-charts                >/dev/null
helm repo add open-telemetry        https://open-telemetry.github.io/opentelemetry-helm-charts >/dev/null
helm repo update >/dev/null

# kube-prometheus-stack: Prometheus + Grafana + node-exporter + kube-state-metrics
helm upgrade --install kps prometheus-community/kube-prometheus-stack \
  --namespace observability \
  --set grafana.adminPassword=admin \
  --set grafana.service.type=ClusterIP \
  --set grafana.persistence.enabled=false \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false

# Loki for logs (single-binary, filesystem). The chart still requires bucket
# names even when not using object storage — set placeholders.
helm upgrade --install loki grafana/loki \
  --namespace observability \
  --set loki.auth_enabled=false \
  --set loki.commonConfig.replication_factor=1 \
  --set loki.storage.type=filesystem \
  --set loki.storage.bucketNames.chunks=chunks \
  --set loki.storage.bucketNames.ruler=ruler \
  --set loki.storage.bucketNames.admin=admin \
  --set loki.schemaConfig.configs[0].from=2024-01-01 \
  --set loki.schemaConfig.configs[0].store=tsdb \
  --set loki.schemaConfig.configs[0].object_store=filesystem \
  --set loki.schemaConfig.configs[0].schema=v13 \
  --set loki.schemaConfig.configs[0].index.prefix=loki_index_ \
  --set loki.schemaConfig.configs[0].index.period=24h \
  --set singleBinary.replicas=1 \
  --set deploymentMode=SingleBinary \
  --set read.replicas=0 \
  --set write.replicas=0 \
  --set backend.replicas=0 \
  --set chunksCache.enabled=false \
  --set resultsCache.enabled=false

# Promtail to ship logs into Loki
helm upgrade --install promtail grafana/promtail \
  --namespace observability \
  --set "config.clients[0].url=http://loki.observability.svc.cluster.local:3100/loki/api/v1/push"

# Tempo for traces
helm upgrade --install tempo grafana/tempo \
  --namespace observability \
  --set tempo.metricsGenerator.enabled=true

# OpenTelemetry Collector (gateway). Apps push OTLP to this; it fans out to Tempo + Prom.
kubectl apply -n observability -f "$(dirname "$0")/../observability/otel-collector.yaml"

# Grafana ingress + datasources
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana
  namespace: observability
spec:
  ingressClassName: nginx
  rules:
    - host: grafana.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: kps-grafana
                port: { number: 80 }
EOF

kubectl apply -n observability -f "$(dirname "$0")/../observability/grafana-datasources.yaml"

echo "observability installed."
echo "  Grafana: http://grafana.local (admin/admin)"
