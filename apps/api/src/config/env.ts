import { z } from 'zod';

const LOCAL_DATABASE_URL = 'postgresql://jat:jat@localhost:5432/job_tracker';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().url().optional(),
    /**
     * Temporary (Phase 2): every request acts as this user.
     * Phase 3 replaces it with Google OAuth + a server-side allowlist.
     */
    OWNER_EMAIL: z.string().email().default('owner@example.com'),
  })
  .transform((env, ctx) => {
    const databaseUrl =
      env.DATABASE_URL ?? (env.NODE_ENV === 'production' ? undefined : LOCAL_DATABASE_URL);
    if (!databaseUrl) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required in production' });
      return z.NEVER;
    }
    return { ...env, DATABASE_URL: databaseUrl };
  });

export type Env = z.infer<typeof envSchema>;

/** Fail fast at boot with a readable list of problems (values are never printed). */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return result.data;
}
