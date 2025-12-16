export type ServerOptions = {
  storePath: string;
  masterKey: string;
  auditLogPath?: string;
  tenant?: string;
  port?: number;
  storage?: 'file' | 's3' | 'gcp' | 'postgres';
  s3Bucket?: string;
  s3Region?: string;
  gcpBucket?: string;
  gcpProjectId?: string;
  dbConnectionString?: string;
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
};
