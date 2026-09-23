import { listApplicationsQuerySchema } from '@jat/shared';
import { describe, expect, it } from 'vitest';
import { buildApplicationsOrderBy, buildApplicationsWhere } from './applications.query.js';

const q = (input: Record<string, unknown> = {}) => listApplicationsQuerySchema.parse(input);

describe('buildApplicationsWhere', () => {
  it('always scopes to the user and hides archived rows', () => {
    expect(buildApplicationsWhere('u1', q())).toEqual({ userId: 'u1', archived: false });
  });

  it('searches company, role and location case-insensitively', () => {
    const where = buildApplicationsWhere('u1', q({ q: 'acme' }));
    expect(where.AND).toEqual([
      {
        OR: [
          { company: { name: { contains: 'acme', mode: 'insensitive' } } },
          { roleTitle: { contains: 'acme', mode: 'insensitive' } },
          { location: { contains: 'acme', mode: 'insensitive' } },
        ],
      },
    ]);
  });

  it('combines status and activeOnly instead of overwriting one with the other', () => {
    const where = buildApplicationsWhere(
      'u1',
      q({ status: ['REJECTED', 'APPLIED'], activeOnly: true }),
    );
    expect(where.AND).toHaveLength(2);
  });

  it('builds an inclusive UTC date range', () => {
    const where = buildApplicationsWhere(
      'u1',
      q({ appliedFrom: '2026-09-01', appliedTo: '2026-09-30' }),
    );
    expect(where.appliedAt).toEqual({
      gte: new Date('2026-09-01T00:00:00.000Z'),
      lte: new Date('2026-09-30T23:59:59.999Z'),
    });
  });
});

describe('buildApplicationsOrderBy', () => {
  it('sorts by company name through the relation', () => {
    expect(buildApplicationsOrderBy(q({ sortBy: 'company', sortDir: 'asc' }))[0]).toEqual({
      company: { name: 'asc' },
    });
  });

  it('adds a stable tie-breaker', () => {
    expect(buildApplicationsOrderBy(q()).at(-1)).toEqual({ id: 'asc' });
  });
});
