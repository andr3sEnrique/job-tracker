import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export type RequestWithUser = Request & { user?: AuthenticatedUser };

/** The user resolved for this request by the global guard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  if (!request.user) throw new Error('CurrentUser used on a route without an authenticated user');
  return request.user;
});
