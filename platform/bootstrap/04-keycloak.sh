#!/usr/bin/env bash
# Installs Keycloak in dev mode with a pre-seeded "shopcart" realm.
# Uses the official quay.io image directly (Bitnami's Docker Hub image is no
# longer freely pullable as of late 2025).
set -euo pipefail

kubectl apply -n platform -f "$(dirname "$0")/../keycloak/realm-configmap.yaml"

cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keycloak
  namespace: platform
spec:
  replicas: 1
  selector: { matchLabels: { app: keycloak } }
  template:
    metadata:
      labels: { app: keycloak }
      annotations: { linkerd.io/inject: enabled }
    spec:
      containers:
        - name: keycloak
          image: quay.io/keycloak/keycloak:26.0
          args: ["start-dev", "--import-realm", "--http-port=8080"]
          env:
            - { name: KC_BOOTSTRAP_ADMIN_USERNAME, value: admin }
            - { name: KC_BOOTSTRAP_ADMIN_PASSWORD, value: admin }
            - { name: KC_HOSTNAME_STRICT,          value: "false" }
            - { name: KC_HTTP_RELATIVE_PATH,       value: "/" }
          ports: [{ containerPort: 8080, name: http }]
          volumeMounts:
            - { name: realm, mountPath: /opt/keycloak/data/import }
          readinessProbe:
            httpGet: { path: /realms/master, port: http }
            initialDelaySeconds: 20
            periodSeconds: 5
      volumes:
        - name: realm
          configMap:
            name: keycloak-realm
            items:
              - { key: shopcart-realm.json, path: shopcart-realm.json }
---
apiVersion: v1
kind: Service
metadata:
  name: keycloak
  namespace: platform
spec:
  selector: { app: keycloak }
  ports: [{ name: http, port: 80, targetPort: http }]
---
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
              service: { name: keycloak, port: { number: 80 } }
EOF

kubectl -n platform wait --for=condition=Available deploy/keycloak --timeout=180s

echo "keycloak installed."
echo "  Admin console: http://keycloak.local (admin/admin)"
echo "  Realm:         shopcart"
echo "  Demo user:     demo / demo"
