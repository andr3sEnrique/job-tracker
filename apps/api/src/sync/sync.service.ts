import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { SyncResult } from '@jat/shared';
import { AppConfig } from '../config/app-config.service.js';
import { EmailsService } from '../emails/emails.service.js';
import { EmailProcessorService } from '../emails/email-processor.service.js';
import { buildGmailSearchQuery, PREFILTER_VERSION } from '../emails/prefilter.js';
import type {
  GmailConnection,
  SyncRun as SyncRunRow,
  SyncRunType,
  SyncTrigger,
} from '../generated/prisma/client.js';
import { GmailConnectionsService, toSyncRun } from '../gmail/gmail-connections.service.js';
import {
  MailAuthError,
  MailHistoryExpiredError,
  MailProvider,
  MailTransientError,
  type MessageRef,
} from '../gmail/mail-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MaintenanceService, type MaintenanceResult } from './maintenance.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Extra lease time beyond the budget, in case a page takes long. */
const LOCK_MARGIN_MS = 60_000;
/** A sync that finished this recently is continued (classification) rather than repeated. */
const CONTINUE_WINDOW_MS = 10 * 60_000;
/** Labels whose new messages are never candidates: not worth a metadata request. */
const IGNORED_HISTORY_LABELS = new Set(['SENT', 'DRAFT', 'SPAM', 'TRASH', 'CHAT']);

export interface AutomaticSyncResult extends MaintenanceResult {
  connections: number;
  succeeded: number;
  failed: number;
  /** Skipped because a sync was already running. */
  busy: number;
  /** Some mailbox still has work left; the next tick continues it. */
  hasMore: boolean;
}

interface ListedPage {
  messages: MessageRef[];
  nextPageToken?: string;
}

/**
 * Walks the mailbox in bounded chunks. Each call processes pages until the time budget runs
 * out and reports `hasMore`; the checkpoint (page token) lives in `sync_runs`, so a chunk
 * interrupted by a restart or a sleeping free-tier instance simply resumes.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: GmailConnectionsService,
    private readonly emails: EmailsService,
    private readonly mail: MailProvider,
    private readonly config: AppConfig,
    private readonly processor: EmailProcessorService,
    private readonly maintenance: MaintenanceService,
  ) {}

  /**
   * Automatic sync (scheduler or cron): one chunk per active connection, then maintenance.
   * A connection whose sync is already running (the user clicked) is skipped this time.
   */
  async runAll(trigger: Exclude<SyncTrigger, 'USER'>): Promise<AutomaticSyncResult> {
    const connections = await this.prisma.gmailConnection.findMany({
      where: { status: 'ACTIVE' },
      select: { userId: true },
    });
    const result: AutomaticSyncResult = {
      connections: connections.length,
      succeeded: 0,
      failed: 0,
      busy: 0,
      hasMore: false,
      ghosted: 0,
      sessionsDeleted: 0,
    };
    for (const { userId } of connections) {
      try {
        const chunk = await this.run(userId, trigger);
        if (chunk.run.status === 'FAILED') result.failed++;
        else result.succeeded++;
        result.hasMore ||= chunk.hasMore;
      } catch (error) {
        if (error instanceof ConflictException) result.busy++;
        else {
          result.failed++;
          this.logger.error(`Automatic sync failed: ${(error as Error).name}`);
        }
      }
    }
    return { ...result, ...(await this.maintenance.run()) };
  }

  /** One chunk of sync for a user; `trigger` records who asked for it. */
  async run(userId: string, trigger: SyncTrigger = 'USER'): Promise<SyncResult> {
    const { connection, refreshToken } = await this.connections.getActive(userId);
    const budget = this.config.get('SYNC_TIME_BUDGET_MS');
    const started = Date.now();

    // Lease-based lock: a concurrent sync (manual click + cron) backs off instead of
    // double-processing. An expired lease (crashed process) is simply taken over.
    const now = new Date();
    const { count } = await this.prisma.gmailConnection.updateMany({
      where: {
        id: connection.id,
        OR: [{ syncLockedUntil: null }, { syncLockedUntil: { lt: now } }],
      },
      data: { syncLockedUntil: new Date(started + budget + LOCK_MARGIN_MS) },
    });
    if (count === 0) throw new ConflictException('A sync is already running');

    // First sync → INITIAL; rules changed since the mail was evaluated → RESCAN the whole
    // window; otherwise INCREMENTAL through the History API (MANUAL, a date-based catch-up,
    // only for connections that predate history tracking).
    const type: SyncRunType = !connection.initialSyncCompletedAt
      ? 'INITIAL'
      : connection.prefilterVersion < PREFILTER_VERSION
        ? 'RESCAN'
        : connection.lastHistoryId
          ? 'INCREMENTAL'
          : 'MANUAL';

    // Still classifying the result of a sync that just finished? Continue with that instead
    // of listing the mailbox again on every call.
    if (type === 'INCREMENTAL' || type === 'MANUAL') {
      const continued = await this.continueProcessing(connection, refreshToken, started + budget);
      if (continued) return continued;
    }

    let run = await this.startOrResumeRun(connection.id, type, trigger);
    try {
      let done: boolean;
      if (run.type === 'INCREMENTAL') {
        try {
          done = await this.walkHistory(connection, refreshToken, run, started + budget);
        } catch (error) {
          if (!(error instanceof MailHistoryExpiredError)) throw error;
          // Gmail forgot where we were (history is kept about a week): search by date instead.
          this.logger.warn('Gmail history expired, falling back to a date-based sync');
          run = await this.prisma.syncRun.update({
            where: { id: run.id },
            data: { type: 'FALLBACK', pageToken: null },
          });
          done = await this.walkSearch(connection, refreshToken, run, started + budget);
        }
      } else {
        done = await this.walkSearch(connection, refreshToken, run, started + budget);
      }
      run = await this.prisma.syncRun.findUniqueOrThrow({ where: { id: run.id } });

      if (done) {
        run = await this.prisma.syncRun.update({
          where: { id: run.id },
          data: { status: 'SUCCESS', finishedAt: new Date() },
        });
        await this.prisma.gmailConnection.update({
          where: { id: connection.id },
          data: {
            lastSyncedAt: run.startedAt,
            prefilterVersion: PREFILTER_VERSION,
            ...(run.type === 'INITIAL' && { initialSyncCompletedAt: new Date() }),
          },
        });
        // Listing finished: spend the rest of the budget classifying stored candidates.
        const processing = await this.processor.processPending(
          connection,
          refreshToken,
          started + budget,
        );
        return { run: toSyncRun(run), processing, hasMore: processing.remaining > 0 };
      }
      return { run: toSyncRun(run), processing: null, hasMore: true };
    } catch (error) {
      return {
        run: toSyncRun(await this.fail(run, connection.id, error)),
        processing: null,
        hasMore: false,
      };
    } finally {
      await this.prisma.gmailConnection.update({
        where: { id: connection.id },
        data: { syncLockedUntil: null },
      });
    }
  }

  /**
   * Lists what was added since the last history id, page by page. The start id only moves
   * once every page is done, so an interrupted walk resumes from its page token.
   */
  private async walkHistory(
    connection: GmailConnection,
    refreshToken: string,
    run: SyncRunRow,
    deadline: number,
  ): Promise<boolean> {
    let pageToken = run.pageToken ?? undefined;
    for (;;) {
      const page = await this.mail.listHistory(refreshToken, {
        startHistoryId: connection.lastHistoryId as string,
        pageToken,
        pageSize: this.config.get('SYNC_PAGE_SIZE'),
      });
      // Several history records can mention the same message.
      const seen = new Set<string>();
      const messages = page.messages.filter(
        (m) =>
          !m.labels.some((l) => IGNORED_HISTORY_LABELS.has(l)) && !seen.has(m.id) && seen.add(m.id),
      );
      await this.ingestPage(connection, refreshToken, run.id, { ...page, messages });
      if (!page.nextPageToken) {
        await this.prisma.gmailConnection.update({
          where: { id: connection.id },
          data: { lastHistoryId: page.historyId },
        });
        return true;
      }
      pageToken = page.nextPageToken;
      if (Date.now() > deadline) return false;
    }
  }

  /** Walks a Gmail search (the whole window, or everything since the last sync). */
  private async walkSearch(
    connection: GmailConnection,
    refreshToken: string,
    run: SyncRunRow,
    deadline: number,
  ): Promise<boolean> {
    if (!run.pageToken) {
      // Captured BEFORE listing, so nothing that arrives while the search is walked is missed
      // by the next incremental sync (the overlap is harmless: ingest is idempotent).
      const historyId = await this.mail.getHistoryId(refreshToken);
      await this.prisma.gmailConnection.update({
        where: { id: connection.id },
        data: { lastHistoryId: historyId },
      });
    }
    const query =
      run.type === 'INITIAL' || run.type === 'RESCAN'
        ? buildGmailSearchQuery({ days: this.config.get('GMAIL_INITIAL_SYNC_DAYS') })
        : buildGmailSearchQuery({
            // One day of overlap: duplicates are harmless (idempotent ingest), gaps are not.
            after: new Date((connection.lastSyncedAt?.getTime() ?? Date.now()) - DAY_MS),
          });
    let pageToken = run.pageToken ?? undefined;
    for (;;) {
      const page = await this.mail.listMessages(refreshToken, {
        query,
        pageToken,
        pageSize: this.config.get('SYNC_PAGE_SIZE'),
      });
      // A re-scan also re-evaluates mail the old rules discarded.
      await this.ingestPage(connection, refreshToken, run.id, page, run.type === 'RESCAN');
      if (!page.nextPageToken) return true;
      pageToken = page.nextPageToken;
      if (Date.now() > deadline) return false;
    }
  }

  /** Stores one listed page (metadata only) and checkpoints the run. */
  private async ingestPage(
    connection: GmailConnection,
    refreshToken: string,
    runId: string,
    page: ListedPage,
    reevaluate = false,
  ) {
    const newIds = await this.emails.filterNew(
      connection.id,
      page.messages.map((m) => m.id),
      { includeSkipped: reevaluate },
    );
    const metadata = await this.mail.getMetadata(refreshToken, newIds);
    const ingested = await this.emails.ingest(connection, metadata, {
      replaceSkipped: reevaluate,
    });
    await this.prisma.syncRun.update({
      where: { id: runId },
      data: {
        pageToken: page.nextPageToken ?? null,
        messagesListed: { increment: page.messages.length },
        candidates: { increment: ingested.candidates },
        skipped: { increment: ingested.skipped },
        // Includes messages deleted between listing and fetching.
        failed: { increment: newIds.length - metadata.length },
      },
    });
  }

  private async continueProcessing(
    connection: { id: string; userId: string },
    refreshToken: string,
    deadline: number,
  ): Promise<SyncResult | null> {
    const lastRun = await this.prisma.syncRun.findFirst({
      where: { connectionId: connection.id },
      orderBy: { startedAt: 'desc' },
    });
    if (
      !lastRun?.finishedAt ||
      lastRun.status !== 'SUCCESS' ||
      Date.now() - lastRun.finishedAt.getTime() > CONTINUE_WINDOW_MS ||
      (await this.processor.countDue(connection.id)) === 0
    ) {
      return null;
    }

    try {
      const processing = await this.processor.processPending(connection, refreshToken, deadline);
      return { run: toSyncRun(lastRun), processing, hasMore: processing.remaining > 0 };
    } catch (error) {
      return {
        run: toSyncRun(await this.fail(lastRun, connection.id, error)),
        processing: null,
        hasMore: false,
      };
    } finally {
      await this.prisma.gmailConnection.update({
        where: { id: connection.id },
        data: { syncLockedUntil: null },
      });
    }
  }

  /**
   * An unfinished run of the same kind is resumed from its checkpoint (its window is stable
   * because `lastSyncedAt` and `lastHistoryId` only move when a run completes); otherwise a
   * new run starts. An incremental run that fell back to a search resumes as such.
   */
  private async startOrResumeRun(connectionId: string, type: SyncRunType, trigger: SyncTrigger) {
    const types: SyncRunType[] = type === 'INCREMENTAL' ? ['INCREMENTAL', 'FALLBACK'] : [type];
    const unfinished = await this.prisma.syncRun.findFirst({
      where: { connectionId, type: { in: types }, status: { not: 'SUCCESS' } },
      orderBy: { startedAt: 'desc' },
    });
    if (unfinished) {
      return this.prisma.syncRun.update({
        where: { id: unfinished.id },
        data: { status: 'RUNNING', errorCode: null, finishedAt: null },
      });
    }
    return this.prisma.syncRun.create({ data: { connectionId, type, trigger } });
  }

  private async fail(run: SyncRunRow, connectionId: string, error: unknown): Promise<SyncRunRow> {
    let errorCode = 'internal';
    if (error instanceof MailAuthError) {
      errorCode = 'auth';
      // Stop syncing until the user reconnects; the UI shows a banner.
      await this.prisma.gmailConnection.update({
        where: { id: connectionId },
        data: { status: 'NEEDS_REAUTH' },
      });
    } else if (error instanceof MailTransientError) {
      errorCode = 'provider_unavailable';
    } else {
      // Only the error class is logged: provider messages may contain personal data.
      this.logger.error(`Sync failed: ${(error as Error).name}`);
    }
    // The page token is kept, so the next attempt resumes where this one stopped.
    return this.prisma.syncRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', finishedAt: new Date(), errorCode },
    });
  }
}
