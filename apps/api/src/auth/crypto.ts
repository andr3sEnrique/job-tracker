import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits of randomness, URL-safe. Used for session tokens, OAuth state and PKCE verifiers. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Sessions are stored by hash: a leaked database cannot be replayed as cookies. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** PKCE S256 code challenge (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
