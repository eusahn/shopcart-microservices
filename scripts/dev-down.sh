#!/usr/bin/env bash
# Stop everything that dev-up.sh started.
set -uo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"

echo "stopping services…"
pkill -f "services/.*/dist/index.js" 2>/dev/null || true

echo "stopping frontend…"
if [ -f /tmp/shopcart-logs/frontend.pid ]; then
  kill "$(cat /tmp/shopcart-logs/frontend.pid)" 2>/dev/null || true
fi
pkill -f "vite" 2>/dev/null || true

echo "stopping data plane…"
docker compose -f "$HERE/docker-compose.dev.yaml" down

echo "done."
