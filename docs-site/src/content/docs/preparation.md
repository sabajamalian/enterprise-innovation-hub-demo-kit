---
title: Prepare the customer
description: Customer-owned prerequisites and preflight evidence.
---

## Required access

- An Azure Commercial subscription where the SSE can create a resource group, managed identities, federated credentials, AKS, ACR, Key Vault, DNS resources, and role assignments.
- A customer GitHub organization where an administrator can install a GitHub App.
- Customer Entra creator and administrator groups.
- A DNS zone or delegated subdomain for Hub and application ingress.

## GitHub App

Create a GitHub App owned by the customer organization. Disable webhooks for the MVP. Grant:

| Permission | Access | Reason |
|---|---:|---|
| Administration | Read and write | Create repositories from the template and configure variables |
| Actions | Read and write | Configure repository Actions settings |
| Contents | Read and write | Generate repository content from the template |
| Metadata | Read | Resolve installation and repository metadata |
| Workflows | Read and write | Install the governed deployment caller |

Fork the demo-kit repository into the customer organization, then install the app for all repositories in the dedicated demo organization. That scope lets the installation token read the customer-owned template, create a repository, and configure the repository it just created. Record the App ID and Installation ID. Put the private key in the deployment environment, then let `azd up` store it in Key Vault.

## Entra contract

Provide object IDs for `ENTRA_CREATOR_GROUP_ID` and `ENTRA_ADMIN_GROUP_ID`. Application audience group IDs are collected per idea. Group claims must reach the authentication layer. For tenants with group overage, replace direct claims with a server-side Microsoft Graph membership check before production use.

Register an Entra web application for oauth2-proxy. Add callback URIs for the Hub and each rehearsed application hostname using `/oauth2/callback`. Provide its client ID and secret through `ENTRA_APP_CLIENT_ID` and `ENTRA_APP_CLIENT_SECRET`.

## Run preflight

```bash
cp .env.example .env
./infra/scripts/preflight.sh
```

The command fails on missing tools, invalid identifiers, an inaccessible subscription, or missing GitHub App configuration.
