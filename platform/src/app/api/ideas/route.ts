import { NextResponse } from "next/server";
import { actorFromHeaders, AuthenticationError, AuthorizationError, requireGroup } from "@/lib/auth";
import { ideaRequestSchema } from "@/lib/contracts";
import { GitHubAppRepositoryProvisioner } from "@/lib/github";
import { KubernetesApplicationProvisioner } from "@/lib/kubernetes";
import { IdeaProvisioner } from "@/lib/provision";
import { getOperationStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const actor = actorFromHeaders(request.headers);
    requireGroup(actor, process.env.ENTRA_CREATOR_GROUP_ID);
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 });
    }
    const parsed = ideaRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Idea request is invalid.", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const service = new IdeaProvisioner(
      await getOperationStore(),
      new GitHubAppRepositoryProvisioner(),
      new KubernetesApplicationProvisioner()
    );
    const operation = await service.submit(idempotencyKey, actor, parsed.data);
    return NextResponse.json(operation, { status: operation.status === "failed" ? 502 : 202 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
