import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module.js';
import { ClassificationModule } from '../classification/classification.module.js';
import { GmailModule } from '../gmail/gmail.module.js';
import { EmailProcessorService } from './email-processor.service.js';
import { EmailsController } from './emails.controller.js';
import { EmailsService } from './emails.service.js';

@Module({
  imports: [ApplicationsModule, ClassificationModule, GmailModule],
  controllers: [EmailsController],
  providers: [EmailsService, EmailProcessorService],
  exports: [EmailsService, EmailProcessorService],
})
export class EmailsModule {}
