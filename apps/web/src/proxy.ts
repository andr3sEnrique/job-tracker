import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, NONCE_HEADER } from './lib/csp';

const SESSION_COOKIES = ['__Host-jat_session', 'jat_session'];
/** Reachable without a session: sign-in, and the pages Google requires to be public. */
const PUBLIC_PATHS = ['/login', '/welcome', '/privacy'];

/**
 * 1. Sets a per-request CSP nonce (Next.js applies it to its own scripts).
 * 2. Optimistic UX check only: sends visitors without a session cookie to /login instead of
 *    rendering an empty dashboard. It never authorizes anything — the API validates the
 *    session on every request, and a forged cookie gets a 401 there.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (process.env.NEXT_PUBLIC_API_MODE !== 'mock' && !hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set(NONCE_HEADER, nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Everything except the API proxy, Next internals and static files.
  matcher: ['/((?!api/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)'],
};
