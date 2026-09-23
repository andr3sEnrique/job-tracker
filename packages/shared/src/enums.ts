import { z } from 'zod';

export const APPLICATION_STATUSES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEWING',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'GHOSTED',
] as const;
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

/** Statuses that close an application. Everything else counts as "active". */
export const CLOSED_STATUSES: readonly ApplicationStatus[] = [
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'GHOSTED',
];

export function isActiveStatus(status: ApplicationStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

export const APPLICATION_SOURCES = [
  'LINKEDIN',
  'INDEED',
  'INFOJOBS',
  'COMPANY_SITE',
  'REFERRAL',
  'RECRUITER',
  'OTHER',
] as const;
export const applicationSourceSchema = z.enum(APPLICATION_SOURCES);
export type ApplicationSource = z.infer<typeof applicationSourceSchema>;

export const WORK_MODES = ['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN'] as const;
export const workModeSchema = z.enum(WORK_MODES);
export type WorkMode = z.infer<typeof workModeSchema>;

export const EVENT_TYPES = [
  'APPLIED',
  'CONFIRMATION_RECEIVED',
  'RECRUITER_CONTACT',
  'INTERVIEW_SCHEDULED',
  'TECHNICAL_INTERVIEW_SCHEDULED',
  'OFFER_RECEIVED',
  'REJECTED',
  'WITHDRAWN',
  'STATUS_CHANGED',
  'NOTE',
] as const;
export const eventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof eventTypeSchema>;

export const EVENT_SOURCES = ['EMAIL', 'MANUAL', 'SYSTEM'] as const;
export const eventSourceSchema = z.enum(EVENT_SOURCES);
export type EventSource = z.infer<typeof eventSourceSchema>;

export const EMAIL_CATEGORIES = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_CONFIRMATION',
  'RECRUITER_REPLY',
  'INTERVIEW',
  'TECHNICAL_INTERVIEW',
  'REJECTION',
  'OFFER',
  'JOB_ALERT',
  'IRRELEVANT',
  'UNKNOWN',
] as const;
export const emailCategorySchema = z.enum(EMAIL_CATEGORIES);
export type EmailCategory = z.infer<typeof emailCategorySchema>;
