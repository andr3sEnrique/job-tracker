import { listApplicationsQuerySchema } from '@jat/shared';
import { describe, expect, it } from 'vitest';
import {
  parseApplicationsSearchParams,
  serializeApplicationsQuery,
} from './applications-search-params';

const parse = (qs: string) => parseApplicationsSearchParams(new URLSearchParams(qs));

describe('parseApplicationsSearchParams', () => {
  it('returns defaults for an empty URL', () => {
    expect(parse('')).toEqual(listApplicationsQuerySchema.parse({}));
  });

  it('parses lists, flags, sorting and paging', () => {
    expect(parse('q=acme&status=APPLIED,OFFER&active=1&sort=company&dir=asc&page=3')).toMatchObject(
      {
        q: 'acme',
        status: ['APPLIED', 'OFFER'],
        activeOnly: true,
        sortBy: 'company',
        sortDir: 'asc',
        page: 3,
      },
    );
  });

  it('drops unknown enum values but keeps valid ones', () => {
    expect(parse('status=APPLIED,NOPE').status).toEqual(['APPLIED']);
    expect(parse('status=NOPE').status).toBeUndefined();
  });

  it('falls back to defaults for invalid scalar values', () => {
    const query = parse('sort=hack&page=-2&size=9999&q=ok');
    expect(query).toMatchObject({ sortBy: 'appliedAt', page: 1, pageSize: 20, q: 'ok' });
  });
});

describe('serializeApplicationsQuery', () => {
  it('omits defaults', () => {
    expect(serializeApplicationsQuery(listApplicationsQuerySchema.parse({})).toString()).toBe('');
  });

  it('round-trips through parse', () => {
    const query = listApplicationsQuerySchema.parse({
      q: 'dev',
      source: ['LINKEDIN', 'REFERRAL'],
      workMode: ['REMOTE'],
      activeOnly: true,
      sortBy: 'lastActivityAt',
      sortDir: 'asc',
      page: 2,
      pageSize: 50,
    });
    expect(parseApplicationsSearchParams(serializeApplicationsQuery(query))).toEqual(query);
  });
});
