import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const bicep = readFileSync(resolve(root, "infra/modules/platform.bicep"), "utf8");
const provisioner = readFileSync(resolve(root, "platform/src/lib/kubernetes.ts"), "utf8");
const helm = readFileSync(resolve(root, "infra/helm/platform/templates/platform.yaml"), "utf8");
const postprovision = readFileSync(resolve(root, "infra/scripts/postprovision.sh"), "utf8");

describe("deployment security boundaries", () => {
  it("does not grant the platform identity application deployment roles", () => {
    expect(bicep).not.toContain("aksRbacWriterRole");
    expect(bicep).not.toContain("acrPushRole");
    expect(bicep).not.toContain("clusterUserRole");
  });

  it("creates one identity and namespace-scoped writer assignment per app", () => {
    expect(provisioner).toContain("id-${repositorySlug}-deploy");
    expect(provisioner).toContain("federatedIdentityCredentials/github-main");
    expect(provisioner).toContain("`${aksId}/namespaces/${namespace}`");
    expect(provisioner).toContain("ROLE.aksNamespaceWriter");
  });

  it("sources GitHub App credentials from Key Vault", () => {
    expect(helm).toContain("kind: ExternalSecret");
    expect(helm).toContain("vault.azure.net");
    expect(bicep).toContain("Microsoft.KeyVault/vaults/secrets");
    expect(postprovision).not.toContain("kubectl create secret generic hub-github-app");
  });
});
