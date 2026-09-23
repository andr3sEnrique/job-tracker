import { describe, expect, it } from 'vitest';
import { generateMockDataset } from './generate';
import {
  computeFunnel,
  computeStatusDistribution,
  computeSummary,
  computeWeeklyTimeline,
} from './stats';

const now = new Date('2026-09-23T12:00:00.000Z');
const { applications, events } = generateMockDataset({ now });

describe('generateMockDataset', () => {
  it('is deterministic for a given seed and date', () => {
    expect(generateMockDataset({ now })).toEqual({ applications, events });
  });

  it('keeps every event attached to an existing application', () => {
    const ids = new Set(applications.map((a) => a.id));
    expect(events.every((e) => ids.has(e.applicationId))).toBe(true);
  });

  it('derives each application status from its last status-changing event', () => {
    for (const app of applications) {
      const last = events
        .filter((e) => e.applicationId === app.id && e.toStatus)
        .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
        .at(-1);
      expect(last?.toStatus).toBe(app.status);
    }
  });

  it('never produces events in the future', () => {
    expect(events.every((e) => Date.parse(e.occurredAt) <= now.getTime())).toBe(true);
  });
});

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
