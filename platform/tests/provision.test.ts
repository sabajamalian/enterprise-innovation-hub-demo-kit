import { describe, expect, it, vi } from "vitest";
import { IdeaProvisioner } from "../src/lib/provision";
import { MemoryOperationStore } from "../src/lib/store";

describe("idea provisioning", () => {
  it("is idempotent and creates one repository", async () => {
    process.env.GITHUB_ORG = "customer";
    const repositories = {
      create: vi.fn().mockResolvedValue({ repositoryUrl: "https://github.com/customer/shelf-signal" })
    };
    const infrastructure = {
      create: vi.fn().mockResolvedValue({ deployClientId: "app-client-id" })
    };
    const service = new IdeaProvisioner(new MemoryOperationStore(), repositories, infrastructure);
    const actor = { id: "1", name: "alex", groups: ["creator"] };
    const request = {
      name: "Shelf Signal",
      problem: "Track shelf label mismatches and route them to an owner.",
      repositorySlug: "shelf-signal",
      audienceGroupIds: ["00000000-0000-4000-8000-000000000001"]
    };

    const first = await service.submit("same-key", actor, request);
    const second = await service.submit("same-key", actor, request);

    expect(first.status).toBe("ready");
    expect(second.id).toBe(first.id);
    expect(repositories.create).toHaveBeenCalledTimes(1);
    expect(infrastructure.create).toHaveBeenCalledTimes(1);
    expect(repositories.create).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ AZURE_CLIENT_ID: "app-client-id" })
    }));
  });
});
