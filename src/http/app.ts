import express, { type Request, type Response } from 'express';

import { Identity } from '../domain';
import { SecretManager } from '../manager';
import { FileSecretStore } from '../storage';
import { createIdentityFromRequest } from './identity';
import type { ServerOptions } from './options';
import {
  parseCreateSecretPayload,
  parseUpdateSecretPayload,
  requireRouteParameter,
} from './parsing';
import { errorToStatus, sendError } from './responses';

function createManager(options: ServerOptions): { manager: SecretManager; tenant: string } {
  const tenant = options.tenant ?? 'default';
  const store = new FileSecretStore(options.storePath, options.masterKey, options.auditLogPath);
  return { manager: new SecretManager(store), tenant };
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
  app.get(routeSecrets, (request: Request, response: Response) => {
    try {
      const secrets = manager.listSecrets(identityFromRequest(request));
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
  });
}

function registerGetSecretRoute(
  app: express.Express,
  manager: SecretManager,
  identityFromRequest: (request: Request) => Identity
): void {
  app.get(routeSecretById, (request: Request, response: Response) => {
    try {
      const secretId = requireRouteParameter(request, 'id');
      const secret = manager.getSecret(secretId, identityFromRequest(request));
      response.json({
        id: secret.id,
        name: secret.name,
        version: secret.latestVersion().version,
        value: secret.latestVersion().value,
      });
    } catch (error: unknown) {
      sendError(response, errorToStatus(error, 403), error);
    }
  });
}

function registerCreateSecretRoute(
  app: express.Express,
  manager: SecretManager,
  tenant: string
): void {
  app.post(routeSecrets, (request: Request, response: Response) => {
    try {
      const { name, value, description, policy } = parseCreateSecretPayload(request.body);
      const actor = new Identity(request.header(subjectHeader) ?? 'http', [...rolesAll], tenant);
      const secret = manager.createSecret(name, value, policy, actor, description);
      response.status(201).json({ id: secret.id, version: secret.latestVersion().version });
    } catch (error: unknown) {
      sendError(response, errorToStatus(error, 400), error);
    }
  });
}

function registerUpdateSecretRoute(
  app: express.Express,
  manager: SecretManager,
  tenant: string
): void {
  app.put(routeSecretById, (request: Request, response: Response) => {
    try {
      const secretId = requireRouteParameter(request, 'id');
      const { value } = parseUpdateSecretPayload(request.body);
      const actor = new Identity(request.header(subjectHeader) ?? 'http', ['writer'], tenant);
      const secret = manager.putSecret(secretId, value, actor);
      response.json({ version: secret.latestVersion().version });
    } catch (error: unknown) {
      sendError(response, errorToStatus(error, 400), error);
    }
  });
}

function registerDeleteSecretRoute(
  app: express.Express,
  manager: SecretManager,
  tenant: string
): void {
  app.delete(routeSecretById, (request: Request, response: Response) => {
    try {
      const secretId = requireRouteParameter(request, 'id');
      const actor = new Identity(request.header(subjectHeader) ?? 'http', ['admin'], tenant);
      manager.deleteSecret(secretId, actor);
      response.json({ deleted: secretId });
    } catch (error: unknown) {
      sendError(response, errorToStatus(error, 404), error);
    }
  });
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
