import { inject } from 'vitest';

// Must run before any app module is imported: ConfigModule.forRoot() reads the
// environment at import time. Setting these later would silently fall back to the
// local development database.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.ALLOWED_GOOGLE_EMAILS = 'owner@test.local,other@test.local';
// Every test logs in through the rate-limited auth endpoints (10/min in real use).
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';
process.env.RATE_LIMIT_PER_MINUTE = '100000';
process.env.MAIL_PROVIDER = 'fake';
// One page per sync call, so the tests exercise chunking and resuming.
process.env.SYNC_PAGE_SIZE = '100';
process.env.SYNC_TIME_BUDGET_MS = '0';
