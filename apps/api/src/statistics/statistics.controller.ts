import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { StatisticsService } from './statistics.service.js';

@Controller('stats')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.statistics.dashboard(user.id);
  }
}
