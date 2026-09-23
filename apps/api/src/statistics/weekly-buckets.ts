import type { TimelinePoint } from '@jat/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing `date` (same convention as Postgres date_trunc('week')). */
export function startOfUtcWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - daysSinceMonday * DAY_MS);
}

/** Turns sparse `{ week, count }` rows into a dense series of `weeks` buckets, oldest first. */
export function fillWeeklyBuckets(
  rows: readonly { week: Date; count: number }[],
  { weeks, now }: { weeks: number; now: Date },
): TimelinePoint[] {
  const counts = new Map(rows.map((r) => [startOfUtcWeek(r.week).getTime(), r.count]));
  const first = startOfUtcWeek(now).getTime() - (weeks - 1) * 7 * DAY_MS;
  return Array.from({ length: weeks }, (_, i) => {
    const week = first + i * 7 * DAY_MS;
    return {
      period: new Date(week).toISOString().slice(0, 10),
      applications: counts.get(week) ?? 0,
    };
  });
}
