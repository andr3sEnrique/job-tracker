import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { generateFakeMailbox, type FakeMailProvider } from '../src/gmail/fake-mail.provider.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  authedClient,
  cookieValue,
  createTestApp,
  login,
  resetDatabase,
} from './create-test-app.js';
import type { FakeIdentityProvider } from './fake-identity-provider.js';

const TOTAL = 240;
// Every message built from a template passes the prefilter; the rest is personal/shop mail.
const CANDIDATES = generateFakeMailbox(TOTAL).filter((m) => m.template !== null).length;

describe('Gmail integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentityProvider;
  let mail: FakeMailProvider;
  let session: string;
  let client: ReturnType<typeof authedClient>;

  async function connect(cookie = session) {
    const start = await request(app.getHttpServer())
      .get('/api/v1/gmail/connect')
      .set('Cookie', cookie)
      .expect(302);
    const callback = new URL(start.headers.location as string, 'http://localhost');
    const oauth = cookieValue(start, 'jat_gmail_oauth');
    return request(app.getHttpServer())
      .get(`${callback.pathname}${callback.search}`)
      .set('Cookie', `${cookie}; jat_gmail_oauth=${oauth}`)
      .expect(302);
  }

  async function syncUntilDone() {
    const results = [];
    for (let i = 0; i < 200; i++) {
      const { body } = await client.post('/api/v1/sync/run').expect(200);
      results.push(body);
      if (!body.hasMore) break;
    }
    return results;
  }

  beforeAll(async () => {
    ({ app, prisma, identity, mail } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    mail.mailbox = generateFakeMailbox(TOTAL);
    mail.failWithAuthError = false;
    session = await login(app, identity);
    client = authedClient(app, session);
  });

  describe('connect', () => {
    it('requires a session', async () => {
      await request(app.getHttpServer()).get('/api/v1/gmail/connect').expect(401);
    });

    it('stores the refresh token encrypted and reports the connection', async () => {
      const res = await connect();
      expect(res.headers.location).toBe('http://localhost:3000/settings?gmail=connected');

      const row = await prisma.gmailConnection.findFirstOrThrow();
      expect(row.refreshTokenEnc).not.toContain('fake-refresh');
      expect(row.refreshTokenEnc.startsWith('v1.')).toBe(true);

      const { body } = await client.get('/api/v1/gmail/status').expect(200);
      expect(body).toMatchObject({
        connected: true,
        googleEmail: 'fake@gmail.test',
        status: 'ACTIVE',
      });
    });

    it('rejects a callback whose state does not match', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gmail/callback')
        .query({ code: 'fake@gmail.test', state: 'forged' })
        .set('Cookie', session)
        .expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/settings?gmail=error&reason=state');
      expect(await prisma.gmailConnection.count()).toBe(0);
    });

    it('reports not connected before connecting', async () => {
      await client.get('/api/v1/gmail/status').expect(200, { connected: false });
    });
  });

  describe('sync', () => {
    beforeEach(async () => {
      await connect();
    });

    it('walks the mailbox in resumable chunks and keeps only candidates with metadata', async () => {
      const results = await syncUntilDone();
      expect(results[0]).toMatchObject({ hasMore: true, processing: null });
      // Listing takes 3 chunks (240 messages, 100 per chunk); classification follows.
      expect(results.findIndex((r) => r.processing !== null)).toBe(2);
      expect(results.at(-1)).toMatchObject({
        hasMore: false,
        run: {
          type: 'INITIAL',
          status: 'SUCCESS',
          messagesListed: TOTAL,
          candidates: CANDIDATES,
          skipped: TOTAL - CANDIDATES,
        },
      });
      expect(await prisma.syncRun.count()).toBe(1); // one run, resumed across calls

      const connection = await prisma.gmailConnection.findFirstOrThrow();
      expect(connection.initialSyncCompletedAt).not.toBeNull();
      expect(connection.lastHistoryId).toBe(String(1000 + TOTAL));
      expect(connection.syncLockedUntil).toBeNull();
    });

    it('never stores sender or subject for discarded mail', async () => {
      await syncUntilDone();
      const skipped = await prisma.email.findMany({ where: { processingStatus: 'SKIPPED' } });
      expect(skipped).toHaveLength(TOTAL - CANDIDATES);
      expect(
        skipped.every((e) => e.subject === null && e.fromEmail === null && e.fromName === null),
      ).toBe(true);

      const kept = await prisma.email.findFirstOrThrow({
        where: { processingStatus: { not: 'SKIPPED' } },
      });
      expect(kept).toMatchObject({ fromDomain: expect.any(String), subject: expect.any(String) });
      expect(kept.prefilterReason).toMatch(/^(ats-sender|job-sender|subject):/);
    });

    it('lists candidate emails with a Gmail link and aggregates threads', async () => {
      await syncUntilDone();
      const { body } = await client.get('/api/v1/emails').query({ pageSize: '10' }).expect(200);
      expect(body.total).toBe(CANDIDATES);
      expect(body.items).toHaveLength(10);
      expect(['PROCESSED', 'NEEDS_REVIEW']).toContain(body.items[0].processingStatus);
      expect(body.items[0].category).not.toBeNull();
      expect(body.items[0].gmailUrl).toContain('rfc822msgid%3A');

      // Stories reply in the same thread (e.g. confirmation then rejection).
      const byThread = Map.groupBy(mail.mailbox, (m) => m.threadId);
      const [sharedThreadId, messages] = [...byThread].find(([, ms]) => ms.length > 1)!;
      const thread = await prisma.emailThread.findFirstOrThrow({
        where: { gmailThreadId: sharedThreadId },
      });
      expect(thread.messageCount).toBe(messages.length);
    });

    it('is idempotent: re-syncing stores nothing twice', async () => {
      await syncUntilDone();
      const again = await syncUntilDone();
      expect(again).toHaveLength(1);
      expect(again[0].run).toMatchObject({
        type: 'INCREMENTAL',
        status: 'SUCCESS',
        messagesListed: 0,
        candidates: 0,
        skipped: 0,
      });
      expect(await prisma.email.count()).toBe(TOTAL);
    });

    it('falls back to a resumable date search when Gmail history has expired', async () => {
      await syncUntilDone();
      // Last sync long ago and Gmail no longer has that history: the catch-up window covers
      // the whole mailbox again.
      mail.expireHistory();
      await prisma.gmailConnection.updateMany({
        data: { lastSyncedAt: new Date(Date.now() - 400 * 86_400_000) },
      });
      const again = await syncUntilDone();
      expect(again).toHaveLength(3);
      expect(new Set(again.map((r) => r.run.id)).size).toBe(1);
      expect(again.at(-1).run).toMatchObject({
        type: 'FALLBACK',
        status: 'SUCCESS',
        messagesListed: TOTAL,
        candidates: 0,
      });
      // Back on track: the next sync is incremental again, from a fresh history id.
      const [next] = await syncUntilDone();
      expect(next.run).toMatchObject({ type: 'INCREMENTAL', messagesListed: 0 });
    });

    it('picks up new messages through the History API', async () => {
      await syncUntilDone();
      mail.deliver({
        id: 'fresh-1',
        threadId: 'fresh-thread',
        from: 'no-reply@ashbyhq.com',
        subject: 'Interview invitation',
        rfc822MessageId: '<fresh@mail.fake>',
        receivedAt: new Date(),
        labels: ['INBOX'],
        body: 'We would like to invite you to an interview.',
        template: null,
        company: null,
        role: null,
      });
      const [next] = await syncUntilDone();
      expect(next.run).toMatchObject({ type: 'INCREMENTAL', messagesListed: 1, candidates: 1 });
      expect(await prisma.email.count()).toBe(TOTAL + 1);
      const fresh = await prisma.email.findFirstOrThrow({ where: { gmailMessageId: 'fresh-1' } });
      expect(fresh.prefilterReason).toBe('ats-sender:ashbyhq.com');
    });

    it('re-scans the whole window when the prefilter rules change, re-evaluating discarded mail', async () => {
      await syncUntilDone();
      // Simulate mail evaluated by older rules: some candidates had been discarded.
      // (Mail that never produced an application, like job alerts.)
      const victims = await prisma.email.findMany({
        where: { processingStatus: { not: 'SKIPPED' }, applicationId: null, category: 'JOB_ALERT' },
        take: 5,
      });
      expect(victims).toHaveLength(5);
      await prisma.email.updateMany({
        where: { id: { in: victims.map((v) => v.id) } },
        data: {
          processingStatus: 'SKIPPED',
          subject: null,
          fromEmail: null,
          fromName: null,
          fromDomain: null,
        },
      });
      await prisma.gmailConnection.updateMany({ data: { prefilterVersion: 1 } });

      const results = await syncUntilDone();
      expect(results.at(-1).run).toMatchObject({
        type: 'RESCAN',
        status: 'SUCCESS',
        messagesListed: TOTAL,
        candidates: 5,
      });

      expect(await prisma.email.count()).toBe(TOTAL);
      expect(await prisma.email.count({ where: { processingStatus: { not: 'SKIPPED' } } })).toBe(
        CANDIDATES,
      );
      const restored = await prisma.email.findFirstOrThrow({
        where: { gmailMessageId: victims[0]!.gmailMessageId },
      });
      expect(restored.subject).not.toBeNull();

      // Rules are now current: the next sync is a normal catch-up again.
      const [next] = await syncUntilDone();
      expect(next.run.type).toBe('INCREMENTAL');
    });

    it('refuses to run two syncs at once', async () => {
      await prisma.gmailConnection.updateMany({
        data: { syncLockedUntil: new Date(Date.now() + 60_000) },
      });
      await client.post('/api/v1/sync/run').expect(409);
    });

    it('takes over an expired lock (crashed process)', async () => {
      await prisma.gmailConnection.updateMany({
        data: { syncLockedUntil: new Date(Date.now() - 1000) },
      });
      await client.post('/api/v1/sync/run').expect(200);
    });

    it('marks the connection for re-authorisation when Google revokes access', async () => {
      mail.failWithAuthError = true;
      const { body } = await client.post('/api/v1/sync/run').expect(200);
      expect(body).toMatchObject({ hasMore: false, run: { status: 'FAILED', errorCode: 'auth' } });

      const { body: status } = await client.get('/api/v1/gmail/status').expect(200);
      expect(status.status).toBe('NEEDS_REAUTH');
      await client.post('/api/v1/sync/run').expect(409);

      // Reconnecting restores it.
      mail.failWithAuthError = false;
      await connect();
      expect((await client.get('/api/v1/gmail/status')).body.status).toBe('ACTIVE');
    });

    it('resumes an interrupted initial sync from its checkpoint', async () => {
      await client.post('/api/v1/sync/run').expect(200); // first chunk only
      mail.failWithAuthError = false;
      const run = await prisma.syncRun.findFirstOrThrow();
      expect(run.pageToken).toBe('100');
      const results = await syncUntilDone();
      expect(results.at(-1).run).toMatchObject({
        id: run.id,
        status: 'SUCCESS',
        messagesListed: TOTAL,
      });
    });
  });

  describe('disconnect', () => {
    it('revokes the grant and deletes every stored email, keeping applications', async () => {
      await connect();
      await syncUntilDone();
      await client
        .post('/api/v1/applications')
        .send({ companyName: 'Acme', roleTitle: 'Dev', appliedAt: new Date().toISOString() })
        .expect(201);

      await client.delete('/api/v1/gmail').expect(204);

      expect(mail.revoked.at(-1)).toMatch(/^fake-refresh-\d+$/);
      expect(await prisma.gmailConnection.count()).toBe(0);
      expect(await prisma.email.count()).toBe(0);
      expect(await prisma.emailThread.count()).toBe(0);
      expect(await prisma.syncRun.count()).toBe(0);
      expect(await prisma.application.count({ where: { company: { name: 'Acme' } } })).toBe(1);
    });
  });

  it("never exposes another user's mailbox", async () => {
    await connect();
    await syncUntilDone();
    const other = authedClient(app, await login(app, identity, 'other@test.local'));
    await other.get('/api/v1/gmail/status').expect(200, { connected: false });
    const { body } = await other.get('/api/v1/emails').expect(200);
    expect(body.total).toBe(0);
    await other.post('/api/v1/sync/run').expect(404);
  });
});
