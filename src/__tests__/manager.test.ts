import { describe, it, expect } from 'vitest';
import { SecretManager } from '../manager';
import { FileSecretStore } from '../storage';
import { Identity, Policy } from '../domain';
import fs from 'fs';
import path from 'path';

const tmp = path.resolve(__dirname, '..', '..', '.tmp-tests');
const storePath = path.join(tmp, 'secrets.json');
const auditPath = path.join(tmp, 'audit.log');

function reset() {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
}

describe('manager', () => {
  reset();
  const masterKey = 'test-master-key';
  const store = new FileSecretStore(storePath, masterKey, auditPath);
  const manager = new SecretManager(store);
  const actorAdmin = new Identity('tester', ['admin', 'writer', 'reader'], 'default');
  const actorReader = new Identity('reader', ['reader'], 'default');
  const policy = new Policy('default', 'test', 30, 8);

  it('creates and retrieves secret', () => {
    const secret = manager.createSecret('db-pass', 'P@ssw0rd!', policy, actorAdmin, 'db password');
    const fetched = manager.getSecret(secret.id, actorReader);
    expect(fetched.latestVersion().value).toEqual('P@ssw0rd!');
  });

  it('adds new version via put', () => {
    const [s] = manager.listSecrets(actorReader);
    const updated = manager.putSecret(s.id, 'NewP@ssw0rd!', actorAdmin);
    expect(updated.latestVersion().version).toBe(2);
  });
});
