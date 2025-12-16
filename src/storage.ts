import fs from 'node:fs';
import path from 'node:path';

import type { AuditLogEntry, Identity, Secret } from './domain';
import type { SecretStore, SecretStoreConfig } from './store/interface';
import { appendAuditLog } from './store/audit';
import { fromStoredSecret, type StoredSecret, toStoredSecret } from './store/serialization';

export { allowAction, enforcePolicy } from './authz';
export { recordObservation } from './observability';
export type { SecretStore, SecretStoreConfig } from './store/interface';
export { S3SecretStore, type S3SecretStoreConfig } from './store/s3';
export { GCPStorageSecretStore, type GCPStorageSecretStoreConfig } from './store/gcp';
export { PostgreSQLSecretStore, type PostgreSQLSecretStoreConfig } from './store/postgres';

export class FileSecretStore implements SecretStore {
  private readonly masterKey: string;
  private readonly auditLogPath: string | undefined;

  constructor(
    private readonly storePath: string,
    config: SecretStoreConfig
  ) {
    this.masterKey = config.masterKey;
    if (config.auditLogPath) {
      this.auditLogPath = config.auditLogPath;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- file path comes from configuration
    fs.mkdirSync(directoryOf(this.storePath), { recursive: true });
    if (config.auditLogPath) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file path comes from configuration
      fs.mkdirSync(directoryOf(config.auditLogPath), { recursive: true });
    }
  }

  listSecrets(tenant?: string): Promise<Secret[]> {
    const data = this.load();
    const secrets: Secret[] = [];
    for (const stored of Object.values(data)) {
      if (tenant && stored.tenant !== tenant) {
        continue;
      }
      secrets.push(fromStoredSecret(stored, this.masterKey));
    }
    return Promise.resolve(secrets);
  }

  get(secretId: string): Promise<Secret | undefined> {
    const data = this.load();
    const stored = data[secretId];
    if (!stored) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(fromStoredSecret(stored, this.masterKey));
  }

  save(secret: Secret, actor: Identity, action: string): Promise<void> {
    const data = this.load();
    data[secret.id] = toStoredSecret(secret, this.masterKey);
    this.persist(data);
    this.log({
      timestamp: new Date(),
      subject: actor.subject,
      action,
      secretId: secret.id,
      tenant: secret.tenant,
      metadata: { policy: secret.policy.name },
    });
    return Promise.resolve();
  }

  delete(secretId: string, actor: Identity): Promise<void> {
    const data = this.load();
    delete data[secretId];
    this.persist(data);
    this.log({
      timestamp: new Date(),
      subject: actor.subject,
      action: 'delete',
      secretId,
      tenant: actor.tenant,
      metadata: {},
    });
    return Promise.resolve();
  }

  private load(): Record<string, StoredSecret> {
    if (!fs.existsSync(this.storePath)) {
      return {};
    }
    const raw = fs.readFileSync(this.storePath, 'utf8');
    if (!raw.trim()) {
      return {};
    }
    return JSON.parse(raw) as Record<string, StoredSecret>;
  }

  private persist(data: Record<string, StoredSecret>): void {
    fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
  }

  private log(entry: AuditLogEntry): void {
    if (!this.auditLogPath) {
      return;
    }
    appendAuditLog(this.auditLogPath, entry);
  }
}

function directoryOf(target: string): string {
  return path.dirname(path.resolve(target));
}
