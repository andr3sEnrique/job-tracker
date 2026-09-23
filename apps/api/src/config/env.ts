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
    /** Per-IP limit for everything else. */
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),

    /** AES-256-GCM key for Gmail refresh tokens. Generate with `openssl rand -base64 32`. */
    TOKEN_ENCRYPTION_KEY: base64Key.optional(),
    /** `fake` serves synthetic emails: develop and demo without touching a real mailbox. */
    MAIL_PROVIDER: z.enum(['gmail', 'fake']).default('gmail'),
    GMAIL_INITIAL_SYNC_DAYS: z.coerce.number().int().min(1).max(730).default(180),
    SYNC_PAGE_SIZE: z.coerce.number().int().min(1).max(500).default(100),
    /** A sync request stops after this long and reports `hasMore` (free hosts time out). */
    SYNC_TIME_BUDGET_MS: z.coerce.number().int().min(0).default(20_000),

    /**
     * Shared secret for `POST /internal/sync`, called by an external cron (free hosts sleep,
     * so an in-process timer alone is not enough). Unset disables the endpoint.
     */
    CRON_SECRET: z.string().min(32).optional(),
    /** In-process timer: for an always-on host or local development. */
    SCHEDULER_ENABLED: z.stringbool().default(false),
    SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1440).default(15),
    /** APPLIED/SCREENING applications without activity for this long become GHOSTED. */
    GHOSTED_AFTER_DAYS: z.coerce.number().int().min(7).max(365).default(30),

    /**
     * AI second opinion for the emails the rules are unsure about. `none` (default) keeps
     * everything local; `anthropic` sends a redacted, truncated body to the API; `ollama`
     * runs a local model; `fake` is for tests.
     */
    AI_PROVIDER: z.enum(['none', 'anthropic', 'ollama', 'fake']).default('none'),
    /** Defaults per provider: claude-haiku-4-5 / llama3.1:8b. */
    AI_MODEL: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    OLLAMA_URL: z.url().default('http://localhost:11434'),
    /** Rules below this confidence (or missing the company) ask the AI. */
    AI_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
    /** Circuit breaker: once this month's spend reaches it, only rules are used. */
    AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(1),
    /** Price per million tokens, for the budget (defaults: Claude Haiku 4.5). */
    AI_INPUT_USD_PER_MTOK: z.coerce.number().min(0).default(1),
    AI_OUTPUT_USD_PER_MTOK: z.coerce.number().min(0).default(5),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),
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
    if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message: 'Required when AI_PROVIDER=anthropic',
      });
    }
    if (isProd && env.AI_PROVIDER === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_PROVIDER'],
        message: 'fake is not allowed in production',
      });
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
      AI_MODEL:
        env.AI_MODEL ??
        { none: 'none', anthropic: 'claude-haiku-4-5', ollama: 'llama3.1:8b', fake: 'fake' }[
          env.AI_PROVIDER
        ],
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
