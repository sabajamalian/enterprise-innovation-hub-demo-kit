import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const policy = readFileSync(resolve(process.cwd(), "../infra/policies/cluster-policy.yaml"), "utf8");
const boundary = readFileSync(resolve(process.cwd(), "../infra/policies/app-boundary.yaml"), "utf8");

describe("application governance policy", () => {
  it("denies unapproved registries and requires non-root resource limits", () => {
    expect(policy).toContain("validationFailureAction: Enforce");
    expect(policy).toContain("runAsNonRoot: true");
    expect(policy).toContain("allowPrivilegeEscalation: false");
    expect(policy).toContain("requests:");
    expect(policy).toContain("limits:");
    expect(policy).toContain("*.azurecr.io/*@sha256:*");
  });

  it("prevents public load balancers and starts from default deny", () => {
    expect(boundary).toContain("kind: NetworkPolicy");
    expect(boundary).toContain("policyTypes: [Ingress, Egress]");
    expect(boundary).toContain("services.loadbalancers: \"0\"");
  });
});
