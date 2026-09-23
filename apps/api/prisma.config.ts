import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// A single .env at the repo root serves every app.
config({ path: new URL('../../.env', import.meta.url), quiet: true });

const LOCAL_DATABASE_URL = 'postgresql://jat:jat@localhost:5432/job_tracker';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // The CLI (migrations) prefers a direct connection: Neon's pooled URL goes through
    // PgBouncer, which does not support the session features migrations use. The app itself
    // always uses DATABASE_URL. Falls back to docker-compose's database for local dev.
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      (process.env.NODE_ENV === 'production' ? undefined : LOCAL_DATABASE_URL),
  },
});
