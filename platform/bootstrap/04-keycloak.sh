#!/usr/bin/env bash
# Installs Keycloak in dev mode with a pre-seeded "shopcart" realm.
set -euo pipefail

helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null
helm repo update >/dev/null

kubectl apply -n platform -f "$(dirname "$0")/../keycloak/realm-configmap.yaml"

helm upgrade --install keycloak bitnami/keycloak \
  --namespace platform \
  --set auth.adminUser=admin \
  --set auth.adminPassword=admin \
  --set production=false \
  --set proxy=edge \
  --set replicaCount=1 \
  --set service.type=ClusterIP \
  --set extraStartupArgs="--import-realm" \
  --set extraVolumes[0].name=realm \
  --set extraVolumes[0].configMap.name=keycloak-realm \
  --set extraVolumeMounts[0].name=realm \
  --set extraVolumeMounts[0].mountPath=/opt/bitnami/keycloak/data/import

cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: keycloak
  namespace: platform
spec:
  ingressClassName: nginx
  rules:
    - host: keycloak.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: keycloak
                port: { number: 80 }
EOF

echo "keycloak installed."
echo "  Admin console: http://keycloak.local (admin/admin)"
echo "  Realm:         shopcart"
echo "  Demo user:     demo / demo"
