#!/usr/bin/env bash
# One-shot local dev:
#   1. docker compose up the data plane (Postgres x3, Redis, Kafka)
#   2. pre-create Kafka topics
#   3. build the Node services
#   4. boot all 7 services
#   5. start the Vite frontend
# Then open http://localhost:5173 (or whatever Vite picks).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

echo "── data plane ─────────────────────────────────────"
docker compose -f docker-compose.dev.yaml up -d
echo "  waiting for kafka…"
for _ in $(seq 1 30); do
  docker exec microservice-kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list >/dev/null 2>&1 && break
  sleep 1
done
for t in orders.events inventory.events payments.events notifications.events; do
  docker exec microservice-kafka-1 /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server kafka:9092 --create --if-not-exists --topic "$t" \
    --partitions 1 --replication-factor 1 >/dev/null 2>&1
done
echo "  topics ready"
echo "  waiting for keycloak…"
for _ in $(seq 1 60); do
  curl -sf http://localhost:8181/realms/shopcart/.well-known/openid-configuration >/dev/null 2>&1 && break
  sleep 2
done
echo "  keycloak ready (admin/admin at http://localhost:8181, realm: shopcart, demo/demo)"

echo
echo "── build services ─────────────────────────────────"
pnpm build > /tmp/shopcart-logs-build.log 2>&1 && echo "  ok" || { tail -20 /tmp/shopcart-logs-build.log; exit 1; }

echo
echo "── boot 7 services ────────────────────────────────"
bash "$HERE/scripts/run-stack.sh"
echo "  waiting for gateway…"
for _ in $(seq 1 15); do
  curl -sf http://localhost:18080/healthz >/dev/null 2>&1 && break
  sleep 1
done

echo
echo "── start frontend ─────────────────────────────────"
( cd "$HERE/frontend" && pnpm dev > /tmp/shopcart-logs/frontend.log 2>&1 ) &
echo $! > /tmp/shopcart-logs/frontend.pid
sleep 3
PORT=$(grep -oE "localhost:[0-9]+" /tmp/shopcart-logs/frontend.log | tail -1 | cut -d: -f2)
PORT=${PORT:-5173}

cat <<EOF

✅ ShopCart is up.

   Frontend:   http://localhost:${PORT}
   Gateway:    http://localhost:18080      (REST API)
   Logs:       /tmp/shopcart-logs/*.log

   Tail everything:
     tail -f /tmp/shopcart-logs/*.log

   Tear down:
     bash scripts/dev-down.sh
EOF
