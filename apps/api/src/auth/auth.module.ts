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
      inject: [AppConfig],
      useFactory: (config: AppConfig) => [
        { name: 'default', ttl: 60_000, limit: 300 },
        {
          // Much stricter, and only for the login/logout endpoints.
          name: 'auth',
          ttl: 60_000,
          limit: config.get('AUTH_RATE_LIMIT_PER_MINUTE'),
          skipIf: (context) =>
            !context.switchToHttp().getRequest<Request>().path.startsWith('/api/v1/auth/'),
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
