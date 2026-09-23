import { describe, expect, it } from 'vitest';
import {
  createApplicationSchema,
  listApplicationsParamsSchema,
  listApplicationsQuerySchema,
  salarySchema,
  toListApplicationsParams,
  updateApplicationSchema,
} from './applications.js';

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

describe('listApplicationsParamsSchema', () => {
  it('parses a query-string record into a typed query', () => {
    expect(
      listApplicationsParamsSchema.parse({
        status: 'APPLIED,OFFER',
        activeOnly: 'true',
        page: '2',
        sortBy: 'company',
      }),
    ).toMatchObject({ status: ['APPLIED', 'OFFER'], activeOnly: true, page: 2, sortBy: 'company' });
  });

  it('rejects unknown enum values', () => {
    expect(listApplicationsParamsSchema.safeParse({ status: 'APPLIED,NOPE' }).success).toBe(false);
  });

  it('round-trips through toListApplicationsParams', () => {
    const query = listApplicationsQuerySchema.parse({
      q: 'dev',
      source: ['LINKEDIN'],
      activeOnly: false,
      page: 3,
    });
    const params = toListApplicationsParams(query);
    expect(listApplicationsParamsSchema.parse(params)).toEqual(query);
  });
});

describe('updateApplicationSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateApplicationSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a partial patch', () => {
    expect(updateApplicationSchema.parse({ location: null })).toEqual({ location: null });
  });
});
