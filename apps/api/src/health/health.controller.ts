import { Controller, Get, Logger } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { Public } from '../common/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** A hung connection must fail the check, not leave the platform waiting forever. */
const DB_CHECK_TIMEOUT_MS = 5_000;

@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

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
        let timer: NodeJS.Timeout | undefined;
        try {
          await Promise.race([
            this.prisma.$queryRaw`SELECT 1`,
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })),
                DB_CHECK_TIMEOUT_MS,
              );
            }),
          ]);
          return indicator.up();
        } catch (error) {
          // Health requests are not access-logged, so say why here. Only the error class and
          // code: driver messages can contain the host or user name.
          const { name, code } = error as { name?: string; code?: string };
          this.logger.warn(
            `Readiness: database check failed (${name ?? 'Error'}${code ? `/${code}` : ''})`,
          );
          return indicator.down({ message: 'Database unreachable' });
        } finally {
          clearTimeout(timer);
        }
      },
    ]);
  }
}
