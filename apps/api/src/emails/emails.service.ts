import { Injectable } from '@nestjs/common';
import type { EmailSummary, ListEmailsQuery, Paginated } from '@jat/shared';
import type { Prisma } from '../generated/prisma/client.js';
import type { MessageMetadata } from '../gmail/mail-provider.js';
import { gmailWebUrl, parseFromHeader } from '../gmail/message-headers.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { prefilter } from './prefilter.js';

export interface IngestResult {
  candidates: number;
  skipped: number;
}

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Of these Gmail ids, which need processing? New ones, plus — when re-scanning after a
   * rules change — the ones previously discarded.
   */
  async filterNew(
    connectionId: string,
    gmailMessageIds: readonly string[],
    { includeSkipped = false } = {},
  ): Promise<string[]> {
    if (gmailMessageIds.length === 0) return [];
    const known = await this.prisma.email.findMany({
      where: {
        connectionId,
        gmailMessageId: { in: [...gmailMessageIds] },
        ...(includeSkipped && { processingStatus: { not: 'SKIPPED' } }),
      },
      select: { gmailMessageId: true },
    });
    const seen = new Set(known.map((e) => e.gmailMessageId));
    return gmailMessageIds.filter((id) => !seen.has(id));
  }

  /**
   * Stores message metadata. Idempotent: the unique (connection, gmail id) key plus
   * `skipDuplicates` make re-running a sync harmless.
   * Candidates keep sender/subject for classification; discarded mail keeps ids and date only.
   */
  async ingest(
    connection: { id: string; googleEmail: string },
    messages: readonly MessageMetadata[],
    { replaceSkipped = false } = {},
  ): Promise<IngestResult> {
    if (messages.length === 0) return { candidates: 0, skipped: 0 };

    if (replaceSkipped) {
      // Re-evaluated with new rules: drop the old verdict so the row is written fresh.
      await this.prisma.email.deleteMany({
        where: {
          connectionId: connection.id,
          processingStatus: 'SKIPPED',
          gmailMessageId: { in: messages.map((m) => m.id) },
        },
      });
    }

    const threadIds = [...new Set(messages.map((m) => m.threadId))];
    await this.prisma.emailThread.createMany({
      data: threadIds.map((gmailThreadId) => {
        const dates = messages
          .filter((m) => m.threadId === gmailThreadId)
          .map((m) => m.receivedAt.getTime());
        return {
          connectionId: connection.id,
          gmailThreadId,
          firstMessageAt: new Date(Math.min(...dates)),
          lastMessageAt: new Date(Math.max(...dates)),
        };
      }),
      skipDuplicates: true,
    });
    const threads = await this.prisma.emailThread.findMany({
      where: { connectionId: connection.id, gmailThreadId: { in: threadIds } },
      select: { id: true, gmailThreadId: true },
    });
    const threadByGmailId = new Map(threads.map((t) => [t.gmailThreadId, t.id]));

    let candidates = 0;
    const rows: Prisma.EmailCreateManyInput[] = messages.map((m) => {
      const from = parseFromHeader(m.from);
      const verdict = prefilter({
        fromEmail: from.email,
        fromDomain: from.domain,
        subject: m.subject ?? null,
        labels: m.labels,
        ownEmail: connection.googleEmail,
      });
      const base = {
        connectionId: connection.id,
        threadId: threadByGmailId.get(m.threadId) as string,
        gmailMessageId: m.id,
        receivedAt: m.receivedAt,
        prefilterReason: verdict.reason,
      };
      if (!verdict.candidate) return { ...base, processingStatus: 'SKIPPED' as const };
      candidates++;
      return {
        ...base,
        processingStatus: 'PENDING' as const,
        rfc822MessageId: m.rfc822MessageId ?? null,
        fromEmail: from.email,
        fromName: from.name,
        fromDomain: from.domain,
        subject: m.subject?.slice(0, 500) ?? null,
        gmailLabels: m.labels,
      };
    });
    await this.prisma.email.createMany({ data: rows, skipDuplicates: true });

    // Keep thread aggregates exact, whatever order messages arrive in.
    const ids = threads.map((t) => t.id);
    await this.prisma.$executeRaw`
      UPDATE email_threads t
      SET message_count = s.c, first_message_at = s.mn, last_message_at = s.mx
      FROM (
        SELECT thread_id, count(*)::int AS c, min(received_at) AS mn, max(received_at) AS mx
        FROM emails WHERE thread_id = ANY(${ids}::uuid[]) GROUP BY thread_id
      ) s
      WHERE t.id = s.thread_id
    `;
    return { candidates, skipped: messages.length - candidates };
  }

  async list(userId: string, query: ListEmailsQuery): Promise<Paginated<EmailSummary>> {
    const connection = await this.prisma.gmailConnection.findFirst({
      where: { userId },
      select: { id: true, googleEmail: true },
    });
    if (!connection) return { items: [], total: 0, page: query.page, pageSize: query.pageSize };

    const where: Prisma.EmailWhereInput = {
      connectionId: connection.id,
      // Discarded mail is not shown unless explicitly requested (it has no metadata anyway).
      processingStatus: query.status?.length ? { in: query.status } : { not: 'SKIPPED' },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.email.findMany({
        where,
        orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          application: { select: { roleTitle: true, company: { select: { name: true } } } },
        },
      }),
      this.prisma.email.count({ where }),
    ]);
    return {
      items: rows.map((e) => ({
        id: e.id,
        fromName: e.fromName,
        fromEmail: e.fromEmail,
        subject: e.subject,
        receivedAt: e.receivedAt.toISOString(),
        processingStatus: e.processingStatus,
        category: e.category,
        prefilterReason: e.prefilterReason,
        applicationId: e.applicationId,
        applicationLabel: e.application
          ? `${e.application.company.name} · ${e.application.roleTitle}`
          : null,
        confidence: e.confidence,
        classifier: e.classifier,
        gmailUrl: gmailWebUrl(e.rfc822MessageId, connection.googleEmail),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
