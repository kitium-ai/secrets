import { Storage } from '@google-cloud/storage';

import type { AuditLogEntry, Identity, Secret } from '../domain';
import { appendAuditLog } from './audit';
import type { SecretStore, SecretStoreConfig } from './interface';
import { fromStoredSecret, type StoredSecret, toStoredSecret } from './serialization';

export type GCPStorageSecretStoreConfig = {
  bucket: string;
  projectId?: string;
  keyFilename?: string;
  keyPrefix?: string;
} & SecretStoreConfig;

export class GCPStorageSecretStore implements SecretStore {
  private readonly storage: Storage;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly masterKey: string;
  private readonly auditLogPath: string | undefined;

  constructor(config: GCPStorageSecretStoreConfig) {
    this.bucket = config.bucket;
    const keyPrefix = config.keyPrefix ?? 'secrets/';
    this.keyPrefix = keyPrefix;
    this.masterKey = config.masterKey;
    this.auditLogPath = config.auditLogPath;

    this.storage = new Storage({
      ...(config.projectId && { projectId: config.projectId }),
      ...(config.keyFilename && { keyFilename: config.keyFilename }),
    });
  }

  async listSecrets(tenant?: string): Promise<Secret[]> {
    const data = await this.load();
    const secrets: Secret[] = [];
    for (const stored of Object.values(data)) {
      if (tenant && stored.tenant !== tenant) {
        continue;
      }
      secrets.push(fromStoredSecret(stored, this.masterKey));
    }
    return secrets;
  }

  async get(secretId: string): Promise<Secret | undefined> {
    const data = await this.load();
    const stored = data[secretId];
    if (!stored) {
      return undefined;
    }
    return fromStoredSecret(stored, this.masterKey);
  }

  async save(secret: Secret, actor: Identity, action: string): Promise<void> {
    const data = await this.load();
    data[secret.id] = toStoredSecret(secret, this.masterKey);
    await this.persist(data);
    this.log({
      timestamp: new Date(),
      subject: actor.subject,
      action,
      secretId: secret.id,
      tenant: secret.tenant,
      metadata: { policy: secret.policy.name },
    });
  }

  async delete(secretId: string, actor: Identity): Promise<void> {
    const data = await this.load();
    delete data[secretId];
    await this.persist(data);
    this.log({
      timestamp: new Date(),
      subject: actor.subject,
      action: 'delete',
      secretId,
      tenant: actor.tenant,
      metadata: {},
    });
  }

  private async load(): Promise<Record<string, StoredSecret>> {
    try {
      const file = this.storage.bucket(this.bucket).file(`${this.keyPrefix}store.json`);
      const [exists] = await file.exists();
      if (!exists) {
        return {};
      }
      const [content] = await file.download();
      const body = content.toString();
      if (!body.trim()) {
        return {};
      }
      return JSON.parse(body) as Record<string, StoredSecret>;
    } catch (error: unknown) {
      if (isErrorWithCode(error) && error.code === 404) {
        return {};
      }
      throw error;
    }
  }

  private async persist(data: Record<string, StoredSecret>): Promise<void> {
    const file = this.storage.bucket(this.bucket).file(`${this.keyPrefix}store.json`);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
    });
  }

  private log(entry: AuditLogEntry): void {
    if (!this.auditLogPath) {
      return;
    }
    appendAuditLog(this.auditLogPath, entry);
  }
}

function isErrorWithCode(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'number'
  );
}
