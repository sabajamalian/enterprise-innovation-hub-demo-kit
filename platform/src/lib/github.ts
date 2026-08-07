import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { RepositoryProvisioning, RepositoryResult } from "./contracts";

export interface RepositoryProvisioner {
  create(input: RepositoryProvisioning): Promise<RepositoryResult>;
}

export class GitHubAppRepositoryProvisioner implements RepositoryProvisioner {
  async create(input: RepositoryProvisioning): Promise<RepositoryResult> {
    const appId = process.env.GITHUB_APP_ID;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replaceAll("\\n", "\n");
    if (!appId || !installationId || !privateKey) {
      throw new Error("GitHub App credentials are incomplete.");
    }

    const auth = createAppAuth({ appId, privateKey, installationId });
    const installation = await auth({ type: "installation" });
    const octokit = new Octokit({ auth: installation.token });
    const templateOwner = process.env.GITHUB_TEMPLATE_OWNER ?? "sabajamalian";
    const templateRepo = process.env.GITHUB_TEMPLATE_REPO ?? "enterprise-innovation-hub-demo-kit";

    let repositoryUrl: string;
    try {
      const response = await octokit.repos.createInOrg({
        org: input.organization,
        name: input.name,
        description: input.description,
        private: true,
        auto_init: false
      });
      repositoryUrl = response.data.html_url;
    } catch (error) {
      if (!(error instanceof Error) || !("status" in error) || error.status !== 422) throw error;
      const existing = await octokit.repos.get({
        owner: input.organization,
        repo: input.name
      });
      repositoryUrl = existing.data.html_url;
    }

    await copyTemplateDirectory(
      new Octokit(),
      octokit,
      templateOwner,
      templateRepo,
      "templates/nextjs-postgres",
      input.organization,
      input.name
    );

    for (const [name, value] of Object.entries(input.variables)) {
      await octokit.actions.createRepoVariable({
        owner: input.organization,
        repo: input.name,
        name,
        value
      });
    }

    return { repositoryUrl };
  }
}

async function copyTemplateDirectory(
  source: Octokit,
  destination: Octokit,
  sourceOwner: string,
  sourceRepo: string,
  sourcePath: string,
  destinationOwner: string,
  destinationRepo: string
): Promise<void> {
  const listing = await source.repos.getContent({
    owner: sourceOwner,
    repo: sourceRepo,
    path: sourcePath
  });
  if (!Array.isArray(listing.data)) {
    throw new Error(`Template path ${sourcePath} is not a directory.`);
  }

  for (const item of listing.data) {
    if (item.type === "dir") {
      await copyTemplateDirectory(
        source,
        destination,
        sourceOwner,
        sourceRepo,
        item.path,
        destinationOwner,
        destinationRepo
      );
      continue;
    }
    if (item.type !== "file") continue;

    const file = await source.repos.getContent({
      owner: sourceOwner,
      repo: sourceRepo,
      path: item.path
    });
    if (Array.isArray(file.data) || file.data.type !== "file" || !("content" in file.data)) {
      throw new Error(`Unable to read template file ${item.path}.`);
    }
    const destinationPath = item.path.slice(`${sourcePath.split("/").slice(0, 2).join("/")}/`.length);
    let sha: string | undefined;
    try {
      const existing = await destination.repos.getContent({
        owner: destinationOwner,
        repo: destinationRepo,
        path: destinationPath
      });
      if (!Array.isArray(existing.data) && existing.data.type === "file") sha = existing.data.sha;
    } catch (error) {
      if (!(error instanceof Error) || !("status" in error) || error.status !== 404) throw error;
    }
    await destination.repos.createOrUpdateFileContents({
      owner: destinationOwner,
      repo: destinationRepo,
      path: destinationPath,
      message: `Initialize ${destinationPath}`,
      content: file.data.content.replaceAll("\n", ""),
      sha
    });
  }
}
