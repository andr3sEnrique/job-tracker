import { Module } from '@nestjs/common';
import { GmailModule } from '../gmail/gmail.module.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';

@Module({
  imports: [GmailModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
