import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ideaRequestSchema } from "../src/lib/contracts";
import {
  ACR_REPOSITORY_WRITER_ROLE_ID,
  repositoryWriterCondition
} from "../src/lib/kubernetes";

describe("ACR repository isolation", () => {
  it("creates a distinct exact-match condition for each application", () => {
    const shelf = repositoryWriterCondition("shelf-signal");
    const returns = repositoryWriterCondition("returns-desk");

    expect(shelf).toContain("StringEqualsIgnoreCase 'shelf-signal'");
    expect(returns).toContain("StringEqualsIgnoreCase 'returns-desk'");
    expect(shelf).not.toBe(returns);
    expect(shelf).not.toContain("*");
    expect(ACR_REPOSITORY_WRITER_ROLE_ID).toBe(
      "2a1e307c-b015-4ebd-883e-5b7698a07328"
    );
    for (const action of ["content/read", "metadata/read", "content/write", "metadata/write"]) {
      expect(shelf).toContain(`repositories/${action}`);
    }
  });

  it("rejects a request that attempts to select another repository path", () => {
    for (const repository of [
      "shelf-signal/other-app",
      "shelf-*",
      "Shelf-Signal",
      "../other-app"
    ]) {
      expect(() => repositoryWriterCondition(repository)).toThrow(
        "governed application slug"
      );
    }
    expect(ideaRequestSchema.safeParse({
      name: "Shelf Signal",
      problem: "Track shelf label mismatches and route them to an owner.",
      repositorySlug: "shelf-signal/other-app",
      audienceGroupIds: ["00000000-0000-4000-8000-000000000001"]
    }).success).toBe(false);
  });

  it("publishes only to the governed app repository path", () => {
    const workflow = readFileSync(
      new URL("../../.github/workflows/reusable-app-deploy.yml", import.meta.url),
      "utf8"
    );

    expect(workflow).toContain(
      'IMAGE="$ACR_NAME.azurecr.io/$APP_NAME:${{ github.sha }}"'
    );
    expect(workflow).toContain('[[ "$APP_NAME" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]');
    expect(workflow).not.toContain("az acr login");
  });
});
