import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('provides safe defaults for local development', () => {
    const env = validateEnv({});
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      FRONTEND_URL: 'http://localhost:3000',
      ALLOWED_GOOGLE_EMAILS: [],
      SECURE_COOKIES: false,
    });
    expect(env.DATABASE_URL).toContain('localhost');
  });

  it('normalises the allowlist', () => {
    expect(
      validateEnv({ ALLOWED_GOOGLE_EMAILS: ' Me@Example.com, ,other@x.io ' }).ALLOWED_GOOGLE_EMAILS,
    ).toEqual(['me@example.com', 'other@x.io']);
  });

  it('refuses to start in production without secrets, OAuth or an allowlist', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      /DATABASE_URL[\s\S]*COOKIE_SECRET[\s\S]*GOOGLE_CLIENT_ID[\s\S]*ALLOWED_GOOGLE_EMAILS/,
    );
  });

  it('requires https in production and enables secure cookies', () => {
    const base = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db:5432/app',
      COOKIE_SECRET: 'x'.repeat(40),
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      ALLOWED_GOOGLE_EMAILS: 'me@example.com',
    };
    expect(() => validateEnv({ ...base, FRONTEND_URL: 'http://app.example.com' })).toThrow(/https/);
    expect(validateEnv({ ...base, FRONTEND_URL: 'https://app.example.com' }).SECURE_COOKIES).toBe(
      true,
    );
  });

  it('never echoes secret values in the error message', () => {
    try {
      validateEnv({ NODE_ENV: 'production', COOKIE_SECRET: 'short-secret-value' });
    } catch (error) {
      expect((error as Error).message).not.toContain('short-secret-value');
    }
  });
});
