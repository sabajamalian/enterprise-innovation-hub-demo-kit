import type { Actor, IdeaRequest, ProvisioningOperation } from "./contracts";
import type { RepositoryProvisioner } from "./github";
import type { ApplicationInfrastructureProvisioner } from "./kubernetes";
import type { OperationStore } from "./store";

export class IdeaProvisioner {
  constructor(
    private readonly store: OperationStore,
    private readonly repositories: RepositoryProvisioner,
    private readonly infrastructure: ApplicationInfrastructureProvisioner
  ) {}

  async submit(
    idempotencyKey: string,
    actor: Actor,
    request: IdeaRequest
  ): Promise<ProvisioningOperation> {
    const existing = await this.store.findByIdempotencyKey(idempotencyKey);
    if (existing && existing.status !== "failed") return existing;

    let operation = existing ?? await this.store.create(idempotencyKey, actor, request);
    operation = await this.store.update(operation.id, { status: "provisioning" });

    try {
      const organization = process.env.GITHUB_ORG;
      if (!organization) throw new Error("GITHUB_ORG is not configured.");
      const applicationHost = `${request.repositorySlug}.${process.env.APP_DOMAIN ?? "apps.example.com"}`;
      const applicationUrl = `https://${applicationHost}`;
      await this.infrastructure.create(request);
      const result = await this.repositories.create({
        organization,
        name: request.repositorySlug,
        description: request.problem.slice(0, 350),
        private: true,
        variables: {
          APP_NAME: request.repositorySlug,
          APP_URL: applicationHost,
          ENTRA_AUDIENCE_GROUP_IDS: request.audienceGroupIds.join(","),
          AZURE_TENANT_ID: process.env.AZURE_TENANT_ID ?? "",
          AZURE_SUBSCRIPTION_ID: process.env.AZURE_SUBSCRIPTION_ID ?? "",
          AZURE_CLIENT_ID: process.env.APP_DEPLOY_CLIENT_ID ?? "",
          AZURE_RESOURCE_GROUP: process.env.AZURE_RESOURCE_GROUP ?? "",
          AKS_CLUSTER_NAME: process.env.AKS_CLUSTER_NAME ?? "",
          ACR_NAME: process.env.ACR_NAME ?? ""
        }
      });
      return this.store.update(operation.id, {
        status: "ready",
        repositoryUrl: result.repositoryUrl,
        applicationUrl
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provisioning failed.";
      return this.store.update(operation.id, { status: "failed", error: message });
    }
  }
}
