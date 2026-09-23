import { inject } from 'vitest';

// Must run before any app module is imported: ConfigModule.forRoot() reads the
// environment at import time. Setting these later would silently fall back to the
// local development database.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.OWNER_EMAIL = 'owner@test.local';
