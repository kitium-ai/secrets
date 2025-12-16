import { decrypt, encrypt } from '../crypto';
import { Policy, Secret, SecretVersion } from '../domain';

type StoredSecretVersion = {
  version: number;
  createdAt: string;
  value: string;
  checksum: string;
  createdBy: string;
};

type StoredPolicy = {
  name: string;
  description: string;
  rotationDays: number;
  minLength: number;
  forbidPatterns?: string[];
  allowedCidrs?: string[];
};

export type StoredSecret = {
  id: string;
  name: string;
  tenant: string;
  policy: StoredPolicy;
  createdAt: string;
  createdBy: string;
  versions: StoredSecretVersion[];
  description?: string;
};

export function fromStoredSecret(payload: StoredSecret, masterKey: string): Secret {
  const policy = new Policy(
    payload.policy.name,
    payload.policy.description,
    payload.policy.rotationDays,
    payload.policy.minLength,
    payload.policy.forbidPatterns,
    payload.policy.allowedCidrs
  );
  const versions = payload.versions.map((storedVersion) => {
    return new SecretVersion(
      storedVersion.version,
      new Date(storedVersion.createdAt),
      decrypt(storedVersion.value, masterKey),
      storedVersion.checksum,
      storedVersion.createdBy
    );
  });
  return new Secret(
    payload.id,
    payload.name,
    payload.tenant,
    policy,
    new Date(payload.createdAt),
    payload.createdBy,
    versions,
    payload.description
  );
}

export function toStoredSecret(secret: Secret, masterKey: string): StoredSecret {
  return {
    id: secret.id,
    name: secret.name,
    tenant: secret.tenant,
    policy: {
      name: secret.policy.name,
      description: secret.policy.description,
      rotationDays: secret.policy.rotationDays,
      minLength: secret.policy.minLength,
      ...(Array.isArray(secret.policy.forbidPatterns)
        ? { forbidPatterns: secret.policy.forbidPatterns }
        : {}),
      ...(Array.isArray(secret.policy.allowedCidrs)
        ? { allowedCidrs: secret.policy.allowedCidrs }
        : {}),
    },
    createdAt: secret.createdAt.toISOString(),
    createdBy: secret.createdBy,
    versions: secret.versions.map((version) => ({
      version: version.version,
      createdAt: version.createdAt.toISOString(),
      value: encrypt(version.value, masterKey),
      checksum: version.checksum,
      createdBy: version.createdBy,
    })),
    ...(typeof secret.description === 'string' ? { description: secret.description } : {}),
  };
}
