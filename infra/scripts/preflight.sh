#!/usr/bin/env sh
set -eu

required_commands="az azd docker kubectl helm"
for command in $required_commands; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

required_variables="AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID GITHUB_ORG GITHUB_APP_ID GITHUB_APP_INSTALLATION_ID GITHUB_APP_PRIVATE_KEY ENTRA_CREATOR_GROUP_ID ENTRA_ADMIN_GROUP_ID ENTRA_APP_CLIENT_ID ENTRA_APP_CLIENT_SECRET HUB_DOMAIN APP_DOMAIN TLS_CONTACT_EMAIL"
for variable in $required_variables; do
  eval "value=\${$variable:-}"
  test -n "$value" || {
    echo "Missing required environment variable: $variable" >&2
    exit 1
  }
done

az account show --output none
case "$AZURE_TENANT_ID:$ENTRA_CREATOR_GROUP_ID:$ENTRA_ADMIN_GROUP_ID" in
  *00000000-0000-0000-0000-000000000000*)
    echo "Replace example UUIDs before deployment." >&2
    exit 1
    ;;
esac

echo "Preflight passed: toolchain, Azure session, Entra groups, and GitHub App inputs are present."
