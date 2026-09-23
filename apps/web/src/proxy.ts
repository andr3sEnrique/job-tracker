import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIES = ['__Host-jat_session', 'jat_session'];
const PUBLIC_PATHS = ['/login'];

/**
 * Optimistic UX check only: sends visitors without a session cookie to /login instead of
 * rendering an empty dashboard. It never authorizes anything — the API validates the
 * session on every request, and a forged cookie gets a 401 there.
 */
export function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_API_MODE === 'mock') return NextResponse.next();

  const { pathname } = request.nextUrl;
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the API proxy, Next internals and static files.
  matcher: ['/((?!api/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)'],
};
