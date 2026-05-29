#!/usr/bin/env bash
# Installs Argo CD and Argo Rollouts.
set -euo pipefail

# Argo CD
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/v2.12.4/manifests/install.yaml

# Argo Rollouts
kubectl apply -n argo-rollouts -f \
  https://github.com/argoproj/argo-rollouts/releases/download/v1.7.2/install.yaml

# Wait for Argo CD core to be ready
kubectl -n argocd wait --for=condition=Available deploy/argocd-server --timeout=300s

# Ingress for Argo CD UI
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd
  namespace: argocd
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
    nginx.ingress.kubernetes.io/ssl-passthrough: "false"
spec:
  ingressClassName: nginx
  rules:
    - host: argocd.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: argocd-server
                port: { number: 80 }
EOF

# Disable TLS for the API server so the ingress can plain-HTTP it
kubectl -n argocd patch configmap argocd-cmd-params-cm --type merge \
  -p '{"data":{"server.insecure":"true"}}'
kubectl -n argocd rollout restart deploy/argocd-server

# Apply the root App-of-Apps
kubectl apply -f "$(dirname "$0")/../argocd/projects/shopcart.yaml"
kubectl apply -f "$(dirname "$0")/../argocd/root-app.yaml"

ADMIN_PW=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)
echo "Argo CD installed."
echo "  UI:       http://argocd.local"
echo "  Username: admin"
echo "  Password: ${ADMIN_PW}"
