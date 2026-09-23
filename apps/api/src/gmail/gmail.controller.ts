import { Controller, Delete, Get, HttpCode, HttpStatus, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { parseOAuthState } from '../auth/auth.controller.js';
import {
  GMAIL_OAUTH_COOKIE,
  GMAIL_OAUTH_COOKIE_PATH,
  oauthCookieOptions,
} from '../auth/cookies.js';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { AppConfig } from '../config/app-config.service.js';
import { GmailConnectionsService } from './gmail-connections.service.js';

/**
 * "Connect Gmail" is a second, separate OAuth authorization (read-only mailbox access),
 * independent from login: least privilege, and login keeps working if Gmail is revoked.
 * Both routes require an authenticated session.
 */
@Controller('gmail')
export class GmailController {
  constructor(
    private readonly connections: GmailConnectionsService,
    private readonly config: AppConfig,
  ) {}

  private settingsRedirect(res: Response, params: Record<string, string>) {
    res.redirect(`${this.config.get('FRONTEND_URL')}/settings?${new URLSearchParams(params)}`);
  }

  @Get('connect')
  connect(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { url, oauthState } = this.connections.startConnect(user.email);
    res.cookie(
      GMAIL_OAUTH_COOKIE,
      JSON.stringify(oauthState),
      oauthCookieOptions(this.config.get('SECURE_COOKIES'), GMAIL_OAUTH_COOKIE_PATH),
    );
    res.redirect(url);
  }

  @Get('callback')
  async callback(
    @CurrentUser() user: AuthenticatedUser,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const stored = parseOAuthState(
      (req.signedCookies as Record<string, unknown>)[GMAIL_OAUTH_COOKIE],
    );
    res.clearCookie(GMAIL_OAUTH_COOKIE, { path: GMAIL_OAUTH_COOKIE_PATH });
    if (providerError) return this.settingsRedirect(res, { gmail: 'error', reason: 'cancelled' });

    const result = await this.connections.completeConnect(user.id, { code, state, stored });
    if (!result.ok) return this.settingsRedirect(res, { gmail: 'error', reason: result.reason });
    this.settingsRedirect(res, { gmail: 'connected' });
  }

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.connections.status(user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@CurrentUser() user: AuthenticatedUser) {
    return this.connections.disconnect(user.id);
  }
}
