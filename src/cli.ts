#!/usr/bin/env node
import { Command } from 'commander';

import { Identity, Policy } from './domain';
import { SecretManager } from './manager';
import { FileSecretStore, S3SecretStore, GCPStorageSecretStore, PostgreSQLSecretStore, type SecretStoreConfig } from './storage';

type GlobalOptions = {
  store: string;
  masterKey: string;
  auditLog?: string;
  tenant?: string;
  subject?: string;
  storage?: 'file' | 's3' | 'gcp' | 'postgres';
  s3Bucket?: string;
  s3Region?: string;
  gcpBucket?: string;
  gcpProjectId?: string;
  dbConnectionString?: string;
};

function buildManager(options: {
  store: string;
  masterKey: string;
  auditLog?: string | undefined;
  storage?: 'file' | 's3' | 'gcp' | 'postgres';
  s3Bucket?: string;
  s3Region?: string;
  gcpBucket?: string;
  gcpProjectId?: string;
  dbConnectionString?: string;
}): SecretManager {
  const baseConfig: SecretStoreConfig = {
    masterKey: options.masterKey,
    ...(options.auditLog ? { auditLogPath: options.auditLog } : {}),
  };

  let store: any;

  switch (options.storage) {
    case 's3':
      if (!options.s3Bucket || !options.s3Region) {
        throw new Error('S3 bucket and region are required for S3 storage');
      }
      store = new S3SecretStore({
        ...baseConfig,
        bucket: options.s3Bucket,
        region: options.s3Region,
      });
      break;
    case 'gcp':
      if (!options.gcpBucket) {
        throw new Error('GCP bucket is required for GCP storage');
      }
      store = new GCPStorageSecretStore({
        ...baseConfig,
        bucket: options.gcpBucket,
        ...(options.gcpProjectId ? { projectId: options.gcpProjectId } : {}),
      });
      break;
    case 'postgres':
      if (!options.dbConnectionString) {
        throw new Error('Database connection string is required for PostgreSQL storage');
      }
      store = new PostgreSQLSecretStore({
        ...baseConfig,
        connectionString: options.dbConnectionString,
      });
      break;
    default:
      store = new FileSecretStore(options.store, baseConfig);
  }

  return new SecretManager(store);
}

function identity(subject: string, roles: string[], tenant: string): Identity {
  return new Identity(subject, roles, tenant);
}

function buildManagerFromGlobals(globals: GlobalOptions): SecretManager {
  return buildManager({
    store: globals.store,
    masterKey: globals.masterKey,
    auditLog: globals.auditLog,
    ...(globals.storage ? { storage: globals.storage } : {}),
    ...(globals.s3Bucket ? { s3Bucket: globals.s3Bucket } : {}),
    ...(globals.s3Region ? { s3Region: globals.s3Region } : {}),
    ...(globals.gcpBucket ? { gcpBucket: globals.gcpBucket } : {}),
    ...(globals.gcpProjectId ? { gcpProjectId: globals.gcpProjectId } : {}),
    ...(globals.dbConnectionString ? { dbConnectionString: globals.dbConnectionString } : {}),
  });
}

const program = new Command();
program
  .name('secret-engine')
  .description('Enterprise-ready secret manager CLI (TypeScript edition)')
  .option('--store <path>', 'path to secrets store (for file storage)', './data/secrets.json')
  .option('--audit-log <path>', 'path to audit log', './data/audit.log')
  .requiredOption('--master-key <value>', 'master key for encrypting secrets')
  .option('--tenant <name>', 'tenant namespace', 'default')
  .option('--subject <name>', 'actor subject for audit logging', 'cli')
  .option('--storage <type>', 'storage backend (file, s3, gcp, postgres)', 'file')
  .option('--s3-bucket <bucket>', 'S3 bucket name for S3 storage')
  .option('--s3-region <region>', 'AWS region for S3 storage')
  .option('--gcp-bucket <bucket>', 'GCP bucket name for GCP storage')
  .option('--gcp-project-id <projectId>', 'GCP project ID for GCP storage')
  .option('--db-connection-string <conn>', 'PostgreSQL connection string for database storage');

program
  .command('create')
  .description('Create a new secret')
  .argument('name')
  .argument('value')
  .option('--description <text>')
  .option('--policy-name <name>', 'policy name', 'default')
  .option('--policy-description <text>', 'policy description', 'Default policy')
  .option(
    '--rotation-days <days>',
    'rotation frequency in days',
    (value) => parseInt(value, 10),
    90
  )
  .option('--min-length <length>', 'minimum secret length', (value) => parseInt(value, 10), 16)
  .option('--forbid-patterns <patterns...>', 'forbidden patterns')
  .option('--ttl <seconds>', 'time-to-live in seconds', (value) => parseInt(value, 10))
  .action(async (name, value, options) => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);
    const actor = identity(
      globals.subject ?? 'cli',
      ['admin', 'writer', 'reader'],
      globals.tenant ?? 'default'
    );
    const policy = new Policy(
      options.policyName,
      options.policyDescription,
      options.rotationDays,
      options.minLength,
      options.forbidPatterns
    );
    const secret = await manager.createSecret(name, value, policy, actor, options.description, undefined, options.ttl);
    console.info(
      JSON.stringify({ id: secret.id, version: secret.latestVersion().version }, null, 2)
    );
  });

program
  .command('get')
  .description('Retrieve a secret value')
  .argument('secretId')
  .action(async (secretId) => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);
    const actor = identity(globals.subject ?? 'cli', ['reader'], globals.tenant ?? 'default');
    const secret = await manager.getSecret(secretId, actor);
    console.info(
      JSON.stringify(
        {
          id: secret.id,
          name: secret.name,
          tenant: secret.tenant,
          value: secret.latestVersion().value,
          version: secret.latestVersion().version,
        },
        null,
        2
      )
    );
  });

program
  .command('put')
  .description('Add a new version of a secret')
  .argument('secretId')
  .argument('value')
  .option('--ttl <seconds>', 'time-to-live in seconds', (value) => parseInt(value, 10))
  .action(async (secretId, value, options) => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);
    const actor = identity(globals.subject ?? 'cli', ['writer'], globals.tenant ?? 'default');
    const secret = await manager.putSecret(secretId, value, actor, options.ttl);
    console.info(JSON.stringify({ version: secret.latestVersion().version }, null, 2));
  });

program
  .command('list')
  .description('List secrets for the tenant')
  .action(async () => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);
    const actor = identity(globals.subject ?? 'cli', ['reader'], globals.tenant ?? 'default');
    const secrets = await manager.listSecrets(actor);
    console.info(
      JSON.stringify(
        secrets.map((secret) => ({
          id: secret.id,
          name: secret.name,
          tenant: secret.tenant,
          version: secret.latestVersion().version,
        })),
        null,
        2
      )
    );
  });

program
  .command('delete')
  .description('Delete a secret')
  .argument('secretId')
  .action(async (secretId) => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);
    const actor = identity(globals.subject ?? 'cli', ['admin'], globals.tenant ?? 'default');
    await manager.deleteSecret(secretId, actor);
    console.info(JSON.stringify({ deleted: secretId }, null, 2));
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
