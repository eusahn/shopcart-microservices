#!/usr/bin/env bash
# End-to-end smoke test of the running stack.
set -euo pipefail
G=http://localhost:18080
# jqp: read stdin as JSON and evaluate a Python expression on `d`.
# Uses a tempfile to dodge shell-quoting hell.
jqp() {
  local code="$1"
  python3 -c "
import json, sys
d = json.load(sys.stdin)
$code
"
}

echo "── catalog list ──────────────────────────────────────────"
PROD_JSON=$(curl -s $G/api/products)
echo "$PROD_JSON" | jqp 'print(f"  {len(d[chr(34)+chr(112)+chr(114)+chr(111)+chr(100)+chr(117)+chr(99)+chr(116)+chr(115)+chr(34)])} - shrug, use clean jq")' >/dev/null 2>&1 || true
N=$(echo "$PROD_JSON" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["products"]))')
PID=$(echo "$PROD_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["products"][1]["id"])')
SKU=$(echo "$PROD_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["products"][1]["sku"])')
echo "  $N products visible; picked sku=$SKU id=$PID"

echo
echo "── search 'mug' ──────────────────────────────────────────"
curl -s "$G/api/products/search?q=mug" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin)
print("  " + ", ".join(p["sku"] + " " + p["name"] for p in d["products"]))'

echo
echo "── add 3 to cart ─────────────────────────────────────────"
curl -s -X POST $G/api/cart/items -H "content-type: application/json" \
  -d "{\"productId\":\"$PID\",\"quantity\":3}" \
  | python3 -c 'import json,sys
d=json.load(sys.stdin); print("  subtotalCents="+str(d["subtotalCents"]),"items="+str(len(d["items"])))'

echo
echo "── place order (idempotencyKey=smoke-A) ──────────────────"
ORDER=$(curl -s -X POST $G/api/orders -H "content-type: application/json" \
  -d '{"shippingAddressId":"","idempotencyKey":"smoke-A"}')
OID=$(echo "$ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
TOTAL=$(echo "$ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["totalCents"])')
echo "  orderId=$OID totalCents=$TOTAL"

echo
echo "── re-submit same idempotencyKey ─────────────────────────"
OID2=$(curl -s -X POST $G/api/orders -H "content-type: application/json" \
  -d '{"shippingAddressId":"","idempotencyKey":"smoke-A"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
[ "$OID" = "$OID2" ] && echo "  PASS: same orderId returned" || echo "  FAIL: $OID vs $OID2"

sleep 3
echo
echo "── trace propagation (gateway → kafka → consumers) ──────"
extract_trace() {
  grep "\"orderId\":\"$OID\"" "$1" | tail -1 | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["trace_id"])'
}
T_INV=$(extract_trace /tmp/shopcart-logs/inventory-service.log)
T_PAY=$(extract_trace /tmp/shopcart-logs/payment-service.log)
T_NOT=$(extract_trace /tmp/shopcart-logs/notification-service.log)
echo "  inventory     trace_id=$T_INV"
echo "  payment       trace_id=$T_PAY"
echo "  notification  trace_id=$T_NOT"
if [ "$T_INV" = "$T_PAY" ] && [ "$T_PAY" = "$T_NOT" ] && [ -n "$T_INV" ]; then
  echo "  PASS: identical trace_id across all three async consumers"
else
  echo "  FAIL: traces diverged"
fi

echo
echo "── stock table reflects reservations ────────────────────"
docker exec microservice-inventory-pg-1 psql -U inventory inventory -tA \
  -c "SELECT product_id || ' available=' || available || ' reserved=' || reserved FROM stock WHERE reserved > 0;" \
  | sed 's/^/  /'

echo
echo "── prom metrics from gateway ────────────────────────────"
curl -s http://localhost:9100/metrics | grep -E "^process_resident_memory_bytes|^nodejs_eventloop_lag_mean" | head -2 | sed 's/^/  /'

echo
echo "── gateway /healthz round-trip ──────────────────────────"
curl -s -o /dev/null -w "  HTTP %{http_code} in %{time_total}s\n" $G/healthz
