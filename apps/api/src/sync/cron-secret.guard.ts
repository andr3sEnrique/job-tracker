import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { safeEqual } from '../auth/crypto.js';
import { AppConfig } from '../config/app-config.service.js';

export const CRON_SECRET_HEADER = 'x-cron-secret';

/**
 * Machine-to-machine auth for the cron endpoint: a shared secret in a header, compared in
 * constant time. Without CRON_SECRET the endpoint does not exist.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get('CRON_SECRET');
    if (!secret) throw new NotFoundException();
    const provided = context.switchToHttp().getRequest<Request>().headers[CRON_SECRET_HEADER];
    if (typeof provided !== 'string' || !safeEqual(provided, secret)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
