import { z } from 'zod';
import {
  applicationSourceSchema,
  applicationStatusSchema,
  eventSourceSchema,
  eventTypeSchema,
  workModeSchema,
} from './enums';

export const companySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  domain: z.string().nullable(),
});
export type Company = z.infer<typeof companySchema>;

export const salarySchema = z
  .object({
    min: z.number().int().nonnegative().nullable(),
    max: z.number().int().nonnegative().nullable(),
    currency: z.string().length(3),
    period: z.enum(['YEAR', 'MONTH', 'HOUR']),
  })
  .refine((s) => s.min === null || s.max === null || s.min <= s.max, {
    message: 'salary.min must be <= salary.max',
    path: ['min'],
  });
export type Salary = z.infer<typeof salarySchema>;

export const applicationSchema = z.object({
  id: z.string(),
  company: companySchema,
  roleTitle: z.string().min(1),
  location: z.string().nullable(),
  workMode: workModeSchema,
  salary: salarySchema.nullable(),
  source: applicationSourceSchema,
  jobUrl: z.url().nullable(),
  status: applicationStatusSchema,
  appliedAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
  needsReview: z.boolean(),
  notes: z.string().nullable(),
});
export type Application = z.infer<typeof applicationSchema>;

export const applicationEventSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  type: eventTypeSchema,
  fromStatus: applicationStatusSchema.nullable(),
  toStatus: applicationStatusSchema.nullable(),
  occurredAt: z.iso.datetime(),
  source: eventSourceSchema,
  summary: z.string().nullable(),
});
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;

export const applicationDetailSchema = applicationSchema.extend({
  events: z.array(applicationEventSchema),
});
export type ApplicationDetail = z.infer<typeof applicationDetailSchema>;

/** Input for creating an application manually. */
export const createApplicationSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  roleTitle: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable().default(null),
  workMode: workModeSchema.default('UNKNOWN'),
  source: applicationSourceSchema.default('OTHER'),
  jobUrl: z.url().nullable().default(null),
  status: applicationStatusSchema.default('APPLIED'),
  appliedAt: z.iso.datetime(),
  notes: z.string().max(5000).nullable().default(null),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const SORTABLE_FIELDS = ['appliedAt', 'lastActivityAt', 'company', 'status'] as const;

/** Query parameters for listing applications (shared by UI filters and API validation). */
export const listApplicationsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.array(applicationStatusSchema).optional(),
  source: z.array(applicationSourceSchema).optional(),
  workMode: z.array(workModeSchema).optional(),
  activeOnly: z.boolean().optional(),
  appliedFrom: z.iso.date().optional(),
  appliedTo: z.iso.date().optional(),
  sortBy: z.enum(SORTABLE_FIELDS).default('appliedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };
