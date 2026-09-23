import { describe, expect, it } from 'vitest';
import { deriveStatus, type TimelineEvent } from './timeline.js';

const at = (day: number) => new Date(Date.UTC(2026, 8, day));
const e = (
  type: TimelineEvent['type'],
  day: number,
  toStatus: TimelineEvent['toStatus'] = null,
): TimelineEvent => ({
  type,
  toStatus,
  occurredAt: at(day),
});

describe('deriveStatus', () => {
  it('starts as APPLIED', () => {
    expect(deriveStatus([])).toBe('APPLIED');
  });

  it('follows the funnel', () => {
    expect(
      deriveStatus([e('APPLIED', 1), e('RECRUITER_CONTACT', 3), e('INTERVIEW_SCHEDULED', 5)]),
    ).toBe('INTERVIEWING');
  });

  it('is independent of arrival order', () => {
    const events = [e('REJECTED', 9), e('APPLIED', 1), e('INTERVIEW_SCHEDULED', 5)];
    expect(deriveStatus(events)).toBe('REJECTED');
    expect(deriveStatus([...events].reverse())).toBe('REJECTED');
  });

  it('a late confirmation never drags the status back', () => {
    expect(deriveStatus([e('INTERVIEW_SCHEDULED', 5), e('CONFIRMATION_RECEIVED', 6)])).toBe(
      'INTERVIEWING',
    );
  });

  it('applies explicit status changes, and later events continue from them', () => {
    expect(deriveStatus([e('APPLIED', 1), e('STATUS_CHANGED', 2, 'WITHDRAWN')])).toBe('WITHDRAWN');
    expect(deriveStatus([e('STATUS_CHANGED', 2, 'GHOSTED'), e('RECRUITER_CONTACT', 8)])).toBe(
      'SCREENING',
    );
  });

  it('removing an event recomputes the status (undo)', () => {
    const history = [e('APPLIED', 1), e('OFFER_RECEIVED', 4)];
    expect(deriveStatus(history)).toBe('OFFER');
    expect(deriveStatus(history.slice(0, 1))).toBe('APPLIED');
  });
});
