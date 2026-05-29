#!/usr/bin/env bash
# Installs Linkerd CRDs, control plane, and viz extension.
set -euo pipefail

if ! command -v linkerd >/dev/null 2>&1; then
  echo "linkerd CLI not found. Install: curl --proto '=https' --tlsv1.2 -sSfL https://run.linkerd.io/install | sh"
  exit 1
fi

linkerd check --pre

linkerd install --crds | kubectl apply -f -
linkerd install        | kubectl apply -f -
linkerd check

linkerd viz install | kubectl apply -f -
linkerd viz check

# Auto-inject the shopcart namespace so we get mTLS + golden metrics for free.
kubectl annotate namespace shopcart linkerd.io/inject=enabled --overwrite

echo "linkerd installed. Dashboard: linkerd viz dashboard &"
