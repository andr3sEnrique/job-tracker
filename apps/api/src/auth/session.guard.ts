import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithUser } from '../common/current-user.js';
import { IS_PUBLIC_KEY } from '../common/public.decorator.js';
import { AppConfig } from '../config/app-config.service.js';
import { isEmailAllowed } from './allowlist.js';
import { sessionCookieName } from './cookies.js';
import { SessionsService } from './sessions.service.js';

/**
 * Global, deny-by-default authorization. Every route needs a valid session unless it is
 * explicitly @Public(). Hiding routes in the frontend is UX, not security: this is the check.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[sessionCookieName(this.config.get('SECURE_COOKIES'))];
    if (!token) throw new UnauthorizedException();

    const session = await this.sessions.resolve(token);
    // Re-check the allowlist on every request: removing an email revokes access at once.
    if (!session || !isEmailAllowed(session.user.email, this.config.get('ALLOWED_GOOGLE_EMAILS'))) {
      throw new UnauthorizedException();
    }

    request.user = { id: session.user.id, email: session.user.email };
    return true;
  }
}
