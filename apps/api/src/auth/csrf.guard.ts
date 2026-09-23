import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig } from '../config/app-config.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-requested-with';

/**
 * CSRF defence in depth on top of SameSite=Lax cookies, for every state-changing request:
 * 1. A custom header is required. Cross-site HTML forms cannot send custom headers, and
 *    cross-origin fetches with one need a CORS preflight, which this API never grants.
 * 2. When the browser sends an Origin, it must be the web app's origin.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(config: AppConfig) {
    this.allowedOrigin = new URL(config.get('FRONTEND_URL')).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    if (!request.headers[CSRF_HEADER]) throw new ForbiddenException('Missing CSRF header');
    const origin = request.headers.origin;
    if (origin && origin !== this.allowedOrigin)
      throw new ForbiddenException('Cross-origin request');
    return true;
  }
}
