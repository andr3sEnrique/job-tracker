import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  generateFakeMailbox,
  type FakeMailProvider,
  type FakeMessage,
} from '../src/gmail/fake-mail.provider.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  authedClient,
  connectGmail,
  createTestApp,
  login,
  resetDatabase,
} from './create-test-app.js';
import type { FakeIdentityProvider } from './fake-identity-provider.js';

const SECRET = process.env.CRON_SECRET as string;
const DAY = 86_400_000;

const message = (id: string, overrides: Partial<FakeMessage> = {}): FakeMessage => ({
  id,
  threadId: `${id}-thread`,
  from: 'no-reply@ashbyhq.com',
  subject: 'Interview invitation',
  rfc822MessageId: `<${id}@mail.fake>`,
  receivedAt: new Date(),
  labels: ['INBOX'],
  body: 'We would like to invite you to an interview.',
  template: null,
  company: null,
  role: null,
  ...overrides,
});

describe('Automatic sync', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentityProvider;
  let mail: FakeMailProvider;
  let session: string;
  let client: ReturnType<typeof authedClient>;

  const cron = (secret: string | null = SECRET) => {
    const req = request(app.getHttpServer()).post('/api/v1/internal/sync');
    return secret === null ? req : req.set('X-Cron-Secret', secret);
  };
  /** The external cron keeps calling until the backlog is gone. */
  async function cronUntilDone() {
    for (let i = 0; i < 50; i++) {
      const { body } = await cron().expect(200);
      if (!body.hasMore) return body;
    }
    throw new Error('Automatic sync never finished');
  }

  beforeAll(async () => {
    ({ app, prisma, identity, mail } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    mail.mailbox = generateFakeMailbox(60);
    mail.failWithAuthError = false;
    session = await login(app, identity);
    client = authedClient(app, session);
  });

  describe('cron endpoint', () => {
    it('requires the shared secret', async () => {
      await cron(null).expect(401);
      await cron('wrong-secret').expect(401);
      await cron(`${SECRET}x`).expect(401);
    });

    it('needs neither a session nor the CSRF header', async () => {
      const { body } = await cron().expect(200);
      expect(body).toMatchObject({ connections: 0, succeeded: 0, failed: 0 });
    });

    it('syncs every active mailbox and records who triggered it', async () => {
      await connectGmail(app, session);
      const other = await login(app, identity, 'other@test.local');
      await connectGmail(app, other);

      const result = await cronUntilDone();
      expect(result).toMatchObject({ connections: 2, failed: 0 });

      const runs = await prisma.syncRun.findMany();
      expect(runs.every((r) => r.trigger === 'CRON')).toBe(true);
      expect(await prisma.gmailConnection.count({ where: { initialSyncCompletedAt: null } })).toBe(
        0,
      );

      const { body: status } = await client.get('/api/v1/gmail/status').expect(200);
      expect(status.lastAutomaticSyncAt).not.toBeNull();
      expect(status.lastRun.trigger).toBe('CRON');
    });

    it('skips mailboxes that need re-authorisation and one already syncing', async () => {
      await connectGmail(app, session);
      await prisma.gmailConnection.updateMany({
        data: { syncLockedUntil: new Date(Date.now() + 60_000) },
      });
      expect((await cron().expect(200)).body).toMatchObject({ connections: 1, busy: 1 });

      await prisma.gmailConnection.updateMany({
        data: { syncLockedUntil: null, status: 'NEEDS_REAUTH' },
      });
      expect((await cron().expect(200)).body).toMatchObject({ connections: 0 });
    });

    it('a manual click still records the user as trigger', async () => {
      await connectGmail(app, session);
      await client.post('/api/v1/sync/run').expect(200);
      expect((await prisma.syncRun.findFirstOrThrow()).trigger).toBe('USER');
      const { body: status } = await client.get('/api/v1/gmail/status').expect(200);
      expect(status.lastAutomaticSyncAt).toBeNull();
    });
  });

  describe('incremental sync', () => {
    beforeEach(async () => {
      await connectGmail(app, session);
      await cronUntilDone();
    });

    it('ingests only what arrived since the last sync, ignoring sent and draft mail', async () => {
      mail.deliver(message('new-1'));
      mail.deliver(message('new-sent', { labels: ['SENT'] }));
      mail.deliver(message('new-draft', { labels: ['DRAFT'] }));
      mail.deliver(message('new-2', { from: 'mum@family.example', subject: 'Dinner?' }));

      await cronUntilDone();
      const run = await prisma.syncRun.findFirstOrThrow({ orderBy: { startedAt: 'desc' } });
      expect(run).toMatchObject({
        type: 'INCREMENTAL',
        status: 'SUCCESS',
        messagesListed: 2,
        candidates: 1,
        skipped: 1,
      });
      const fresh = await prisma.email.findFirstOrThrow({ where: { gmailMessageId: 'new-1' } });
      expect(fresh.processingStatus).not.toBe('PENDING'); // classified in the same tick
      expect(await prisma.email.count({ where: { gmailMessageId: 'new-sent' } })).toBe(0);
    });

    it('tolerates messages deleted before their metadata was fetched', async () => {
      mail.deliver(message('ephemeral'));
      await mail.getHistoryId(); // Gmail recorded the arrival…
      mail.mailbox.splice(0, 1); // …and the message was deleted before the sync.
      mail.deliver(message('kept'));

      await cronUntilDone();
      const run = await prisma.syncRun.findFirstOrThrow({ orderBy: { startedAt: 'desc' } });
      // Listed by the history, gone when fetched: counted as failed, not a sync error.
      expect(run).toMatchObject({ status: 'SUCCESS', messagesListed: 2, candidates: 1, failed: 1 });
      expect(await prisma.email.count({ where: { gmailMessageId: 'kept' } })).toBe(1);
    });
  });

  describe('maintenance', () => {
    const createApplication = (appliedAt: Date, status?: string) =>
      client
        .post('/api/v1/applications')
        .send({
          companyName: 'Silent Corp',
          roleTitle: 'Backend Engineer',
          appliedAt: appliedAt.toISOString(),
          ...(status && { status }),
        })
        .expect(201);

    it('marks applications without news for 30 days as ghosted, with a system event', async () => {
      const lastActivity = new Date(Date.now() - 45 * DAY);
      const { body: stale } = await createApplication(lastActivity);
      const { body: recent } = await createApplication(new Date(Date.now() - 5 * DAY));
      const { body: rejected } = await createApplication(lastActivity, 'REJECTED');

      expect((await cron().expect(200)).body.ghosted).toBe(1);

      const { body: ghosted } = await client.get(`/api/v1/applications/${stale.id}`).expect(200);
      expect(ghosted.status).toBe('GHOSTED');
      expect(ghosted.events[0]).toMatchObject({
        type: 'STATUS_CHANGED',
        source: 'SYSTEM',
        fromStatus: 'APPLIED',
        toStatus: 'GHOSTED',
        occurredAt: new Date(lastActivity.getTime() + 30 * DAY).toISOString(),
      });
      for (const id of [recent.id, rejected.id]) {
        const { body } = await client.get(`/api/v1/applications/${id}`).expect(200);
        expect(body.status).not.toBe('GHOSTED');
      }

      // Idempotent: nothing more to do on the next run.
      expect((await cron().expect(200)).body.ghosted).toBe(0);
    });

    it('deletes expired sessions', async () => {
      await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await cron().expect(200)).body.sessionsDeleted).toBe(1);
      expect(await prisma.session.count()).toBe(0);
    });
  });
});
