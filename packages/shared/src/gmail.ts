import { z } from 'zod';
import { emailCategorySchema } from './enums.js';

export const GMAIL_CONNECTION_STATUSES = ['ACTIVE', 'NEEDS_REAUTH', 'REVOKED', 'ERROR'] as const;
export const gmailConnectionStatusSchema = z.enum(GMAIL_CONNECTION_STATUSES);
export type GmailConnectionStatus = z.infer<typeof gmailConnectionStatusSchema>;

export const SYNC_RUN_STATUSES = ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'] as const;
export const syncRunStatusSchema = z.enum(SYNC_RUN_STATUSES);

export const SYNC_TRIGGERS = ['USER', 'SCHEDULER', 'CRON'] as const;
export const syncTriggerSchema = z.enum(SYNC_TRIGGERS);
export type SyncTrigger = z.infer<typeof syncTriggerSchema>;
export const SYNC_RUN_TYPES = ['INITIAL', 'INCREMENTAL', 'MANUAL', 'FALLBACK', 'RESCAN'] as const;
export const syncRunTypeSchema = z.enum(SYNC_RUN_TYPES);

export const EMAIL_PROCESSING_STATUSES = [
  'PENDING',
  'PROCESSED',
  'SKIPPED',
  'NEEDS_REVIEW',
  'FAILED',
] as const;
export const emailProcessingStatusSchema = z.enum(EMAIL_PROCESSING_STATUSES);
export type EmailProcessingStatus = z.infer<typeof emailProcessingStatusSchema>;

export const syncRunSchema = z.object({
  id: z.string(),
  type: syncRunTypeSchema,
  trigger: syncTriggerSchema,
  status: syncRunStatusSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  messagesListed: z.number().int(),
  candidates: z.number().int(),
  skipped: z.number().int(),
  failed: z.number().int(),
  errorCode: z.string().nullable(),
});
export type SyncRun = z.infer<typeof syncRunSchema>;

export const gmailStatusSchema = z.discriminatedUnion('connected', [
  z.object({ connected: z.literal(false) }),
  z.object({
    connected: z.literal(true),
    googleEmail: z.string(),
    status: gmailConnectionStatusSchema,
    connectedAt: z.iso.datetime(),
    lastSyncedAt: z.iso.datetime().nullable(),
    initialSyncCompleted: z.boolean(),
    syncWindowDays: z.number().int(),
    counts: z.object({
      candidates: z.number().int(),
      pending: z.number().int(),
      needsReview: z.number().int(),
      skipped: z.number().int(),
    }),
    lastRun: syncRunSchema.nullable(),
    /** Last sync started by the scheduler or the external cron (not the button). */
    lastAutomaticSyncAt: z.iso.datetime().nullable(),
  }),
]);
export type GmailStatus = z.infer<typeof gmailStatusSchema>;

export const processingResultSchema = z.object({
  processed: z.number().int(),
  needsReview: z.number().int(),
  failed: z.number().int(),
  /** Candidates still waiting to be classified. */
  remaining: z.number().int(),
});

export const syncResultSchema = z.object({
  run: syncRunSchema,
  /** Classification progress; null while the mailbox is still being listed. */
  processing: processingResultSchema.nullable(),
  /** The chunk ended before the mailbox was fully walked; call again to continue. */
  hasMore: z.boolean(),
});
export type SyncResult = z.infer<typeof syncResultSchema>;

/** Stored metadata only: the body of an email is never persisted. */
export const emailSummarySchema = z.object({
  id: z.string(),
  fromName: z.string().nullable(),
  fromEmail: z.string().nullable(),
  subject: z.string().nullable(),
  receivedAt: z.iso.datetime(),
  processingStatus: emailProcessingStatusSchema,
  category: emailCategorySchema.nullable(),
  /** Why the prefilter kept it, e.g. "ats-sender:greenhouse.io" or "subject:entrevista". */
  prefilterReason: z.string().nullable(),
  applicationId: z.string().nullable(),
  /** "Company · Role" of the linked application, for display. */
  applicationLabel: z.string().nullable(),
  confidence: z.number().nullable(),
  /** Opens the original message in Gmail; the app itself never shows its content. */
  gmailUrl: z.string().nullable(),
});
export type EmailSummary = z.infer<typeof emailSummarySchema>;

export const listEmailsQuerySchema = z.object({
  status: z.array(emailProcessingStatusSchema).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export type ListEmailsQuery = z.infer<typeof listEmailsQuerySchema>;

export const listEmailsParamsSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'string' && v !== '' ? Number(v) : undefined);
  return {
    status:
      typeof r.status === 'string' && r.status ? r.status.split(',').filter(Boolean) : undefined,
    page: num(r.page),
    pageSize: num(r.pageSize),
  };
}, listEmailsQuerySchema);

/**
 * Human decisions from the review inbox. "assign" and "create" also let the user fix the
 * category the classifier chose.
 */
export const resolveEmailSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('ignore') }),
  z.object({
    action: z.literal('assign'),
    applicationId: z.string(),
    category: emailCategorySchema,
  }),
  z.object({
    action: z.literal('create'),
    companyName: z.string().trim().min(1).max(200),
    roleTitle: z.string().trim().min(1).max(200),
    category: emailCategorySchema,
  }),
]);
export type ResolveEmailInput = z.infer<typeof resolveEmailSchema>;

export const reprocessResultSchema = z.object({
  emailsReset: z.number().int(),
  applicationsRemoved: z.number().int(),
});
export type ReprocessResult = z.infer<typeof reprocessResultSchema>;
