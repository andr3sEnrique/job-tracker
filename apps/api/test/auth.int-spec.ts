import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sha256 } from '../src/auth/crypto.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  OWNER_EMAIL,
  authedClient,
  cookieValue,
  createTestApp,
  login,
  resetDatabase,
} from './create-test-app.js';
import { FAKE_AUTH_URL, type FakeIdentityProvider } from './fake-identity-provider.js';

describe('Authentication', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentityProvider;
  const http = () => request(app.getHttpServer());

  async function startLogin() {
    const res = await http().get('/api/v1/auth/google').expect(302);
    return {
      res,
      state: new URL(res.headers.location as string).searchParams.get('state') ?? '',
      oauthCookie: `jat_oauth=${cookieValue(res, 'jat_oauth')}`,
    };
  }

  beforeAll(async () => {
    ({ app, prisma, identity } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  describe('login', () => {
    it('redirects to the provider with state and PKCE, keeping them in a signed cookie', async () => {
      const { res } = await startLogin();
      const location = new URL(res.headers.location as string);
      expect(`${location.origin}${location.pathname}`).toBe(FAKE_AUTH_URL);
      expect(location.searchParams.get('code_challenge')).toBeTruthy();

      const setCookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(setCookie).toMatch(/jat_oauth=s%3A/); // signed
      expect(setCookie).toMatch(/HttpOnly/);
      expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
    });

    it('creates a hashed session and an httpOnly SameSite=Lax cookie', async () => {
      identity.register({ email: OWNER_EMAIL, name: 'Owner' });
      const { state, oauthCookie } = await startLogin();
      const res = await http()
        .get('/api/v1/auth/google/callback')
        .query({ code: OWNER_EMAIL, state })
        .set('Cookie', oauthCookie)
        .expect(302);

      expect(res.headers.location).toBe('http://localhost:3000/');
      const header = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('jat_session='),
      );
      expect(header).toMatch(/HttpOnly/);
      expect(header).toMatch(/SameSite=Lax/);

      const token = cookieValue(res, 'jat_session') ?? '';
      const session = await prisma.session.findFirstOrThrow();
      expect(session.tokenHash).toBe(sha256(token));
      expect(session.tokenHash).not.toBe(token);

      const me = await authedClient(app, `jat_session=${token}`).get('/api/v1/auth/me').expect(200);
      expect(me.body).toMatchObject({ email: OWNER_EMAIL, name: 'Owner' });
    });

    it('adopts a pre-existing user with the same email and links the Google id', async () => {
      await prisma.user.create({ data: { email: OWNER_EMAIL } });
      await login(app, identity);
      const users = await prisma.user.findMany();
      expect(users).toHaveLength(1);
      expect(users[0]?.googleSub).toBe(`sub-${OWNER_EMAIL}`);
    });

    it('denies accounts outside the allowlist without creating anything', async () => {
      identity.register({ email: 'intruder@example.com' });
      const { state, oauthCookie } = await startLogin();
      const res = await http()
        .get('/api/v1/auth/google/callback')
        .query({ code: 'intruder@example.com', state })
        .set('Cookie', oauthCookie)
        .expect(302);

      expect(res.headers.location).toBe('http://localhost:3000/login?error=forbidden');
      expect(cookieValue(res, 'jat_session')).toBeUndefined();
      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.session.count()).toBe(0);
    });

    it('denies unverified emails', async () => {
      identity.register({ email: OWNER_EMAIL, emailVerified: false });
      const { state, oauthCookie } = await startLogin();
      const res = await http()
        .get('/api/v1/auth/google/callback')
        .query({ code: OWNER_EMAIL, state })
        .set('Cookie', oauthCookie);
      expect(res.headers.location).toBe('http://localhost:3000/login?error=unverified');
    });

    it.each([
      ['a missing state cookie', () => ({ cookie: '' })],
      ['a mismatched state', () => ({ stateOverride: 'forged-state' })],
      ['a tampered cookie', () => ({ cookie: 'jat_oauth=s%3A%7B%7D.forged' })],
    ])('rejects the callback with %s', async (_label, variant) => {
      identity.register({ email: OWNER_EMAIL });
      const { state, oauthCookie } = await startLogin();
      const v = variant() as { cookie?: string; stateOverride?: string };
      const res = await http()
        .get('/api/v1/auth/google/callback')
        .query({ code: OWNER_EMAIL, state: v.stateOverride ?? state })
        .set('Cookie', v.cookie ?? oauthCookie);
      expect(res.headers.location).toBe('http://localhost:3000/login?error=state');
      expect(await prisma.session.count()).toBe(0);
    });

    it('reports a cancelled consent screen', async () => {
      const res = await http()
        .get('/api/v1/auth/google/callback')
        .query({ error: 'access_denied' });
      expect(res.headers.location).toBe('http://localhost:3000/login?error=cancelled');
    });
  });

  describe('authorization', () => {
    it.each(['/api/v1/applications', '/api/v1/stats/dashboard', '/api/v1/auth/me'])(
      'rejects %s without a session',
      async (url) => {
        await http().get(url).expect(401);
      },
    );

    it('rejects a forged session cookie', async () => {
      await http().get('/api/v1/applications').set('Cookie', 'jat_session=forged').expect(401);
    });

    it('rejects expired sessions and removes them', async () => {
      const cookie = await login(app, identity);
      await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      await authedClient(app, cookie).get('/api/v1/applications').expect(401);
      expect(await prisma.session.count()).toBe(0);
    });

    it('keeps health probes public', async () => {
      await http().get('/api/v1/health/live').expect(200);
    });
  });

  describe('logout', () => {
    it('revokes the session server-side and clears the cookie', async () => {
      const cookie = await login(app, identity);
      const res = await authedClient(app, cookie).post('/api/v1/auth/logout').expect(204);
      expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/jat_session=;/);
      await authedClient(app, cookie).get('/api/v1/auth/me').expect(401);
      expect(await prisma.session.count()).toBe(0);
    });
  });

  describe('CSRF', () => {
    it('rejects state-changing requests without the custom header', async () => {
      const cookie = await login(app, identity);
      await http()
        .post('/api/v1/applications')
        .set('Cookie', cookie)
        .send({ companyName: 'A', roleTitle: 'B', appliedAt: new Date().toISOString() })
        .expect(403);
    });

    it('rejects cross-origin requests even with the header', async () => {
      const cookie = await login(app, identity);
      await authedClient(app, cookie)
        .post('/api/v1/auth/logout')
        .set('Origin', 'https://evil.example')
        .expect(403);
    });
  });
});
