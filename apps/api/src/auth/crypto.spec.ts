import { describe, expect, it } from 'vitest';
import { pkceChallenge, randomToken, safeEqual, sha256 } from './crypto.js';

describe('auth crypto helpers', () => {
  it('generates unique, URL-safe tokens with 256 bits of entropy', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it('hashes deterministically without exposing the input', () => {
    expect(sha256('token')).toBe(sha256('token'));
    expect(sha256('token')).not.toContain('token');
  });

  it('computes the RFC 7636 S256 challenge', () => {
    // Test vector from RFC 7636, appendix B.
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('compares in constant time and handles different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
