import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { pinReusableWorkflow } from "../src/lib/github";

describe("reusable workflow publication", () => {
  it("pins generated callers to the resolved template commit", () => {
    const sha = "a".repeat(40);
    const source = Buffer.from(
      "uses: customer-organization/enterprise-innovation-hub-demo-kit/.github/workflows/reusable-app-deploy.yml@main"
    ).toString("base64");

    const result = Buffer.from(
      pinReusableWorkflow(source, sha, "customer/demo-kit"),
      "base64"
    ).toString("utf8");

    expect(result).toContain(`customer/demo-kit/.github/workflows/reusable-app-deploy.yml@${sha}`);
    expect(result).not.toContain("reusable-app-deploy.yml@main");
  });
});
