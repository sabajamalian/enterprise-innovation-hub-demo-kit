import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { Actor, IdeaRequest, ProvisioningOperation } from "./contracts";

export interface OperationStore {
  findByIdempotencyKey(key: string): Promise<ProvisioningOperation | undefined>;
  create(key: string, actor: Actor, request: IdeaRequest): Promise<ProvisioningOperation>;
  update(id: string, patch: Partial<ProvisioningOperation>): Promise<ProvisioningOperation>;
}

export class MemoryOperationStore implements OperationStore {
  private operations = new Map<string, ProvisioningOperation>();

  async findByIdempotencyKey(key: string) {
    return [...this.operations.values()].find((item) => item.idempotencyKey === key);
  }

  async create(key: string, actor: Actor, request: IdeaRequest) {
    const now = new Date().toISOString();
    const operation: ProvisioningOperation = {
      id: randomUUID(),
      idempotencyKey: key,
      actor,
      request,
      status: "accepted",
      createdAt: now,
      updatedAt: now
    };
    this.operations.set(operation.id, operation);
    return operation;
  }

  async update(id: string, patch: Partial<ProvisioningOperation>) {
    const current = this.operations.get(id);
    if (!current) throw new Error(`Operation ${id} was not found.`);
    const next = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
    this.operations.set(id, next);
    return next;
  }
}

export class PostgresOperationStore implements OperationStore {
  constructor(private readonly pool: Pool) {}

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS provisioning_operations (
        id uuid PRIMARY KEY,
        idempotency_key text UNIQUE NOT NULL,
        payload jsonb NOT NULL
      )
    `);
  }

  async findByIdempotencyKey(key: string) {
    const result = await this.pool.query<{ payload: ProvisioningOperation }>(
      "SELECT payload FROM provisioning_operations WHERE idempotency_key = $1",
      [key]
    );
    return result.rows[0]?.payload;
  }

  async create(key: string, actor: Actor, request: IdeaRequest) {
    const now = new Date().toISOString();
    const operation: ProvisioningOperation = {
      id: randomUUID(),
      idempotencyKey: key,
      actor,
      request,
      status: "accepted",
      createdAt: now,
      updatedAt: now
    };
    await this.pool.query(
      "INSERT INTO provisioning_operations (id, idempotency_key, payload) VALUES ($1, $2, $3)",
      [operation.id, key, operation]
    );
    return operation;
  }

  async update(id: string, patch: Partial<ProvisioningOperation>) {
    const result = await this.pool.query<{ payload: ProvisioningOperation }>(
      "SELECT payload FROM provisioning_operations WHERE id = $1",
      [id]
    );
    const current = result.rows[0]?.payload;
    if (!current) throw new Error(`Operation ${id} was not found.`);
    const next = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
    await this.pool.query("UPDATE provisioning_operations SET payload = $2 WHERE id = $1", [id, next]);
    return next;
  }
}

declare global {
  var operationStore: OperationStore | undefined;
}

export async function getOperationStore(): Promise<OperationStore> {
  if (global.operationStore) return global.operationStore;
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production.");
    }
    global.operationStore = new MemoryOperationStore();
    return global.operationStore;
  }
  const store = new PostgresOperationStore(new Pool({ connectionString: process.env.DATABASE_URL }));
  await store.migrate();
  global.operationStore = store;
  return store;
}
