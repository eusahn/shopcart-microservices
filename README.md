# ShopCart — Microservice Learning Stack

A right-sized, production-shaped scaffold of a shopping-cart system. Built to **learn how services talk to each other, get orchestrated, observed, and shipped via GitOps** — runs entirely on **minikube**, no real cloud.

> If you're skimming, jump to [docs/getting-started.md](docs/getting-started.md).

## What's in the box

| Layer | Tools |
|---|---|
| Languages | Node.js + TypeScript everywhere, gRPC contracts via Protobuf |
| Sync RPC | [Connect-RPC](https://connectrpc.com) (gRPC + HTTP/JSON dual-protocol) |
| Async | Apache Kafka via the [Strimzi](https://strimzi.io) operator (KRaft mode, no Zookeeper) |
| Service mesh | [Linkerd](https://linkerd.io) — mTLS, golden metrics, retries |
| Auth | [Keycloak](https://www.keycloak.org) (OIDC, with a pre-seeded `shopcart` realm) |
| Data | Postgres per service via [CloudNativePG](https://cloudnative-pg.io); Redis for cart |
| Observability | [OpenTelemetry Collector](https://opentelemetry.io) → Prometheus + Grafana + Loki + Tempo |
| GitOps | [Argo CD](https://argo-cd.readthedocs.io) + [Argo Rollouts](https://argo-rollouts.readthedocs.io) (canary on `order-service`) |
| Secrets | [Sealed Secrets](https://sealed-secrets.netlify.app) |
| CI | GitHub Actions (build, test, image push, manifest bump) |
| Dev loop | [Tilt](https://tilt.dev) — live reload into minikube |
| Resilience | [Chaos Mesh](https://chaos-mesh.org) experiments |
| Feature flags | [OpenFeature](https://openfeature.dev) + [flagd](https://flagd.dev) |
| Frontend | React 19 + Vite 8 SPA, Keycloak login via PKCE, served by nginx |

## The services

```
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│ api-gateway  │──┬──▶│ catalog-svc  │     │ user-service │
│   (REST)     │  │   └──────────────┘     └──────────────┘
└──────┬───────┘  │   ┌──────────────┐     ┌──────────────┐
       │          ├──▶│  cart-svc    │     │ payment-svc  │
       │          │   └──────────────┘     └──────────────┘
       │          │   ┌──────────────┐
       │          └──▶│  order-svc   │── publishes ─────────▶ Kafka (orders.events)
       │              └──────────────┘                              │
       │                                                            ▼
       │                                                  ┌──────────────────┐
       │                                                  │ inventory-svc    │── publishes ─▶ inventory.events
       │                                                  └──────────────────┘                       │
       │                                                                                             ▼
       │                                                                                   ┌──────────────────┐
       │                                                                                   │  payment-svc     │── publishes ─▶ payments.events
       │                                                                                   └──────────────────┘                       │
       │                                                                                                                              ▼
       │                                                                                                                ┌──────────────────────┐
       │                                                                                                                │ notification-svc     │ (consumes payments + inventory)
       │                                                                                                                └──────────────────────┘
```

## Repo layout

```
microservice/
├── services/                # 8 Node services
├── packages/                # shared TS libs: proto, otel, logger, kafka, config, errors, feature-flags
├── proto/                   # canonical .proto contracts (buf-generated to packages/proto/src/gen)
├── platform/
│   ├── bootstrap/           # numbered install scripts: 00-minikube → 06-argo
│   ├── helm/                # one generic chart, eight per-service values files
│   ├── argocd/              # AppProject + App-of-Apps
│   ├── observability/       # OTel Collector, Grafana datasources, dashboards
│   ├── keycloak/            # pre-seeded realm
│   ├── chaos/               # Chaos Mesh experiments
│   └── feature-flags/       # flagd config
├── .github/workflows/       # CI + image build + manifest bump
├── Dockerfile               # shared, parameterized by SERVICE build-arg
└── Tiltfile                 # local dev loop
```

## Get started

### Option A — local-only (no minikube needed)

Brings up Postgres x3 + Redis + Kafka in docker, all 7 services on your host, and the Vite frontend:

```bash
bash scripts/dev-up.sh
# open http://localhost:5173
```

Tear down:

```bash
bash scripts/dev-down.sh
```

Smoke test the gateway directly: `bash scripts/smoke.sh`.

### Option B — the full minikube ride

```bash
# 0. Prereqs: minikube, helm, kubectl, linkerd CLI, tilt, pnpm, docker
# 1. Bring up the cluster + platform (~10 min the first time)
bash platform/bootstrap/all.sh

# 2. Add the hostnames to /etc/hosts
echo "$(minikube ip -p shopcart) shop.local grafana.local argocd.local keycloak.local" | sudo tee -a /etc/hosts

# 3. Run the app (frontend + services, live-reload)
eval $(minikube -p shopcart docker-env)
tilt up
```

See [`docs/getting-started.md`](docs/getting-started.md) for the full walkthrough, [`docs/architecture.md`](docs/architecture.md) for design notes, and [`docs/runbook.md`](docs/runbook.md) for ops recipes.
