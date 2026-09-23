import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FakeLlmProvider } from '../src/ai/fake-llm.provider.js';
import { LlmProvider } from '../src/ai/llm-provider.js';
import { AppModule } from '../src/app.module.js';
import { IdentityProvider } from '../src/auth/identity-provider.js';
import { configureApp } from '../src/configure-app.js';
import { FakeMailProvider } from '../src/gmail/fake-mail.provider.js';
import { MailProvider } from '../src/gmail/mail-provider.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeIdentityProvider } from './fake-identity-provider.js';

export const OWNER_EMAIL = 'owner@test.local';

export async function createTestApp() {
  const identity = new FakeIdentityProvider();
  const mail = new FakeMailProvider();
  // Disabled by default: only the AI tests turn it on.
  const llm = new FakeLlmProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LlmProvider)
    .useValue(llm)
    .overrideProvider(IdentityProvider)
    .useValue(identity)
    .overrideProvider(MailProvider)
    .useValue(mail)
    .compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  const prisma = app.get(PrismaService);

  // Guard against ever truncating a real database.
  const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (rows[0]?.db === 'job_tracker') {
    throw new Error('Integration tests must not run against the dev database');
  }

  return { app, prisma, identity, mail, llm };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRaw`TRUNCATE sessions, application_events, applications, companies, users, gmail_connections CASCADE`;
}

export function cookieValue(res: request.Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.slice(name.length + 1);
}

/** Runs the real OAuth flow against the fake provider; returns the session cookie. */
export async function login(
  app: INestApplication,
  identity: FakeIdentityProvider,
  email = OWNER_EMAIL,
): Promise<string> {
  identity.register({ email });
  const server = app.getHttpServer();
  const start = await request(server).get('/api/v1/auth/google').expect(302);
  const state = new URL(start.headers.location as string).searchParams.get('state') ?? '';
  const oauthCookie = cookieValue(start, 'jat_oauth');

  const callback = await request(server)
    .get('/api/v1/auth/google/callback')
    .query({ code: email, state })
    .set('Cookie', `jat_oauth=${oauthCookie}`)
    .expect(302);
  const session = cookieValue(callback, 'jat_session');
  if (!session)
    throw new Error(`Login failed: redirected to ${callback.headers.location as string}`);
  return `jat_session=${session}`;
}

/** Runs the Gmail connect flow against the fake mail provider. */
export async function connectGmail(app: INestApplication, cookie: string) {
  const server = app.getHttpServer();
  const start = await request(server)
    .get('/api/v1/gmail/connect')
    .set('Cookie', cookie)
    .expect(302);
  const callback = new URL(start.headers.location as string, 'http://localhost');
  const oauth = cookieValue(start, 'jat_gmail_oauth');
  await request(server)
    .get(`${callback.pathname}${callback.search}`)
    .set('Cookie', `${cookie}; jat_gmail_oauth=${oauth}`)
    .expect(302);
}

/** Supertest bound to a session, with the CSRF header the web client always sends. */
export function authedClient(app: INestApplication, cookie: string) {
  const server = app.getHttpServer();
  const withAuth = (req: request.Test) =>
    req.set('Cookie', cookie).set('X-Requested-With', 'fetch');
  return {
    get: (url: string) => withAuth(request(server).get(url)),
    post: (url: string) => withAuth(request(server).post(url)),
    patch: (url: string) => withAuth(request(server).patch(url)),
    delete: (url: string) => withAuth(request(server).delete(url)),
  };
}
