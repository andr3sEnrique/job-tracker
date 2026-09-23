import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AccountModule } from './account/account.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { AppConfig } from './config/app-config.service.js';
import { ConfigModule } from './config/config.module.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { EmailsModule } from './emails/emails.module.js';
import { GmailModule } from './gmail/gmail.module.js';
import { SyncModule } from './sync/sync.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StatisticsModule } from './statistics/statistics.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          transport:
            config.get('NODE_ENV') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          // Log the minimum: no headers, no query strings (they can carry search terms).
          serializers: {
            req: (req: { id: unknown; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              path: req.url.split('?')[0],
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          // Defence in depth: never log credentials or cookies (docs/PLAN_TECNICO.md §10).
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            censor: '[redacted]',
          },
          autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
          quietReqLogger: true,
        },
      }),
    }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    AccountModule,
    ApplicationsModule,
    StatisticsModule,
    GmailModule,
    EmailsModule,
    SyncModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
})
export class AppModule {}
