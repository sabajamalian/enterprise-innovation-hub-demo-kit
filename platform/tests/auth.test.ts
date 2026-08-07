import { describe, expect, it } from "vitest";
import { actorFromHeaders, AuthorizationError, requireGroup } from "../src/lib/auth";

describe("trusted identity headers", () => {
  it("parses the Entra actor and normalizes groups", () => {
    const actor = actorFromHeaders(new Headers({
      "x-auth-request-user": "user-1",
      "x-auth-request-email": "alex@example.com",
      "x-auth-request-groups": "GROUP-A, group-b"
    }));
    expect(actor.groups).toEqual(["group-a", "group-b"]);
    expect(() => requireGroup(actor, "GROUP-A")).not.toThrow();
  });

  it("rejects an actor outside the creator group", () => {
    const actor = { id: "1", name: "alex", groups: ["other"] };
    expect(() => requireGroup(actor, "creator")).toThrow(AuthorizationError);
  });
});
