import { z } from 'zod';
import { emailCategorySchema } from './enums.js';

export const GMAIL_CONNECTION_STATUSES = ['ACTIVE', 'NEEDS_REAUTH', 'REVOKED', 'ERROR'] as const;
export const gmailConnectionStatusSchema = z.enum(GMAIL_CONNECTION_STATUSES);
export type GmailConnectionStatus = z.infer<typeof gmailConnectionStatusSchema>;

export const SYNC_RUN_STATUSES = ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'] as const;
export const syncRunStatusSchema = z.enum(SYNC_RUN_STATUSES);

export const SYNC_RUN_TYPES = ['INITIAL', 'INCREMENTAL', 'MANUAL', 'FALLBACK'] as const;
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
      skipped: z.number().int(),
    }),
    lastRun: syncRunSchema.nullable(),
  }),
]);
export type GmailStatus = z.infer<typeof gmailStatusSchema>;

export const syncResultSchema = z.object({
  run: syncRunSchema,
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
