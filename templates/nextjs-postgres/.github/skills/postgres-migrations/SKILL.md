# Postgres migrations

Change `prisma/schema.prisma`, generate a named migration, and review the SQL. Prefer additive changes. Include a rollback or forward-fix note for destructive operations. The deployment workflow runs committed migrations before rollout.
