#!/usr/bin/env bash
# Brings up a minikube cluster sized for the full shopcart stack.
set -euo pipefail

PROFILE="${MINIKUBE_PROFILE:-shopcart}"
CPUS="${MINIKUBE_CPUS:-6}"
MEMORY="${MINIKUBE_MEMORY:-10240}"
DISK="${MINIKUBE_DISK:-40g}"
K8S_VERSION="${K8S_VERSION:-v1.31.0}"

minikube start \
  --profile "$PROFILE" \
  --cpus "$CPUS" \
  --memory "$MEMORY" \
  --disk-size "$DISK" \
  --kubernetes-version "$K8S_VERSION" \
  --driver=docker \
  --container-runtime=containerd

minikube addons enable ingress       -p "$PROFILE"
minikube addons enable metrics-server -p "$PROFILE"

kubectl create namespace shopcart       --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace platform       --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace observability  --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace kafka          --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace argocd         --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace argo-rollouts  --dry-run=client -o yaml | kubectl apply -f -

echo "minikube ($PROFILE) ready."
echo "Tip: add '$(minikube ip -p $PROFILE) shop.local grafana.local argocd.local keycloak.local' to /etc/hosts"
