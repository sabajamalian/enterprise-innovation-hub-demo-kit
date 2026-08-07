#!/usr/bin/env sh
set -eu

: "${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP is required}"
: "${AKS_CLUSTER_NAME:?AKS_CLUSTER_NAME is required}"

az aks get-credentials \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AKS_CLUSTER_NAME" \
  --overwrite-existing

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo add external-secrets https://charts.external-secrets.io
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo add oauth2-proxy https://oauth2-proxy.github.io/manifests
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace --wait
helm upgrade --install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set crds.enabled=true --wait
helm upgrade --install kyverno kyverno/kyverno --namespace kyverno --create-namespace --wait
helm upgrade --install external-secrets external-secrets/external-secrets --namespace external-secrets --create-namespace --wait
helm upgrade --install cnpg cnpg/cloudnative-pg --namespace cnpg-system --create-namespace --wait
cookie_secret=$(openssl rand -base64 32 | tr -- '+/' '-_')
helm upgrade --install oauth2-proxy oauth2-proxy/oauth2-proxy \
  --namespace oauth2-proxy --create-namespace \
  --set config.clientID="$ENTRA_APP_CLIENT_ID" \
  --set config.clientSecret="$ENTRA_APP_CLIENT_SECRET" \
  --set config.cookieSecret="$cookie_secret" \
  --set extraArgs.provider=oidc \
  --set extraArgs.oidc-issuer-url="https://login.microsoftonline.com/$AZURE_TENANT_ID/v2.0" \
  --set extraArgs.oidc-groups-claim=groups \
  --set extraArgs.reverse-proxy=true \
  --set extraArgs.set-xauthrequest=true \
  --set extraArgs.skip-provider-button=true \
  --wait
kubectl apply -f infra/policies/cluster-policy.yaml

az acr login --name "$ACR_NAME"
image="$ACR_NAME.azurecr.io/innovation-hub:$AZURE_ENV_NAME"
docker build --file platform/Dockerfile --tag "$image" .
docker push "$image"
digest=$(docker inspect --format='{{index .RepoDigests 0}}' "$image" | cut -d@ -f2)

kubectl create namespace innovation-hub-system --dry-run=client -o yaml | kubectl apply -f -
kubectl -n innovation-hub-system create secret generic hub-github-app \
  --from-literal=app-id="$GITHUB_APP_ID" \
  --from-literal=installation-id="$GITHUB_APP_INSTALLATION_ID" \
  --from-literal=private-key="$GITHUB_APP_PRIVATE_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install innovation-hub infra/helm/platform \
  --namespace innovation-hub-system \
  --set image.repository="$ACR_NAME.azurecr.io/innovation-hub" \
  --set image.digest="$digest" \
  --set creatorGroupId="$ENTRA_CREATOR_GROUP_ID" \
  --set adminGroupId="$ENTRA_ADMIN_GROUP_ID" \
  --set githubOrganization="$GITHUB_ORG" \
  --set workloadIdentityClientId="$APP_DEPLOY_CLIENT_ID" \
  --set deployIdentityResourceId="$APP_DEPLOY_IDENTITY_RESOURCE_ID" \
  --set azureTenantId="$AZURE_TENANT_ID" \
  --set azureSubscriptionId="$AZURE_SUBSCRIPTION_ID" \
  --set azureResourceGroup="$AZURE_RESOURCE_GROUP" \
  --set aksClusterName="$AKS_CLUSTER_NAME" \
  --set acrName="$ACR_NAME" \
  --set domain="$HUB_DOMAIN" \
  --set appDomain="$APP_DOMAIN" \
  --set tlsContactEmail="$TLS_CONTACT_EMAIL" \
  --wait

./infra/scripts/readiness.sh
