import type { Request } from 'express';

import { Identity } from '../domain';

export function createIdentityFromRequest(tenant: string): (request: Request) => Identity {
  return (request: Request) => {
    const subject = request.header('x-subject') ?? 'http';
    const rolesHeader = request.header('x-roles') ?? 'reader';
    const roles = rolesHeader
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
    return new Identity(subject, roles, tenant);
  };
}
