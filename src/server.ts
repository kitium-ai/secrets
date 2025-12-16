import { Command } from 'commander';

import { buildApp } from './http/app';
import type { ServerOptions } from './http/options';

export { buildApp };

export function serve(options: ServerOptions): void {
  const app = buildApp(options);
  const port = options.port ?? 8080;
  app.listen(port, () => {
    console.info(`Secrets server listening on port ${port}`);
  });
}

if (require.main === module) {
  const program = new Command();
  program
    .option('--store <path>', 'path to secret store (for file storage)', './data/secrets.json')
    .option('--audit-log <path>', 'path to audit log', './data/audit.log')
    .requiredOption('--master-key <value>', 'master key for encryption')
    .option('--tenant <name>', 'tenant identifier', 'default')
    .option('--port <number>', 'port to listen on', (value) => parseInt(value, 10), 8080)
    .option('--storage <type>', 'storage backend (file, s3, gcp, postgres)', 'file')
    .option('--s3-bucket <bucket>', 'S3 bucket name for S3 storage')
    .option('--s3-region <region>', 'AWS region for S3 storage')
    .option('--gcp-bucket <bucket>', 'GCP bucket name for GCP storage')
    .option('--gcp-project-id <projectId>', 'GCP project ID for GCP storage')
    .option('--db-connection-string <conn>', 'PostgreSQL connection string for database storage')
    .option('--webhook-url <url>', 'webhook URL for event notifications');

  program.action((options) => {
    serve({
      storePath: options.store,
      masterKey: options.masterKey,
      auditLogPath: options.auditLog,
      tenant: options.tenant,
      port: options.port,
      storage: options.storage,
      s3Bucket: options.s3Bucket,
      s3Region: options.s3Region,
      gcpBucket: options.gcpBucket,
      gcpProjectId: options.gcpProjectId,
      dbConnectionString: options.dbConnectionString,
      webhookUrl: options.webhookUrl,
    });
  });

  program.parse(process.argv);
}
