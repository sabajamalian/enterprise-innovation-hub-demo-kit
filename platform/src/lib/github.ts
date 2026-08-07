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
    const templateOwner = process.env.GITHUB_TEMPLATE_OWNER ?? input.organization;
    const templateRepo = process.env.GITHUB_TEMPLATE_REPO ?? "enterprise-innovation-hub-demo-kit";
    const template = await resolveTemplateSource(octokit, templateOwner, templateRepo);

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
      octokit,
      templateOwner,
      templateRepo,
      template.sha,
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
  octokit: Octokit,
  sourceOwner: string,
  sourceRepo: string,
  sourceSha: string,
  sourcePath: string,
  destinationOwner: string,
  destinationRepo: string
): Promise<void> {
  let listing;
  try {
    listing = await octokit.repos.getContent({
      owner: sourceOwner,
      repo: sourceRepo,
      path: sourcePath,
      ref: sourceSha
    });
  } catch (error) {
    if (hasStatus(error, 403) || hasStatus(error, 404)) {
      throw new Error(
        `The GitHub App installation cannot read ${sourceOwner}/${sourceRepo}/${sourcePath}. ` +
        "Install the app on the customer-owned demo-kit repository."
      );
    }
    throw error;
  }
  if (!Array.isArray(listing.data)) {
    throw new Error(`Template path ${sourcePath} is not a directory.`);
  }

  for (const item of listing.data) {
    if (item.type === "dir") {
      await copyTemplateDirectory(
        octokit,
        sourceOwner,
        sourceRepo,
        sourceSha,
        item.path,
        destinationOwner,
        destinationRepo
      );
      continue;
    }
    if (item.type !== "file") continue;

    let file;
    try {
      file = await octokit.repos.getContent({
        owner: sourceOwner,
        repo: sourceRepo,
        path: item.path,
        ref: sourceSha
      });
    } catch (error) {
      if (hasStatus(error, 403) || hasStatus(error, 404)) {
        throw new Error(
          `The GitHub App installation cannot read template file ${sourceOwner}/${sourceRepo}/${item.path}.`
        );
      }
      throw error;
    }
    if (Array.isArray(file.data) || file.data.type !== "file" || !("content" in file.data)) {
      throw new Error(`Unable to read template file ${item.path}.`);
    }
    const destinationPath = item.path.slice(`${sourcePath.split("/").slice(0, 2).join("/")}/`.length);
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({
        owner: destinationOwner,
        repo: destinationRepo,
        path: destinationPath
      });
      if (!Array.isArray(existing.data) && existing.data.type === "file") sha = existing.data.sha;
    } catch (error) {
      if (!(error instanceof Error) || !("status" in error) || error.status !== 404) throw error;
    }
    const sourceContent = file.data.content.replaceAll("\n", "");
    const content = destinationPath === ".github/workflows/deploy.yml"
      ? pinReusableWorkflow(sourceContent, sourceSha, `${sourceOwner}/${sourceRepo}`)
      : sourceContent;
    await octokit.repos.createOrUpdateFileContents({
      owner: destinationOwner,
      repo: destinationRepo,
      path: destinationPath,
      message: `Initialize ${destinationPath}`,
      content,
      sha
    });
  }
}

async function resolveTemplateSource(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<{ sha: string }> {
  try {
    const repository = await octokit.repos.get({ owner, repo });
    const reference = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${repository.data.default_branch}`
    });
    return { sha: reference.data.object.sha };
  } catch (error) {
    if (hasStatus(error, 403) || hasStatus(error, 404)) {
      throw new Error(
        `The GitHub App installation cannot resolve the default branch of ${owner}/${repo}.`
      );
    }
    throw error;
  }
}

export function pinReusableWorkflow(
  base64Content: string,
  sourceSha: string,
  workflowRepository: string
): string {
  const workflow = Buffer.from(base64Content, "base64").toString("utf8");
  const marker =
    "customer-organization/enterprise-innovation-hub-demo-kit/.github/workflows/reusable-app-deploy.yml@main";
  if (!workflow.includes(marker)) {
    throw new Error("The generated deployment workflow does not contain the expected publication marker.");
  }
  const pinned =
    `${workflowRepository}/.github/workflows/reusable-app-deploy.yml@${sourceSha}`;
  return Buffer.from(workflow.replace(marker, pinned)).toString("base64");
}

function hasStatus(error: unknown, status: number): boolean {
  return error instanceof Error && "status" in error && error.status === status;
}
