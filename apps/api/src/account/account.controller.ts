import { Controller, Delete, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { sessionCookieName } from '../auth/cookies.js';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { AppConfig } from '../config/app-config.service.js';
import { AccountService } from './account.service.js';

@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly config: AppConfig,
  ) {}

  /** Deletes the account and all its data. Signing in again starts from scratch. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.account.delete(user.id);
    res.clearCookie(sessionCookieName(this.config.get('SECURE_COOKIES')), { path: '/' });
  }
}
