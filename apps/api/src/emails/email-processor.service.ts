import { Injectable, Logger } from '@nestjs/common';
import { EmailEventsService } from '../applications/email-events.service.js';
import { EmailAnalyzer } from '../classification/analyzer.js';
import { prepareEmail } from '../classification/prepare-email.js';
import { MailAuthError, MailProvider } from '../gmail/mail-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';

const BATCH = 10;
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60_000;

export interface ProcessingResult {
  processed: number;
  needsReview: number;
  failed: number;
  remaining: number;
}

/**
 * Pipeline for stored candidates: fetch body → prepare → classify → extract → apply.
 * The body only exists in memory inside `processOne`; it is never stored or logged.
 * Emails are processed oldest first so each application's history is built in order.
 */
@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailProvider,
    private readonly analyzer: EmailAnalyzer,
    private readonly events: EmailEventsService,
  ) {}

  async processPending(
    connection: { id: string; userId: string },
    refreshToken: string,
    deadline: number,
  ): Promise<ProcessingResult> {
    const result: ProcessingResult = { processed: 0, needsReview: 0, failed: 0, remaining: 0 };

    // At least one batch per call, so every call makes progress even with a tiny budget.
    let firstBatch = true;
    while (firstBatch || Date.now() < deadline) {
      const batch = await this.prisma.email.findMany({
        where: this.dueWhere(connection.id),
        orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
        take: BATCH,
      });
      if (batch.length === 0) break;

      for (const email of batch) {
        if (!firstBatch && Date.now() >= deadline) break;
        const outcome = await this.processOne(connection.userId, refreshToken, email);
        result[outcome]++;
      }
      firstBatch = false;
    }
    result.remaining = await this.countDue(connection.id);
    return result;
  }

  /** Candidates waiting for (another) classification attempt. */
  countDue(connectionId: string): Promise<number> {
    return this.prisma.email.count({ where: this.dueWhere(connectionId) });
  }

  private dueWhere(connectionId: string) {
    return {
      connectionId,
      processingStatus: { in: ['PENDING', 'FAILED'] as ('PENDING' | 'FAILED')[] },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    };
  }

  private async processOne(
    userId: string,
    refreshToken: string,
    email: {
      id: string;
      gmailMessageId: string;
      threadId: string;
      receivedAt: Date;
      subject: string | null;
      fromName: string | null;
      fromEmail: string | null;
      fromDomain: string | null;
      attempts: number;
    },
  ): Promise<'processed' | 'needsReview' | 'failed'> {
    try {
      const content = await this.mail.getContent(refreshToken, email.gmailMessageId);
      const from = email.fromName ? `"${email.fromName}" <${email.fromEmail}>` : email.fromEmail;
      const prepared = prepareEmail({
        subject: email.subject,
        from,
        text: content.text,
        html: content.html,
      });

      const { classification, extracted, classifierId } = await this.analyzer.analyze(prepared, {
        emailId: email.id,
      });
      const outcome = await this.events.apply(
        userId,
        email,
        classification,
        extracted,
        classifierId,
      );
      return outcome === 'needs_review' ? 'needsReview' : 'processed';
    } catch (error) {
      // Auth problems stop the whole sync (the caller marks the connection).
      if (error instanceof MailAuthError) throw error;

      const attempts = email.attempts + 1;
      await this.prisma.email.update({
        where: { id: email.id },
        data: {
          attempts,
          processingStatus: 'FAILED',
          errorCode: (error as Error).name.slice(0, 50),
          nextAttemptAt: new Date(Date.now() + BASE_BACKOFF_MS * 2 ** attempts),
        },
      });
      // Only the error class: provider messages may contain personal data.
      this.logger.warn(`Email processing failed (attempt ${attempts}): ${(error as Error).name}`);
      return 'failed';
    }
  }
}
