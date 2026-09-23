import { describe, expect, it } from 'vitest';
import { createApplicationSchema, listApplicationsQuerySchema, salarySchema } from './applications';

describe('createApplicationSchema', () => {
  it('applies defaults and trims strings', () => {
    const parsed = createApplicationSchema.parse({
      companyName: '  Acme  ',
      roleTitle: 'Backend Engineer',
      appliedAt: '2026-09-01T10:00:00.000Z',
    });
    expect(parsed).toMatchObject({
      companyName: 'Acme',
      status: 'APPLIED',
      source: 'OTHER',
      workMode: 'UNKNOWN',
      jobUrl: null,
    });
  });

  it('rejects an empty company name', () => {
    const result = createApplicationSchema.safeParse({
      companyName: '   ',
      roleTitle: 'Dev',
      appliedAt: '2026-09-01T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid job URLs', () => {
    const result = createApplicationSchema.safeParse({
      companyName: 'Acme',
      roleTitle: 'Dev',
      appliedAt: '2026-09-01T10:00:00.000Z',
      jobUrl: 'not a url',
    });
    expect(result.success).toBe(false);
  });
});

describe('salarySchema', () => {
  it('rejects min greater than max', () => {
    const result = salarySchema.safeParse({
      min: 60000,
      max: 40000,
      currency: 'EUR',
      period: 'YEAR',
    });
    expect(result.success).toBe(false);
  });
});

describe('listApplicationsQuerySchema', () => {
  it('fills pagination and sort defaults', () => {
    expect(listApplicationsQuerySchema.parse({})).toMatchObject({
      sortBy: 'appliedAt',
      sortDir: 'desc',
      page: 1,
      pageSize: 20,
    });
  });

  it('caps page size', () => {
    expect(listApplicationsQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });
});
