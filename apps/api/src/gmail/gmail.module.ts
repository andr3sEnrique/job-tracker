import { Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { FakeMailProvider } from './fake-mail.provider.js';
import { GmailApiProvider } from './gmail-api.provider.js';
import { GmailConnectionsService } from './gmail-connections.service.js';
import { GmailController } from './gmail.controller.js';
import { MailProvider } from './mail-provider.js';

@Module({
  controllers: [GmailController],
  providers: [
    GmailConnectionsService,
    {
      provide: MailProvider,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        config.get('MAIL_PROVIDER') === 'fake'
          ? new FakeMailProvider()
          : new GmailApiProvider(config),
    },
  ],
  exports: [GmailConnectionsService, MailProvider],
})
export class GmailModule {}
