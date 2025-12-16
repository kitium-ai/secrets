export { checksum, decrypt, encrypt } from './crypto';
export { Identity, Policy, Secret, SecretVersion } from './domain';
export {
  CompositeNotifier,
  type KtSecretEvent,
  type SecretNotifier,
  WebhookNotifier,
} from './events';
export { SecretManager } from './manager';
export { buildApp, serve } from './server';
export {
  allowAction,
  enforcePolicy,
  FileSecretStore,
  GCPStorageSecretStore,
  type GCPStorageSecretStoreConfig,
  PostgreSQLSecretStore,
  type PostgreSQLSecretStoreConfig,
  recordObservation,
  S3SecretStore,
  type S3SecretStoreConfig,
} from './storage';

// Phase 2: Advanced Enterprise Features
export {
  type AuditQuery,
  ComplianceAuditor,
  type ComplianceReport,
  type ComplianceViolation,
} from './compliance';
export {
  AWSIAMIntegration,
  type CloudIntegration,
  GCPIAMIntegration,
  IntegrationManager,
  KubernetesIntegration,
} from './integrations';
export {
  type AlertRule,
  type ComponentHealth,
  HealthMonitor,
  type HealthStatus,
  type SystemMetrics,
} from './monitoring';
export { type RotationConfig, type RotationSchedule, RotationScheduler } from './rotation';

// Phase 3: Advanced Security & Scalability
export {
  type AccessCondition,
  AccessControlManager,
  type AccessRequest,
  type AccessRule,
  type Session,
  SessionManager,
} from './access-control';
export {
  type ContainerConfig,
  ContainerOrchestrator,
  DockerIntegration,
  K8sIntegration,
  type KubernetesConfig,
} from './containers';
export {
  AdvancedEncryptionManager,
  BackupManager,
  type EncryptionKey,
  type EnvelopeEncryptionConfig,
} from './encryption';
export {
  ConnectionPool,
  type PerformanceConfig,
  type PerformanceMetrics,
  PerformanceMonitor,
} from './performance';
