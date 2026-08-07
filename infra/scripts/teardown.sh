#!/usr/bin/env sh
set -eu

kubectl get namespaces -o name \
  | sed -n 's#namespace/app-#app-#p' \
  | while read -r namespace; do
      kubectl delete namespace "$namespace" --wait=true
    done

echo "Application namespaces removed. Source repositories were preserved."
