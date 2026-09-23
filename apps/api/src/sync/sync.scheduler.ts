import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppConfig } from '../config/app-config.service.js';
import { SyncService } from './sync.service.js';

const INTERVAL_NAME = 'automatic-sync';

/**
 * Optional in-process timer (SCHEDULER_ENABLED), for an always-on host or local development.
 * On a host that sleeps, use the cron endpoint instead: a sleeping process runs no timers.
 */
@Injectable()
export class SyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncScheduler.name);
  private running = false;

  constructor(
    private readonly sync: SyncService,
    private readonly config: AppConfig,
    private readonly registry: SchedulerRegistry,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.get('SCHEDULER_ENABLED')) return;
    const minutes = this.config.get('SYNC_INTERVAL_MINUTES');
    this.registry.addInterval(
      INTERVAL_NAME,
      setInterval(() => void this.tick(), minutes * 60_000),
    );
    this.logger.log(`Automatic sync every ${minutes} min`);
  }

  async tick() {
    // A slow tick (big backlog) must not overlap the next one.
    if (this.running) return;
    this.running = true;
    try {
      // Keep going while there is work left, within one interval's worth of chunks.
      for (let i = 0; i < 10; i++) {
        const result = await this.sync.runAll('SCHEDULER');
        if (!result.hasMore) break;
      }
    } catch (error) {
      this.logger.error(`Scheduled sync failed: ${(error as Error).name}`);
    } finally {
      this.running = false;
    }
  }
}
