// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

describe('proxy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sends visitors without a session to /login', () => {
    const res = proxy(req('/applications?status=OFFER'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('lets requests with a session cookie through (the API does the real check)', () => {
    expect(proxy(req('/', 'jat_session=abc')).headers.get('location')).toBeNull();
    expect(proxy(req('/', '__Host-jat_session=abc')).headers.get('location')).toBeNull();
  });

  it('keeps the login page public', () => {
    expect(proxy(req('/login?error=forbidden')).headers.get('location')).toBeNull();
  });

  it('does nothing in mock mode', () => {
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'mock');
    expect(proxy(req('/applications')).headers.get('location')).toBeNull();
  });
});
