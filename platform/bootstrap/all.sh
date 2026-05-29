#!/usr/bin/env bash
# Brings up the whole platform end-to-end. Run once after `minikube start`.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

bash "$HERE/00-minikube.sh"
bash "$HERE/01-linkerd.sh"
bash "$HERE/02-operators.sh"
bash "$HERE/03-data.sh"
bash "$HERE/04-keycloak.sh"
bash "$HERE/05-observability.sh"
bash "$HERE/06-argo.sh"

echo ""
echo "✅ Platform up. Next:"
echo "   tilt up       # iterate on services with live reload"
echo "   open http://shop.local      # api-gateway"
echo "   open http://grafana.local   # dashboards"
echo "   open http://argocd.local    # GitOps"
