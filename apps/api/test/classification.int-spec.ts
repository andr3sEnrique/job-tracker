import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { generateFakeMailbox, type FakeMailProvider } from '../src/gmail/fake-mail.provider.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { authedClient, createTestApp, login, resetDatabase } from './create-test-app.js';
import type { FakeIdentityProvider } from './fake-identity-provider.js';
import request from 'supertest';

describe('Email classification pipeline', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentityProvider;
  let mail: FakeMailProvider;
  let client: ReturnType<typeof authedClient>;

  async function connectAndSync() {
    const cookie = (client as unknown as { cookie: string }).cookie;
    const start = await request(app.getHttpServer())
      .get('/api/v1/gmail/connect')
      .set('Cookie', cookie);
    const callback = new URL(start.headers.location as string, 'http://localhost');
    const oauth = (start.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith('jat_gmail_oauth='))!
      .split(';')[0];
    await request(app.getHttpServer())
      .get(`${callback.pathname}${callback.search}`)
      .set('Cookie', `${cookie}; ${oauth}`)
      .expect(302);
    return syncUntilDone();
  }

  async function syncUntilDone() {
    let last;
    for (let i = 0; i < 200; i++) {
      last = (await client.post('/api/v1/sync/run').expect(200)).body;
      if (!last.hasMore) break;
    }
    return last;
  }

  /** The mailbox is the test oracle: every templated message says what it should become. */
  const templated = () => mail.mailbox.filter((m) => m.template);

  beforeAll(async () => {
    ({ app, prisma, identity, mail } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    mail.mailbox = generateFakeMailbox(120);
    const cookie = await login(app, identity);
    client = Object.assign(authedClient(app, cookie), { cookie });
  });

  it('classifies every email in the mailbox correctly', async () => {
    const result = await connectAndSync();
    expect(result.processing.remaining).toBe(0);

    const stored = await prisma.email.findMany({ where: { processingStatus: { not: 'SKIPPED' } } });
    const byGmailId = new Map(stored.map((e) => [e.gmailMessageId, e]));
    const mistakes = templated()
      .map((m) => ({
        key: m.template!.key,
        expected: m.template!.expected.category,
        got: byGmailId.get(m.id)?.category,
      }))
      .filter((r) => r.expected !== r.got);
    expect(mistakes).toEqual([]);
  });

  it('builds each application history in order, with the right final status', async () => {
    await connectAndSync();

    const offer = templated().find((m) => m.template!.key === 'en-offer')!;
    const offerEmail = await prisma.email.findFirstOrThrow({ where: { gmailMessageId: offer.id } });
    const application = await prisma.application.findUniqueOrThrow({
      where: { id: offerEmail.applicationId! },
      include: { company: true, events: { orderBy: { occurredAt: 'asc' } } },
    });

    expect(application.company.name).toBe(offer.company);
    expect(application.status).toBe('OFFER');
    const types = application.events.map((e) => e.type);
    expect(types.slice(-4)).toEqual([
      'CONFIRMATION_RECEIVED',
      'INTERVIEW_SCHEDULED',
      'TECHNICAL_INTERVIEW_SCHEDULED',
      'OFFER_RECEIVED',
    ]);
    // Learned from the recruiter's address, so her technical-interview email (no company
    // name in the text) still matched.
    expect(application.company.domain).toBe(offer.from!.split('@')[1]!.replace('>', ''));
  });

  it('links rejections to the application they belong to', async () => {
    await connectAndSync();
    const rejection = templated().find((m) => m.template!.key === 'fr-welcomekit-rejection')!;
    const email = await prisma.email.findFirstOrThrow({
      where: { gmailMessageId: rejection.id },
      include: { application: true },
    });
    expect(email.application).toMatchObject({ status: 'REJECTED', roleTitle: rejection.role });
  });

  it('never creates applications from job alerts or newsletters', async () => {
    await connectAndSync();
    const noise = await prisma.email.findMany({
      where: { category: { in: ['JOB_ALERT', 'IRRELEVANT'] } },
    });
    expect(noise.length).toBeGreaterThan(0);
    expect(noise.every((e) => e.applicationId === null && e.processingStatus === 'PROCESSED')).toBe(
      true,
    );
    expect(
      await prisma.applicationEvent.count({ where: { emailId: { in: noise.map((e) => e.id) } } }),
    ).toBe(0);
  });

  it('stores only structured data, never the body', async () => {
    await connectAndSync();
    const emails = await prisma.email.findMany({ where: { extracted: { not: undefined } } });
    for (const email of emails) {
      if (!email.extracted) continue;
      expect(Object.keys(email.extracted as object).sort()).toEqual(
        ['company', 'companyConfidence', 'jobUrl', 'location', 'role', 'workMode'].sort(),
      );
    }
    const bodySnippet = 'after careful consideration';
    const dump = JSON.stringify(await prisma.email.findMany());
    expect(dump).not.toContain(bodySnippet);
    const events = JSON.stringify(await prisma.applicationEvent.findMany());
    expect(events).not.toContain(bodySnippet);
  });

  it('is idempotent: one event per email, and syncing again changes nothing', async () => {
    await connectAndSync();
    const counts = async () => ({
      applications: await prisma.application.count(),
      events: await prisma.applicationEvent.count(),
    });
    const before = await counts();
    const linked = await prisma.email.count({ where: { applicationId: { not: null } } });
    expect(await prisma.applicationEvent.count({ where: { emailId: { not: null } } })).toBe(linked);

    await syncUntilDone();
    expect(await counts()).toEqual(before);
  });

  it('completes a role-less application instead of duplicating it', async () => {
    const base = { labels: ['INBOX'], template: null, company: null, role: null };
    mail.mailbox = [
      {
        ...base,
        id: 'later-with-role',
        threadId: 't-2',
        from: '"Nordvik" <no-reply@nordvik.teamtailor-mail.com>',
        subject: 'Nous avons bien reçu votre candidature !',
        body: 'Bonjour, merci pour votre candidature au poste de Data Engineer.',
        rfc822MessageId: '<t2@mail.fake>',
        receivedAt: new Date(Date.now() - 86_400_000),
      },
      {
        ...base,
        id: 'first-without-role',
        threadId: 't-1',
        from: 'noreply@emails.hellowork.com',
        subject: 'Votre candidature est arrivée chez Nordvik',
        body: 'Ces offres publiées dernièrement pourraient vous intéresser.',
        rfc822MessageId: '<t1@mail.fake>',
        receivedAt: new Date(Date.now() - 2 * 86_400_000),
      },
    ];
    await connectAndSync();

    const apps = await prisma.application.findMany({ include: { events: true } });
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ roleTitle: 'Data Engineer' });
    expect(apps[0]!.events).toHaveLength(2);
  });

  it('never overwrites fields edited by hand', async () => {
    const first = generateFakeMailbox(120);
    // Only the LinkedIn submission first: the application gets a location from the email.
    const submitted = first.find((m) => m.template?.key === 'es-linkedin-submitted')!;
    mail.mailbox = [submitted];
    await connectAndSync();
    const app0 = await prisma.application.findFirstOrThrow();
    await client
      .patch(`/api/v1/applications/${app0.id}`)
      .send({ location: 'Valencia' })
      .expect(200);

    // A later email for the same application must not reset it.
    mail.mailbox = first;
    await prisma.gmailConnection.updateMany({
      data: { lastSyncedAt: new Date(Date.now() - 400 * 86_400_000) },
    });
    await syncUntilDone();
    expect((await prisma.application.findUniqueOrThrow({ where: { id: app0.id } })).location).toBe(
      'Valencia',
    );
  });

  describe('review inbox', () => {
    it('sends emails it cannot place to review, and a human can create the application', async () => {
      mail.mailbox = [
        {
          id: 'orphan-1',
          threadId: 'orphan-thread',
          from: 'no-reply@ashbyhq.com',
          subject: 'Interview invitation',
          body: 'We would like to invite you to an interview next week.',
          rfc822MessageId: '<orphan@mail.fake>',
          receivedAt: new Date(),
          labels: ['INBOX'],
          template: null,
          company: null,
          role: null,
        },
      ];
      await connectAndSync();
      const email = await prisma.email.findFirstOrThrow({ where: { gmailMessageId: 'orphan-1' } });
      expect(email).toMatchObject({
        processingStatus: 'NEEDS_REVIEW',
        category: 'INTERVIEW',
        applicationId: null,
      });

      const { body: review } = await client
        .get('/api/v1/emails')
        .query({ status: 'NEEDS_REVIEW' })
        .expect(200);
      expect(review.items.map((e: { id: string }) => e.id)).toEqual([email.id]);

      await client
        .post(`/api/v1/emails/${email.id}/resolve`)
        .send({
          action: 'create',
          companyName: 'Orphan Corp',
          roleTitle: 'Data Engineer',
          category: 'INTERVIEW',
        })
        .expect(204);

      const app0 = await prisma.application.findFirstOrThrow({
        include: { events: true, company: true },
      });
      expect(app0).toMatchObject({
        roleTitle: 'Data Engineer',
        status: 'INTERVIEWING',
        company: { name: 'Orphan Corp' },
      });
      expect(app0.events.map((e) => e.type)).toEqual(['INTERVIEW_SCHEDULED']);
      expect(await prisma.email.findUniqueOrThrow({ where: { id: email.id } })).toMatchObject({
        processingStatus: 'PROCESSED',
        classifier: 'manual',
        applicationId: app0.id,
      });
    });

    it('ignoring an email undoes its effect on the application', async () => {
      await connectAndSync();
      const offer = templated().find((m) => m.template!.key === 'en-offer')!;
      const email = await prisma.email.findFirstOrThrow({ where: { gmailMessageId: offer.id } });

      await client
        .post(`/api/v1/emails/${email.id}/resolve`)
        .send({ action: 'ignore' })
        .expect(204);

      const application = await prisma.application.findUniqueOrThrow({
        where: { id: email.applicationId! },
      });
      expect(application.status).toBe('INTERVIEWING'); // back to the state before the offer
      expect(await prisma.applicationEvent.count({ where: { emailId: email.id } })).toBe(0);
    });

    it('can move an email to another application', async () => {
      await connectAndSync();
      const { body: manual } = await client
        .post('/api/v1/applications')
        .send({
          companyName: 'Target Co',
          roleTitle: 'SRE',
          appliedAt: new Date(Date.now() - 86_400_000).toISOString(),
        })
        .expect(201);
      const rejection = await prisma.email.findFirstOrThrow({ where: { category: 'REJECTION' } });

      await client
        .post(`/api/v1/emails/${rejection.id}/resolve`)
        .send({ action: 'assign', applicationId: manual.id, category: 'REJECTION' })
        .expect(204);

      const { body: target } = await client.get(`/api/v1/applications/${manual.id}`).expect(200);
      expect(target.status).toBe('REJECTED');
      const moved = target.events.find((e: { type: string }) => e.type === 'REJECTED');
      expect(moved).toMatchObject({
        source: 'EMAIL',
        emailUrl: expect.stringContaining('rfc822msgid'),
      });
      expect(await prisma.applicationEvent.count({ where: { emailId: rejection.id } })).toBe(1);
    });

    it("cannot resolve another user's email", async () => {
      await connectAndSync();
      const email = await prisma.email.findFirstOrThrow({
        where: { processingStatus: { not: 'SKIPPED' } },
      });
      const other = authedClient(app, await login(app, identity, 'other@test.local'));
      await other.post(`/api/v1/emails/${email.id}/resolve`).send({ action: 'ignore' }).expect(404);
    });
  });

  describe('reprocessing', () => {
    it('rebuilds everything derived from emails and keeps manual work', async () => {
      await connectAndSync();
      const before = await prisma.application.count();
      const { body: manual } = await client
        .post('/api/v1/applications')
        .send({ companyName: 'Hand Made', roleTitle: 'CTO', appliedAt: new Date().toISOString() })
        .expect(201);

      const { body: reset } = await client.post('/api/v1/emails/reprocess').expect(200);
      expect(reset.applicationsRemoved).toBe(before);
      expect(await prisma.application.count()).toBe(1);
      expect(await prisma.email.count({ where: { processingStatus: 'PENDING' } })).toBe(
        reset.emailsReset,
      );

      await syncUntilDone();
      expect(await prisma.application.count()).toBe(before + 1);
      await client.get(`/api/v1/applications/${manual.id}`).expect(200);
    });
  });
});
