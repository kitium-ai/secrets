import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { AuditLogEntry, Identity, Secret } from '../domain';
import { appendAuditLog } from './audit';
import type { SecretStore, SecretStoreConfig } from './interface';
import { fromStoredSecret, type StoredSecret, toStoredSecret } from './serialization';

export type S3SecretStoreConfig = {
  bucket: string;
  region: string;
  keyPrefix?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
} & SecretStoreConfig;

export class S3SecretStore implements SecretStore {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly masterKey: string;
  private readonly auditLogPath: string | undefined;

  constructor(config: S3SecretStoreConfig) {
    this.bucket = config.bucket;
    const keyPrefix = config.keyPrefix ?? 'secrets/';
    this.keyPrefix = keyPrefix;
    this.masterKey = config.masterKey;
    this.auditLogPath = config.auditLogPath;

    const credentials =
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined;

    this.client = new S3Client({
      region: config.region,
      ...(credentials ? { credentials } : {}),
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
      const command = new GetObjectCommand({
        // eslint-disable-next-line @typescript-eslint/naming-convention -- AWS SDK command input uses PascalCase
        Bucket: this.bucket,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- AWS SDK command input uses PascalCase
        Key: `${this.keyPrefix}store.json`,
      });
      const response = await this.client.send(command);
      const body = await response.Body?.transformToString();
      if (!body?.trim()) {
        return {};
      }
      return JSON.parse(body) as Record<string, StoredSecret>;
    } catch (error: unknown) {
      if (isErrorWithName(error) && error.name === 'NoSuchKey') {
        return {};
      }
      throw error;
    }
  }

  private async persist(data: Record<string, StoredSecret>): Promise<void> {
    const command = new PutObjectCommand({
      // eslint-disable-next-line @typescript-eslint/naming-convention -- AWS SDK command input uses PascalCase
      Bucket: this.bucket,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- AWS SDK command input uses PascalCase
      Key: `${this.keyPrefix}store.json`,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- AWS SDK command input uses PascalCase
      Body: JSON.stringify(data, null, 2),
      // eslint-disable-next-line @typescript-eslint/naming-convention -- AWS SDK command input uses PascalCase
      ContentType: 'application/json',
    });
    await this.client.send(command);
  }

  private log(entry: AuditLogEntry): void {
    if (!this.auditLogPath) {
      return;
    }
    appendAuditLog(this.auditLogPath, entry);
  }
}

function isErrorWithName(error: unknown): error is { name: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof (error as { name?: unknown }).name === 'string'
  );
}
