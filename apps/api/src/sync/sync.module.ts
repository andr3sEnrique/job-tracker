import { Module } from '@nestjs/common';
import { EmailsModule } from '../emails/emails.module.js';
import { GmailModule } from '../gmail/gmail.module.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [GmailModule, EmailsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
