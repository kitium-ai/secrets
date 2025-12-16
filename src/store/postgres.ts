import { Client, type ClientConfig } from 'pg';

import type { AuditLogEntry, Identity, Secret } from '../domain';
import { appendAuditLog } from './audit';
import type { SecretStore, SecretStoreConfig } from './interface';
import { fromStoredSecret, type StoredSecret, toStoredSecret } from './serialization';

export type PostgreSQLSecretStoreConfig = {
  connectionString: string;
  tableName?: string;
} & SecretStoreConfig;

export class PostgreSQLSecretStore implements SecretStore {
  private readonly config: ClientConfig;
  private readonly tableName: string;
  private readonly masterKey: string;
  private readonly auditLogPath: string | undefined;

  constructor(config: PostgreSQLSecretStoreConfig) {
    this.config = { connectionString: config.connectionString };
    const tableName = config.tableName ?? 'secrets';
    this.tableName = tableName;
    this.masterKey = config.masterKey;
    this.auditLogPath = config.auditLogPath;
  }

  async listSecrets(tenant?: string): Promise<Secret[]> {
    const client = new Client(this.config);
    try {
      await client.connect();
      await this.ensureTable(client);

      let query = 'SELECT data FROM $1';
      const parameters: string[] = [this.tableName];

      if (tenant) {
        query += ' WHERE tenant = $2';
        parameters.push(tenant);
      }

      const result = await client.query(query, parameters);
      const secrets: Secret[] = [];

      for (const row of result.rows) {
        const stored = JSON.parse(row.data) as StoredSecret;
        secrets.push(fromStoredSecret(stored, this.masterKey));
      }

      return secrets;
    } finally {
      await client.end();
    }
  }

  async get(secretId: string): Promise<Secret | undefined> {
    const client = new Client(this.config);
    try {
      await client.connect();
      await this.ensureTable(client);

      const result = await client.query('SELECT data FROM $1 WHERE id = $2', [
        this.tableName,
        secretId,
      ]);

      if (result.rows.length === 0) {
        return undefined;
      }

      const stored = JSON.parse(result.rows[0].data) as StoredSecret;
      return fromStoredSecret(stored, this.masterKey);
    } finally {
      await client.end();
    }
  }

  async save(secret: Secret, actor: Identity, action: string): Promise<void> {
    const client = new Client(this.config);
    try {
      await client.connect();
      await this.ensureTable(client);

      const stored = toStoredSecret(secret, this.masterKey);
      const data = JSON.stringify(stored);

      await client.query(
        `INSERT INTO $1 (id, tenant, data) VALUES ($2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [this.tableName, secret.id, secret.tenant, data]
      );

      this.log({
        timestamp: new Date(),
        subject: actor.subject,
        action,
        secretId: secret.id,
        tenant: secret.tenant,
        metadata: { policy: secret.policy.name },
      });
    } finally {
      await client.end();
    }
  }

  async delete(secretId: string, actor: Identity): Promise<void> {
    const client = new Client(this.config);
    try {
      await client.connect();
      await this.ensureTable(client);

      await client.query('DELETE FROM $1 WHERE id = $2', [this.tableName, secretId]);

      this.log({
        timestamp: new Date(),
        subject: actor.subject,
        action: 'delete',
        secretId,
        tenant: actor.tenant,
        metadata: {},
      });
    } finally {
      await client.end();
    }
  }

  private async ensureTable(client: Client): Promise<void> {
    await client.query(
      `
      CREATE TABLE IF NOT EXISTS $1 (
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `,
      [this.tableName]
    );

    await client.query(
      `
      CREATE INDEX IF NOT EXISTS idx_$1_tenant ON $1 (tenant)
    `,
      [this.tableName]
    );
  }

  private log(entry: AuditLogEntry): void {
    if (!this.auditLogPath) {
      return;
    }
    appendAuditLog(this.auditLogPath, entry);
  }
}
