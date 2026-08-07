import { describe, expect, it } from "vitest";
import { IdentityError, readIdentity } from "../src/lib/identity";

describe("application audience", () => {
  it("accepts a member of a configured group", () => {
    process.env.ENTRA_AUDIENCE_GROUP_IDS = "group-a,group-b";
    const identity = readIdentity(new Headers({
      "x-auth-request-user": "1",
      "x-auth-request-email": "alex@example.com",
      "x-auth-request-groups": "GROUP-B"
    }));
    expect(identity.id).toBe("1");
  });

  it("rejects other users", () => {
    process.env.ENTRA_AUDIENCE_GROUP_IDS = "group-a";
    expect(() => readIdentity(new Headers({
      "x-auth-request-user": "1",
      "x-auth-request-email": "alex@example.com",
      "x-auth-request-groups": "group-z"
    }))).toThrow(IdentityError);
  });
});
