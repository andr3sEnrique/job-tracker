import { describe, expect, it } from 'vitest';
import { fillWeeklyBuckets, startOfUtcWeek } from './weekly-buckets.js';

describe('startOfUtcWeek', () => {
  it('returns the Monday of the week', () => {
    expect(startOfUtcWeek(new Date('2026-09-23T15:00:00Z')).toISOString()).toBe(
      '2026-09-21T00:00:00.000Z',
    );
  });

  it('treats Sunday as the end of the week', () => {
    expect(startOfUtcWeek(new Date('2026-09-27T23:00:00Z')).toISOString()).toBe(
      '2026-09-21T00:00:00.000Z',
    );
  });
});

describe('fillWeeklyBuckets', () => {
  const now = new Date('2026-09-23T12:00:00Z');

  it('produces a dense, ordered series ending in the current week', () => {
    const series = fillWeeklyBuckets([], { weeks: 4, now });
    expect(series.map((p) => p.period)).toEqual([
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ]);
    expect(series.every((p) => p.applications === 0)).toBe(true);
  });

  it('places counts in their week and ignores weeks outside the window', () => {
    const series = fillWeeklyBuckets(
      [
        { week: new Date('2026-09-14T00:00:00Z'), count: 3 },
        { week: new Date('2025-01-06T00:00:00Z'), count: 9 },
      ],
      { weeks: 2, now },
    );
    expect(series).toEqual([
      { period: '2026-09-14', applications: 3 },
      { period: '2026-09-21', applications: 0 },
    ]);
  });
});
