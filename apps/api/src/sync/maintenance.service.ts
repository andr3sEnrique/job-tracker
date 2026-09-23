import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MaintenanceResult {
  ghosted: number;
  sessionsDeleted: number;
}

/** Housekeeping that runs after every automatic sync. */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async run(now = new Date()): Promise<MaintenanceResult> {
    const ghosted = await this.markGhosted(now);
    const { count: sessionsDeleted } = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (ghosted || sessionsDeleted) {
      this.logger.log(`Maintenance: ${ghosted} ghosted, ${sessionsDeleted} expired sessions`);
    }
    return { ghosted, sessionsDeleted };
  }

  /**
   * Applications still waiting (APPLIED/SCREENING) with no activity for GHOSTED_AFTER_DAYS
   * become GHOSTED through a SYSTEM status change dated when the silence crossed the
   * threshold, so the timeline tells the truth and any later email reopens them
   * (see deriveStatus).
   */
  private async markGhosted(now: Date): Promise<number> {
    const threshold = this.config.get('GHOSTED_AFTER_DAYS') * DAY_MS;
    const stale = await this.prisma.application.findMany({
      where: {
        status: { in: ['APPLIED', 'SCREENING'] },
        lastActivityAt: { lt: new Date(now.getTime() - threshold) },
      },
      select: { id: true, status: true, lastActivityAt: true },
    });
    for (const app of stale) {
      const occurredAt = new Date(app.lastActivityAt.getTime() + threshold);
      await this.prisma.$transaction([
        this.prisma.applicationEvent.create({
          data: {
            applicationId: app.id,
            type: 'STATUS_CHANGED',
            fromStatus: app.status,
            toStatus: 'GHOSTED',
            occurredAt,
            source: 'SYSTEM',
            summary: `Sin respuesta en ${this.config.get('GHOSTED_AFTER_DAYS')} días`,
          },
        }),
        this.prisma.application.update({
          where: { id: app.id },
          data: { status: 'GHOSTED', lastActivityAt: occurredAt },
        }),
      ]);
    }
    return stale.length;
  }
}
