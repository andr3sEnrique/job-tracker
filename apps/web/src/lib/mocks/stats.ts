import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  isActiveStatus,
  type Application,
  type ApplicationEvent,
  type Funnel,
  type SourceCount,
  type StatsSummary,
  type StatusCount,
  type TimelinePoint,
} from '@jat/shared';
import { addWeeks, format, startOfWeek } from 'date-fns';

const INTERVIEW_EVENTS = new Set(['INTERVIEW_SCHEDULED', 'TECHNICAL_INTERVIEW_SCHEDULED']);

function idsWithEvent(
  events: readonly ApplicationEvent[],
  predicate: (e: ApplicationEvent) => boolean,
) {
  return new Set(events.filter(predicate).map((e) => e.applicationId));
}

export function computeSummary(
  applications: readonly Application[],
  events: readonly ApplicationEvent[],
): StatsSummary {
  const interviewed = idsWithEvent(events, (e) => INTERVIEW_EVENTS.has(e.type));
  const offered = idsWithEvent(events, (e) => e.type === 'OFFER_RECEIVED');
  return {
    total: applications.length,
    active: applications.filter((a) => isActiveStatus(a.status)).length,
    interviews: applications.filter((a) => interviewed.has(a.id)).length,
    offers: applications.filter((a) => offered.has(a.id)).length,
    rejected: applications.filter((a) => a.status === 'REJECTED').length,
  };
}

export function computeFunnel(
  applications: readonly Application[],
  events: readonly ApplicationEvent[],
): Funnel {
  const summary = computeSummary(applications, events);
  return { applied: summary.total, interviewed: summary.interviews, offered: summary.offers };
}

/** Applications per week (Monday-based), including empty weeks, oldest first. */
export function computeWeeklyTimeline(
  applications: readonly Application[],
  { weeks = 12, now = new Date() }: { weeks?: number; now?: Date } = {},
): TimelinePoint[] {
  const firstWeek = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), -(weeks - 1));
  const buckets = new Map<string, number>();
  for (let i = 0; i < weeks; i++) buckets.set(format(addWeeks(firstWeek, i), 'yyyy-MM-dd'), 0);

  for (const app of applications) {
    const key = format(startOfWeek(new Date(app.appliedAt), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets].map(([period, count]) => ({ period, applications: count }));
}

export function computeStatusDistribution(applications: readonly Application[]): StatusCount[] {
  return APPLICATION_STATUSES.map((status) => ({
    status,
    count: applications.filter((a) => a.status === status).length,
  }));
}

export function computeSourceDistribution(applications: readonly Application[]): SourceCount[] {
  return APPLICATION_SOURCES.map((source) => ({
    source,
    count: applications.filter((a) => a.source === source).length,
  }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}
