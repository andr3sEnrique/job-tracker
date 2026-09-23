import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES, CLOSED_STATUSES, isActiveStatus } from './enums';

describe('isActiveStatus', () => {
  it.each(['APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER'] as const)('%s is active', (s) => {
    expect(isActiveStatus(s)).toBe(true);
  });

  it.each(CLOSED_STATUSES)('%s is closed', (s) => {
    expect(isActiveStatus(s)).toBe(false);
  });

  it('classifies every status', () => {
    const active = APPLICATION_STATUSES.filter(isActiveStatus);
    expect(active.length + CLOSED_STATUSES.length).toBe(APPLICATION_STATUSES.length);
  });
});
