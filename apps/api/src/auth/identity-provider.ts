import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { AppConfig } from '../config/app-config.service.js';

export interface VerifiedIdentity {
  /** Stable Google account id (never reused, unlike emails). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/**
 * Port for the external identity provider. Production uses Google; tests swap in a fake,
 * so the whole login flow is exercised without network calls.
 */
export abstract class IdentityProvider {
  abstract isConfigured(): boolean;
  abstract buildAuthorizationUrl(params: { state: string; codeChallenge: string }): string;
  abstract exchangeCode(params: { code: string; codeVerifier: string }): Promise<VerifiedIdentity>;
}

@Injectable()
export class GoogleIdentityProvider extends IdentityProvider {
  private readonly client?: OAuth2Client;
  private readonly clientId?: string;

  constructor(config: AppConfig) {
    super();
    const clientId = config.get('GOOGLE_CLIENT_ID');
    const clientSecret = config.get('GOOGLE_CLIENT_SECRET');
    if (clientId && clientSecret) {
      this.clientId = clientId;
      this.client = new OAuth2Client({
        clientId,
        clientSecret,
        // Goes through the web app's /api proxy, so the session cookie is first-party.
        redirectUri: `${config.get('FRONTEND_URL')}/api/v1/auth/google/callback`,
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  buildAuthorizationUrl({
    state,
    codeChallenge,
  }: {
    state: string;
    codeChallenge: string;
  }): string {
    return this.requireClient().generateAuthUrl({
      // Identity only. Gmail access is a separate, later authorization (Phase 4).
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    });
  }

  async exchangeCode({ code, codeVerifier }: { code: string; codeVerifier: string }) {
    const client = this.requireClient();
    const { tokens } = await client.getToken({ code, codeVerifier });
    if (!tokens.id_token) throw new Error('Google did not return an ID token');

    // Verifies signature, issuer, audience and expiry.
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error('ID token without subject or email');

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }

  private requireClient(): OAuth2Client {
    if (!this.client) throw new ServiceUnavailableException('Google OAuth is not configured');
    return this.client;
  }
}
