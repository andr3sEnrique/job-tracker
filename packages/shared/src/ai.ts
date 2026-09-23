import { z } from 'zod';

/** AI classification settings and this month's usage, for the Settings page. */
export const aiStatusSchema = z.object({
  enabled: z.boolean(),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  monthlyBudgetUsd: z.number(),
  spentThisMonthUsd: z.number(),
  /** Calls actually made this month (skipped-by-budget ones excluded). */
  callsThisMonth: z.number().int(),
  budgetExceeded: z.boolean(),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;
