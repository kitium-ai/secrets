import type { Identity, Secret } from '../domain';

export type SecretStore = {
  listSecrets(tenant?: string): Promise<Secret[]>;
  get(secretId: string): Promise<Secret | undefined>;
  save(secret: Secret, actor: Identity, action: string): Promise<void>;
  delete(secretId: string, actor: Identity): Promise<void>;
};

export type SecretStoreConfig = {
  masterKey: string;
  auditLogPath?: string;
};
