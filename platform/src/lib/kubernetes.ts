import { readFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { DefaultAzureCredential } from "@azure/identity";
import type { IdeaRequest } from "./contracts";

export interface ApplicationInfrastructureProvisioner {
  create(request: IdeaRequest): Promise<void>;
}

export class KubernetesApplicationProvisioner implements ApplicationInfrastructureProvisioner {
  async create(request: IdeaRequest): Promise<void> {
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
    await createFederatedCredential(request.repositorySlug);
  }
}

async function createFederatedCredential(repositorySlug: string): Promise<void> {
  const identityResourceId = process.env.APP_DEPLOY_IDENTITY_RESOURCE_ID;
  const organization = process.env.GITHUB_ORG;
  if (!identityResourceId || !organization) {
    throw new Error("Deployment identity resource ID and GitHub organization are required.");
  }
  const credential = new DefaultAzureCredential();
  const token = await credential.getToken("https://management.azure.com/.default");
  if (!token) throw new Error("Azure workload identity did not return an ARM token.");

  const name = `github-${repositorySlug}`.slice(0, 120);
  const response = await fetch(
    `https://management.azure.com${identityResourceId}/federatedIdentityCredentials/${name}?api-version=2023-01-31`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          audiences: ["api://AzureADTokenExchange"],
          issuer: "https://token.actions.githubusercontent.com",
          subject: `repo:${organization}/${repositorySlug}:ref:refs/heads/main`
        }
      })
    }
  );
  if (response.ok) return;
  throw new Error(`Azure federated credential creation returned ${response.status}: ${await response.text()}`);
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
