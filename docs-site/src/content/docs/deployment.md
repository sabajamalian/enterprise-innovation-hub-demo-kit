---
title: Deploy with azd
description: Provision Azure, configure the cluster, and capture readiness evidence.
---

```bash
azd auth login
az login
azd env new customer-innovation-hub
azd env set AZURE_LOCATION eastus2
azd up
```

The Bicep deployment creates the network, AKS cluster, ACR, Key Vault, monitoring workspace, and platform identity. The post-provision hook obtains cluster credentials, installs ingress and policy components, applies namespace governance, and deploys the Hub.

Run the evidence check again before the customer meeting:

```bash
./infra/scripts/readiness.sh
```

Keep the command output with the demo notes. Do not publish tenant IDs, subscription IDs, hostnames, or installation IDs.
