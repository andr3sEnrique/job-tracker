import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
import { EmailEventsService } from './email-events.service.js';

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService, EmailEventsService],
  exports: [ApplicationsService, EmailEventsService],
})
export class ApplicationsModule {}
