import type { CookieOptions } from 'express';

export const OAUTH_COOKIE = 'jat_oauth';
export const OAUTH_COOKIE_PATH = '/api/v1/auth';
/** Same mechanism for the separate "connect Gmail" authorization. */
export const GMAIL_OAUTH_COOKIE = 'jat_gmail_oauth';
export const GMAIL_OAUTH_COOKIE_PATH = '/api/v1/gmail';
export const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Over HTTPS the session cookie uses the `__Host-` prefix: the browser then enforces
 * Secure, Path=/ and no Domain, so no subdomain can set or read it.
 */
export function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-jat_session' : 'jat_session';
}

export function sessionCookieOptions(secure: boolean, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true, // not readable from JavaScript → XSS cannot steal it
    secure,
    sameSite: 'lax', // not sent on cross-site POSTs → baseline CSRF protection
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function oauthCookieOptions(secure: boolean, path = OAUTH_COOKIE_PATH): CookieOptions {
  return {
    httpOnly: true,
    secure,
    // Lax (not Strict): it must travel on the top-level redirect back from Google.
    sameSite: 'lax',
    path,
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    signed: true,
  };
}
