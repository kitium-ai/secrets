# @kitiumai/secrets

An enterprise-grade secret management toolkit implemented in TypeScript with encrypted storage, RBAC-aware APIs, rotation hooks, and developer-friendly CLI/HTTP endpoints. The package mirrors the evaluation recommendations for an end-to-end MVP while remaining lightweight for local and CI usage.

## What is this package?

**@kitiumai/secrets** is a comprehensive, production-ready secret management solution designed for modern TypeScript applications. It provides secure storage, access control, automated rotation, compliance auditing, and cloud-native integrations in a single, lightweight package.

### Key Capabilities

- **🔐 Secure Storage**: AES-256-GCM encryption with envelope encryption and key rotation
- **🔄 Automated Rotation**: Scheduled secret rotation with maintenance windows
- **📊 Compliance & Audit**: Built-in compliance reporting and violation detection
- **☁️ Cloud Native**: Native integrations with AWS, GCP, Kubernetes, and Docker
- **⚡ High Performance**: Connection pooling, caching, and real-time monitoring
- **🛡️ Access Control**: Time-based, IP-based, and role-based access policies
- **📈 Enterprise Ready**: Multi-tenant, multi-region, backup/recovery

## Why we need this package?

In modern application development, secrets management is critical but often overlooked. Traditional approaches suffer from:

### Problems with Current Solutions

- **🔓 Insecure Storage**: Plaintext secrets in environment variables or config files
- **⏰ Manual Rotation**: Forgotten password rotations leading to security incidents
- **📋 Compliance Gaps**: Lack of audit trails and compliance reporting
- **🔗 Integration Complexity**: Difficult integration with cloud services and containers
- **⚙️ Operational Burden**: No monitoring, alerting, or performance optimization

### Business Value

- **Security**: Enterprise-grade encryption and access controls
- **Compliance**: Automated compliance reporting and audit trails
- **Productivity**: Developer-friendly CLI and APIs reduce integration time
- **Reliability**: Built-in monitoring, health checks, and failover
- **Scalability**: High-performance architecture supporting enterprise workloads

## Competitor Comparison

| Feature | @kitiumai/secrets | HashiCorp Vault | AWS Secrets Manager | Azure Key Vault | GCP Secret Manager |
|---------|------------------|-----------------|-------------------|----------------|-------------------|
| **Language** | TypeScript | Go | Cloud Service | Cloud Service | Cloud Service |
| **Self-Hosted** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Encryption** | AES-256-GCM + Envelope | AES-256-GCM | AES-256-GCM | AES-256 | AES-256 |
| **Key Rotation** | ✅ Automated | ✅ Manual | ✅ Automated | ✅ Automated | ✅ Automated |
| **Access Control** | ✅ RBAC + Time/IP | ✅ ACL/Policies | ✅ IAM | ✅ RBAC | ✅ IAM |
| **Audit Logging** | ✅ Built-in | ✅ Enterprise | ✅ CloudTrail | ✅ Logs | ✅ Audit Logs |
| **Compliance** | ✅ SOC2/PCI Ready | ✅ Enterprise | ✅ Enterprise | ✅ Enterprise | ✅ Enterprise |
| **CLI Tools** | ✅ Native | ✅ | ❌ | ❌ | ❌ |
| **HTTP API** | ✅ REST | ✅ | ✅ | ✅ | ✅ |
| **Multi-Cloud** | ✅ AWS/GCP/K8s | ✅ | ❌ | ❌ | ❌ |
| **Container Integration** | ✅ Docker/K8s | ✅ | Limited | Limited | Limited |
| **Performance Monitoring** | ✅ Built-in | Enterprise | ❌ | ❌ | ❌ |
| **Backup/Recovery** | ✅ Automated | Enterprise | ❌ | ❌ | ❌ |
| **Cost** | Free/Open Source | Enterprise License | Pay-per-use | Pay-per-use | Pay-per-use |
| **Setup Complexity** | Low (npm install) | High | Medium | Medium | Medium |

## Unique Selling Proposition (USP)

### 🎯 **Developer-First Design**
Unlike enterprise-focused solutions, @kitiumai/secrets is built by developers for developers. Native TypeScript support, intuitive APIs, and comprehensive CLI tools make integration seamless.

### 🚀 **Complete Enterprise Stack**
Most secret managers focus on storage. We provide the complete enterprise stack: encryption, rotation, compliance, monitoring, and cloud integrations - all in one package.

### ⚡ **High Performance & Monitoring**
Built-in performance monitoring, connection pooling, and health scoring ensure your secrets infrastructure scales with your application.

### 🏗️ **Cloud-Native Architecture**
Native integrations with Docker, Kubernetes, AWS, and GCP make deploying secrets in modern infrastructure effortless.

### 📦 **Zero Dependencies for Core Features**
Core functionality works without external dependencies, making it suitable for air-gapped environments and reducing supply chain risks.

## Features

- **Secure encrypted storage** with AES-256-GCM, integrity checks, and master-key-derived encryption.
- **Versioning and rotation** with checksum tracking and optional rotation handlers.
- **Policy enforcement** for minimum length and forbidden patterns; tenant-aware RBAC roles (admin, writer, reader).
- **Audit logs and metrics** written to file/console for SIEM ingestion and observability.
- **CLI and HTTP API** for CRUD operations, health checks, and quick integration into pipelines.
- **Multiple storage backends**: File, AWS S3, Google Cloud Storage, PostgreSQL.
- **Dynamic secrets** with TTL-based expiration and leasing.
- **Event notifications** via webhooks for real-time monitoring.
- **Automated rotation scheduling** with maintenance windows and failure handling.
- **Cloud integrations** for AWS IAM, GCP IAM, and Kubernetes service accounts.
- **Compliance auditing** with violation detection and regulatory reporting.
- **Health monitoring** with system metrics, alerts, and performance tracking.
- **Advanced encryption** with envelope encryption and automatic key rotation.
- **Access control** with time-based, IP-based, and role-based policies.
- **Performance optimization** with connection pooling and real-time metrics.
- **Container orchestration** with Docker and Kubernetes native support.
- **Backup and recovery** with automated backup scheduling.
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
import { FileSecretStore, Identity, Policy, SecretManager, WebhookNotifier } from 'secret-engine';

const store = new FileSecretStore('./data/secrets.json', 'change-me', './data/audit.log');
const webhookNotifier = new WebhookNotifier('https://my-webhook.example.com/secrets');
const manager = new SecretManager(store, webhookNotifier);
const actor = new Identity('app', ['admin', 'writer', 'reader'], 'default');
const policy = new Policy('default', 'baseline', 60, 12);

// Create a secret with TTL (expires in 1 hour)
const secret = manager.createSecret(
  'db_password',
  'supersafe-value',
  policy,
  actor,
  'db password',
  undefined,
  3600
);
const retrieved = manager.getSecret(secret.id, new Identity('app', ['reader'], 'default'));
console.log(retrieved.latestVersion().value);

// Create a secret with AWS S3 storage
import { S3SecretStore } from 'secret-engine';
const s3Store = new S3SecretStore({
  masterKey: 'change-me',
  bucket: 'my-secrets-bucket',
  region: 'us-east-1',
});
const s3Manager = new SecretManager(s3Store);
```

### Phase 2: Advanced Enterprise Features

#### Automated Rotation Scheduling

```bash
# Start rotation scheduler (runs in background)
node dist/cjs/cli.js --master-key "$MASTER_KEY" rotate-scheduler --start

# Manually rotate a secret
node dist/cjs/cli.js --master-key "$MASTER_KEY" rotate <secret-id>
```

#### Compliance Auditing

```bash
# Generate compliance report for last 30 days
node dist/cjs/cli.js --master-key "$MASTER_KEY" compliance-report

# Export compliance report as CSV
node dist/cjs/cli.js --master-key "$MASTER_KEY" compliance-report --format csv
```

#### Health Monitoring

```bash
# Run health check
node dist/cjs/cli.js --master-key "$MASTER_KEY" health-check
```

#### Cloud Integrations (TypeScript SDK)

```ts
import { AWSIAMIntegration, IntegrationManager } from 'secret-engine';

const integrations = new IntegrationManager();
integrations.registerIntegration(
  new AWSIAMIntegration({
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  })
);

// Sync secret to AWS IAM
await integrations.syncSecretToCloud('aws-iam', secret, manager, actor);
```

#### Compliance Reporting (TypeScript SDK)

```ts
import { ComplianceAuditor } from 'secret-engine';

const auditor = new ComplianceAuditor(manager);
const report = await auditor.generateComplianceReport(
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  new Date()
);

console.log(`Compliance violations: ${report.summary.complianceViolations}`);
```

#### Health Monitoring (TypeScript SDK)

```ts
import { HealthMonitor } from 'secret-engine';

const monitor = new HealthMonitor(manager, store, {
  healthCheckIntervalMs: 60000,
  metricsRetentionHours: 24,
  alertWebhook: 'https://alerts.example.com/webhook',
});

const health = await monitor.checkHealth();
console.log(`System health: ${health.overall}`);
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
    "policy": { "name": "default", "rotationDays": 60, "min_length": 12 },
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
- `rotate <secret_id>` manually rotate a secret
- `compliance-report` generate compliance report
- `health-check` run system health check
- `rotate-keys` rotate encryption keys
- `create-backup <backup_id>` create backup of all secrets
- `performance-stats` show performance statistics
- `docker-deploy <name> <image>` deploy to Docker with secrets
- `k8s-create-secret <name>` create Kubernetes secret

**Storage Options:**

- `--storage <type>`: file, s3, gcp, postgres
- `--s3-bucket <bucket>`: S3 bucket name
- `--s3-region <region>`: AWS region
- `--gcp-bucket <bucket>`: GCP bucket name
- `--db-connection-string <conn>`: PostgreSQL connection string

**Server Options:**

- `--webhook-url <url>`: Webhook URL for event notifications

### Phase 3: Advanced Security & Scalability

#### Advanced Encryption & Key Management

```bash
# Rotate encryption keys
node dist/cjs/cli.js --master-key "$MASTER_KEY" rotate-keys

# Create backup
node dist/cjs/cli.js --master-key "$MASTER_KEY" create-backup my-backup-2025
```

#### Performance Monitoring

```bash
# Show performance statistics
node dist/cjs/cli.js --master-key "$MASTER_KEY" performance-stats
```

#### Container Deployments

```bash
# Deploy to Docker with secrets
node dist/cjs/cli.js docker-deploy my-app nginx:latest --env PORT=8080 --secret DB_PASSWORD=mys3cr3t

# Create Kubernetes secret
node dist/cjs/cli.js k8s-create-secret my-secret --namespace production --data key1=value1 key2=value2
```

#### Advanced Encryption (TypeScript SDK)

```ts
import { AdvancedEncryptionManager, BackupManager } from 'secret-engine';

const encryptionManager = new AdvancedEncryptionManager({
  masterKey: 'your-master-key',
  keyRotationDays: 90,
  keySize: 32,
  algorithm: 'aes-256-gcm',
});

// Encrypt data with envelope encryption
const { ciphertext, keyId, iv } = await encryptionManager.encrypt('sensitive-data');

// Rotate keys automatically
if (await encryptionManager.shouldRotateKey()) {
  const newKeyId = await encryptionManager.rotateKey();
}

// Create backup
const backupManager = new BackupManager('./backups');
const backupId = await backupManager.createBackup(secretsData);
```

#### Access Control & Sessions (TypeScript SDK)

```ts
import { AccessControlManager, SessionManager } from 'secret-engine';

const accessManager = new AccessControlManager();

// Add time-based access rule (9 AM - 5 PM only)
accessManager.addRule(
  accessManager.createTimeBasedRule('business-hours', 'secrets', 'read', 9, 17)
);

// Add IP restriction
accessManager.addRule(
  accessManager.createIPRestrictionRule('office-only', 'secrets', 'write', ['192.168.1.0/24'])
);

// Create session
const sessionManager = new SessionManager();
const sessionId = sessionManager.createSession(identity, { source: 'web' });

// Check access
const allowed = await accessManager.evaluateAccess({
  subject: 'user123',
  resource: 'secret:db-password',
  action: 'read',
  context: {
    ip: '192.168.1.100',
    time: new Date(),
    roles: ['reader'],
  },
});
```

#### Performance Monitoring (TypeScript SDK)

```ts
import { PerformanceMonitor, ConnectionPool } from 'secret-engine';

const monitor = new PerformanceMonitor(manager, {
  metricsRetentionMs: 3600000, // 1 hour
  samplingRate: 0.1, // Sample 10% of operations
  alertThresholds: {
    maxLatencyMs: 1000,
    maxErrorRate: 0.05,
    minThroughput: 10,
  },
});

// Record operation metrics
monitor.recordOperation('read', 150, true); // 150ms, success

// Get health score (0-100)
const healthScore = monitor.getHealthScore();
const alerts = monitor.getAlerts();

// Connection pooling for high throughput
const pool = new ConnectionPool(10, createConnection, destroyConnection);
const connection = await pool.getConnection();
// ... use connection
await pool.releaseConnection(connection);
```

#### Container Orchestration (TypeScript SDK)

```ts
import { DockerIntegration, KubernetesIntegration, ContainerOrchestrator } from 'secret-engine';

const orchestrator = new ContainerOrchestrator(
  new DockerIntegration(),
  new KubernetesIntegration()
);

// Deploy to Docker
await orchestrator.deployApplication('my-app', {
  image: 'nginx:latest',
  environment: { PORT: '8080' },
  volumes: ['/data:/app/data'],
  ports: { '8080': '80' },
  secrets: { API_KEY: 'secret-value' },
});

// Deploy to Kubernetes
await orchestrator.deployApplication(
  'my-app',
  {
    namespace: 'production',
    serviceAccount: 'app-service-account',
    secrets: {
      'app-secrets': { API_KEY: 'secret-value', DB_PASSWORD: 'db-secret' },
    },
    configMaps: {
      'app-config': { ENV: 'production', LOG_LEVEL: 'info' },
    },
  },
  true
); // use Kubernetes

// Get logs
const logs = await orchestrator.getLogs('my-app', 'production');
```

## API Reference

### Core Classes

#### `SecretManager`
The main entry point for secret operations.

```ts
import { SecretManager } from '@kitiumai/secrets';

const manager = new SecretManager(store, notifier?);
```

**Methods:**
- `createSecret(name, value, policy, actor, description?, tags?, ttl?)` - Create a new secret
- `getSecret(id, actor)` - Retrieve a secret
- `updateSecret(id, value, actor)` - Update secret value
- `deleteSecret(id, actor)` - Delete a secret
- `listSecrets(actor)` - List all accessible secrets
- `rotateSecret(id, actor)` - Manually rotate a secret

#### `Identity`
Represents an authenticated actor.

```ts
import { Identity } from '@kitiumai/secrets';

const identity = new Identity(subject, roles, tenant?);
```

**Properties:**
- `subject: string` - Unique identifier
- `roles: string[]` - Assigned roles (admin, writer, reader)
- `tenant: string` - Tenant namespace

**Methods:**
- `hasRole(role: string): boolean` - Check if identity has a role

#### `Policy`
Defines secret requirements and constraints.

```ts
import { Policy } from '@kitiumai/secrets';

const policy = new Policy(name, description, rotationDays, minLength, forbidPatterns?, allowedCidrs?);
```

**Properties:**
- `name: string` - Policy identifier
- `description: string` - Human-readable description
- `rotationDays: number` - Days between rotations
- `minLength: number` - Minimum secret length
- `forbidPatterns?: string[]` - Forbidden patterns
- `allowedCidrs?: string[]` - Allowed IP ranges

### Storage Backends

#### `FileSecretStore`
File-based storage for development and small deployments.

```ts
import { FileSecretStore } from '@kitiumai/secrets';

const store = new FileSecretStore(path, config);
```

**Configuration:**
```ts
interface SecretStoreConfig {
  masterKey: string;
  auditLogPath?: string;
}
```

#### `S3SecretStore`
AWS S3-backed storage for cloud deployments.

```ts
import { S3SecretStore } from '@kitiumai/secrets';

const store = new S3SecretStore({
  masterKey: 'your-key',
  bucket: 'secrets-bucket',
  region: 'us-east-1',
  auditLogPath: './audit.log'
});
```

#### `GCPStorageSecretStore`
Google Cloud Storage-backed storage.

```ts
import { GCPStorageSecretStore } from '@kitiumai/secrets';

const store = new GCPStorageSecretStore({
  masterKey: 'your-key',
  bucket: 'secrets-bucket',
  projectId: 'your-project',
  auditLogPath: './audit.log'
});
```

#### `PostgreSQLSecretStore`
PostgreSQL database storage for enterprise deployments.

```ts
import { PostgreSQLSecretStore } from '@kitiumai/secrets';

const store = new PostgreSQLSecretStore({
  masterKey: 'your-key',
  connectionString: 'postgresql://user:pass@host:5432/db',
  auditLogPath: './audit.log'
});
```

### Phase 2: Advanced Enterprise Features

#### `RotationScheduler`
Automated secret rotation with maintenance windows.

```ts
import { RotationScheduler } from '@kitiumai/secrets';

const scheduler = new RotationScheduler(manager, {
  checkIntervalMs: 3600000, // 1 hour
  maintenanceWindows: [{ start: '02:00', end: '04:00' }],
  retryAttempts: 3
});

await scheduler.start();
```

#### `ComplianceAuditor`
Compliance reporting and violation detection.

```ts
import { ComplianceAuditor } from '@kitiumai/secrets';

const auditor = new ComplianceAuditor(manager);
const report = await auditor.generateComplianceReport(
  new Date('2024-01-01'),
  new Date(),
  'default'
);

console.log(`Violations: ${report.summary.complianceViolations}`);
```

#### `HealthMonitor`
System health monitoring and alerting.

```ts
import { HealthMonitor } from '@kitiumai/secrets';

const monitor = new HealthMonitor(manager, store, {
  healthCheckIntervalMs: 60000,
  metricsRetentionHours: 24,
});

const health = await monitor.checkHealth();
console.log(`Status: ${health.overall}`);
```

#### `IntegrationManager`
Cloud service integrations.

```ts
import { IntegrationManager, AWSIAMIntegration } from '@kitiumai/secrets';

const integrations = new IntegrationManager();
integrations.registerIntegration(new AWSIAMIntegration({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}));

await integrations.syncSecretToCloud('aws-iam', secret, manager, actor);
```

### Phase 3: Advanced Security & Scalability

#### `AdvancedEncryptionManager`
Envelope encryption with automatic key rotation.

```ts
import { AdvancedEncryptionManager } from '@kitiumai/secrets';

const encryption = new AdvancedEncryptionManager({
  masterKey: 'your-master-key',
  keyRotationDays: 90,
  keySize: 32,
  algorithm: 'aes-256-gcm',
});

const { ciphertext, keyId, iv } = await encryption.encrypt('sensitive-data');
const plaintext = await encryption.decrypt(ciphertext, keyId, iv);
```

#### `AccessControlManager`
Advanced access control with time/IP restrictions.

```ts
import { AccessControlManager } from '@kitiumai/secrets';

const accessManager = new AccessControlManager();

// Add time-based rule (9 AM - 5 PM only)
accessManager.addRule(
  accessManager.createTimeBasedRule('business-hours', 'secrets', 'read', 9, 17)
);

// Add IP restriction
accessManager.addRule(
  accessManager.createIPRestrictionRule('office-only', 'secrets', 'write', ['192.168.1.0/24'])
);

const allowed = await accessManager.evaluateAccess({
  subject: 'user123',
  resource: 'secret:db-password',
  action: 'read',
  context: { ip: '192.168.1.100', time: new Date(), roles: ['reader'] },
});
```

#### `SessionManager`
Secure session management.

```ts
import { SessionManager } from '@kitiumai/secrets';

const sessionManager = new SessionManager(3600000); // 1 hour timeout
const sessionId = sessionManager.createSession(identity, { source: 'web' });

const session = sessionManager.getSession(sessionId);
if (session) {
  sessionManager.extendSession(sessionId);
}
```

#### `PerformanceMonitor`
Real-time performance monitoring and optimization.

```ts
import { PerformanceMonitor } from '@kitiumai/secrets';

const monitor = new PerformanceMonitor(manager, {
  metricsRetentionMs: 3600000,
  samplingRate: 0.1,
  alertThresholds: {
    maxLatencyMs: 1000,
    maxErrorRate: 0.05,
    minThroughput: 10,
  },
});

monitor.recordOperation('read', 150, true); // 150ms, success
const healthScore = monitor.getHealthScore(); // 0-100
const alerts = monitor.getAlerts();
```

#### `ConnectionPool`
Database connection pooling for high performance.

```ts
import { ConnectionPool } from '@kitiumai/secrets';

const pool = new ConnectionPool(
  10, // max connections
  () => createDatabaseConnection(),
  (conn) => conn.close()
);

const connection = await pool.getConnection();
// ... use connection
await pool.releaseConnection(connection);
```

#### `ContainerOrchestrator`
Docker and Kubernetes container orchestration.

```ts
import { ContainerOrchestrator, DockerIntegration } from '@kitiumai/secrets';

const orchestrator = new ContainerOrchestrator(
  new DockerIntegration(),
  new K8sIntegration()
);

// Deploy to Docker
await orchestrator.deployApplication('my-app', {
  image: 'nginx:latest',
  environment: { PORT: '8080' },
  secrets: { API_KEY: 'secret-value' },
});

// Get container logs
const logs = await orchestrator.getLogs('my-app');
```

#### `BackupManager`
Automated backup and recovery.

```ts
import { BackupManager } from '@kitiumai/secrets';

const backupManager = new BackupManager('./backups', 30); // 30 day retention
const backupId = await backupManager.createBackup(secretsData);

// Later...
const restoredData = await backupManager.restoreFromBackup(backupId);
```

### Event System

#### `WebhookNotifier`
HTTP webhook notifications for secret events.

```ts
import { WebhookNotifier } from '@kitiumai/secrets';

const notifier = new WebhookNotifier('https://your-webhook.com/secrets', {
  headers: { 'Authorization': 'Bearer token' },
  timeout: 5000,
});
```

#### `CompositeNotifier`
Combine multiple notification channels.

```ts
import { CompositeNotifier, WebhookNotifier } from '@kitiumai/secrets';

const composite = new CompositeNotifier([
  new WebhookNotifier('https://webhook1.com'),
  new WebhookNotifier('https://webhook2.com'),
]);
```

### HTTP API

The package includes a complete REST API server:

```bash
# Start HTTP server
npm run serve -- --master-key "your-key" --port 8080
```

**Endpoints:**
- `GET /healthz` - Health check
- `GET /secrets` - List secrets
- `POST /secrets` - Create secret
- `GET /secrets/:id` - Get secret
- `PUT /secrets/:id` - Update secret
- `DELETE /secrets/:id` - Delete secret
- `POST /secrets/:id/rotate` - Rotate secret

**Headers:**
- `x-subject` - Actor identifier
- `x-roles` - Comma-separated roles
- `x-tenant` - Tenant namespace

### CLI Commands

```bash
# Core operations
secret-engine create <name> <value> [options]
secret-engine get <secretId>
secret-engine put <secretId> <value>
secret-engine list
secret-engine delete <secretId>
secret-engine rotate <secretId>

# Enterprise features
secret-engine compliance-report [options]
secret-engine health-check
secret-engine rotate-keys
secret-engine create-backup <backupId>
secret-engine performance-stats
secret-engine docker-deploy <name> <image> [options]
secret-engine k8s-create-secret <name> [options]

# Global options
--master-key <key>          # Master encryption key
--store <path>              # File storage path
--storage <type>            # Storage backend (file|s3|gcp|postgres)
--tenant <name>             # Tenant namespace
--subject <name>            # Actor identifier
--audit-log <path>          # Audit log path
```

### Utility Functions

#### Crypto Utilities
```ts
import { encrypt, decrypt, checksum } from '@kitiumai/secrets';

// Encrypt/decrypt data
const encrypted = encrypt('plaintext', 'key');
const decrypted = decrypt(encrypted, 'key');

// Generate checksums
const hash = checksum('data');
```

#### Policy Enforcement
```ts
import { enforcePolicy, allowAction } from '@kitiumai/secrets';

// Check policy compliance
const violations = enforcePolicy(secret, policy);

// Check RBAC permissions
const allowed = allowAction(identity, 'read', 'secret', tenant);
```

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
