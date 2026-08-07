#!/usr/bin/env sh
set -eu

failures=0
check() {
  label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf '[pass] %s\n' "$label"
  else
    printf '[fail] %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

check "AKS API reachable" kubectl version
check "ingress controller ready" kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=10s
check "cert-manager ready" kubectl -n cert-manager rollout status deployment/cert-manager --timeout=10s
check "Kyverno ready" kubectl -n kyverno rollout status deployment/kyverno-admission-controller --timeout=10s
check "External Secrets ready" kubectl -n external-secrets rollout status deployment/external-secrets --timeout=10s
check "CloudNativePG ready" kubectl -n cnpg-system rollout status deployment/cnpg-cloudnative-pg --timeout=10s
check "Hub ready" kubectl -n innovation-hub-system rollout status deployment/hub --timeout=30s

test "$failures" -eq 0 || {
  echo "Readiness failed with $failures incomplete checks." >&2
  exit 1
}
echo "Platform readiness checks passed."
