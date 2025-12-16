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
    .option('--store <path>', 'path to secret store', './data/secrets.json')
    .option('--audit-log <path>', 'path to audit log', './data/audit.log')
    .requiredOption('--master-key <value>', 'master key for encryption')
    .option('--tenant <name>', 'tenant identifier', 'default')
    .option('--port <number>', 'port to listen on', (value) => parseInt(value, 10), 8080);

  program.action((options) => {
    serve({
      storePath: options.store,
      masterKey: options.masterKey,
      auditLogPath: options.auditLog,
      tenant: options.tenant,
      port: options.port,
    });
  });

  program.parse(process.argv);
}
