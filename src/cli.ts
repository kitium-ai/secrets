#!/usr/bin/env node
import { Command } from "commander";
import { Identity, Policy } from "./domain";
import { SecretManager } from "./manager";
import { FileSecretStore } from "./storage";

function buildManager(options: { store: string; masterKey: string; auditLog?: string }): SecretManager {
  const store = new FileSecretStore(options.store, options.masterKey, options.auditLog);
  return new SecretManager(store);
}

function identity(subject: string, roles: string[], tenant: string): Identity {
  return new Identity(subject, roles, tenant);
}

const program = new Command();
program
  .name("secret-engine")
  .description("Enterprise-ready secret manager CLI (TypeScript edition)")
  .option("--store <path>", "path to secrets store", "./data/secrets.json")
  .option("--audit-log <path>", "path to audit log", "./data/audit.log")
  .requiredOption("--master-key <value>", "master key for encrypting secrets")
  .option("--tenant <name>", "tenant namespace", "default")
  .option("--subject <name>", "actor subject for audit logging", "cli");

program
  .command("create")
  .description("Create a new secret")
  .argument("name")
  .argument("value")
  .option("--description <text>")
  .option("--policy-name <name>", "policy name", "default")
  .option("--policy-description <text>", "policy description", "Default policy")
  .option("--rotation-days <days>", "rotation frequency in days", (value) => parseInt(value, 10), 90)
  .option("--min-length <length>", "minimum secret length", (value) => parseInt(value, 10), 16)
  .option("--forbid-patterns <patterns...>", "forbidden patterns")
  .action((name, value, options) => {
    const globals = program.opts();
    const manager = buildManager(globals);
    const actor = identity(globals.subject ?? "cli", ["admin", "writer", "reader"], globals.tenant ?? "default");
    const policy = new Policy(
      options.policyName,
      options.policyDescription,
      options.rotationDays,
      options.minLength,
      options.forbidPatterns,
    );
    const secret = manager.createSecret(name, value, policy, actor, options.description);
    console.log(JSON.stringify({ id: secret.id, version: secret.latestVersion().version }, null, 2));
  });

program
  .command("get")
  .description("Retrieve a secret value")
  .argument("secretId")
  .action((secretId, options) => {
    const globals = program.opts();
    const manager = buildManager(globals);
    const actor = identity(globals.subject ?? "cli", ["reader"], globals.tenant ?? "default");
    const secret = manager.getSecret(secretId, actor);
    console.log(
      JSON.stringify(
        {
          id: secret.id,
          name: secret.name,
          tenant: secret.tenant,
          value: secret.latestVersion().value,
          version: secret.latestVersion().version,
        },
        null,
        2,
      ),
    );
  });

program
  .command("put")
  .description("Add a new version of a secret")
  .argument("secretId")
  .argument("value")
  .action((secretId, value, options) => {
    const globals = program.opts();
    const manager = buildManager(globals);
    const actor = identity(globals.subject ?? "cli", ["writer"], globals.tenant ?? "default");
    const secret = manager.putSecret(secretId, value, actor);
    console.log(JSON.stringify({ version: secret.latestVersion().version }, null, 2));
  });

program
  .command("list")
  .description("List secrets for the tenant")
  .action((options) => {
    const globals = program.opts();
    const manager = buildManager(globals);
    const actor = identity(globals.subject ?? "cli", ["reader"], globals.tenant ?? "default");
    const secrets = manager.listSecrets(actor);
    console.log(
      JSON.stringify(
        secrets.map((secret) => ({
          id: secret.id,
          name: secret.name,
          tenant: secret.tenant,
          version: secret.latestVersion().version,
        })),
        null,
        2,
      ),
    );
  });

program
  .command("delete")
  .description("Delete a secret")
  .argument("secretId")
  .action((secretId, options) => {
    const globals = program.opts();
    const manager = buildManager(globals);
    const actor = identity(globals.subject ?? "cli", ["admin"], globals.tenant ?? "default");
    manager.deleteSecret(secretId, actor);
    console.log(JSON.stringify({ deleted: secretId }, null, 2));
  });

program.parseAsync(process.argv);
