import { describe, expect, it } from 'vitest';
import { resolveAutomaticTransition, statusForEvent } from './status-machine.js';

describe('statusForEvent', () => {
  it('maps funnel events to statuses', () => {
    expect(statusForEvent('INTERVIEW_SCHEDULED')).toBe('INTERVIEWING');
    expect(statusForEvent('OFFER_RECEIVED')).toBe('OFFER');
  });

  it('ignores events that do not imply a status', () => {
    expect(statusForEvent('CONFIRMATION_RECEIVED')).toBeNull();
    expect(statusForEvent('NOTE')).toBeNull();
  });
});

describe('resolveAutomaticTransition', () => {
  it('moves forward through the funnel', () => {
    expect(resolveAutomaticTransition('APPLIED', 'RECRUITER_CONTACT')).toBe('SCREENING');
    expect(resolveAutomaticTransition('SCREENING', 'TECHNICAL_INTERVIEW_SCHEDULED')).toBe(
      'INTERVIEWING',
    );
  });

  it('never moves backwards', () => {
    expect(resolveAutomaticTransition('INTERVIEWING', 'APPLIED')).toBeNull();
    expect(resolveAutomaticTransition('OFFER', 'RECRUITER_CONTACT')).toBeNull();
  });

  it('allows a rejection from any open status', () => {
    for (const status of ['APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER'] as const) {
      expect(resolveAutomaticTransition(status, 'REJECTED')).toBe('REJECTED');
    }
  });

  it('keeps closed applications closed', () => {
    expect(resolveAutomaticTransition('REJECTED', 'INTERVIEW_SCHEDULED')).toBeNull();
    expect(resolveAutomaticTransition('ACCEPTED', 'REJECTED')).toBeNull();
  });

  it('reopens a ghosted application on any sign of life', () => {
    expect(resolveAutomaticTransition('GHOSTED', 'RECRUITER_CONTACT')).toBe('SCREENING');
  });

  it('returns null when nothing changes', () => {
    expect(resolveAutomaticTransition('INTERVIEWING', 'INTERVIEW_SCHEDULED')).toBeNull();
    expect(resolveAutomaticTransition('APPLIED', 'CONFIRMATION_RECEIVED')).toBeNull();
  });
});
