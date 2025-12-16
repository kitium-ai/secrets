import fs from 'node:fs';

import type { AuditLogEntry } from '../domain';

type SerializableAuditEntry = {
  timestamp: string;
  subject: string;
  action: string;
  secretId?: string | null;
  tenant: string;
  metadata: Record<string, string>;
};

function serialize(entry: AuditLogEntry): SerializableAuditEntry {
  return {
    timestamp: entry.timestamp.toISOString(),
    subject: entry.subject,
    action: entry.action,
    secretId: entry.secretId,
    tenant: entry.tenant,
    metadata: entry.metadata,
  };
}

export function appendAuditLog(path: string, entry: AuditLogEntry): void {
  const payload = serialize(entry);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- file path comes from configuration
  fs.appendFileSync(path, `${JSON.stringify(payload)}\n`, { encoding: 'utf8' });
  console.info('AUDIT', payload);
}
