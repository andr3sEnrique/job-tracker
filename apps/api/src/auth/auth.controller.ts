import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { Public } from '../common/public.decorator.js';
import { AppConfig } from '../config/app-config.service.js';
import { AuthService, type OAuthState } from './auth.service.js';
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  oauthCookieOptions,
  sessionCookieName,
  sessionCookieOptions,
} from './cookies.js';
import { SessionsService } from './sessions.service.js';

export function parseOAuthState(raw: unknown): OAuthState | null {
  if (typeof raw !== 'string') return null; // unsigned or tampered cookies come back as false
  try {
    const value = JSON.parse(raw) as Partial<OAuthState>;
    return typeof value.state === 'string' && typeof value.verifier === 'string'
      ? { state: value.state, verifier: value.verifier }
      : null;
  } catch {
    return null;
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly config: AppConfig,
  ) {}

  private get secure() {
    return this.config.get('SECURE_COOKIES');
  }

  private redirectToLogin(res: Response, error: string) {
    res.redirect(`${this.config.get('FRONTEND_URL')}/login?error=${error}`);
  }

  /** Starts the Google login: stores state + PKCE verifier in a signed, short-lived cookie. */
  @Public()
  @Get('google')
  start(@Res() res: Response) {
    if (!this.auth.isConfigured()) return this.redirectToLogin(res, 'config');
    const { url, oauthState } = this.auth.startLogin();
    res.cookie(OAUTH_COOKIE, JSON.stringify(oauthState), oauthCookieOptions(this.secure));
    res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const signedCookies = req.signedCookies as Record<string, unknown>;
    const stored = parseOAuthState(signedCookies[OAUTH_COOKIE]);
    // One-shot: the state cookie is consumed whatever the outcome.
    res.clearCookie(OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH });

    if (providerError) return this.redirectToLogin(res, 'cancelled');

    const result = await this.auth.completeLogin({ code, state, stored });
    if (!result.ok) return this.redirectToLogin(res, result.reason);

    const token = await this.sessions.create(result.userId, req.headers['user-agent']);
    res.cookie(
      sessionCookieName(this.secure),
      token,
      sessionCookieOptions(this.secure, this.sessions.ttlMs),
    );
    res.redirect(`${this.config.get('FRONTEND_URL')}/`);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  /** Public so it can always clear the cookie, even when the session is already gone. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const name = sessionCookieName(this.secure);
    const token = (req.cookies as Record<string, string | undefined>)[name];
    if (token) await this.sessions.revoke(token);
    res.clearCookie(name, { path: '/' });
  }
}
