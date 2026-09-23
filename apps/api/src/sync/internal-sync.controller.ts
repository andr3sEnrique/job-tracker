import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Public, SkipCsrf } from '../common/public.decorator.js';
import { CronSecretGuard } from './cron-secret.guard.js';
import { SyncService } from './sync.service.js';

/**
 * Entry point for an external scheduler (GitHub Actions, cron-job.org…). Free hosts sleep
 * when idle, so the request itself wakes the API up. No session or cookies: the shared
 * secret is the credential, which is also why CSRF does not apply.
 */
@Controller('internal')
@Public()
@SkipCsrf()
@UseGuards(CronSecretGuard)
export class InternalSyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  run() {
    return this.sync.runAll('CRON');
  }
}
