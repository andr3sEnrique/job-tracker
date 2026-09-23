import { pkceChallenge } from '../src/auth/crypto.js';
import { IdentityProvider, type VerifiedIdentity } from '../src/auth/identity-provider.js';

export const FAKE_AUTH_URL = 'https://accounts.fake/authorize';

/**
 * Stands in for Google. The "code" is the email of a registered identity, and the
 * exchange fails unless the PKCE verifier matches a challenge it issued — so the
 * tests also prove the verifier really round-trips through the cookie.
 */
export class FakeIdentityProvider extends IdentityProvider {
  private readonly identities = new Map<string, VerifiedIdentity>();
  private readonly challenges = new Set<string>();

  register(identity: Partial<VerifiedIdentity> & { email: string }): VerifiedIdentity {
    const full = {
      sub: `sub-${identity.email}`,
      emailVerified: true,
      name: 'Test User',
      picture: null,
      ...identity,
    };
    this.identities.set(full.email, full);
    return full;
  }

  isConfigured() {
    return true;
  }

  buildAuthorizationUrl({ state, codeChallenge }: { state: string; codeChallenge: string }) {
    this.challenges.add(codeChallenge);
    return `${FAKE_AUTH_URL}?${new URLSearchParams({ state, code_challenge: codeChallenge })}`;
  }

  async exchangeCode({ code, codeVerifier }: { code: string; codeVerifier: string }) {
    if (!this.challenges.has(pkceChallenge(codeVerifier))) throw new Error('PKCE mismatch');
    const identity = this.identities.get(code);
    if (!identity) throw new Error('invalid_grant');
    return identity;
  }
}
