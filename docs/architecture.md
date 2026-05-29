# Architecture

## Why these pieces

The goal is to expose the patterns a working microservice org actually uses, with the smallest stack that still demonstrates them.

| Pattern | Where to see it |
|---|---|
| Sync RPC between services | api-gateway → catalog/cart/order, via Connect-RPC over HTTP/2 |
| Async event-driven side effects | order-service publishes `OrderPlaced`; inventory + payment + notification consume |
| Database per service | Each Postgres cluster is owned by exactly one service; no shared schema |
| Service mesh | Linkerd injects sidecars in `shopcart`; mTLS + retries + golden metrics |
| API gateway pattern | `api-gateway` translates REST/JSON edge requests to internal gRPC |
| OIDC at the edge | Keycloak issues tokens; gateway verifies via JWKS; downstream services trust mesh identity |
| Distributed tracing | OTel auto-instrumentation; W3C `traceparent` propagated over both HTTP and Kafka headers |
| GitOps | Argo CD watches `platform/argocd/apps/`; one Application per service |
| Progressive delivery | order-service is an Argo Rollout (canary) instead of a Deployment |
| Resilience | Chaos Mesh experiments + Linkerd retry/timeout config |
| Feature flags | flagd + OpenFeature SDK in shared `feature-flags` package |

## Request flow: place an order

```
client
  │ POST /api/orders   (Bearer JWT)
  ▼
api-gateway ──verify JWT (Keycloak JWKS)
  │ Connect-RPC (h2)
  ▼
order-service
  ├── Connect-RPC ──▶ cart-service ──▶ Redis
  ├── Postgres (BEGIN; insert order; insert items; COMMIT)
  └── Kafka.produce(orders.events, OrderPlaced)
        │
        │ headers: { traceparent, event-type }
        ▼
   inventory-service (consumer)
        ├── Postgres (reserve stock, transactional)
        └── Kafka.produce(inventory.events, InventoryReserved | InventoryOutOfStock)
              │
              ▼
        payment-service (consumer)
              ├── mock charge (5% decline)
              └── Kafka.produce(payments.events, PaymentCaptured | PaymentFailed)
                    │
                    ▼
              notification-service (consumer)
                    └── logs a "mock email"
```

Every hop is a span in the same trace. Open it in Tempo to verify.

## Why **Connect-RPC** instead of grpc-js

Same `.proto` contracts, but Connect:
- Speaks gRPC, gRPC-Web, **and** plain HTTP+JSON on the same endpoint — easier to `curl` for debugging.
- Has a much smaller runtime than `@grpc/grpc-js`.
- Native HTTP/2 — Linkerd's protocol detection treats it as h2c and adds golden metrics automatically.

## Why **CloudNativePG** instead of Helm-installed Postgres

It gives you the database-per-service pattern with declarative manifests:
- Cluster CR creates Postgres + a `*-rw` and `*-ro` Service + a `*-app` secret.
- Backups, restarts, and failover are declarative — closest to how managed Postgres works in real clouds.

## Why **Strimzi** + KRaft instead of bare Kafka

Strimzi gives you `Kafka` and `KafkaTopic` CRs so topics are GitOps-able. KRaft mode means no Zookeeper, so the footprint is small enough for minikube.

## Why **Argo Rollouts** only on `order-service`

To show the canary pattern without making every Helm release a 5-minute affair. The rest are plain Deployments — fast and obvious. Compare the two in the chart and decide for yourself which fits which service.

## Trade-offs we picked

| Choice | Trade-off |
|---|---|
| Connect-RPC | Slightly less ecosystem than vanilla gRPC. Acceptable. |
| Linkerd over Istio | Less powerful (no advanced traffic policy), much simpler. Right for learning. |
| Mocked payment + notifications | Not realistic, but keeps the focus on orchestration. |
| Resource owner password grant in the demo | Insecure but easy. Real apps use Authorization Code + PKCE. |
| No backup configured on CNPG | Out of scope for minikube. Real clusters need S3-targeted Barman backups. |
