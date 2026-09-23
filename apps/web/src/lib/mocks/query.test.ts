import { listApplicationsQuerySchema, type Application } from '@jat/shared';
import { describe, expect, it } from 'vitest';
import { normalizeText, queryApplications } from './query';

const base = (overrides: Partial<Application>): Application => ({
  id: 'x',
  company: { id: 'c', name: 'Acme', domain: null },
  roleTitle: 'Backend Engineer',
  location: 'Madrid',
  workMode: 'REMOTE',
  salary: null,
  source: 'LINKEDIN',
  jobUrl: null,
  status: 'APPLIED',
  appliedAt: '2026-09-01T10:00:00.000Z',
  lastActivityAt: '2026-09-01T10:00:00.000Z',
  needsReview: false,
  notes: null,
  ...overrides,
});

const apps: Application[] = [
  base({
    id: 'a',
    company: { id: '1', name: 'Zeta', domain: null },
    status: 'REJECTED',
    appliedAt: '2026-08-01T10:00:00.000Z',
    location: 'Málaga',
  }),
  base({
    id: 'b',
    company: { id: '2', name: 'Alfa', domain: null },
    status: 'INTERVIEWING',
    source: 'REFERRAL',
    appliedAt: '2026-09-10T10:00:00.000Z',
  }),
  base({
    id: 'c',
    company: { id: '3', name: 'Mu', domain: null },
    roleTitle: 'Frontend Dev',
    workMode: 'ONSITE',
    appliedAt: '2026-09-05T10:00:00.000Z',
  }),
];

const q = (input: Record<string, unknown> = {}) => listApplicationsQuerySchema.parse(input);

describe('normalizeText', () => {
  it('lowercases and removes accents', () => {
    expect(normalizeText('Málaga ÑANDÚ')).toBe('malaga nandu');
  });
});

describe('queryApplications', () => {
  it('sorts by appliedAt desc by default', () => {
    expect(queryApplications(apps, q()).items.map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  it('searches company, role and location ignoring accents', () => {
    expect(queryApplications(apps, q({ q: 'malaga' })).items.map((a) => a.id)).toEqual(['a']);
    expect(queryApplications(apps, q({ q: 'frontend' })).items.map((a) => a.id)).toEqual(['c']);
  });

  it('filters by status, source and work mode', () => {
    expect(queryApplications(apps, q({ status: ['REJECTED'] })).total).toBe(1);
    expect(queryApplications(apps, q({ source: ['REFERRAL'] })).items[0]?.id).toBe('b');
    expect(queryApplications(apps, q({ workMode: ['ONSITE'] })).items[0]?.id).toBe('c');
  });

  it('keeps only active applications when requested', () => {
    expect(queryApplications(apps, q({ activeOnly: true })).items.map((a) => a.id)).toEqual([
      'b',
      'c',
    ]);
  });

  it('filters by an inclusive date range', () => {
    const result = queryApplications(
      apps,
      q({ appliedFrom: '2026-09-05', appliedTo: '2026-09-05' }),
    );
    expect(result.items.map((a) => a.id)).toEqual(['c']);
  });

  it('sorts by company name', () => {
    const result = queryApplications(apps, q({ sortBy: 'company', sortDir: 'asc' }));
    expect(result.items.map((a) => a.company.name)).toEqual(['Alfa', 'Mu', 'Zeta']);
  });

  it('paginates and reports the unpaginated total', () => {
    const result = queryApplications(apps, q({ pageSize: 2, page: 2 }));
    expect(result).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(result.items.map((a) => a.id)).toEqual(['a']);
  });
});
