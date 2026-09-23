import { describe, expect, it } from 'vitest';
import { generateSampleDataset } from './sample-data.js';

const now = new Date('2026-09-23T12:00:00.000Z');
const { applications, events } = generateSampleDataset({ now });

describe('generateSampleDataset', () => {
  it('is deterministic for a given seed and date', () => {
    expect(generateSampleDataset({ now })).toEqual({ applications, events });
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

  it('marks remote locations as remote work', () => {
    const remote = applications.filter((a) => a.location?.startsWith('Remoto'));
    expect(remote.every((a) => a.workMode === 'REMOTE')).toBe(true);
  });
});
