import { z } from 'zod';

const LOCAL_DATABASE_URL = 'postgresql://jat:jat@localhost:5432/job_tracker';
// Only ever used outside production (enforced below).
const DEV_COOKIE_SECRET = 'dev-only-cookie-secret-change-me-0123456789';
// 32 zero-ish bytes, base64. Dev/test only: never protects real tokens (enforced below).
const DEV_TOKEN_ENCRYPTION_KEY = Buffer.from('dev-only-token-key-do-not-use!!!').toString('base64');

const base64Key = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, 'Must be 32 bytes, base64-encoded');

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.url().optional(),

    /** Public origin of the web app; the API is reached through its /api proxy. */
    FRONTEND_URL: z.url().default('http://localhost:3000'),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    /**
     * Who may sign in. Checked on login AND on every request, so removing an email
     * revokes access immediately. Empty means nobody can log in.
     */
    ALLOWED_GOOGLE_EMAILS: csv,

    /** Signs the short-lived OAuth state cookie. */
    COOKIE_SECRET: z.string().min(32).optional(),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** Per-IP limit for the login endpoints (brute-force and abuse protection). */
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),

    /** AES-256-GCM key for Gmail refresh tokens. Generate with `openssl rand -base64 32`. */
    TOKEN_ENCRYPTION_KEY: base64Key.optional(),
    /** `fake` serves synthetic emails: develop and demo without touching a real mailbox. */
    MAIL_PROVIDER: z.enum(['gmail', 'fake']).default('gmail'),
    GMAIL_INITIAL_SYNC_DAYS: z.coerce.number().int().min(1).max(730).default(180),
    SYNC_PAGE_SIZE: z.coerce.number().int().min(1).max(500).default(100),
    /** A sync request stops after this long and reports `hasMore` (free hosts time out). */
    SYNC_TIME_BUDGET_MS: z.coerce.number().int().min(0).default(20_000),
  })
  .transform((env, ctx) => {
    const isProd = env.NODE_ENV === 'production';
    const databaseUrl = env.DATABASE_URL ?? (isProd ? undefined : LOCAL_DATABASE_URL);
    const cookieSecret = env.COOKIE_SECRET ?? (isProd ? undefined : DEV_COOKIE_SECRET);
    const tokenKey = env.TOKEN_ENCRYPTION_KEY ?? (isProd ? undefined : DEV_TOKEN_ENCRYPTION_KEY);

    const required: [string, unknown][] = [
      ['DATABASE_URL', databaseUrl],
      ['COOKIE_SECRET', cookieSecret],
      ['TOKEN_ENCRYPTION_KEY', tokenKey],
    ];
    if (isProd) {
      required.push(
        ['GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID],
        ['GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET],
        ['ALLOWED_GOOGLE_EMAILS', env.ALLOWED_GOOGLE_EMAILS.length ? 'ok' : undefined],
      );
    }
    for (const [key, value] of required) {
      if (!value) ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
    }
    if (isProd && env.MAIL_PROVIDER === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_PROVIDER'],
        message: 'fake is not allowed in production',
      });
    }
    if (isProd && !env.FRONTEND_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['FRONTEND_URL'],
        message: 'Must be https in production',
      });
    }
    if (ctx.issues.length) return z.NEVER;

    return {
      ...env,
      DATABASE_URL: databaseUrl as string,
      COOKIE_SECRET: cookieSecret as string,
      TOKEN_ENCRYPTION_KEY: tokenKey as string,
      /** Cookies need the Secure flag whenever the site is served over HTTPS. */
      SECURE_COOKIES: env.FRONTEND_URL.startsWith('https://'),
    };
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
