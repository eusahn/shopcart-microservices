# Runbook

Small recipes for the things you'll do over and over.

## Re-generate proto code

```bash
pnpm proto:gen
```

## Tail logs from a service across pods

```bash
kubectl -n shopcart logs -l app.kubernetes.io/name=order-service -f --tail=100
```

## Open a psql to a per-service database

```bash
SVC=catalog
kubectl -n shopcart exec -it ${SVC}-pg-1 -- psql -U ${SVC} ${SVC}
```

## Inspect a Kafka topic from inside the cluster

```bash
kubectl -n kafka run kafka-cli --rm -ti --restart=Never \
  --image=quay.io/strimzi/kafka:0.43.0-kafka-3.8.0 -- \
  bin/kafka-console-consumer.sh \
  --bootstrap-server kafka-kafka-bootstrap:9092 \
  --topic orders.events --from-beginning --property print.headers=true
```

## Force an Argo CD sync (skip the auto loop)

```bash
argocd app sync order-service --grpc-web
```

## Promote / abort an in-flight canary

```bash
kubectl argo rollouts -n shopcart promote order-service
kubectl argo rollouts -n shopcart abort   order-service
kubectl argo rollouts -n shopcart status  order-service --watch
```

## Trigger a chaos experiment

```bash
kubectl apply -f platform/chaos/network-delay-cart.yaml
# ... watch Grafana
kubectl delete -f platform/chaos/network-delay-cart.yaml
```

## Toggle a feature flag

Edit `platform/bootstrap/02-operators.sh`'s `flagd-config` ConfigMap (or apply it directly):

```bash
kubectl -n platform edit configmap flagd-config
```

flagd reloads in seconds; the SDK in each service picks up the new value on the next evaluation.

## "Why is my service crashlooping?"

```bash
kubectl -n shopcart describe pod -l app.kubernetes.io/name=<svc>
kubectl -n shopcart logs <pod> -c <container> --previous
```

Common culprits:
- DATABASE_URL secret missing — check `kubectl -n shopcart get secret <svc>-db`
- Kafka not ready yet — `kubectl -n kafka get kafka kafka` should show `Ready: True`
- Linkerd sidecar still initializing — wait 20s, or check `config.linkerd.io/proxy-await`

## Wipe and start over

```bash
minikube delete -p shopcart
bash platform/bootstrap/all.sh
```
