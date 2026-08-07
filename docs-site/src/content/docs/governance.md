---
title: Governance controls
description: Controls visible in the demo and production tradeoffs.
---

| Boundary | Enforced by |
|---|---|
| Idea creation | Entra creator group |
| Administrative deletion | Entra administrator group |
| Repository privilege | Customer-installed GitHub App |
| Deployment identity | Exact GitHub OIDC subject for `main` |
| Runtime isolation | Namespace, service account, quota, limits, network policy |
| Image source | ACR allowlist policy |
| Secret delivery | Key Vault and workload identity |
| Database | Per-application CloudNativePG cluster and credentials |
| Audit | Hub operation log, GitHub audit log, Azure Monitor |

The MVP uses trusted identity headers from a shared authentication layer. Production deployments should validate the proxy boundary, handle Entra group overage, define emergency access, configure backups and restore tests, and connect alerts to the customer's incident process.

AKS makes controls visible and programmable, but it adds operational work. Use a managed application platform when a customer doesn't need Kubernetes-level policy or workload portability.
