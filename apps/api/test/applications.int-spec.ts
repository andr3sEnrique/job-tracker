import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { authedClient, createTestApp, login, resetDatabase } from './create-test-app.js';
import type { FakeIdentityProvider } from './fake-identity-provider.js';

describe('Applications API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentityProvider;
  let http: () => ReturnType<typeof authedClient>;

  const create = (body: Record<string, unknown> = {}) =>
    http()
      .post('/api/v1/applications')
      .send({
        companyName: 'Acme, S.L.',
        roleTitle: 'Backend Engineer',
        appliedAt: '2026-09-01T10:00:00.000Z',
        ...body,
      });

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

  it('creates an application with its initial event', async () => {
    const res = await create().expect(201);
    expect(res.body).toMatchObject({
      company: { name: 'Acme, S.L.' },
      roleTitle: 'Backend Engineer',
      status: 'APPLIED',
      events: [{ type: 'APPLIED', source: 'MANUAL', toStatus: 'APPLIED' }],
    });
  });

  it('reuses the company when the name only differs in case, accents or legal suffix', async () => {
    await create({ companyName: 'Acme, S.L.' }).expect(201);
    await create({ companyName: 'ACME' }).expect(201);
    expect(await prisma.company.count()).toBe(1);
  });

  it('records the jump when an application is registered in a later status', async () => {
    const res = await create({ status: 'INTERVIEWING' }).expect(201);
    expect(res.body.events.map((e: { type: string }) => e.type)).toEqual([
      'STATUS_CHANGED',
      'APPLIED',
    ]);
  });

  it('rejects invalid input with the validation issues', async () => {
    const res = await create({ companyName: '', jobUrl: 'nope' }).expect(400);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['companyName', 'jobUrl']),
    );
  });

  it('lists with filters, sorting and pagination', async () => {
    await create({ companyName: 'Zeta', appliedAt: '2026-09-01T10:00:00.000Z' });
    await create({
      companyName: 'Alfa',
      appliedAt: '2026-09-03T10:00:00.000Z',
      source: 'REFERRAL',
    });
    await create({ companyName: 'Mu', appliedAt: '2026-09-02T10:00:00.000Z', status: 'REJECTED' });

    const byDate = await http().get('/api/v1/applications').expect(200);
    expect(byDate.body.items.map((a: { company: { name: string } }) => a.company.name)).toEqual([
      'Alfa',
      'Mu',
      'Zeta',
    ]);

    const active = await http()
      .get('/api/v1/applications')
      .query({ activeOnly: 'true', sortBy: 'company', sortDir: 'asc' })
      .expect(200);
    expect(active.body.items.map((a: { company: { name: string } }) => a.company.name)).toEqual([
      'Alfa',
      'Zeta',
    ]);

    const page = await http()
      .get('/api/v1/applications')
      .query({ pageSize: '2', page: '2' })
      .expect(200);
    expect(page.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page.body.items).toHaveLength(1);

    const search = await http()
      .get('/api/v1/applications')
      .query({ q: 'alf', source: 'REFERRAL' })
      .expect(200);
    expect(search.body.total).toBe(1);
  });

  it('rejects unknown filter values', async () => {
    await http().get('/api/v1/applications').query({ status: 'HACKED' }).expect(400);
  });

  it('changes the status, records the event and refuses no-op changes', async () => {
    const { body: created } = await create();
    const res = await http()
      .post(`/api/v1/applications/${created.id}/status`)
      .send({ status: 'INTERVIEWING', note: 'Primera entrevista' })
      .expect(200);
    expect(res.body.status).toBe('INTERVIEWING');
    expect(res.body.events[0]).toMatchObject({
      type: 'STATUS_CHANGED',
      fromStatus: 'APPLIED',
      toStatus: 'INTERVIEWING',
      summary: 'Primera entrevista',
    });

    await http()
      .post(`/api/v1/applications/${created.id}/status`)
      .send({ status: 'INTERVIEWING' })
      .expect(400);
  });

  it('updates fields, moves the application to another company and locks edited fields', async () => {
    const { body: created } = await create();
    const res = await http()
      .patch(`/api/v1/applications/${created.id}`)
      .send({ companyName: 'Globex', location: 'Madrid', salary: null })
      .expect(200);
    expect(res.body).toMatchObject({
      company: { name: 'Globex' },
      location: 'Madrid',
      salary: null,
    });

    const row = await prisma.application.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.lockedFields).toEqual(expect.arrayContaining(['company', 'location', 'salary']));
  });

  it('adds notes to the timeline', async () => {
    const { body: created } = await create();
    await http()
      .post(`/api/v1/applications/${created.id}/notes`)
      .send({ text: 'Llamar el lunes' })
      .expect(201);
    const { body } = await http().get(`/api/v1/applications/${created.id}`).expect(200);
    expect(body.events[0]).toMatchObject({ type: 'NOTE', summary: 'Llamar el lunes' });
  });

  it('deletes an application and its events', async () => {
    const { body: created } = await create();
    await http().delete(`/api/v1/applications/${created.id}`).expect(204);
    await http().get(`/api/v1/applications/${created.id}`).expect(404);
    expect(await prisma.applicationEvent.count()).toBe(0);
  });

  it('returns 404 for unknown ids and 400 for malformed ones', async () => {
    await http().get('/api/v1/applications/0199a1f2-0000-7000-8000-000000000000').expect(404);
    await http().get('/api/v1/applications/not-a-uuid').expect(400);
  });

  it('never returns applications owned by another user', async () => {
    const stranger = await prisma.user.create({ data: { email: 'stranger@test.local' } });
    const company = await prisma.company.create({
      data: { userId: stranger.id, name: 'Secret', normalizedName: 'secret' },
    });
    const foreign = await prisma.application.create({
      data: {
        userId: stranger.id,
        companyId: company.id,
        roleTitle: 'Hidden',
        appliedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    const list = await http().get('/api/v1/applications').expect(200);
    expect(list.body.total).toBe(0);
    await http().get(`/api/v1/applications/${foreign.id}`).expect(404);
    await http().patch(`/api/v1/applications/${foreign.id}`).send({ roleTitle: 'x' }).expect(404);
    await http().delete(`/api/v1/applications/${foreign.id}`).expect(404);
    expect(await prisma.application.count({ where: { id: foreign.id } })).toBe(1);
  });
});
