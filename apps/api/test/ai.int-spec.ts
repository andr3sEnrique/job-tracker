import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FakeLlmProvider } from '../src/ai/fake-llm.provider.js';
import type { AiAnalysis } from '../src/ai/email-prompt.js';
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

/** A platform confirmation that names neither the company nor the role: rules are stuck. */
const vague: FakeMessage = {
  id: 'vague-1',
  threadId: 'vague-thread',
  from: 'Indeed <no-reply@indeed.com>',
  subject: 'Application submitted',
  rfc822MessageId: '<vague@mail.fake>',
  receivedAt: new Date(Date.now() - 3_600_000),
  labels: ['INBOX'],
  body: 'Your application has been sent. The employer will contact you at recruit.me@example.org or +44 7700 900123.',
  template: null,
  company: null,
  role: null,
};

const answer: AiAnalysis = {
  category: 'APPLICATION_SUBMITTED',
  confidence: 0.9,
  company: 'Northwind Analytics',
  role: 'Data Engineer',
  location: 'Lyon',
  workMode: 'HYBRID',
  jobUrl: 'https://invented.example/job',
};

describe('AI classification', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentityProvider;
  let mail: FakeMailProvider;
  let llm: FakeLlmProvider;
  let client: ReturnType<typeof authedClient>;

  async function syncUntilDone() {
    for (let i = 0; i < 50; i++) {
      const { body } = await client.post('/api/v1/sync/run').expect(200);
      if (!body.hasMore) return;
    }
    throw new Error('Sync never finished');
  }

  beforeAll(async () => {
    ({ app, prisma, identity, mail, llm } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    await prisma.aiRun.deleteMany();
    llm.reset();
    mail.mailbox = [{ ...vague }];
    const session = await login(app, identity);
    client = authedClient(app, session);
    await connectGmail(app, session);
  });

  it('is off by default: rules only, nothing recorded', async () => {
    await syncUntilDone();
    expect(llm.calls).toHaveLength(0);
    expect(await prisma.aiRun.count()).toBe(0);
    const email = await prisma.email.findFirstOrThrow();
    expect(email).toMatchObject({ classifier: 'rules@3', processingStatus: 'NEEDS_REVIEW' });
  });

  it('asks the AI when the rules are stuck and uses its answer', async () => {
    llm.enabled = true;
    llm.respond = () => answer;
    await syncUntilDone();

    expect(llm.calls).toHaveLength(1);
    const email = await prisma.email.findFirstOrThrow({
      include: { application: { include: { company: true } } },
    });
    expect(email.classifier).toBe('ai:fake-model@prompt-v2');
    expect(email.application).toMatchObject({
      roleTitle: 'Data Engineer',
      location: 'Lyon',
      workMode: 'HYBRID',
      // A link that is not in the email is a hallucination and is dropped.
      jobUrl: null,
      company: { name: 'Northwind Analytics' },
    });

    const run = await prisma.aiRun.findFirstOrThrow();
    // 1000 input tokens × $1/M + 100 output × $5/M.
    expect(run).toMatchObject({ status: 'OK', model: 'fake-model', promptVersion: 'prompt-v2' });
    expect(Number(run.costUsd)).toBeCloseTo(0.0015);
  });

  it('sends only redacted text: no addresses or phone numbers leave the server', async () => {
    llm.enabled = true;
    llm.respond = () => answer;
    await syncUntilDone();
    const prompt = llm.calls[0]!.prompt;
    expect(prompt).not.toMatch(/recruit\.me|no-reply@indeed|7700/);
    expect(prompt).toContain('domain: indeed.com');
  });

  it('never calls the AI for mail the rules are sure about', async () => {
    mail.mailbox = generateFakeMailbox(40).filter(
      (m) => m.template?.expected.company && m.template.expected.role,
    );
    llm.enabled = true;
    llm.respond = () => answer;
    await syncUntilDone();
    const candidates = await prisma.email.count({
      where: { processingStatus: { not: 'SKIPPED' } },
    });
    expect(candidates).toBeGreaterThan(5);
    expect(llm.calls.length).toBeLessThan(candidates / 2);
  });

  it('reuses the stored answer when emails are reprocessed', async () => {
    llm.enabled = true;
    llm.respond = () => answer;
    await syncUntilDone();
    await client.post('/api/v1/emails/reprocess').expect(200);
    await syncUntilDone();
    expect(llm.calls).toHaveLength(1);
    expect(await prisma.aiRun.count()).toBe(1);
    expect((await prisma.email.findFirstOrThrow()).classifier).toBe('ai:fake-model@prompt-v2');
  });

  it.each([
    ['invalid output', () => ({ category: 'MAYBE' }), 'INVALID_OUTPUT'],
    [
      'a provider error',
      () => {
        throw new Error('boom');
      },
      'ERROR',
    ],
  ])('falls back to the rules on %s', async (_label, respond, status) => {
    llm.enabled = true;
    llm.respond = respond;
    await syncUntilDone();
    expect((await prisma.aiRun.findFirstOrThrow()).status).toBe(status);
    const email = await prisma.email.findFirstOrThrow();
    expect(email).toMatchObject({ classifier: 'rules@3', processingStatus: 'NEEDS_REVIEW' });
  });

  it('stops calling the AI once the monthly budget is spent', async () => {
    llm.enabled = true;
    llm.respond = () => answer;
    await prisma.aiRun.create({
      data: {
        provider: 'fake',
        model: 'fake-model',
        promptVersion: 'old',
        status: 'OK',
        costUsd: 1,
      },
    });
    await syncUntilDone();
    expect(llm.calls).toHaveLength(0);
    expect(await prisma.aiRun.count({ where: { status: 'SKIPPED_BUDGET' } })).toBe(1);
    expect((await prisma.email.findFirstOrThrow()).classifier).toBe('rules@3');

    const { body } = await client.get('/api/v1/ai/status').expect(200);
    expect(body).toMatchObject({
      enabled: true,
      provider: 'fake',
      budgetExceeded: true,
      spentThisMonthUsd: 1,
      callsThisMonth: 1,
    });
  });

  it('shows who classified each email', async () => {
    llm.enabled = true;
    llm.respond = () => answer;
    await syncUntilDone();
    const { body } = await client.get('/api/v1/emails').expect(200);
    expect(body.items[0].classifier).toBe('ai:fake-model@prompt-v2');
  });
});
