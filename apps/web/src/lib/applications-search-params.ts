import {
  applicationSourceSchema,
  applicationStatusSchema,
  listApplicationsQuerySchema,
  workModeSchema,
  type ListApplicationsQuery,
} from '@jat/shared';
import type { z } from 'zod';

const DEFAULTS = listApplicationsQuerySchema.parse({});

function parseList<T extends string>(raw: string | null, schema: z.ZodType<T>): T[] | undefined {
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((v) => schema.safeParse(v))
    .flatMap((r) => (r.success ? [r.data] : []));
  return values.length ? values : undefined;
}

function parsePositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * URL → query. Invalid values are dropped instead of throwing, so a hand-edited
 * or stale URL never breaks the page.
 */
export function parseApplicationsSearchParams(params: URLSearchParams): ListApplicationsQuery {
  const candidate = {
    q: params.get('q') || undefined,
    status: parseList(params.get('status'), applicationStatusSchema),
    source: parseList(params.get('source'), applicationSourceSchema),
    workMode: parseList(params.get('workMode'), workModeSchema),
    activeOnly: params.get('active') === '1' || undefined,
    sortBy: params.get('sort') || undefined,
    sortDir: params.get('dir') || undefined,
    page: parsePositiveInt(params.get('page')),
    pageSize: parsePositiveInt(params.get('size')),
  };
  const result = listApplicationsQuerySchema.safeParse(candidate);
  if (result.success) return result.data;

  // Drop only the offending fields and keep the rest.
  const invalid = new Set(result.error.issues.map((i) => String(i.path[0])));
  const cleaned = Object.fromEntries(Object.entries(candidate).filter(([k]) => !invalid.has(k)));
  return listApplicationsQuerySchema.parse(cleaned);
}

/** Query → URL, omitting defaults to keep URLs short and shareable. */
export function serializeApplicationsQuery(query: ListApplicationsQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status?.length) params.set('status', query.status.join(','));
  if (query.source?.length) params.set('source', query.source.join(','));
  if (query.workMode?.length) params.set('workMode', query.workMode.join(','));
  if (query.activeOnly) params.set('active', '1');
  if (query.sortBy !== DEFAULTS.sortBy) params.set('sort', query.sortBy);
  if (query.sortDir !== DEFAULTS.sortDir) params.set('dir', query.sortDir);
  if (query.page !== DEFAULTS.page) params.set('page', String(query.page));
  if (query.pageSize !== DEFAULTS.pageSize) params.set('size', String(query.pageSize));
  return params;
}
