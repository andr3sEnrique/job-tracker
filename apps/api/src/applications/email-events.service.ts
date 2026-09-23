import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApplicationSource,
  EmailCategory,
  EventType,
  ReprocessResult,
  ResolveEmailInput,
} from '@jat/shared';
import type { Classification, ExtractedData } from '../classification/types.js';
import { JOB_SENDER_DOMAINS } from '../emails/prefilter.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizeCompanyName } from './company-name.js';
import { compactName, roleSimilarity } from './role-similarity.js';
import { deriveStatus } from './timeline.js';

type Tx = Prisma.TransactionClient;

export const CATEGORY_EVENT: Partial<Record<EmailCategory, EventType>> = {
  APPLICATION_SUBMITTED: 'APPLIED',
  APPLICATION_CONFIRMATION: 'CONFIRMATION_RECEIVED',
  RECRUITER_REPLY: 'RECRUITER_CONTACT',
  INTERVIEW: 'INTERVIEW_SCHEDULED',
  TECHNICAL_INTERVIEW: 'TECHNICAL_INTERVIEW_SCHEDULED',
  REJECTION: 'REJECTED',
  OFFER: 'OFFER_RECEIVED',
};

/** Below this confidence the email lands in the review inbox (its effects still apply). */
export const REVIEW_THRESHOLD = 0.7;
const ROLE_MATCH_THRESHOLD = 0.5;
const UNKNOWN_ROLE = 'Puesto sin identificar';
const FREEMAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
]);

export interface ProcessableEmail {
  id: string;
  threadId: string;
  receivedAt: Date;
  subject: string | null;
  fromDomain: string | null;
}

export type ApplyOutcome = 'processed' | 'needs_review';

const isPlatform = (domain: string) =>
  JOB_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)) ||
  domain.endsWith('linkedin.com');

/** A human writing from the company's own domain (not an ATS, platform or freemail). */
const companyDomainOf = (domain: string | null) =>
  domain && !isPlatform(domain) && !FREEMAIL.has(domain) ? domain : null;

function sourceFrom(domain: string | null, category: EmailCategory): ApplicationSource {
  if (!domain) return 'OTHER';
  if (domain.endsWith('linkedin.com')) return 'LINKEDIN';
  if (domain.includes('indeed.')) return 'INDEED';
  if (domain.endsWith('infojobs.net')) return 'INFOJOBS';
  if (companyDomainOf(domain)) return category === 'RECRUITER_REPLY' ? 'RECRUITER' : 'COMPANY_SITE';
  return 'COMPANY_SITE';
}

/**
 * Turns classified emails into application history. Everything runs in a transaction and is
 * idempotent (one email → at most one event, enforced by a unique key).
 */
@Injectable()
export class EmailEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(
    userId: string,
    email: ProcessableEmail,
    classification: Classification,
    extracted: ExtractedData,
    classifierId: string,
  ): Promise<ApplyOutcome> {
    const eventType = CATEGORY_EVENT[classification.category];
    const needsReview = classification.confidence < REVIEW_THRESHOLD;
    const verdict = {
      category: classification.category,
      confidence: classification.confidence,
      classifier: classifierId,
      extracted: extracted as unknown as Prisma.InputJsonValue,
      errorCode: null,
    };

    // Job alerts, newsletters and unknown mail never touch applications.
    if (!eventType) {
      const status = classification.category === 'UNKNOWN' ? 'NEEDS_REVIEW' : 'PROCESSED';
      await this.prisma.email.update({
        where: { id: email.id },
        data: { ...verdict, processingStatus: status },
      });
      return status === 'NEEDS_REVIEW' ? 'needs_review' : 'processed';
    }

    return this.prisma.$transaction(async (tx) => {
      if (await tx.applicationEvent.findUnique({ where: { emailId: email.id } })) {
        await tx.email.update({
          where: { id: email.id },
          data: { ...verdict, processingStatus: 'PROCESSED' },
        });
        return 'processed';
      }

      let applicationId = await this.findMatch(
        tx,
        userId,
        email,
        extracted,
        classification.category,
      );
      let created = false;
      if (!applicationId) {
        if (!extracted.company) {
          // No application and no company to create one with: a human has to decide.
          await tx.email.update({
            where: { id: email.id },
            data: { ...verdict, processingStatus: 'NEEDS_REVIEW' },
          });
          return 'needs_review';
        }
        applicationId = await this.createFromEmail(tx, userId, email, classification, extracted);
        created = true;
      }

      await this.recordEvent(tx, applicationId, email, eventType);
      if (!created) await this.fillMissingFields(tx, applicationId, extracted);
      await this.learnCompanyDomain(tx, applicationId, email.fromDomain);

      const outcome: ApplyOutcome = needsReview ? 'needs_review' : 'processed';
      await tx.email.update({
        where: { id: email.id },
        data: {
          ...verdict,
          applicationId,
          processingStatus: needsReview ? 'NEEDS_REVIEW' : 'PROCESSED',
        },
      });
      await tx.emailThread.updateMany({
        where: { id: email.threadId, applicationId: null },
        data: { applicationId },
      });
      return outcome;
    });
  }

  /**
   * Which existing application is this email about? In order of reliability:
   * same Gmail thread → same job URL → same company (by name or sender domain) and a
   * similar role.
   */
  private async findMatch(
    tx: Tx,
    userId: string,
    email: ProcessableEmail,
    extracted: ExtractedData,
    category: EmailCategory,
  ): Promise<string | null> {
    const thread = await tx.emailThread.findUnique({
      where: { id: email.threadId },
      select: { application: { select: { id: true, userId: true } } },
    });
    if (thread?.application?.userId === userId) return thread.application.id;

    if (extracted.jobUrl) {
      const byUrl = await tx.application.findFirst({
        where: { userId, jobUrl: extracted.jobUrl },
        select: { id: true },
      });
      if (byUrl) return byUrl.id;
    }

    const companyDomain = companyDomainOf(email.fromDomain);
    const wanted = extracted.company ? compactName(extracted.company) : null;
    if (!wanted && !companyDomain) return null;

    const companies = await tx.company.findMany({
      where: { userId },
      select: { id: true, name: true, domain: true },
    });
    const companyIds = companies
      .filter(
        (c) =>
          (wanted && compactName(c.name) === wanted) ||
          (companyDomain && c.domain === companyDomain),
      )
      .map((c) => c.id);
    if (companyIds.length === 0) return null;

    const candidates = await tx.application.findMany({
      where: { userId, archived: false, companyId: { in: companyIds } },
      select: { id: true, roleTitle: true, status: true },
      orderBy: { lastActivityAt: 'desc' },
    });
    if (candidates.length === 0) return null;

    if (extracted.role) {
      const scored = candidates
        .map((c) => ({ id: c.id, score: roleSimilarity(c.roleTitle, extracted.role!) }))
        .sort((a, b) => b.score - a.score);
      if (scored[0]!.score >= ROLE_MATCH_THRESHOLD) return scored[0]!.id;
      // A new confirmation for another role at the same company is a new application.
      if (category === 'APPLICATION_SUBMITTED' || category === 'APPLICATION_CONFIRMATION')
        return null;
    }
    const open = candidates.find((c) => !['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(c.status));
    return (open ?? candidates[0]!).id;
  }

  private async createFromEmail(
    tx: Tx,
    userId: string,
    email: ProcessableEmail,
    classification: Classification,
    extracted: ExtractedData,
  ): Promise<string> {
    const company = await this.upsertCompany(
      tx,
      userId,
      extracted.company!,
      companyDomainOf(email.fromDomain),
    );
    const startsApplication =
      classification.category === 'APPLICATION_SUBMITTED' ||
      classification.category === 'APPLICATION_CONFIRMATION';
    const application = await tx.application.create({
      data: {
        userId,
        companyId: company.id,
        roleTitle: extracted.role ?? UNKNOWN_ROLE,
        location: extracted.location,
        workMode: extracted.workMode ?? 'UNKNOWN',
        jobUrl: extracted.jobUrl,
        source: sourceFrom(email.fromDomain, classification.category),
        status: 'APPLIED',
        appliedAt: email.receivedAt,
        lastActivityAt: email.receivedAt,
        origin: 'EMAIL',
        // A rejection or interview for an application we never saw, or a guessed company
        // or role, deserves a human look.
        needsReview:
          !startsApplication ||
          !extracted.role ||
          extracted.companyConfidence < 0.8 ||
          classification.confidence < REVIEW_THRESHOLD,
      },
    });
    return application.id;
  }

  private async recordEvent(
    tx: Tx,
    applicationId: string,
    email: ProcessableEmail,
    type: EventType,
  ) {
    const before = await tx.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { status: true },
    });
    const event = await tx.applicationEvent.create({
      data: {
        applicationId,
        type,
        occurredAt: email.receivedAt,
        source: 'EMAIL',
        summary: email.subject?.slice(0, 300) ?? null,
        emailId: email.id,
      },
    });
    const after = await this.recomputeStatus(tx, applicationId);
    if (after !== before.status) {
      await tx.applicationEvent.update({
        where: { id: event.id },
        data: { fromStatus: before.status, toStatus: after },
      });
    }
  }

  /** Re-derives status and last activity from the full history (see deriveStatus). */
  async recomputeStatus(tx: Tx, applicationId: string) {
    const events = await tx.applicationEvent.findMany({
      where: { applicationId },
      select: { type: true, toStatus: true, occurredAt: true },
    });
    const status = deriveStatus(events);
    const lastActivityAt = events.reduce<Date | null>(
      (max, e) => (!max || e.occurredAt > max ? e.occurredAt : max),
      null,
    );
    await tx.application.update({
      where: { id: applicationId },
      data: { status, ...(lastActivityAt && { lastActivityAt }) },
    });
    return status;
  }

  /** Emails can complete an application, but never overwrite what the user typed. */
  private async fillMissingFields(tx: Tx, applicationId: string, extracted: ExtractedData) {
    const app = await tx.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { location: true, jobUrl: true, workMode: true, roleTitle: true, lockedFields: true },
    });
    const free = (field: string) => !app.lockedFields.includes(field);
    const data: Prisma.ApplicationUpdateInput = {};
    if (!app.location && extracted.location && free('location')) data.location = extracted.location;
    if (!app.jobUrl && extracted.jobUrl && free('jobUrl')) data.jobUrl = extracted.jobUrl;
    if (app.workMode === 'UNKNOWN' && extracted.workMode && free('workMode'))
      data.workMode = extracted.workMode;
    if (app.roleTitle === UNKNOWN_ROLE && extracted.role && free('roleTitle'))
      data.roleTitle = extracted.role;
    if (Object.keys(data).length)
      await tx.application.update({ where: { id: applicationId }, data });
  }

  /** Remember a recruiter's domain so later emails from colleagues match the company. */
  private async learnCompanyDomain(tx: Tx, applicationId: string, fromDomain: string | null) {
    const domain = companyDomainOf(fromDomain);
    if (!domain) return;
    const app = await tx.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { companyId: true },
    });
    await tx.company.updateMany({ where: { id: app.companyId, domain: null }, data: { domain } });
  }

  private upsertCompany(tx: Tx, userId: string, name: string, domain: string | null) {
    const normalizedName = normalizeCompanyName(name);
    return tx.company.upsert({
      where: { userId_normalizedName: { userId, normalizedName } },
      update: {},
      create: { userId, name: name.trim(), normalizedName, domain },
      select: { id: true },
    });
  }

  // ---------------------------------------------------------------------------------------
  // Review inbox
  // ---------------------------------------------------------------------------------------

  async resolve(userId: string, emailId: string, input: ResolveEmailInput): Promise<void> {
    const email = await this.prisma.email.findFirst({
      where: { id: emailId, connection: { userId }, processingStatus: { not: 'SKIPPED' } },
      select: { id: true, threadId: true, receivedAt: true, subject: true, fromDomain: true },
    });
    if (!email) throw new NotFoundException('Email not found');

    await this.prisma.$transaction(async (tx) => {
      if (input.action === 'confirm') {
        await tx.email.update({ where: { id: email.id }, data: { processingStatus: 'PROCESSED' } });
        return;
      }

      await this.detach(tx, email.id);
      const manual = {
        confidence: 1,
        classifier: 'manual',
        processingStatus: 'PROCESSED' as const,
      };

      if (input.action === 'ignore') {
        await tx.email.update({
          where: { id: email.id },
          data: { ...manual, category: 'IRRELEVANT', applicationId: null },
        });
        return;
      }

      const eventType = CATEGORY_EVENT[input.category];
      if (!eventType)
        throw new BadRequestException('This category does not belong to an application');

      let applicationId: string;
      if (input.action === 'assign') {
        const target = await tx.application.findFirst({
          where: { id: input.applicationId, userId },
          select: { id: true },
        });
        if (!target) throw new NotFoundException('Application not found');
        applicationId = target.id;
      } else {
        const company = await this.upsertCompany(
          tx,
          userId,
          input.companyName,
          companyDomainOf(email.fromDomain),
        );
        applicationId = (
          await tx.application.create({
            data: {
              userId,
              companyId: company.id,
              roleTitle: input.roleTitle,
              source: sourceFrom(email.fromDomain, input.category),
              appliedAt: email.receivedAt,
              lastActivityAt: email.receivedAt,
              origin: 'EMAIL',
            },
          })
        ).id;
      }

      await this.recordEvent(tx, applicationId, email, eventType);
      await tx.email.update({
        where: { id: email.id },
        data: { ...manual, category: input.category, applicationId },
      });
      await tx.emailThread.update({ where: { id: email.threadId }, data: { applicationId } });
    });
  }

  /**
   * Undoes an email's effect: removes its event, recomputes the application, and deletes
   * the application if this email alone had created it and nobody edited it.
   */
  private async detach(tx: Tx, emailId: string) {
    const event = await tx.applicationEvent.findUnique({
      where: { emailId },
      select: { id: true, applicationId: true },
    });
    if (!event) return;
    await tx.applicationEvent.delete({ where: { id: event.id } });

    const app = await tx.application.findUniqueOrThrow({
      where: { id: event.applicationId },
      select: { origin: true, lockedFields: true, _count: { select: { events: true } } },
    });
    if (app.origin === 'EMAIL' && app._count.events === 0 && app.lockedFields.length === 0) {
      await tx.emailThread.updateMany({
        where: { applicationId: event.applicationId },
        data: { applicationId: null },
      });
      await tx.application.delete({ where: { id: event.applicationId } });
    } else {
      await this.recomputeStatus(tx, event.applicationId);
    }
  }

  /**
   * Starts over after the rules improve: removes everything derived from emails (keeping
   * manual edits and hand-made applications) and marks every stored email as pending.
   */
  async resetForReprocessing(userId: string): Promise<ReprocessResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.applicationEvent.deleteMany({
        where: { application: { userId }, source: 'EMAIL', emailId: { not: null } },
      });
      const { count: applicationsRemoved } = await tx.application.deleteMany({
        where: { userId, origin: 'EMAIL', lockedFields: { isEmpty: true }, events: { none: {} } },
      });
      const remaining = await tx.application.findMany({ where: { userId }, select: { id: true } });
      for (const { id } of remaining) await this.recomputeStatus(tx, id);

      await tx.emailThread.updateMany({
        where: { connection: { userId } },
        data: { applicationId: null },
      });
      const { count: emailsReset } = await tx.email.updateMany({
        where: { connection: { userId }, processingStatus: { not: 'SKIPPED' } },
        data: {
          processingStatus: 'PENDING',
          category: null,
          confidence: null,
          classifier: null,
          extracted: Prisma.DbNull,
          applicationId: null,
          attempts: 0,
          nextAttemptAt: null,
          errorCode: null,
        },
      });
      return { emailsReset, applicationsRemoved };
    });
  }
}
