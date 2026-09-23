import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfig } from '../config/app-config.service.js';
import type { AuthenticatedUser, RequestWithUser } from '../common/current-user.js';
import { IS_PUBLIC_KEY } from '../common/public.decorator.js';
import { UsersService } from './users.service.js';

/**
 * TEMPORARY (Phase 2): attaches the single owner (OWNER_EMAIL) to every request so the
 * rest of the code is already written against `request.user`.
 *
 * Phase 3 replaces this with a SessionGuard (Google OAuth + allowlist). Until then the API
 * must not be exposed with real data.
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  private owner?: Promise<AuthenticatedUser>;

  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    this.owner ??= this.users.ensureUser(this.config.get('OWNER_EMAIL')).catch((error: unknown) => {
      this.owner = undefined; // retry on the next request instead of caching the failure
      throw error;
    });
    context.switchToHttp().getRequest<RequestWithUser>().user = await this.owner;
    return true;
  }
}
