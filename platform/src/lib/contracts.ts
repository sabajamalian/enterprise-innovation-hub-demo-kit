import { z } from "zod";

export const ideaRequestSchema = z.object({
  name: z.string().trim().min(3).max(80),
  problem: z.string().trim().min(20).max(2000),
  repositorySlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  audienceGroupIds: z.array(z.string().uuid()).min(1).max(20)
});

export type IdeaRequest = z.infer<typeof ideaRequestSchema>;

export type OperationStatus =
  | "accepted"
  | "provisioning"
  | "ready"
  | "failed"
  | "deleting"
  | "deleted";

export interface Actor {
  id: string;
  name: string;
  groups: string[];
}

export interface ProvisioningOperation {
  id: string;
  idempotencyKey: string;
  actor: Actor;
  request: IdeaRequest;
  status: OperationStatus;
  repositoryUrl?: string;
  applicationUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryProvisioning {
  organization: string;
  name: string;
  description: string;
  private: true;
  variables: Record<string, string>;
}

export interface RepositoryResult {
  repositoryUrl: string;
}
