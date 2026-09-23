import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export const API_PREFIX = 'api/v1';

/** Shared by main.ts and the integration tests so both run the same HTTP pipeline. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  // No CORS: the browser reaches the API through the Next.js rewrite (same origin).
  app.enableShutdownHooks();
  return app;
}
