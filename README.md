# @kitiumai/secrets

An enterprise-grade secret management toolkit implemented in TypeScript with encrypted storage, RBAC-aware APIs, rotation hooks, and developer-friendly CLI/HTTP endpoints. The package mirrors the evaluation recommendations for an end-to-end MVP while remaining lightweight for local and CI usage.

## Features
- **Secure encrypted storage** with AES-256-GCM, integrity checks, and master-key-derived encryption.
- **Versioning and rotation** with checksum tracking and optional rotation handlers.
- **Policy enforcement** for minimum length and forbidden patterns; tenant-aware RBAC roles (admin, writer, reader).
- **Audit logs and metrics** written to file/console for SIEM ingestion and observability.
- **CLI and HTTP API** for CRUD operations, health checks, and quick integration into pipelines.
- **Multiple storage backends**: File, AWS S3, Google Cloud Storage, PostgreSQL.
- **Dynamic secrets** with TTL-based expiration and leasing.
- **Event notifications** via webhooks for real-time monitoring.
- **Compliance-ready defaults** (rotation cadence, auditability, data residency via file placement).

## Getting Started
1. Install dependencies and build the package:
   ```bash
   npm install
   npm run build
   ```
2. Export a master key (keep it safe):
   ```bash
   export MASTER_KEY="change-me-please"
   ```
3. Create a secret using the CLI (compiled output):
   ```bash
   # File storage (default)
   node dist/cjs/cli.js \
     --master-key "$MASTER_KEY" \
     --store ./data/secrets.json \
     --audit-log ./data/audit.log \
     create db_password "s3cr3t-value" --policy-name pci --min-length 12

   # AWS S3 storage
   node dist/cjs/cli.js \
     --master-key "$MASTER_KEY" \
     --storage s3 \
     --s3-bucket my-secrets-bucket \
     --s3-region us-east-1 \
     create db_password "s3cr3t-value"

   # Google Cloud Storage
   node dist/cjs/cli.js \
     --master-key "$MASTER_KEY" \
     --storage gcp \
     --gcp-bucket my-secrets-bucket \
     create db_password "s3cr3t-value"

   # PostgreSQL storage
   node dist/cjs/cli.js \
     --master-key "$MASTER_KEY" \
     --storage postgres \
     --db-connection-string "postgresql://user:pass@localhost:5432/secrets" \
     create db_password "s3cr3t-value"
   ```
4. Read the secret:
   ```bash
   node dist/cjs/cli.js --master-key "$MASTER_KEY" get <secret-id>
   ```
5. Start the HTTP service locally:
   ```bash
   # With webhook notifications
   node dist/cjs/server.js \
     --master-key "$MASTER_KEY" \
     --storage s3 \
     --s3-bucket my-secrets-bucket \
     --s3-region us-east-1 \
     --webhook-url https://my-webhook.example.com/secrets
   ```
6. Fetch via HTTP:
   ```bash
   curl -H "x-subject: demo" -H "x-roles: reader" http://localhost:8080/secrets/<secret-id>
   ```

### TypeScript SDK Example
```ts
import { FileSecretStore, Identity, Policy, SecretManager, WebhookNotifier } from "secret-engine";

const store = new FileSecretStore("./data/secrets.json", "change-me", "./data/audit.log");
const webhookNotifier = new WebhookNotifier("https://my-webhook.example.com/secrets");
const manager = new SecretManager(store, webhookNotifier);
const actor = new Identity("app", ["admin", "writer", "reader"], "default");
const policy = new Policy("default", "baseline", 60, 12);

// Create a secret with TTL (expires in 1 hour)
const secret = manager.createSecret("db_password", "supersafe-value", policy, actor, "db password", undefined, 3600);
const retrieved = manager.getSecret(secret.id, new Identity("app", ["reader"], "default"));
console.log(retrieved.latestVersion().value);

// Create a secret with AWS S3 storage
import { S3SecretStore } from "secret-engine";
const s3Store = new S3SecretStore({
  masterKey: "change-me",
  bucket: "my-secrets-bucket",
  region: "us-east-1"
});
const s3Manager = new SecretManager(s3Store);
```

### HTTP API
- `GET /healthz` → `{ "status": "ok" }`
- `GET /secrets` → list all secrets for tenant using `x-subject` and `x-roles` headers
- `GET /secrets/:id` → returns `{ id, name, version, value }`
- `POST /secrets` with body:
  ```json
  {
    "name": "db_password",
    "value": "super-secret",
    "description": "database credential",
    "policy": {"name": "default", "rotationDays": 60, "min_length": 12},
    "ttl": 3600
  }
  ```
  Headers: `x-subject`, `x-roles` (include `admin,writer,reader`)
- `PUT /secrets/:id` with body `{ "value": "new-secret", "ttl": 7200 }` and header `x-roles: writer`
- `DELETE /secrets/:id` with header `x-roles: admin`

### CLI
- `create <name> <value>` create a secret (supports `--ttl <seconds>`)
- `get <secret_id>` retrieve value
- `put <secret_id> <value>` add new version (supports `--ttl <seconds>`)
- `list` enumerate secrets
- `delete <secret_id>` remove a secret

**Storage Options:**
- `--storage <type>`: file, s3, gcp, postgres
- `--s3-bucket <bucket>`: S3 bucket name
- `--s3-region <region>`: AWS region
- `--gcp-bucket <bucket>`: GCP bucket name
- `--db-connection-string <conn>`: PostgreSQL connection string

**Server Options:**
- `--webhook-url <url>`: Webhook URL for event notifications

## Operations and Reliability
- File-based storage supports **backups and restores** via file snapshots and VCS.
- Audit logs are **append-only** and can be shipped to SIEM tools.
- Health endpoint (`/healthz`) enables **liveness** checks; metrics are logged for SLO dashboards.
- Deterministic master keys enable **disaster recovery** and **multi-region sync** via file replication.

## Rotation and Lifecycle
- Register a rotation handler in code (e.g., calling a cloud function) and invoke `manager.rotate(secretId, actor)`.
- Policies enforce rotation cadence through `rotationDays`; future CI hooks can validate recency.

## Compliance & Governance
- Policies include rotation frequency, minimum length, and forbidden patterns for **guardrails**.
- Audit logs supply **tamper-evident** records when paired with log shipping and checksums.
- Tenants enable **isolation** across teams or environments.

## Developer Experience
- Ships with TypeScript examples plus **HTTP/CLI tooling** for local and CI/CD use.
- Compatible with secret scanning workflows; output JSON is deterministic for tests/backups.

## Support & Onboarding
- Threat model entry point: see `EVALUATION.md` for risks and mitigations.
- Customer onboarding checklist: create master key, configure storage path, set tenant roles, integrate CLI/HTTP in pipelines.
