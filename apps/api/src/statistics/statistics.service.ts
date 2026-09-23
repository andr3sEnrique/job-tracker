import { Injectable } from '@nestjs/common';
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  CLOSED_STATUSES,
  type DashboardStats,
} from '@jat/shared';
import { toApplicationEvent } from '../applications/applications.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fillWeeklyBuckets, startOfUtcWeek } from './weekly-buckets.js';

const TIMELINE_WEEKS = 12;
const RECENT_ACTIVITY = 8;
const INTERVIEW_EVENTS = ['INTERVIEW_SCHEDULED', 'TECHNICAL_INTERVIEW_SCHEDULED'] as const;

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(userId: string, now = new Date()): Promise<DashboardStats> {
    const scope = { userId, archived: false };
    const since = new Date(startOfUtcWeek(now).getTime() - (TIMELINE_WEEKS - 1) * 7 * 86_400_000);

    const [byStatus, bySource, interviews, offers, weekly, recent] = await Promise.all([
      this.prisma.application.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
      this.prisma.application.groupBy({ by: ['source'], where: scope, _count: { _all: true } }),
      this.prisma.application.count({
        where: { ...scope, events: { some: { type: { in: [...INTERVIEW_EVENTS] } } } },
      }),
      this.prisma.application.count({
        where: { ...scope, events: { some: { type: 'OFFER_RECEIVED' } } },
      }),
      // Parameterised tagged template: values are bound, never interpolated into SQL.
      this.prisma.$queryRaw<{ week: Date; count: bigint }[]>`
        SELECT date_trunc('week', applied_at AT TIME ZONE 'UTC') AS week, count(*) AS count
        FROM applications
        WHERE user_id = ${userId}::uuid AND archived = false AND applied_at >= ${since}
        GROUP BY week
      `,
      this.prisma.applicationEvent.findMany({
        where: { application: scope },
        orderBy: { occurredAt: 'desc' },
        take: RECENT_ACTIVITY,
        include: { application: { include: { company: true } } },
      }),
    ]);

    const statusCount = new Map(byStatus.map((r) => [r.status, r._count._all]));
    const total = byStatus.reduce((sum, r) => sum + r._count._all, 0);
    const summary = {
      total,
      active: byStatus
        .filter((r) => !CLOSED_STATUSES.includes(r.status))
        .reduce((sum, r) => sum + r._count._all, 0),
      interviews,
      offers,
      rejected: statusCount.get('REJECTED') ?? 0,
    };
    const sourceCount = new Map(bySource.map((r) => [r.source, r._count._all]));

    return {
      summary,
      timeline: fillWeeklyBuckets(
        weekly.map((r) => ({ week: r.week, count: Number(r.count) })),
        { weeks: TIMELINE_WEEKS, now },
      ),
      statusDistribution: APPLICATION_STATUSES.map((status) => ({
        status,
        count: statusCount.get(status) ?? 0,
      })),
      sourceDistribution: APPLICATION_SOURCES.map((source) => ({
        source,
        count: sourceCount.get(source) ?? 0,
      }))
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count),
      funnel: { applied: total, interviewed: interviews, offered: offers },
      recentActivity: recent.map((event) => ({
        event: toApplicationEvent(event),
        application: {
          id: event.application.id,
          roleTitle: event.application.roleTitle,
          company: {
            id: event.application.company.id,
            name: event.application.company.name,
            domain: event.application.company.domain,
          },
        },
      })),
    };
  }
}
