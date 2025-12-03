import crypto from "crypto";
import { checksum } from "./crypto";
import { Identity, Policy, Secret, SecretVersion } from "./domain";
import { FileSecretStore, allowAction, enforcePolicy, recordObservation } from "./storage";

export class SecretManager {
  constructor(private store: FileSecretStore) {}

  createSecret(
    name: string,
    value: string,
    policy: Policy,
    actor: Identity,
    description?: string,
    rotationHandler?: () => string | Promise<string>,
  ): Secret {
    enforcePolicy(value, policy);
    allowAction(actor, actor.tenant, "admin");
    const secretId = crypto.randomUUID();
    const now = new Date();
    const version = new SecretVersion(1, now, value, checksum(value), actor.subject);
    const secret = new Secret(
      secretId,
      name,
      actor.tenant,
      policy,
      now,
      actor.subject,
      [version],
      description,
      rotationHandler,
    );
    this.store.save(secret, actor, "create");
    recordObservation("create", secretId, actor);
    return secret;
  }

  putSecret(secretId: string, value: string, actor: Identity): Secret {
    const secret = this.getOrRaise(secretId);
    allowAction(actor, secret.tenant, "writer");
    enforcePolicy(value, secret.policy);
    const version = new SecretVersion(secret.nextVersionNumber(), new Date(), value, checksum(value), actor.subject);
    secret.versions.push(version);
    this.store.save(secret, actor, "put");
    recordObservation("put", secretId, actor);
    return secret;
  }

  async rotate(secretId: string, actor: Identity): Promise<Secret> {
    const secret = this.getOrRaise(secretId);
    allowAction(actor, secret.tenant, "writer");
    if (!secret.rotationHandler) {
      throw new Error("No rotation handler configured for secret");
    }
    const newValue = await Promise.resolve(secret.rotationHandler());
    enforcePolicy(newValue, secret.policy);
    const version = new SecretVersion(secret.nextVersionNumber(), new Date(), newValue, checksum(newValue), actor.subject);
    secret.versions.push(version);
    this.store.save(secret, actor, "rotate");
    recordObservation("rotate", secretId, actor);
    return secret;
  }

  getSecret(secretId: string, actor: Identity): Secret {
    const secret = this.getOrRaise(secretId);
    allowAction(actor, secret.tenant, "reader");
    recordObservation("get", secretId, actor);
    return secret;
  }

  listSecrets(actor: Identity): Secret[] {
    allowAction(actor, actor.tenant, "reader");
    const secrets = this.store.listSecrets(actor.tenant);
    for (const secret of secrets) {
      recordObservation("list", secret.id, actor);
    }
    return secrets;
  }

  deleteSecret(secretId: string, actor: Identity): void {
    const secret = this.getOrRaise(secretId);
    allowAction(actor, secret.tenant, "admin");
    this.store.delete(secretId, actor);
    recordObservation("delete", secretId, actor);
  }

  private getOrRaise(secretId: string): Secret {
    const secret = this.store.get(secretId);
    if (!secret) {
      throw new Error(`Secret ${secretId} not found`);
    }
    return secret;
  }
}
