import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { generateFakeMailbox, type FakeMailProvider } from '../src/gmail/fake-mail.provider.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  authedClient,
  connectGmail,
  createTestApp,
  login,
  resetDatabase,
} from './create-test-app.js';
import type { FakeIdentityProvider } from './fake-identity-provider.js';

describe('Account deletion', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentityProvider;
  let mail: FakeMailProvider;

  beforeAll(async () => {
    ({ app, prisma, identity, mail } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    mail.mailbox = generateFakeMailbox(30);
  });

  it('revokes Gmail and deletes every row of the user, and only theirs', async () => {
    const session = await login(app, identity);
    const client = authedClient(app, session);
    await connectGmail(app, session);
    for (let i = 0; i < 20; i++) {
      const { body } = await client.post('/api/v1/sync/run').expect(200);
      if (!body.hasMore) break;
    }
    await client
      .post('/api/v1/applications')
      .send({ companyName: 'Acme', roleTitle: 'Dev', appliedAt: new Date().toISOString() })
      .expect(201);

    const otherSession = await login(app, identity, 'other@test.local');
    await authedClient(app, otherSession)
      .post('/api/v1/applications')
      .send({ companyName: 'Other Co', roleTitle: 'Dev', appliedAt: new Date().toISOString() })
      .expect(201);
    expect(await prisma.email.count()).toBeGreaterThan(0);

    const res = await client.delete('/api/v1/account').expect(204);
    expect(String(res.headers['set-cookie'])).toMatch(/jat_session=;/);
    expect(mail.revoked).toHaveLength(1);

    const owner = { user: { email: 'owner@test.local' } };
    expect(await prisma.user.count({ where: { email: 'owner@test.local' } })).toBe(0);
    expect(await prisma.session.count({ where: owner })).toBe(0);
    expect(await prisma.application.count({ where: owner })).toBe(0);
    expect(await prisma.company.count({ where: owner })).toBe(0);
    expect(await prisma.gmailConnection.count()).toBe(0);
    expect(await prisma.email.count()).toBe(0);
    expect(await prisma.syncRun.count()).toBe(0);

    // The other user is untouched, and the deleted session no longer works.
    expect(await prisma.application.count()).toBe(1);
    await client.get('/api/v1/auth/me').expect(401);
  });

  it('requires the CSRF header like any other write', async () => {
    const session = await login(app, identity);
    await request(app.getHttpServer()).delete('/api/v1/account').set('Cookie', session).expect(403);
    expect(await prisma.user.count()).toBe(1);
  });
});
