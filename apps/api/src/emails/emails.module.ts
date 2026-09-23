import { Module } from '@nestjs/common';
import { EmailsController } from './emails.controller.js';
import { EmailsService } from './emails.service.js';

@Module({
  controllers: [EmailsController],
  providers: [EmailsService],
  exports: [EmailsService],
})
export class EmailsModule {}
