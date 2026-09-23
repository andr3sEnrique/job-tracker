import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { SyncResult } from '@jat/shared';
import { AppConfig } from '../config/app-config.service.js';
import { EmailsService } from '../emails/emails.service.js';
import { EmailProcessorService } from '../emails/email-processor.service.js';
import { buildGmailSearchQuery, PREFILTER_VERSION } from '../emails/prefilter.js';
import type { SyncRun as SyncRunRow, SyncRunType } from '../generated/prisma/client.js';
import { GmailConnectionsService, toSyncRun } from '../gmail/gmail-connections.service.js';
import { MailAuthError, MailProvider, MailTransientError } from '../gmail/mail-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Extra lease time beyond the budget, in case a page takes long. */
const LOCK_MARGIN_MS = 60_000;
/** A sync that finished this recently is continued (classification) rather than repeated. */
const CONTINUE_WINDOW_MS = 10 * 60_000;

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
  ) {}

  async run(userId: string): Promise<SyncResult> {
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
    // window; otherwise a MANUAL catch-up from the last sync.
    const type: SyncRunType = !connection.initialSyncCompletedAt
      ? 'INITIAL'
      : connection.prefilterVersion < PREFILTER_VERSION
        ? 'RESCAN'
        : 'MANUAL';
    const fullWindow = type !== 'MANUAL';

    // Still classifying the result of a sync that just finished? Continue with that instead
    // of listing the mailbox again on every call.
    if (type === 'MANUAL') {
      const continued = await this.continueProcessing(connection, refreshToken, started + budget);
      if (continued) return continued;
    }

    let run = await this.startOrResumeRun(connection.id, type);
    try {
      if (!connection.lastHistoryId || run.type !== 'INITIAL') {
        // Captured BEFORE listing, so nothing that arrives during the sync is missed by
        // the incremental (History API) sync of Phase 6.
        const historyId = await this.mail.getHistoryId(refreshToken);
        await this.prisma.gmailConnection.update({
          where: { id: connection.id },
          data: { lastHistoryId: historyId },
        });
      }

      const query = fullWindow
        ? buildGmailSearchQuery({ days: this.config.get('GMAIL_INITIAL_SYNC_DAYS') })
        : buildGmailSearchQuery({
            // One day of overlap: duplicates are harmless (idempotent ingest), gaps are not.
            after: new Date((connection.lastSyncedAt?.getTime() ?? started) - DAY_MS),
          });

      let done = false;
      while (!done) {
        const page = await this.mail.listMessages(refreshToken, {
          query,
          pageToken: run.pageToken ?? undefined,
          pageSize: this.config.get('SYNC_PAGE_SIZE'),
        });
        // A re-scan also re-evaluates mail the old rules discarded.
        const reevaluate = type === 'RESCAN';
        const newIds = await this.emails.filterNew(
          connection.id,
          page.messages.map((m) => m.id),
          { includeSkipped: reevaluate },
        );
        const metadata = await this.mail.getMetadata(refreshToken, newIds);
        const ingested = await this.emails.ingest(connection, metadata, {
          replaceSkipped: reevaluate,
        });

        done = !page.nextPageToken;
        run = await this.prisma.syncRun.update({
          where: { id: run.id },
          data: {
            pageToken: page.nextPageToken ?? null,
            messagesListed: { increment: page.messages.length },
            candidates: { increment: ingested.candidates },
            skipped: { increment: ingested.skipped },
            failed: { increment: newIds.length - metadata.length },
          },
        });
        if (Date.now() - started > budget) break;
      }

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
   * An unfinished run of the same kind is resumed from its checkpoint (its query window is
   * stable because `lastSyncedAt` only moves when a run completes); otherwise a new run starts.
   */
  private async startOrResumeRun(connectionId: string, type: SyncRunType) {
    const unfinished = await this.prisma.syncRun.findFirst({
      where: { connectionId, type, status: { not: 'SUCCESS' } },
      orderBy: { startedAt: 'desc' },
    });
    if (unfinished) {
      return this.prisma.syncRun.update({
        where: { id: unfinished.id },
        data: { status: 'RUNNING', errorCode: null, finishedAt: null },
      });
    }
    return this.prisma.syncRun.create({ data: { connectionId, type } });
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
