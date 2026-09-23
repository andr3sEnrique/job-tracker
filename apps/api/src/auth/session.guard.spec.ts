import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/app-config.service.js';
import { SessionGuard } from './session.guard.js';
import type { SessionsService } from './sessions.service.js';

function setup({ allowlist = ['me@example.com'], isPublic = false, session = null as unknown }) {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  const sessions = { resolve: vi.fn().mockResolvedValue(session) } as unknown as SessionsService;
  const values: Record<string, unknown> = {
    SECURE_COOKIES: false,
    ALLOWED_GOOGLE_EMAILS: allowlist,
  };
  const config = { get: (k: string) => values[k] } as unknown as AppConfig;
  const request: Record<string, unknown> = { cookies: { jat_session: 'token' } };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new SessionGuard(reflector, sessions, config), context, request };
}

const validSession = { user: { id: 'u1', email: 'me@example.com' } };

describe('SessionGuard', () => {
  it('skips public routes', async () => {
    const { guard, context } = setup({ isPublic: true });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects requests without a valid session', async () => {
    const { guard, context } = setup({ session: null });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the user for a valid session', async () => {
    const { guard, context, request } = setup({ session: validSession });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', email: 'me@example.com' });
  });

  it('revokes access as soon as the email leaves the allowlist', async () => {
    const { guard, context } = setup({ session: validSession, allowlist: ['someone@else.com'] });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
