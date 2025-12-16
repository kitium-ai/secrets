import type { Request } from 'express';

import { Policy } from '../domain';

type PolicyPayload = Partial<{
  name: unknown;
  description: unknown;
  rotationDays: unknown;
  minLength: unknown;
  forbidPatterns: unknown;
  allowedCidrs: unknown;
}>;

type SecretCreatePayload = Partial<{
  name: unknown;
  value: unknown;
  description: unknown;
  policy: unknown;
}>;

export function requireRouteParameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || !value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function requireStringBodyField(payload: Record<string, unknown>, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || !value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function toPolicyPayload(payload: unknown): PolicyPayload {
  return typeof payload === 'object' && payload !== null ? (payload as PolicyPayload) : {};
}

export function parsePolicy(payload: unknown): Policy {
  const policyPayload = toPolicyPayload(payload);
  const name = typeof policyPayload.name === 'string' ? policyPayload.name : 'default';
  const description =
    typeof policyPayload.description === 'string' ? policyPayload.description : 'created via http';
  const rotationDays =
    typeof policyPayload.rotationDays === 'number' ? policyPayload.rotationDays : 90;
  const minLength = typeof policyPayload.minLength === 'number' ? policyPayload.minLength : 16;

  const forbidPatterns = Array.isArray(policyPayload.forbidPatterns)
    ? (policyPayload.forbidPatterns.filter((entry) => typeof entry === 'string') as string[])
    : undefined;
  const allowedCidrs = Array.isArray(policyPayload.allowedCidrs)
    ? (policyPayload.allowedCidrs.filter((entry) => typeof entry === 'string') as string[])
    : undefined;

  return new Policy(name, description, rotationDays, minLength, forbidPatterns, allowedCidrs);
}

export function parseCreateSecretPayload(body: unknown): {
  name: string;
  value: string;
  description?: string;
  policy: Policy;
} {
  const payload: SecretCreatePayload =
    typeof body === 'object' && body !== null ? (body as SecretCreatePayload) : {};
  const dictionary = payload as unknown as Record<string, unknown>;
  const name = requireStringBodyField(dictionary, 'name');
  const value = requireStringBodyField(dictionary, 'value');
  const description = typeof payload.description === 'string' ? payload.description : undefined;
  const policy = parsePolicy(payload.policy);
  return {
    name,
    value,
    ...(typeof description === 'string' ? { description } : {}),
    policy,
  };
}

export function parseUpdateSecretPayload(body: unknown): { value: string } {
  const payload =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  return { value: requireStringBodyField(payload, 'value') };
}
