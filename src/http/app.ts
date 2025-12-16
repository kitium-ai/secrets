import express, { type Request, type Response } from 'express';

import { Identity } from '../domain';
import { type SecretNotifier, WebhookNotifier } from '../events';
import { SecretManager } from '../manager';
import {
  FileSecretStore,
  GCPStorageSecretStore,
  PostgreSQLSecretStore,
  S3SecretStore,
  type SecretStore,
  type SecretStoreConfig,
} from '../storage';
import { createIdentityFromRequest } from './identity';
import type { ServerOptions } from './options';
import {
  parseCreateSecretPayload,
  parseUpdateSecretPayload,
  requireRouteParameter,
} from './parsing';
import { errorToStatus, sendError } from './responses';

type AsyncRouteHandler = (request: Request, response: Response) => Promise<void>;

function wrapAsync(handler: AsyncRouteHandler): (request: Request, response: Response) => void {
  return (request: Request, response: Response) => {
    void handler(request, response);
  };
}

function createStore(options: ServerOptions, baseConfig: SecretStoreConfig): SecretStore {
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
      return new FileSecretStore(options.storePath, baseConfig);
    }
  }
}

function createManager(options: ServerOptions): { manager: SecretManager; tenant: string } {
  const tenant = options.tenant ?? 'default';
  const baseConfig: SecretStoreConfig = {
    masterKey: options.masterKey,
    ...(options.auditLogPath ? { auditLogPath: options.auditLogPath } : {}),
  };

  const store = createStore(options, baseConfig);

  let eventNotifier: SecretNotifier | undefined;
  if (options.webhookUrl) {
    eventNotifier = new WebhookNotifier(options.webhookUrl, options.webhookHeaders);
  }

  return { manager: new SecretManager(store, eventNotifier), tenant };
}

const subjectHeader = 'x-subject';
const routeHealth = '/healthz';
const routeSecrets = '/secrets';
const routeSecretById = '/secrets/:id';
const rolesAll = ['admin', 'writer', 'reader'] as const;

function registerHealthRoute(app: express.Express): void {
  app.get(routeHealth, (_request: Request, response: Response) => {
    response.json({ status: 'ok' });
  });
}

function registerListSecretsRoute(
  app: express.Express,
  manager: SecretManager,
  identityFromRequest: (request: Request) => Identity
): void {
  app.get(
    routeSecrets,
    wrapAsync(async (request: Request, response: Response) => {
      try {
        const secrets = await manager.listSecrets(identityFromRequest(request));
        response.json(
          secrets.map((secret) => ({
            id: secret.id,
            name: secret.name,
            version: secret.latestVersion().version,
          }))
        );
      } catch (error: unknown) {
        sendError(response, errorToStatus(error, 403), error);
      }
    })
  );
}

function registerGetSecretRoute(
  app: express.Express,
  manager: SecretManager,
  identityFromRequest: (request: Request) => Identity
): void {
  app.get(
    routeSecretById,
    wrapAsync(async (request: Request, response: Response) => {
      try {
        const secretId = requireRouteParameter(request, 'id');
        const secret = await manager.getSecret(secretId, identityFromRequest(request));
        response.json({
          id: secret.id,
          name: secret.name,
          version: secret.latestVersion().version,
          value: secret.latestVersion().value,
        });
      } catch (error: unknown) {
        sendError(response, errorToStatus(error, 403), error);
      }
    })
  );
}

function registerCreateSecretRoute(
  app: express.Express,
  manager: SecretManager,
  tenant: string
): void {
  app.post(
    routeSecrets,
    wrapAsync(async (request: Request, response: Response) => {
      try {
        const { name, value, description, policy, ttl } = parseCreateSecretPayload(request.body);
        const actor = new Identity(request.header(subjectHeader) ?? 'http', [...rolesAll], tenant);
        const secret = await manager.createSecret(
          name,
          value,
          policy,
          actor,
          description,
          undefined,
          ttl
        );
        response.status(201).json({ id: secret.id, version: secret.latestVersion().version });
      } catch (error: unknown) {
        sendError(response, errorToStatus(error, 400), error);
      }
    })
  );
}

function registerUpdateSecretRoute(
  app: express.Express,
  manager: SecretManager,
  tenant: string
): void {
  app.put(
    routeSecretById,
    wrapAsync(async (request: Request, response: Response) => {
      try {
        const secretId = requireRouteParameter(request, 'id');
        const { value, ttl } = parseUpdateSecretPayload(request.body);
        const actor = new Identity(request.header(subjectHeader) ?? 'http', ['writer'], tenant);
        const secret = await manager.putSecret(secretId, value, actor, ttl);
        response.json({ version: secret.latestVersion().version });
      } catch (error: unknown) {
        sendError(response, errorToStatus(error, 400), error);
      }
    })
  );
}

function registerDeleteSecretRoute(
  app: express.Express,
  manager: SecretManager,
  tenant: string
): void {
  app.delete(
    routeSecretById,
    wrapAsync(async (request: Request, response: Response) => {
      try {
        const secretId = requireRouteParameter(request, 'id');
        const actor = new Identity(request.header(subjectHeader) ?? 'http', ['admin'], tenant);
        await manager.deleteSecret(secretId, actor);
        response.json({ deleted: secretId });
      } catch (error: unknown) {
        sendError(response, errorToStatus(error, 404), error);
      }
    })
  );
}

function registerRoutes(
  app: express.Express,
  manager: SecretManager,
  tenant: string,
  identityFromRequest: (request: Request) => Identity
): void {
  registerHealthRoute(app);
  registerListSecretsRoute(app, manager, identityFromRequest);
  registerGetSecretRoute(app, manager, identityFromRequest);
  registerCreateSecretRoute(app, manager, tenant);
  registerUpdateSecretRoute(app, manager, tenant);
  registerDeleteSecretRoute(app, manager, tenant);
}

export function buildApp(options: ServerOptions): express.Express {
  const { manager, tenant } = createManager(options);
  const app = express();
  app.use(express.json());

  const identityFromRequest = createIdentityFromRequest(tenant);
  registerRoutes(app, manager, tenant, identityFromRequest);

  return app;
}
