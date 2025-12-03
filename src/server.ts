import { Command } from "commander";
import express, { Request, Response } from "express";
import { Identity, Policy } from "./domain";
import { SecretManager } from "./manager";
import { FileSecretStore } from "./storage";

export interface ServerOptions {
  storePath: string;
  masterKey: string;
  auditLogPath?: string;
  tenant?: string;
  port?: number;
}

export function buildApp(options: ServerOptions): express.Express {
  const tenant = options.tenant ?? "default";
  const store = new FileSecretStore(options.storePath, options.masterKey, options.auditLogPath);
  const manager = new SecretManager(store);
  const app = express();
  app.use(express.json());

  const identityFromRequest = (req: Request): Identity => {
    const subject = req.header("x-subject") ?? "http";
    const rolesHeader = req.header("x-roles") ?? "reader";
    const roles = rolesHeader.split(",").map((role) => role.trim()).filter(Boolean);
    return new Identity(subject, roles, tenant);
  };

  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/secrets", (req: Request, res: Response) => {
    try {
      const secrets = manager.listSecrets(identityFromRequest(req));
      res.json(
        secrets.map((secret) => ({
          id: secret.id,
          name: secret.name,
          version: secret.latestVersion().version,
        })),
      );
    } catch (error: unknown) {
      res.status(403).json({ error: (error as Error).message });
    }
  });

  app.get("/secrets/:id", (req: Request, res: Response) => {
    try {
      const secret = manager.getSecret(req.params.id, identityFromRequest(req));
      res.json({
        id: secret.id,
        name: secret.name,
        version: secret.latestVersion().version,
        value: secret.latestVersion().value,
      });
    } catch (error: unknown) {
      const status = (error as Error).message.includes("not found") ? 404 : 403;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  app.post("/secrets", (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (typeof body.name !== "string" || typeof body.value !== "string") {
        throw new Error("name and value are required fields");
      }
      const policyPayload = body.policy ?? {};
      const policy = new Policy(
        policyPayload.name ?? "default",
        policyPayload.description ?? "created via http",
        policyPayload.rotationDays ?? 90,
        policyPayload.minLength ?? 16,
        policyPayload.forbidPatterns,
        policyPayload.allowedCidrs,
      );
      const secret = manager.createSecret(
        body.name,
        body.value,
        policy,
        new Identity(req.header("x-subject") ?? "http", ["admin", "writer", "reader"], tenant),
        body.description,
      );
      res.status(201).json({ id: secret.id, version: secret.latestVersion().version });
    } catch (error: unknown) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.put("/secrets/:id", (req: Request, res: Response) => {
    try {
      if (typeof req.body?.value !== "string") {
        throw new Error("value is required");
      }
      const secret = manager.putSecret(
        req.params.id,
        req.body?.value,
        new Identity(req.header("x-subject") ?? "http", ["writer"], tenant),
      );
      res.json({ version: secret.latestVersion().version });
    } catch (error: unknown) {
      const status = (error as Error).message.includes("required role") ? 403 : 400;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  app.delete("/secrets/:id", (req: Request, res: Response) => {
    try {
      manager.deleteSecret(req.params.id, new Identity(req.header("x-subject") ?? "http", ["admin"], tenant));
      res.json({ deleted: req.params.id });
    } catch (error: unknown) {
      const status = (error as Error).message.includes("required role") ? 403 : 404;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  return app;
}

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
    .option("--store <path>", "path to secret store", "./data/secrets.json")
    .option("--audit-log <path>", "path to audit log", "./data/audit.log")
    .requiredOption("--master-key <value>", "master key for encryption")
    .option("--tenant <name>", "tenant identifier", "default")
    .option("--port <number>", "port to listen on", (value) => parseInt(value, 10), 8080);

  program.action((opts) => {
    serve({
      storePath: opts.store,
      masterKey: opts.masterKey,
      auditLogPath: opts.auditLog,
      tenant: opts.tenant,
      port: opts.port,
    });
  });

  program.parse(process.argv);
}
