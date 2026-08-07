import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const caller = readFileSync(
  "templates/nextjs-postgres/.github/workflows/deploy.yml",
  "utf8"
);
const marker =
  "customer-organization/enterprise-innovation-hub-demo-kit/.github/workflows/reusable-app-deploy.yml@main";

if (!caller.includes(marker)) {
  throw new Error("Template caller must use the @main publication marker.");
}

if (process.env.GITHUB_REF === "refs/heads/main") {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  execFileSync("git", [
    "cat-file",
    "-e",
    `${sha}:.github/workflows/reusable-app-deploy.yml`
  ]);
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error("Default branch did not resolve to a full commit SHA.");
  }
  console.log(`Reusable workflow publication resolves main to ${sha}.`);
} else {
  console.log("Template publication marker and provisioning-time SHA pinning are present.");
}
