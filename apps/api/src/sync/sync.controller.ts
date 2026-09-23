import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { SyncService } from './sync.service.js';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** Manual sync: processes one chunk; the client calls again while `hasMore` is true. */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  run(@CurrentUser() user: AuthenticatedUser) {
    return this.sync.run(user.id);
  }
}
