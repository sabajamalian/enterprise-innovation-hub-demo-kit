# Generated innovation application

This repository starts with Next.js, TypeScript, Prisma, and Postgres. The platform authentication layer supplies trusted Entra identity headers. The application checks `ENTRA_AUDIENCE_GROUP_IDS` before reading or writing data.

## Work with Copilot

- **Copilot CLI:** open this directory and run `copilot`. Ask it to use `.github/agents/idea-framer.agent.md`.
- **Copilot Desktop:** add this repository as a workspace, then select the checked-in agent files in order.
- **VS Code:** open the repository, start Agent mode in Copilot Chat, and reference the matching agent with `#file`.

Use the same sequence in every client: idea framer, solution architect, app builder, test and review, then demo coach. Approve the plan before implementation. Do not change `.github/workflows/deploy.yml`, identity middleware, or platform manifests from an application-building task.

## Local development

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

## Delivery

A push to `main` calls the platform-owned reusable workflow. Azure authentication uses GitHub OIDC. Repository variables identify the customer-owned ACR, AKS cluster, resource group, application name, URL, and audience groups.
