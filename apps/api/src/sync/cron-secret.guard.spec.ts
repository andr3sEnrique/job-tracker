import { NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config.service.js';
import { CronSecretGuard } from './cron-secret.guard.js';

const SECRET = 'a'.repeat(40);
const guardWith = (secret: string | undefined) =>
  new CronSecretGuard({ get: () => secret } as unknown as AppConfig);
const ctx = (headers: Record<string, string> = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

describe('CronSecretGuard', () => {
  it('hides the endpoint when no secret is configured', () => {
    expect(() => guardWith(undefined).canActivate(ctx({ 'x-cron-secret': SECRET }))).toThrow(
      NotFoundException,
    );
  });

  it('accepts only the exact secret', () => {
    const guard = guardWith(SECRET);
    expect(guard.canActivate(ctx({ 'x-cron-secret': SECRET }))).toBe(true);
    expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx({ 'x-cron-secret': SECRET.slice(1) }))).toThrow(
      UnauthorizedException,
    );
  });
});
