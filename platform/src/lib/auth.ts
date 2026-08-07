import type { Actor } from "./contracts";

const HEADER_ID = "x-auth-request-user";
const HEADER_NAME = "x-auth-request-email";
const HEADER_GROUPS = "x-auth-request-groups";

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}

export function actorFromHeaders(headers: Headers): Actor {
  const id = headers.get(HEADER_ID);
  const name = headers.get(HEADER_NAME);
  if (!id || !name) {
    throw new AuthenticationError("A trusted Entra identity header is required.");
  }

  const groups = (headers.get(HEADER_GROUPS) ?? "")
    .split(",")
    .map((group) => group.trim().toLowerCase())
    .filter(Boolean);

  return { id, name, groups };
}

export function requireGroup(actor: Actor, groupId: string | undefined): void {
  if (!groupId) {
    throw new Error("ENTRA_CREATOR_GROUP_ID is not configured.");
  }
  if (!actor.groups.includes(groupId.toLowerCase())) {
    throw new AuthorizationError("Creator group membership is required.");
  }
}
