import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { Public } from '../common/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  /** Process is up. Cheap: used by uptime monitors and the platform. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Ready to serve traffic: the database answers. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      async () => {
        const indicator = this.indicators.check('database');
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return indicator.up();
        } catch {
          return indicator.down({ message: 'Database unreachable' });
        }
      },
    ]);
  }
}
