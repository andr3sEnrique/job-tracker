import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config.service.js';
import { CsrfGuard } from './csrf.guard.js';

const config = { get: () => 'http://localhost:3000' } as unknown as AppConfig;
const guard = new CsrfGuard(config);

const ctx = (method: string, headers: Record<string, string> = {}) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  }) as unknown as ExecutionContext;

describe('CsrfGuard', () => {
  it('lets safe methods through', () => {
    expect(guard.canActivate(ctx('GET'))).toBe(true);
  });

  it('requires the custom header on state-changing requests', () => {
    expect(() => guard.canActivate(ctx('POST'))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx('DELETE', { 'x-requested-with': 'fetch' }))).toBe(true);
  });

  it('rejects a foreign Origin even with the header', () => {
    expect(() =>
      guard.canActivate(
        ctx('PATCH', { 'x-requested-with': 'fetch', origin: 'https://evil.example' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts the web app origin', () => {
    expect(
      guard.canActivate(
        ctx('POST', { 'x-requested-with': 'fetch', origin: 'http://localhost:3000' }),
      ),
    ).toBe(true);
  });
});
