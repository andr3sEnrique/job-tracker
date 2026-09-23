import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { AppConfig } from '../config/app-config.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { GoogleIdentityProvider, IdentityProvider } from './identity-provider.js';
import { SessionGuard } from './session.guard.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [
    // In-memory store: fine for a single instance.
    ThrottlerModule.forRootAsync({
      // Explicit on purpose: in the pruned Docker install TypeScript cannot resolve the
      // `@nestjs/common/interfaces` import in throttler's typings, which makes `imports`
      // look mandatory and breaks the image build.
      imports: [],
      inject: [AppConfig],
      useFactory: (config: AppConfig) => [
        { name: 'default', ttl: 60_000, limit: config.get('RATE_LIMIT_PER_MINUTE') },
        {
          // Much stricter, and only for the login/logout endpoints.
          name: 'auth',
          ttl: 60_000,
          limit: config.get('AUTH_RATE_LIMIT_PER_MINUTE'),
          skipIf: (context) =>
            !context.switchToHttp().getRequest<Request>().path.startsWith('/api/v1/auth/'),
        },
        {
          // Expensive endpoints (Gmail quota, AI tokens): a runaway client or a leaked cron
          // secret cannot hammer them.
          name: 'sync',
          ttl: 60_000,
          limit: config.get('SYNC_RATE_LIMIT_PER_MINUTE'),
          skipIf: (context) => {
            const path = context.switchToHttp().getRequest<Request>().path;
            return !(
              path.startsWith('/api/v1/sync/') ||
              path.startsWith('/api/v1/internal/') ||
              path === '/api/v1/emails/reprocess'
            );
          },
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    { provide: IdentityProvider, useClass: GoogleIdentityProvider },
    // Global guards run in registration order: rate limit → CSRF → session.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
