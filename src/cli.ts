#!/usr/bin/env node
import { Command } from 'commander';

import { Identity, Policy } from './domain';
import { SecretManager } from './manager';
import {
  FileSecretStore,
  GCPStorageSecretStore,
  PostgreSQLSecretStore,
  S3SecretStore,
  type SecretStore,
  type SecretStoreConfig,
} from './storage';

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

type StoreOptions = {
  storage?: 'file' | 's3' | 'gcp' | 'postgres';
  filePath: string;
  s3Bucket?: string;
  s3Region?: string;
  gcpBucket?: string;
  gcpProjectId?: string;
  dbConnectionString?: string;
};

function createStore(baseConfig: SecretStoreConfig, options: StoreOptions): SecretStore {
  const storage = options.storage ?? 'file';
  switch (storage) {
    case 's3': {
      if (!options.s3Bucket || !options.s3Region) {
        throw new Error('S3 bucket and region are required for S3 storage');
      }
      return new S3SecretStore({
        ...baseConfig,
        bucket: options.s3Bucket,
        region: options.s3Region,
      });
    }
    case 'gcp': {
      if (!options.gcpBucket) {
        throw new Error('GCP bucket is required for GCP storage');
      }
      return new GCPStorageSecretStore({
        ...baseConfig,
        bucket: options.gcpBucket,
        ...(options.gcpProjectId ? { projectId: options.gcpProjectId } : {}),
      });
    }
    case 'postgres': {
      if (!options.dbConnectionString) {
        throw new Error('Database connection string is required for PostgreSQL storage');
      }
      return new PostgreSQLSecretStore({
        ...baseConfig,
        connectionString: options.dbConnectionString,
      });
    }
    case 'file': {
      return new FileSecretStore(options.filePath, baseConfig);
    }
  }
}

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

  const store = createStore(baseConfig, {
    filePath: options.store,
    ...(options.storage ? { storage: options.storage } : {}),
    ...(options.s3Bucket ? { s3Bucket: options.s3Bucket } : {}),
    ...(options.s3Region ? { s3Region: options.s3Region } : {}),
    ...(options.gcpBucket ? { gcpBucket: options.gcpBucket } : {}),
    ...(options.gcpProjectId ? { gcpProjectId: options.gcpProjectId } : {}),
    ...(options.dbConnectionString ? { dbConnectionString: options.dbConnectionString } : {}),
  });

  return new SecretManager(store);
}

function buildStoreFromGlobals(globals: GlobalOptions): SecretStore {
  const baseConfig: SecretStoreConfig = {
    masterKey: globals.masterKey,
    ...(globals.auditLog ? { auditLogPath: globals.auditLog } : {}),
  };

  return createStore(baseConfig, {
    filePath: globals.store,
    ...(globals.storage ? { storage: globals.storage } : {}),
    ...(globals.s3Bucket ? { s3Bucket: globals.s3Bucket } : {}),
    ...(globals.s3Region ? { s3Region: globals.s3Region } : {}),
    ...(globals.gcpBucket ? { gcpBucket: globals.gcpBucket } : {}),
    ...(globals.gcpProjectId ? { gcpProjectId: globals.gcpProjectId } : {}),
    ...(globals.dbConnectionString ? { dbConnectionString: globals.dbConnectionString } : {}),
  });
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
    const secret = await manager.createSecret(
      name,
      value,
      policy,
      actor,
      options.description,
      undefined,
      options.ttl
    );
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

// Phase 2: Advanced Enterprise Features
program
  .command('rotate')
  .description('Manually rotate a secret')
  .argument('secretId')
  .action(async (secretId) => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);
    const actor = identity(globals.subject ?? 'cli', ['writer'], globals.tenant ?? 'default');
    await manager.rotate(secretId, actor);
    console.info(JSON.stringify({ rotated: secretId }, null, 2));
  });

program
  .command('compliance-report')
  .description('Generate a compliance report')
  .option('--start-date <date>', 'Start date (ISO format)', (value) => new Date(value))
  .option('--end-date <date>', 'End date (ISO format)', (value) => new Date(value))
  .option('--format <format>', 'Output format (json|csv)', 'json')
  .action(async (options) => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);

    const { ComplianceAuditor: complianceAuditorCtor } = await import('./compliance');
    const auditor = new complianceAuditorCtor(manager);

    const startDate = options.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = options.endDate ?? new Date();

    const report = await auditor.generateComplianceReport(startDate, endDate, globals.tenant);

    if (options.format === 'csv') {
      const csv = await auditor.exportAuditReport('csv', report);
      console.info(csv.toString());
    } else {
      console.info(JSON.stringify(report, null, 2));
    }
  });

program
  .command('health-check')
  .description('Run health checks and show system status')
  .action(async () => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);
    const store = buildStoreFromGlobals(globals);

    const { HealthMonitor: healthMonitorCtor } = await import('./monitoring');
    const monitor = new healthMonitorCtor(manager, store, {
      healthCheckIntervalMs: 60000, // 1 minute
      metricsRetentionHours: 24,
    });

    const health = await monitor.checkHealth();
    console.info(JSON.stringify(health, null, 2));
  });

// Phase 3: Advanced Security & Scalability
program
  .command('rotate-keys')
  .description('Rotate encryption keys')
  .action(async () => {
    const globals = program.opts() as GlobalOptions;

    const { AdvancedEncryptionManager: advancedEncryptionManagerCtor } =
      await import('./encryption');
    const encryptionManager = new advancedEncryptionManagerCtor({
      masterKey: globals.masterKey,
      keyRotationDays: 90,
      keySize: 32,
      algorithm: 'aes-256-gcm',
    });

    const newKeyId = await encryptionManager.rotateKey();
    console.info(JSON.stringify({ newKeyId, rotated: true }, null, 2));
  });

program
  .command('create-backup')
  .description('Create a backup of all secrets')
  .argument('backupId')
  .action(async (backupId) => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);

    const { BackupManager: backupManagerCtor } = await import('./encryption');
    const backupManager = new backupManagerCtor('./backups');

    // Get all secrets for backup
    const actor = identity(globals.subject ?? 'cli', ['reader'], globals.tenant ?? 'default');
    const secrets = await manager.listSecrets(actor);

    await backupManager.createBackup(secrets);
    console.info(JSON.stringify({ backupId, created: true }, null, 2));
  });

program
  .command('performance-stats')
  .description('Show performance statistics')
  .action(async () => {
    const globals = program.opts() as GlobalOptions;
    const manager = buildManagerFromGlobals(globals);

    const { PerformanceMonitor: performanceMonitorCtor } = await import('./performance');
    const monitor = new performanceMonitorCtor(manager, {
      metricsRetentionMs: 3600000, // 1 hour
      samplingRate: 1.0,
      alertThresholds: {
        maxLatencyMs: 1000,
        maxErrorRate: 0.05,
        minThroughput: 10,
      },
    });

    const metrics = monitor.getMetrics();
    const healthScore = monitor.getHealthScore();
    const alerts = monitor.getAlerts();

    console.info(
      JSON.stringify(
        {
          healthScore,
          metrics,
          alerts,
        },
        null,
        2
      )
    );
  });

program
  .command('docker-deploy')
  .description('Deploy application with secrets to Docker')
  .argument('containerName')
  .argument('image')
  .option('--env <key=value...>', 'Environment variables')
  .option('--secret <key=value...>', 'Secrets to inject')
  .action(async (containerName, image, options) => {
    const { DockerIntegration: dockerIntegrationCtor } = await import('./containers');
    const docker = new dockerIntegrationCtor();

    const environmentVariables: Record<string, string> = {};
    const secrets: Record<string, string> = {};

    if (options.env) {
      options.env.forEach((environment: string) => {
        const parts = environment.split('=', 2);
        const key = parts[0] ?? '';
        const value = parts[1] ?? '';
        environmentVariables[key] = value;
      });
    }

    if (options.secret) {
      options.secret.forEach((secret: string) => {
        const parts = secret.split('=', 2);
        const key = parts[0] ?? '';
        const value = parts[1] ?? '';
        secrets[key] = value;
      });
    }

    const config = {
      image,
      environment: environmentVariables,
      volumes: [],
      ports: {},
      secrets,
    };

    const containerId = await docker.createContainer(containerName, config);
    if (Object.keys(secrets).length > 0) {
      await docker.injectSecrets(containerId, secrets);
    }

    console.info(JSON.stringify({ containerId, deployed: true }, null, 2));
  });

program
  .command('k8s-create-secret')
  .description('Create a secret in Kubernetes')
  .argument('secretName')
  .option('--namespace <ns>', 'Kubernetes namespace', 'default')
  .option('--data <key=value...>', 'Secret data')
  .action(async (secretName, options) => {
    const { K8sIntegration: k8sIntegrationCtor } = await import('./containers');
    const k8s = new k8sIntegrationCtor();

    const data: Record<string, string> = {};
    if (options.data) {
      options.data.forEach((item: string) => {
        const parts = item.split('=', 2);
        const key = parts[0] ?? '';
        const value = parts[1] ?? '';
        data[key] = value;
      });
    }

    await k8s.createSecret(secretName, options.namespace, data);
    console.info(
      JSON.stringify({ secretName, namespace: options.namespace, created: true }, null, 2)
    );
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
