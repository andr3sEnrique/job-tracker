/**
 * Content Security Policy with a fresh nonce per request (see proxy.ts): only scripts
 * rendered by Next.js with that nonce run, so injected markup cannot execute code.
 * Styles allow 'unsafe-inline' because components use `style=` attributes (colours of
 * badges, charts), which nonces do not cover; CSS cannot run scripts.
 */
export function buildCsp(nonce: string, isDev = process.env.NODE_ENV === 'development'): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by trusted (nonced) scripts are trusted too.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // Google profile pictures in the user menu.
    "img-src 'self' blob: data: https://lh3.googleusercontent.com",
    "font-src 'self'",
    // Only our own origin: the API is reached through the /api rewrite.
    `connect-src 'self'${isDev ? ' ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    // The OAuth redirects are navigations, not form posts.
    "form-action 'self'",
    "frame-ancestors 'none'",
    // No upgrade-insecure-requests: HSTS (next.config.ts) already forces HTTPS in production,
    // and it would break production builds served over http://localhost (E2E tests).
  ].join('; ');
}

export const NONCE_HEADER = 'x-nonce';
