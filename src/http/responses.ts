import type { Response } from 'express';

export function sendError(response: Response, status: number, error: unknown): void {
  const message = error instanceof Error ? error.message : 'unknown error';
  response.status(status).json({ error: message });
}

export function errorToStatus(error: unknown, defaultStatus: number): number {
  if (!(error instanceof Error)) {
    return defaultStatus;
  }
  if (error.message.includes('not found')) {
    return 404;
  }
  if (error.message.includes('required role') || error.message.includes('Tenant mismatch')) {
    return 403;
  }
  return defaultStatus;
}
