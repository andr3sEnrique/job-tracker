import type { ApplicationStatus, EventType } from '@jat/shared';

/**
 * How far along the funnel a status is. Automatic updates (from emails) may only move an
 * application forward, so a late "we received your application" email never drags an
 * application in INTERVIEWING back to APPLIED. Terminal statuses can be reached from anywhere.
 */
const STATUS_RANK: Record<ApplicationStatus, number> = {
  APPLIED: 0,
  SCREENING: 1,
  INTERVIEWING: 2,
  OFFER: 3,
  ACCEPTED: 4,
  REJECTED: 4,
  WITHDRAWN: 4,
  GHOSTED: 4,
};

const TERMINAL: ReadonlySet<ApplicationStatus> = new Set(['ACCEPTED', 'REJECTED', 'WITHDRAWN']);

/**
 * Status an automatic event implies, if any. GHOSTED is not here: it is computed
 * by a scheduled job, never inferred from an email.
 */
const EVENT_STATUS: Partial<Record<EventType, ApplicationStatus>> = {
  APPLIED: 'APPLIED',
  RECRUITER_CONTACT: 'SCREENING',
  INTERVIEW_SCHEDULED: 'INTERVIEWING',
  TECHNICAL_INTERVIEW_SCHEDULED: 'INTERVIEWING',
  OFFER_RECEIVED: 'OFFER',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
};

export function statusForEvent(type: EventType): ApplicationStatus | null {
  return EVENT_STATUS[type] ?? null;
}

/**
 * Next status after an automatic event, or null when the status must not change.
 * - Terminal statuses are sticky: a new automatic event never reopens them.
 * - GHOSTED reopens on any sign of life.
 * - Otherwise the status only moves forward.
 */
export function resolveAutomaticTransition(
  current: ApplicationStatus,
  event: EventType,
): ApplicationStatus | null {
  const target = statusForEvent(event);
  if (!target || target === current) return null;
  if (TERMINAL.has(current)) return null;
  if (current === 'GHOSTED') return target;
  if (TERMINAL.has(target)) return target;
  return STATUS_RANK[target] > STATUS_RANK[current] ? target : null;
}
