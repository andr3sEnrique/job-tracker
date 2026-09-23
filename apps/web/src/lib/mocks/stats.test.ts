import { generateSampleDataset } from '@jat/shared';
import { describe, expect, it } from 'vitest';
import {
  computeFunnel,
  computeStatusDistribution,
  computeSummary,
  computeWeeklyTimeline,
} from './stats';

const now = new Date('2026-09-23T12:00:00.000Z');
const { applications, events } = generateSampleDataset({ now });

describe('computeSummary', () => {
  it('produces consistent counts', () => {
    const s = computeSummary(applications, events);
    expect(s.total).toBe(applications.length);
    expect(s.active).toBeLessThanOrEqual(s.total);
    expect(s.offers).toBeLessThanOrEqual(s.interviews);
    expect(s.rejected).toBe(applications.filter((a) => a.status === 'REJECTED').length);
  });
});

describe('computeFunnel', () => {
  it('narrows at each stage', () => {
    const f = computeFunnel(applications, events);
    expect(f.applied).toBeGreaterThanOrEqual(f.interviewed);
    expect(f.interviewed).toBeGreaterThanOrEqual(f.offered);
  });
});

describe('computeWeeklyTimeline', () => {
  it('returns one bucket per week, oldest first, starting on Monday', () => {
    const timeline = computeWeeklyTimeline(applications, { weeks: 12, now });
    expect(timeline).toHaveLength(12);
    expect(timeline.at(-1)?.period).toBe('2026-09-21');
    expect(new Date(`${timeline[0]?.period}T00:00:00`).getDay()).toBe(1);
  });

  it('counts only applications inside the window', () => {
    const timeline = computeWeeklyTimeline(
      [{ ...applications[0]!, appliedAt: '2020-01-01T00:00:00.000Z' }],
      { weeks: 4, now },
    );
    expect(timeline.every((p) => p.applications === 0)).toBe(true);
  });
});

describe('computeStatusDistribution', () => {
  it('covers every application exactly once', () => {
    const total = computeStatusDistribution(applications).reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(applications.length);
  });
});
