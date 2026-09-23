import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OwnerGuard } from './owner.guard.js';
import { UsersService } from './users.service.js';

@Module({
  providers: [UsersService, { provide: APP_GUARD, useClass: OwnerGuard }],
  exports: [UsersService],
})
export class UsersModule {}
