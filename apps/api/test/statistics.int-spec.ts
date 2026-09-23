import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { authedClient, createTestApp, login, resetDatabase } from './create-test-app.js';
import type { FakeIdentityProvider } from './fake-identity-provider.js';

describe('Statistics and health API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentityProvider;
  let http: () => ReturnType<typeof authedClient>;

  beforeAll(async () => {
    ({ app, prisma, identity } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    const client = authedClient(app, await login(app, identity));
    http = () => client;
  });

  it('returns an empty dashboard for a new user', async () => {
    const { body } = await http().get('/api/v1/stats/dashboard').expect(200);
    expect(body.summary).toEqual({ total: 0, active: 0, interviews: 0, offers: 0, rejected: 0 });
    expect(body.timeline).toHaveLength(12);
    expect(body.recentActivity).toEqual([]);
  });

  it('aggregates applications and events', async () => {
    const now = new Date().toISOString();
    const post = (body: Record<string, unknown>) =>
      http()
        .post('/api/v1/applications')
        .send({ roleTitle: 'Dev', appliedAt: now, ...body })
        .expect(201);

    const a = await post({ companyName: 'A' });
    await post({ companyName: 'B', status: 'REJECTED', source: 'LINKEDIN' });
    await post({ companyName: 'C' });

    // Record an interview on A through the events table (what the email pipeline will do).
    await prisma.applicationEvent.create({
      data: {
        applicationId: a.body.id,
        type: 'INTERVIEW_SCHEDULED',
        occurredAt: new Date(),
        source: 'EMAIL',
      },
    });

    const { body } = await http().get('/api/v1/stats/dashboard').expect(200);
    expect(body.summary).toEqual({ total: 3, active: 2, interviews: 1, offers: 0, rejected: 1 });
    expect(body.funnel).toEqual({ applied: 3, interviewed: 1, offered: 0 });
    expect(body.timeline.at(-1).applications).toBe(3);
    expect(body.sourceDistribution).toEqual([
      { source: 'OTHER', count: 2 },
      { source: 'LINKEDIN', count: 1 },
    ]);
    expect(body.recentActivity[0].event.type).toBe('INTERVIEW_SCHEDULED');
  });

  it('exposes public liveness and readiness probes', async () => {
    await http().get('/api/v1/health/live').expect(200, { status: 'ok' });
    const { body } = await http().get('/api/v1/health/ready').expect(200);
    expect(body.status).toBe('ok');
  });
});
