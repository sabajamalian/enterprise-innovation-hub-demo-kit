# Trusted identity headers

Use `readIdentity` from `src/lib/identity.ts` at every authenticated server boundary. Identity comes from the platform proxy, never a form field, cookie created by application code, or client-supplied JSON. Test allowed and denied audience groups.
