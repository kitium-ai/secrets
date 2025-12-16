import type { Identity, Policy } from './domain';

export function enforcePolicy(value: string, policy: Policy): void {
  if (value.length < policy.minLength) {
    throw new Error(`Secret must be at least ${policy.minLength} characters long`);
  }
  if (policy.forbidPatterns) {
    for (const pattern of policy.forbidPatterns) {
      if (pattern && value.includes(pattern)) {
        throw new Error(`Secret must not contain forbidden pattern: ${pattern}`);
      }
    }
  }
}

export function allowAction(actor: Identity, tenant: string, requiredRole: string): void {
  if (actor.tenant !== tenant) {
    throw new Error('Tenant mismatch for action');
  }
  if (!actor.hasRole(requiredRole)) {
    throw new Error(`Actor missing required role: ${requiredRole}`);
  }
}
