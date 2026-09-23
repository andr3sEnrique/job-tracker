import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppConfig } from './config/app-config.service.js';

export const API_PREFIX = 'api/v1';

/** Shared by main.ts and the integration tests so both run the same HTTP pipeline. */
export function configureApp<T extends INestApplication>(app: T): T {
  const config = app.get(AppConfig);
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser(config.get('COOKIE_SECRET')));
  // Behind the platform's load balancer (and the Next.js proxy): trust X-Forwarded-For
  // so rate limiting sees the client IP rather than the proxy's.
  if (config.get('NODE_ENV') === 'production') {
    (app as unknown as NestExpressApplication).set('trust proxy', true);
  }
  // No CORS: the browser reaches the API through the Next.js rewrite (same origin).
  app.enableShutdownHooks();
  return app;
}
