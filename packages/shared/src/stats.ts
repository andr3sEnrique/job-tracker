import { z } from 'zod';
import { applicationEventSchema, companySchema } from './applications.js';
import { applicationSourceSchema, applicationStatusSchema } from './enums.js';

export const statsSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  interviews: z.number().int().nonnegative(),
  offers: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
});
export type StatsSummary = z.infer<typeof statsSummarySchema>;

export const timelinePointSchema = z.object({
  /** ISO date of the first day of the bucket (week). */
  period: z.iso.date(),
  applications: z.number().int().nonnegative(),
});
export type TimelinePoint = z.infer<typeof timelinePointSchema>;

export const statusCountSchema = z.object({
  status: applicationStatusSchema,
  count: z.number().int().nonnegative(),
});
export type StatusCount = z.infer<typeof statusCountSchema>;

export const sourceCountSchema = z.object({
  source: applicationSourceSchema,
  count: z.number().int().nonnegative(),
});
export type SourceCount = z.infer<typeof sourceCountSchema>;

export const funnelSchema = z.object({
  applied: z.number().int().nonnegative(),
  interviewed: z.number().int().nonnegative(),
  offered: z.number().int().nonnegative(),
});
export type Funnel = z.infer<typeof funnelSchema>;

export const recentActivityItemSchema = z.object({
  event: applicationEventSchema,
  application: z.object({
    id: z.string(),
    roleTitle: z.string(),
    company: companySchema,
  }),
});
export type RecentActivityItem = z.infer<typeof recentActivityItemSchema>;

export const dashboardStatsSchema = z.object({
  summary: statsSummarySchema,
  timeline: z.array(timelinePointSchema),
  statusDistribution: z.array(statusCountSchema),
  sourceDistribution: z.array(sourceCountSchema),
  funnel: funnelSchema,
  recentActivity: z.array(recentActivityItemSchema),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
