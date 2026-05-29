# Getting started

A walkthrough from zero to "I just placed an order through the gateway and watched the trace flow through six services."

## 1. Install the toolbelt

| Tool | Why | macOS install |
|---|---|---|
| `minikube` | Local Kubernetes | `brew install minikube` |
| `kubectl` | k8s CLI | `brew install kubectl` |
| `helm` | Chart installer | `brew install helm` |
| `linkerd` CLI | Mesh control | `brew install linkerd` |
| `tilt` | Dev loop | `brew install tilt-dev/tap/tilt` |
| `pnpm` | Node workspaces | `corepack enable && corepack prepare pnpm@9 --activate` |
| `docker` | Container runtime | Docker Desktop / OrbStack |
| `buf` (optional) | Local proto gen | `brew install bufbuild/buf/buf` |

## 2. Bring up minikube and the platform

```bash
bash platform/bootstrap/all.sh
```

The script runs the numbered installers in order:

| Step | What it does |
|---|---|
| `00-minikube.sh` | Profile `shopcart`, 6 CPU / 10 GB, namespaces |
| `01-linkerd.sh` | CRDs, control plane, viz, namespace auto-injection |
| `02-operators.sh` | CloudNativePG, Strimzi, Sealed Secrets, Chaos Mesh, flagd |
| `03-data.sh` | One Postgres cluster per service, Redis, Kafka + topics |
| `04-keycloak.sh` | Keycloak with pre-seeded `shopcart` realm |
| `05-observability.sh` | kube-prometheus-stack, Loki, Tempo, OTel Collector, Grafana datasources |
| `06-argo.sh` | Argo CD + Argo Rollouts + App-of-Apps |

## 3. Wire up host names

```bash
echo "$(minikube ip -p shopcart) shop.local grafana.local argocd.local keycloak.local" | sudo tee -a /etc/hosts
```

| URL | What |
|---|---|
| http://shop.local | api-gateway |
| http://grafana.local | Grafana (admin/admin) |
| http://argocd.local | Argo CD (admin / see bootstrap output) |
| http://keycloak.local | Keycloak (admin/admin) |

## 4. Run the services

```bash
# point your docker CLI at the minikube daemon so images don't need pushing
eval $(minikube -p shopcart docker-env)

tilt up
# UI: http://localhost:10350
```

Tilt builds each service's image, helm-applies its chart, and live-reloads on file changes.

## 5. Do something

```bash
# Get a token (resource owner password grant for demo only — never do this in prod)
TOKEN=$(curl -s -X POST \
  -d "client_id=shopcart-web" -d "grant_type=password" \
  -d "username=demo" -d "password=demo" \
  http://keycloak.local/realms/shopcart/protocol/openid-connect/token | jq -r .access_token)

# Browse the catalog
curl -s http://shop.local/api/products | jq

# Pick the first product id and add it to the cart
PID=$(curl -s http://shop.local/api/products | jq -r '.products[0].id')
curl -s -X POST http://shop.local/api/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d "{\"productId\":\"$PID\",\"quantity\":2}" | jq

# Place an order
curl -s -X POST http://shop.local/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"shippingAddressId":"","idempotencyKey":"demo-001"}' | jq
```

## 6. Watch it move

- **Trace flow** — Grafana → Explore → Tempo → search by `service.name=api-gateway` and follow a `placeOrder` trace through cart → order → kafka producer → inventory consumer → payment → notification.
- **Mesh metrics** — `linkerd viz dashboard` and look at the `shopcart` namespace; you should see success rates, RPS, and latency per route automatically.
- **GitOps** — make a change to `platform/helm/values/order-service.yaml`, commit, push. Argo CD picks it up; Argo Rollouts runs the canary.
- **Chaos** — `kubectl apply -f platform/chaos/pod-kill-order.yaml` and watch the dashboards.

## 7. Tear down

```bash
minikube delete -p shopcart
```
