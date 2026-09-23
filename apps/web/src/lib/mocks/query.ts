import {
  isActiveStatus,
  type Application,
  type ListApplicationsQuery,
  type Paginated,
} from '@jat/shared';

/** Lowercase and strip accents so "malaga" matches "Málaga". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * In-memory equivalent of what `GET /applications` will do in Phase 2.
 * Kept pure so it can be unit-tested and reused as a reference for the API.
 */
export function queryApplications(
  applications: readonly Application[],
  query: ListApplicationsQuery,
): Paginated<Application> {
  const needle = query.q ? normalizeText(query.q) : null;
  const from = query.appliedFrom ? new Date(`${query.appliedFrom}T00:00:00Z`).getTime() : null;
  const to = query.appliedTo ? new Date(`${query.appliedTo}T23:59:59.999Z`).getTime() : null;

  const filtered = applications.filter((app) => {
    if (needle) {
      const haystack = normalizeText(
        [app.company.name, app.roleTitle, app.location ?? ''].join(' '),
      );
      if (!haystack.includes(needle)) return false;
    }
    if (query.status?.length && !query.status.includes(app.status)) return false;
    if (query.source?.length && !query.source.includes(app.source)) return false;
    if (query.workMode?.length && !query.workMode.includes(app.workMode)) return false;
    if (query.activeOnly && !isActiveStatus(app.status)) return false;
    const applied = new Date(app.appliedAt).getTime();
    if (from !== null && applied < from) return false;
    if (to !== null && applied > to) return false;
    return true;
  });

  const direction = query.sortDir === 'asc' ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    switch (query.sortBy) {
      case 'company':
        return a.company.name.localeCompare(b.company.name, 'es') * direction;
      case 'status':
        return a.status.localeCompare(b.status) * direction;
      case 'lastActivityAt':
        return (Date.parse(a.lastActivityAt) - Date.parse(b.lastActivityAt)) * direction;
      case 'appliedAt':
        return (Date.parse(a.appliedAt) - Date.parse(b.appliedAt)) * direction;
    }
  });

  const start = (query.page - 1) * query.pageSize;
  return {
    items: sorted.slice(start, start + query.pageSize),
    total: sorted.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}
