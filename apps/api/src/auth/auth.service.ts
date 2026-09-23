import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isEmailAllowed } from './allowlist.js';
import { pkceChallenge, randomToken, safeEqual } from './crypto.js';
import { IdentityProvider, type VerifiedIdentity } from './identity-provider.js';

export interface OAuthState {
  state: string;
  verifier: string;
}

export type LoginFailure = 'config' | 'state' | 'oauth' | 'unverified' | 'forbidden';

export type LoginResult = { ok: true; userId: string } | { ok: false; reason: LoginFailure };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly identity: IdentityProvider,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  isConfigured(): boolean {
    return this.identity.isConfigured();
  }

  /** Step 1: a fresh state (CSRF protection for the callback) and PKCE verifier. */
  startLogin(): { url: string; oauthState: OAuthState } {
    const oauthState = { state: randomToken(), verifier: randomToken(48) };
    const url = this.identity.buildAuthorizationUrl({
      state: oauthState.state,
      codeChallenge: pkceChallenge(oauthState.verifier),
    });
    return { url, oauthState };
  }

  /** Step 2: validate the callback, verify the identity and enforce the allowlist. */
  async completeLogin(params: {
    code?: string;
    state?: string;
    stored?: OAuthState | null;
  }): Promise<LoginResult> {
    if (!this.identity.isConfigured()) return { ok: false, reason: 'config' };
    const { code, state, stored } = params;
    if (!code || !state || !stored || !safeEqual(state, stored.state)) {
      return { ok: false, reason: 'state' };
    }

    let identity: VerifiedIdentity;
    try {
      identity = await this.identity.exchangeCode({ code, codeVerifier: stored.verifier });
    } catch (error) {
      this.logger.warn(`OAuth code exchange failed: ${(error as Error).name}`);
      return { ok: false, reason: 'oauth' };
    }

    if (!identity.emailVerified) return { ok: false, reason: 'unverified' };
    if (!isEmailAllowed(identity.email, this.config.get('ALLOWED_GOOGLE_EMAILS'))) {
      // Denied before touching the users table: unknown accounts leave no trace.
      this.logger.warn('Login denied for an account outside the allowlist');
      return { ok: false, reason: 'forbidden' };
    }

    const user = await this.upsertUser(identity);
    return { ok: true, userId: user.id };
  }

  /** Match by Google id first; fall back to email to adopt a pre-existing (seeded) user. */
  private async upsertUser(identity: VerifiedIdentity) {
    const profile = { name: identity.name, avatarUrl: identity.picture, lastLoginAt: new Date() };
    const bySub = await this.prisma.user.findUnique({ where: { googleSub: identity.sub } });
    if (bySub) {
      return this.prisma.user.update({
        where: { id: bySub.id },
        data: { ...profile, email: identity.email },
      });
    }
    return this.prisma.user.upsert({
      where: { email: identity.email },
      update: { ...profile, googleSub: identity.sub },
      create: { ...profile, email: identity.email, googleSub: identity.sub },
    });
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  }
}
