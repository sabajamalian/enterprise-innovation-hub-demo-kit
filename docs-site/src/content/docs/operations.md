---
title: Reset and troubleshoot
description: Clean up the demo and recover common failures.
---

## Reset one application

Use the Hub administrator view to delete runtime infrastructure. The operation removes the namespace and federated deployment binding. It does not delete the source repository.

## Remove the platform

```bash
./infra/scripts/teardown.sh
azd down --purge
```

Confirm customer retention requirements before deleting logs or Key Vault.

## Failure map

| Symptom | Check |
|---|---|
| Hub returns 401 | Authentication layer and trusted identity headers |
| Hub returns 403 | Creator group object ID and group claim |
| Repository creation fails | GitHub App installation, private key, and organization policy |
| OIDC login fails | Exact repository and branch subject on the federated credential |
| Image pull fails | ACR attachment and digest reference |
| Pod rejected | Resource limits, non-root context, registry, and required labels |
| App returns 403 | Per-application audience group |
| Database unavailable | CloudNativePG cluster, secret sync, and namespace network policy |

For an offline customer meeting, use a screen recording of the same workflow and a sanitized readiness report. Keep the live repository available so the audience can inspect the contracts and controls.
