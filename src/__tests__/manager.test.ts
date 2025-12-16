import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { Identity, Policy } from '../domain';
import { SecretManager } from '../manager';
import { FileSecretStore, type SecretStoreConfig } from '../storage';

const temporary = path.resolve(__dirname, '..', '..', '.tmp-tests');
const storePath = path.join(temporary, 'secrets.json');
const auditPath = path.join(temporary, 'audit.log');

function reset(): void {
  fs.rmSync(temporary, { recursive: true, force: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only temp directory
  fs.mkdirSync(temporary, { recursive: true });
}

describe('manager', () => {
  const masterKey = 'test-master-key';
  const config: SecretStoreConfig = {
    masterKey,
    auditLogPath: auditPath,
  };
  let manager: SecretManager;
  const actorAdmin = new Identity('tester', ['admin', 'writer', 'reader'], 'default');
  const actorReader = new Identity('reader', ['reader'], 'default');
  const policy = new Policy('default', 'test', 30, 8);

  beforeEach(() => {
    reset();
    const store = new FileSecretStore(storePath, config);
    manager = new SecretManager(store);
  });

  it('creates and retrieves secret', async () => {
    const secret = await manager.createSecret(
      'db-pass',
      'P@ssw0rd!',
      policy,
      actorAdmin,
      'db password'
    );
    const fetched = await manager.getSecret(secret.id, actorReader);
    expect(fetched.latestVersion().value).toEqual('P@ssw0rd!');
  });

  it('adds new version via put', async () => {
    const secret = await manager.createSecret('db-pass', 'P@ssw0rd!', policy, actorAdmin);
    const updated = await manager.putSecret(secret.id, 'NewP@ssw0rd!', actorAdmin);
    expect(updated.latestVersion().version).toBe(2);
  });
});
