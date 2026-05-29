#!/usr/bin/env bash
# Boots the whole stack against the docker-compose dev data plane.
# Each service writes its logs to /tmp/shopcart-logs/<svc>.log
set -uo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
LOG=/tmp/shopcart-logs
rm -rf "$LOG" && mkdir -p "$LOG"

# kill any leftover from a previous run
pkill -f "shopcart/dist/index.js" 2>/dev/null
pkill -f "services/.*/dist/index.js" 2>/dev/null
sleep 1

run() {
  local svc=$1; shift
  ( cd "$HERE/services/$svc" && \
    env "$@" KAFKAJS_NO_PARTITIONER_WARNING=1 \
    node --enable-source-maps dist/index.js > "$LOG/$svc.log" 2>&1 ) &
  echo "$!" > "$LOG/$svc.pid"
  echo "  $svc pid=$(cat $LOG/$svc.pid)"
}

OTEL=http://localhost:14318  # unused locally — disable trace export error noise
echo "starting services…"

run catalog-service \
  SERVICE_NAME=catalog-service GRPC_PORT=50001 METRICS_PORT=9101 \
  DATABASE_URL=postgresql://catalog:catalog@localhost:55432/catalog \
  OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL

run cart-service \
  SERVICE_NAME=cart-service GRPC_PORT=50002 METRICS_PORT=9102 \
  REDIS_URL=redis://localhost:56379/0 \
  CATALOG_SERVICE_URL=http://localhost:50001 \
  OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL

run order-service \
  SERVICE_NAME=order-service GRPC_PORT=50004 METRICS_PORT=9104 \
  DATABASE_URL=postgresql://orderdb:orderdb@localhost:55433/orderdb \
  CART_SERVICE_URL=http://localhost:50002 \
  CATALOG_SERVICE_URL=http://localhost:50001 \
  KAFKA_BROKERS=localhost:59092 \
  OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL

run inventory-service \
  SERVICE_NAME=inventory-service GRPC_PORT=50006 METRICS_PORT=9106 \
  DATABASE_URL=postgresql://inventory:inventory@localhost:55434/inventory \
  KAFKA_BROKERS=localhost:59092 \
  OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL

run payment-service \
  SERVICE_NAME=payment-service GRPC_PORT=50005 METRICS_PORT=9105 \
  KAFKA_BROKERS=localhost:59092 \
  FAILURE_RATE=0 \
  OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL

run notification-service \
  SERVICE_NAME=notification-service METRICS_PORT=9107 \
  KAFKA_BROKERS=localhost:59092 \
  OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL

run api-gateway \
  SERVICE_NAME=api-gateway HTTP_PORT=18080 METRICS_PORT=9100 \
  CATALOG_SERVICE_URL=http://localhost:50001 \
  CART_SERVICE_URL=http://localhost:50002 \
  USER_SERVICE_URL=http://localhost:50003 \
  ORDER_SERVICE_URL=http://localhost:50004 \
  PAYMENT_SERVICE_URL=http://localhost:50005 \
  KEYCLOAK_ISSUER=http://localhost:8181/realms/shopcart \
  AUTH_DISABLED=true \
  OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL

echo "logs: $LOG"
