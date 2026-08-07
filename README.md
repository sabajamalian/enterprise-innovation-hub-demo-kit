# Enterprise Innovation Hub Demo Kit

Turn an employee idea into a governed application repository and an isolated AKS workload. The Hub handles intake, authorization, repository creation, and platform provisioning. Builders do the product work in GitHub Copilot CLI, Copilot Desktop, or VS Code agent mode, where the delivery instructions live beside the code.

The kit demonstrates agentic engineering across the full software delivery system: idea intake, planning, implementation, review, testing, deployment, identity, policy, and operations.

## What ships

- An Entra-protected Hub with a short idea form and no embedded chat interface.
- A GitHub App integration that creates private repositories from a governed template.
- A Next.js, TypeScript, Prisma, and Postgres application template.
- Repository-local Copilot instructions, custom agents, and reusable skills.
- AKS, ACR, Key Vault, workload identity, monitoring, and governance policy through Bicep.
- A reusable GitHub Actions deployment workflow that uses Azure OIDC and image digests.
- An Astro Starlight field guide for preparation, delivery, reset, and troubleshooting.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

The Hub trusts identity headers set by the in-cluster oauth2-proxy authentication layer:

- `x-auth-request-user`
- `x-auth-request-email`
- `x-auth-request-groups`

For local development, send those headers through a reverse proxy or use the API contract tests. In AKS, only ingress can reach the Hub service, and ingress replaces the headers with oauth2-proxy results. The server rejects missing identity headers and users outside `ENTRA_CREATOR_GROUP_ID`.

## Deploy the platform

1. Install Azure Developer CLI, Azure CLI, Docker, `kubectl`, and Helm.
2. Register and install a GitHub App with the permissions documented in the [field guide](https://sabajamalian.github.io/enterprise-innovation-hub-demo-kit/).
3. Copy `.env.example`, fill in customer-owned identifiers, and run:

```bash
azd auth login
azd env new
azd up
```

`azd up` runs a fail-fast preflight, deploys Azure resources, configures AKS add-ons, applies governance policy, deploys the Hub, and prints readiness evidence.

## Trust boundaries

The browser never receives GitHub App credentials or Azure credentials. The Hub records an idempotent provisioning operation. Its server-side provisioner creates the repository and the application namespace. Generated repositories can deploy only through the centrally controlled reusable workflow, using an exact OIDC subject for `main`.

See `docs-site/src/content/docs/architecture.md` for the full system and `platform/src/lib/contracts.ts` for the public provisioning contract.

## Development

```bash
npm run typecheck
npm test
npm run build
```

Security reports should follow [SECURITY.md](SECURITY.md). This project is a demonstration kit. Review the production-hardening guidance before adapting it to a production platform.
