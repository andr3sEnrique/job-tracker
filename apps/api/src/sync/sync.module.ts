import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailsModule } from '../emails/emails.module.js';
import { GmailModule } from '../gmail/gmail.module.js';
import { InternalSyncController } from './internal-sync.controller.js';
import { MaintenanceService } from './maintenance.service.js';
import { SyncController } from './sync.controller.js';
import { SyncScheduler } from './sync.scheduler.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [ScheduleModule.forRoot(), GmailModule, EmailsModule],
  controllers: [SyncController, InternalSyncController],
  providers: [SyncService, MaintenanceService, SyncScheduler],
})
export class SyncModule {}
