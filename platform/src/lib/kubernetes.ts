import { readFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { createHash } from "node:crypto";
import { DefaultAzureCredential } from "@azure/identity";
import type { IdeaRequest } from "./contracts";

export interface ApplicationInfrastructure {
  deployClientId: string;
}

export interface ApplicationInfrastructureProvisioner {
  create(request: IdeaRequest): Promise<ApplicationInfrastructure>;
}

export class KubernetesApplicationProvisioner implements ApplicationInfrastructureProvisioner {
  async create(request: IdeaRequest): Promise<ApplicationInfrastructure> {
    const namespace = `app-${request.repositorySlug}`;
    const labels = {
      "innovation-hub/owner": "platform",
      "innovation-hub/application": request.repositorySlug
    };

    await createResource("/api/v1/namespaces", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: namespace, labels }
    });
    await createResource(`/api/v1/namespaces/${namespace}/serviceaccounts`, {
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: { name: request.repositorySlug, namespace, labels },
      automountServiceAccountToken: false
    });
    await createResource(`/api/v1/namespaces/${namespace}/resourcequotas`, {
      apiVersion: "v1",
      kind: "ResourceQuota",
      metadata: { name: "application-quota", namespace, labels },
      spec: {
        hard: {
          "requests.cpu": "2",
          "requests.memory": "4Gi",
          "limits.cpu": "4",
          "limits.memory": "8Gi",
          pods: "20",
          "services.loadbalancers": "0"
        }
      }
    });
    await createResource(`/apis/networking.k8s.io/v1/namespaces/${namespace}/networkpolicies`, {
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata: { name: "default-deny", namespace, labels },
      spec: { podSelector: {}, policyTypes: ["Ingress", "Egress"] }
    });
    await createResource(`/apis/networking.k8s.io/v1/namespaces/${namespace}/networkpolicies`, {
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata: { name: "application-allow", namespace, labels },
      spec: {
        podSelector: {},
        policyTypes: ["Ingress", "Egress"],
        ingress: [
          { from: [{ namespaceSelector: { matchLabels: { "kubernetes.io/metadata.name": "ingress-nginx" } } }] },
          { from: [{ podSelector: {} }] }
        ],
        egress: [
          {
            to: [{ namespaceSelector: { matchLabels: { "kubernetes.io/metadata.name": "kube-system" } } }],
            ports: [{ protocol: "UDP", port: 53 }, { protocol: "TCP", port: 53 }]
          },
          { to: [{ podSelector: {} }] },
          {
            to: [{ ipBlock: { cidr: "0.0.0.0/0", except: ["169.254.169.254/32"] } }],
            ports: [{ protocol: "TCP", port: 443 }]
          }
        ]
      }
    });
    await createResource(`/apis/postgresql.cnpg.io/v1/namespaces/${namespace}/clusters`, {
      apiVersion: "postgresql.cnpg.io/v1",
      kind: "Cluster",
      metadata: { name: `${request.repositorySlug}-database`, namespace, labels },
      spec: {
        instances: 2,
        storage: { size: "5Gi" },
        bootstrap: { initdb: { database: "app", owner: "app" } },
        monitoring: { enablePodMonitor: true }
      }
    });
    return createApplicationIdentity(request.repositorySlug, namespace);
  }
}

interface ManagedIdentityResponse {
  id: string;
  location: string;
  properties: {
    clientId: string;
    principalId: string;
  };
}

export const ACR_REPOSITORY_WRITER_ROLE_ID = "2a1e307c-b015-4ebd-883e-5b7698a07328";

const ROLE = {
  acrRepositoryWriter: ACR_REPOSITORY_WRITER_ROLE_ID,
  aksClusterUser: "4abbcc35-e782-43d8-92c5-2d3f1bd2253f",
  aksNamespaceWriter: "a7ffa36f-339b-4b5c-8bdf-e2c188b2c0eb"
} as const;

async function createApplicationIdentity(
  repositorySlug: string,
  namespace: string
): Promise<ApplicationInfrastructure> {
  const organization = process.env.GITHUB_ORG;
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const location = process.env.AZURE_LOCATION;
  const aksName = process.env.AKS_CLUSTER_NAME;
  const acrName = process.env.ACR_NAME;
  if (!organization || !subscriptionId || !resourceGroup || !location || !aksName || !acrName) {
    throw new Error("Azure application identity configuration is incomplete.");
  }

  const credential = new DefaultAzureCredential();
  const token = await credential.getToken("https://management.azure.com/.default");
  if (!token) throw new Error("Azure workload identity did not return an ARM token.");

  const resourceGroupId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`;
  const identityName = `id-${repositorySlug}-deploy`.slice(0, 128);
  const identityId =
    `${resourceGroupId}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/${identityName}`;
  const identity = await armPut<ManagedIdentityResponse>(
    token.token,
    identityId,
    "2023-01-31",
    { location }
  );

  await armPut(
    token.token,
    `${identityId}/federatedIdentityCredentials/github-main`,
    "2023-01-31",
    {
      properties: {
        audiences: ["api://AzureADTokenExchange"],
        issuer: "https://token.actions.githubusercontent.com",
        subject: `repo:${organization}/${repositorySlug}:ref:refs/heads/main`
      }
    }
  );

  const acrId =
    `${resourceGroupId}/providers/Microsoft.ContainerRegistry/registries/${acrName}`;
  const aksId =
    `${resourceGroupId}/providers/Microsoft.ContainerService/managedClusters/${aksName}`;
  await createRoleAssignment(
    token.token,
    subscriptionId,
    acrId,
    identity.properties.principalId,
    ROLE.acrRepositoryWriter,
    repositoryWriterCondition(repositorySlug)
  );
  await createRoleAssignment(
    token.token,
    subscriptionId,
    aksId,
    identity.properties.principalId,
    ROLE.aksClusterUser
  );
  await createRoleAssignment(
    token.token,
    subscriptionId,
    `${aksId}/namespaces/${namespace}`,
    identity.properties.principalId,
    ROLE.aksNamespaceWriter
  );

  return { deployClientId: identity.properties.clientId };
}

async function createRoleAssignment(
  token: string,
  subscriptionId: string,
  scope: string,
  principalId: string,
  roleId: string,
  condition?: string
): Promise<void> {
  const assignmentId = deterministicGuid(`${scope}:${principalId}:${roleId}:${condition ?? ""}`);
  await armPut(
    token,
    `${scope}/providers/Microsoft.Authorization/roleAssignments/${assignmentId}`,
    "2022-04-01",
    {
      properties: {
        principalId,
        principalType: "ServicePrincipal",
        roleDefinitionId:
          `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${roleId}`,
        ...(condition ? { condition, conditionVersion: "2.0" } : {})
      }
    }
  );
}

export function repositoryWriterCondition(repository: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(repository)) {
    throw new Error("ACR repository names must match the governed application slug.");
  }
  return [
    "(",
    " (",
    "  !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/read'})",
    "  AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/read'})",
    "  AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/write'})",
    "  AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/write'})",
    " )",
    " OR",
    ` (@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase '${repository}')`,
    ")"
  ].join("");
}

async function armPut<T = unknown>(
  token: string,
  resourceId: string,
  apiVersion: string,
  body: unknown
): Promise<T> {
  const response = await fetch(
    `https://management.azure.com${resourceId}?api-version=${apiVersion}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );
  if (response.ok) return response.json() as Promise<T>;
  throw new Error(`Azure resource ${resourceId} returned ${response.status}: ${await response.text()}`);
}

function deterministicGuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

async function createResource(path: string, body: unknown): Promise<void> {
  const host = process.env.KUBERNETES_SERVICE_HOST;
  const port = process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? "443";
  if (!host) throw new Error("Kubernetes in-cluster configuration is unavailable.");
  const [token, ca] = await Promise.all([
    readFile("/var/run/secrets/kubernetes.io/serviceaccount/token", "utf8"),
    readFile("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt")
  ]);
  const payload = JSON.stringify(body);
  await new Promise<void>((resolve, reject) => {
    const request = httpsRequest({
      hostname: host,
      port,
      path,
      method: "POST",
      ca,
      headers: {
        authorization: `Bearer ${token.trim()}`,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload)
      }
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => {
        if (response.statusCode && (response.statusCode < 300 || response.statusCode === 409)) {
          resolve();
          return;
        }
        reject(new Error(`Kubernetes API ${path} returned ${response.statusCode}: ${responseBody}`));
      });
    });
    request.on("error", reject);
    request.end(payload);
  });
}
