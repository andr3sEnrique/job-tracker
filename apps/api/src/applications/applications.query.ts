import { CLOSED_STATUSES, type ListApplicationsQuery } from '@jat/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** Filters → Prisma `where`. Always scoped to the owner, whatever the query says. */
export function buildApplicationsWhere(
  userId: string,
  query: ListApplicationsQuery,
): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = { userId, archived: false };
  const and: Prisma.ApplicationWhereInput[] = [];

  if (query.q) {
    const contains = { contains: query.q, mode: 'insensitive' as const };
    and.push({
      OR: [{ company: { name: contains } }, { roleTitle: contains }, { location: contains }],
    });
  }
  if (query.status?.length) and.push({ status: { in: query.status } });
  if (query.activeOnly) and.push({ status: { notIn: [...CLOSED_STATUSES] } });
  if (query.source?.length) where.source = { in: query.source };
  if (query.workMode?.length) where.workMode = { in: query.workMode };
  if (query.appliedFrom || query.appliedTo) {
    where.appliedAt = {
      ...(query.appliedFrom && { gte: new Date(`${query.appliedFrom}T00:00:00.000Z`) }),
      ...(query.appliedTo && { lte: new Date(`${query.appliedTo}T23:59:59.999Z`) }),
    };
  }
  if (and.length) where.AND = and;
  return where;
}

export function buildApplicationsOrderBy(
  query: ListApplicationsQuery,
): Prisma.ApplicationOrderByWithRelationInput[] {
  const dir = query.sortDir;
  const primary: Prisma.ApplicationOrderByWithRelationInput =
    query.sortBy === 'company' ? { company: { name: dir } } : { [query.sortBy]: dir };
  // Stable tie-breaker so pagination never repeats or skips rows.
  return [primary, { id: 'asc' }];
}
