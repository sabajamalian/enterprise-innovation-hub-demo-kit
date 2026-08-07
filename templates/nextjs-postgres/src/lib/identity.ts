export interface Identity {
  id: string;
  name: string;
  groups: string[];
}

export class IdentityError extends Error {}

export function readIdentity(headers: Headers): Identity {
  const id = headers.get("x-auth-request-user");
  const name = headers.get("x-auth-request-email");
  if (!id || !name) throw new IdentityError("Authentication is required.");
  const groups = (headers.get("x-auth-request-groups") ?? "")
    .split(",")
    .map((group) => group.trim().toLowerCase())
    .filter(Boolean);
  const allowed = (process.env.ENTRA_AUDIENCE_GROUP_IDS ?? "")
    .split(",")
    .map((group) => group.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) throw new Error("ENTRA_AUDIENCE_GROUP_IDS is not configured.");
  if (!groups.some((group) => allowed.includes(group))) {
    throw new IdentityError("This application is restricted to its configured audience.");
  }
  return { id, name, groups };
}
