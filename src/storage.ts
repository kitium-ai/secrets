import fs from "fs";
import path from "path";
import { decrypt, encrypt } from "./crypto";
import { AuditLogEntry, Identity, Policy, Secret, SecretVersion } from "./domain";

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

type StoredSecret = {
  id: string;
  name: string;
  tenant: string;
  policy: StoredPolicy;
  createdAt: string;
  createdBy: string;
  versions: StoredSecretVersion[];
  description?: string;
};

export class FileSecretStore {
  constructor(private path: string, private masterKey: string, private auditLogPath?: string) {
    fs.mkdirSync(pathLibDir(path), { recursive: true });
    if (auditLogPath) {
      fs.mkdirSync(pathLibDir(auditLogPath), { recursive: true });
    }
  }

  listSecrets(tenant?: string): Secret[] {
    const data = this.load();
    const secrets: Secret[] = [];
    for (const stored of Object.values(data)) {
      if (tenant && stored.tenant !== tenant) continue;
      secrets.push(this.toSecret(stored));
    }
    return secrets;
  }

  get(secretId: string): Secret | undefined {
    const data = this.load();
    const stored = data[secretId];
    if (!stored) return undefined;
    return this.toSecret(stored);
  }

  save(secret: Secret, actor: Identity, action: string): void {
    const data = this.load();
    data[secret.id] = this.toStored(secret);
    this.persist(data);
    this.log({
      timestamp: new Date(),
      subject: actor.subject,
      action,
      secretId: secret.id,
      tenant: secret.tenant,
      metadata: { policy: secret.policy.name },
    });
  }

  delete(secretId: string, actor: Identity): void {
    const data = this.load();
    delete data[secretId];
    this.persist(data);
    this.log({
      timestamp: new Date(),
      subject: actor.subject,
      action: "delete",
      secretId,
      tenant: actor.tenant,
      metadata: {},
    });
  }

  private load(): Record<string, StoredSecret> {
    if (!fs.existsSync(this.path)) return {};
    const raw = fs.readFileSync(this.path, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, StoredSecret>;
  }

  private persist(data: Record<string, StoredSecret>): void {
    fs.writeFileSync(this.path, JSON.stringify(data, null, 2));
  }

  private log(entry: AuditLogEntry): void {
    if (!this.auditLogPath) return;
    const payload = {
      timestamp: entry.timestamp.toISOString(),
      subject: entry.subject,
      action: entry.action,
      secretId: entry.secretId,
      tenant: entry.tenant,
      metadata: entry.metadata,
    };
    fs.appendFileSync(this.auditLogPath, `${JSON.stringify(payload)}\n`, { encoding: "utf8" });
    console.info("AUDIT", payload);
  }

  private toSecret(payload: StoredSecret): Secret {
    const policy = new Policy(
      payload.policy.name,
      payload.policy.description,
      payload.policy.rotationDays,
      payload.policy.minLength,
      payload.policy.forbidPatterns,
      payload.policy.allowedCidrs,
    );
    const versions = payload.versions.map(
      (v) =>
        new SecretVersion(
          v.version,
          new Date(v.createdAt),
          decrypt(v.value, this.masterKey),
          v.checksum,
          v.createdBy,
        ),
    );
    return new Secret(
      payload.id,
      payload.name,
      payload.tenant,
      policy,
      new Date(payload.createdAt),
      payload.createdBy,
      versions,
      payload.description,
    );
  }

  private toStored(secret: Secret): StoredSecret {
    return {
      id: secret.id,
      name: secret.name,
      tenant: secret.tenant,
      policy: {
        name: secret.policy.name,
        description: secret.policy.description,
        rotationDays: secret.policy.rotationDays,
        minLength: secret.policy.minLength,
        forbidPatterns: secret.policy.forbidPatterns,
        allowedCidrs: secret.policy.allowedCidrs,
      },
      createdAt: secret.createdAt.toISOString(),
      createdBy: secret.createdBy,
      versions: secret.versions.map((version) => ({
        version: version.version,
        createdAt: version.createdAt.toISOString(),
        value: encrypt(version.value, this.masterKey),
        checksum: version.checksum,
        createdBy: version.createdBy,
      })),
      description: secret.description,
    };
  }
}

export function enforcePolicy(value: string, policy: Policy): void {
  if (value.length < policy.minLength) {
    throw new Error(`Secret must be at least ${policy.minLength} characters long`);
  }
  if (policy.forbidPatterns) {
    for (const pattern of policy.forbidPatterns) {
      if (pattern && value.includes(pattern)) {
        throw new Error(`Secret must not contain forbidden pattern: ${pattern}`);
      }
    }
  }
}

export function allowAction(actor: Identity, tenant: string, requiredRole: string): void {
  if (actor.tenant !== tenant) {
    throw new Error("Tenant mismatch for action");
  }
  if (!actor.hasRole(requiredRole)) {
    throw new Error(`Actor missing required role: ${requiredRole}`);
  }
}

export function recordObservation(action: string, secretId: string, actor: Identity): void {
  console.info(
    "METRIC action=%s secret=%s subject=%s tenant=%s",
    action,
    secretId,
    actor.subject,
    actor.tenant,
  );
}

function pathLibDir(target: string): string {
  return path.dirname(path.resolve(target));
}
