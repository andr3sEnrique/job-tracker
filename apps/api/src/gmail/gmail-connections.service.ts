import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { GmailStatus, SyncRun } from '@jat/shared';
import { pkceChallenge, randomToken, safeEqual } from '../auth/crypto.js';
import type { OAuthState } from '../auth/auth.service.js';
import { AppConfig } from '../config/app-config.service.js';
import { EncryptionService } from '../crypto/encryption.service.js';
import type { SyncRun as SyncRunRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GMAIL_READONLY_SCOPE, MailProvider } from './mail-provider.js';

export type ConnectFailure = 'state' | 'oauth' | 'scope' | 'no-refresh-token';

/** The encryption context binds each ciphertext to its owner (see EncryptionService). */
const tokenContext = (userId: string) => `gmail-refresh-token:${userId}`;

export function toSyncRun(run: SyncRunRow): SyncRun {
  return {
    id: run.id,
    type: run.type,
    trigger: run.trigger,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    messagesListed: run.messagesListed,
    candidates: run.candidates,
    skipped: run.skipped,
    failed: run.failed,
    errorCode: run.errorCode,
  };
}

@Injectable()
export class GmailConnectionsService {
  private readonly logger = new Logger(GmailConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailProvider,
    private readonly encryption: EncryptionService,
    private readonly config: AppConfig,
  ) {}

  startConnect(loginHint: string): { url: string; oauthState: OAuthState } {
    const oauthState = { state: randomToken(), verifier: randomToken(48) };
    const url = this.mail.buildConnectUrl({
      state: oauthState.state,
      codeChallenge: pkceChallenge(oauthState.verifier),
      loginHint,
    });
    return { url, oauthState };
  }

  async completeConnect(
    userId: string,
    params: { code?: string; state?: string; stored: OAuthState | null },
  ): Promise<{ ok: true } | { ok: false; reason: ConnectFailure }> {
    const { code, state, stored } = params;
    if (!code || !state || !stored || !safeEqual(state, stored.state))
      return { ok: false, reason: 'state' };

    let result;
    try {
      result = await this.mail.exchangeConnectCode({ code, codeVerifier: stored.verifier });
    } catch (error) {
      this.logger.warn(`Gmail code exchange failed: ${(error as Error).name}`);
      return { ok: false, reason: 'oauth' };
    }
    // Google's consent screen lets the user untick individual scopes.
    if (!result.scopes.includes(GMAIL_READONLY_SCOPE)) return { ok: false, reason: 'scope' };
    if (!result.refreshToken) return { ok: false, reason: 'no-refresh-token' };

    const { ciphertext, keyVersion } = this.encryption.encrypt(
      result.refreshToken,
      tokenContext(userId),
    );
    const data = {
      refreshTokenEnc: ciphertext,
      keyVersion,
      scopes: result.scopes,
      status: 'ACTIVE' as const,
    };
    await this.prisma.gmailConnection.upsert({
      where: { userId_googleEmail: { userId, googleEmail: result.email } },
      update: data,
      create: { ...data, userId, googleEmail: result.email },
    });
    return { ok: true };
  }

  /** The connection with its decrypted refresh token, for the sync. */
  async getActive(userId: string) {
    const connection = await this.prisma.gmailConnection.findFirst({ where: { userId } });
    if (!connection) throw new NotFoundException('Gmail is not connected');
    if (connection.status !== 'ACTIVE') throw new ConflictException('Gmail access must be renewed');
    const refreshToken = this.encryption.decrypt(
      connection.refreshTokenEnc,
      connection.keyVersion,
      tokenContext(userId),
    );
    return { connection, refreshToken };
  }

  async status(userId: string): Promise<GmailStatus> {
    const connection = await this.prisma.gmailConnection.findFirst({ where: { userId } });
    if (!connection) return { connected: false };

    const [groups, lastRun, lastAutomatic] = await Promise.all([
      this.prisma.email.groupBy({
        by: ['processingStatus'],
        where: { connectionId: connection.id },
        _count: { _all: true },
      }),
      this.prisma.syncRun.findFirst({
        where: { connectionId: connection.id },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.syncRun.findFirst({
        where: { connectionId: connection.id, trigger: { in: ['SCHEDULER', 'CRON'] } },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
    ]);
    const count = (s: string) => groups.find((g) => g.processingStatus === s)?._count._all ?? 0;
    const skipped = count('SKIPPED');
    const total = groups.reduce((sum, g) => sum + g._count._all, 0);

    return {
      connected: true,
      googleEmail: connection.googleEmail,
      status: connection.status,
      connectedAt: connection.createdAt.toISOString(),
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      initialSyncCompleted: connection.initialSyncCompletedAt !== null,
      syncWindowDays: this.config.get('GMAIL_INITIAL_SYNC_DAYS'),
      counts: {
        candidates: total - skipped,
        pending: count('PENDING') + count('FAILED'),
        needsReview: count('NEEDS_REVIEW'),
        skipped,
      },
      lastRun: lastRun ? toSyncRun(lastRun) : null,
      lastAutomaticSyncAt: lastAutomatic?.startedAt.toISOString() ?? null,
    };
  }

  /**
   * Revokes the grant at Google (best effort) and deletes the connection with every stored
   * email, thread and sync run. Applications and their history are kept.
   */
  async disconnect(userId: string): Promise<void> {
    const connection = await this.prisma.gmailConnection.findFirst({ where: { userId } });
    if (!connection) return;
    try {
      const token = this.encryption.decrypt(
        connection.refreshTokenEnc,
        connection.keyVersion,
        tokenContext(userId),
      );
      await this.mail.revoke(token);
    } catch (error) {
      // Already revoked, or Google unreachable: deleting our copy is what matters.
      this.logger.warn(`Gmail token revocation failed: ${(error as Error).name}`);
    }
    await this.prisma.gmailConnection.delete({ where: { id: connection.id } });
  }
}
