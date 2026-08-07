# Repository instructions

Build only the application described by the approved plan. Keep the platform trust boundaries intact.

- Use Next.js App Router, strict TypeScript, Prisma, and Postgres.
- Read identity only through `src/lib/identity.ts`. Do not create a login page or accept identity from request bodies.
- Validate every external payload with Zod.
- Keep database changes in Prisma migrations.
- Preserve `/api/health` and `/api/ready`.
- Do not edit the deployment workflow, Docker runtime user, or audience enforcement unless the task explicitly comes from a platform administrator.
- Run `npm run typecheck`, `npm test`, and `npm run build` before delivery.
- Do not add Azure credentials, kubeconfig, GitHub tokens, tenant data, or customer data.
