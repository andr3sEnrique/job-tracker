import { inject } from 'vitest';

// Must run before any app module is imported: ConfigModule.forRoot() reads the
// environment at import time. Setting these later would silently fall back to the
// local development database.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.ALLOWED_GOOGLE_EMAILS = 'owner@test.local';
// Every test logs in through the rate-limited auth endpoints (10/min in real use).
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';
