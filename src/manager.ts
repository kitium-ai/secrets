import crypto from 'node:crypto';

import { allowAction, enforcePolicy } from './authz';
import { checksum } from './crypto';
import { type Identity, type Policy, Secret, SecretVersion } from './domain';
import type { EventNotifier, SecretEvent } from './events';
import { recordObservation } from './observability';
import type { SecretStore } from './storage';

export class SecretManager {
  constructor(
    private readonly store: SecretStore,
    private readonly eventNotifier?: EventNotifier
  ) {}

  private async emitEvent(event: SecretEvent): Promise<void> {
    if (this.eventNotifier) {
      await this.eventNotifier.notify(event);
    }
  }

  async createSecret(
    name: string,
    value: string,
    policy: Policy,
    actor: Identity,
    description?: string,
    rotationHandler?: () => string | Promise<string>,
    ttlSeconds?: number
  ): Promise<Secret> {
    enforcePolicy(value, policy);
    allowAction(actor, actor.tenant, 'admin');
    const secretId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = ttlSeconds ? new Date(now.getTime() + ttlSeconds * 1000) : undefined;
    const version = new SecretVersion(1, now, value, checksum(value), actor.subject, expiresAt);
    const secret = new Secret(
      secretId,
      name,
      actor.tenant,
      policy,
      now,
      actor.subject,
      [version],
      description,
      rotationHandler
    );
    await this.store.save(secret, actor, 'create');
    recordObservation('create', secretId, actor);
    await this.emitEvent({
      type: 'created',
      secretId,
      tenant: actor.tenant,
      timestamp: now,
      actor: actor.subject,
      metadata: { name, policy: policy.name, ttlSeconds },
    });
    return secret;
  }

  async putSecret(secretId: string, value: string, actor: Identity, ttlSeconds?: number): Promise<Secret> {
    const secret = await this.getOrRaise(secretId);
    allowAction(actor, secret.tenant, 'writer');
    enforcePolicy(value, secret.policy);
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : undefined;
    const version = new SecretVersion(
      secret.nextVersionNumber(),
      new Date(),
      value,
      checksum(value),
      actor.subject,
      expiresAt
    );
    secret.versions.push(version);
    await this.store.save(secret, actor, 'put');
    recordObservation('put', secretId, actor);
    await this.emitEvent({
      type: 'updated',
      secretId,
      tenant: secret.tenant,
      timestamp: new Date(),
      actor: actor.subject,
      metadata: { version: version.version, ttlSeconds },
    });
    return secret;
  }

  async rotate(secretId: string, actor: Identity): Promise<Secret> {
    const secret = await this.getOrRaise(secretId);
    allowAction(actor, secret.tenant, 'writer');
    if (!secret.rotationHandler) {
      throw new Error('No rotation handler configured for secret');
    }
    const newValue = await Promise.resolve(secret.rotationHandler());
    enforcePolicy(newValue, secret.policy);
    const version = new SecretVersion(
      secret.nextVersionNumber(),
      new Date(),
      newValue,
      checksum(newValue),
      actor.subject
    );
    secret.versions.push(version);
    await this.store.save(secret, actor, 'rotate');
    recordObservation('rotate', secretId, actor);
    return secret;
  }

  async getSecret(secretId: string, actor: Identity): Promise<Secret> {
    const secret = await this.getOrRaise(secretId);
    allowAction(actor, secret.tenant, 'reader');

    const latestVersion = secret.latestVersion();
    if (latestVersion.isExpired()) {
      throw new Error(`Secret ${secretId} has expired`);
    }

    recordObservation('get', secretId, actor);
    await this.emitEvent({
      type: 'accessed',
      secretId,
      tenant: secret.tenant,
      timestamp: new Date(),
      actor: actor.subject,
    });
    return secret;
  }

  async listSecrets(actor: Identity): Promise<Secret[]> {
    allowAction(actor, actor.tenant, 'reader');
    const secrets = await this.store.listSecrets(actor.tenant);
    for (const secret of secrets) {
      recordObservation('list', secret.id, actor);
    }
    return secrets;
  }

  async deleteSecret(secretId: string, actor: Identity): Promise<void> {
    const secret = await this.getOrRaise(secretId);
    allowAction(actor, secret.tenant, 'admin');
    await this.store.delete(secretId, actor);
    recordObservation('delete', secretId, actor);
    await this.emitEvent({
      type: 'deleted',
      secretId,
      tenant: secret.tenant,
      timestamp: new Date(),
      actor: actor.subject,
    });
  }

  private async getOrRaise(secretId: string): Promise<Secret> {
    const secret = await this.store.get(secretId);
    if (!secret) {
      throw new Error(`Secret ${secretId} not found`);
    }
    return secret;
  }
}
