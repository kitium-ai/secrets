import type { Identity } from './domain';

export function recordObservation(action: string, secretId: string, actor: Identity): void {
  console.info(
    'METRIC action=%s secret=%s subject=%s tenant=%s',
    action,
    secretId,
    actor.subject,
    actor.tenant
  );
}
