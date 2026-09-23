import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddNoteInput,
  Application,
  ApplicationDetail,
  ApplicationEvent,
  ChangeStatusInput,
  CreateApplicationInput,
  ListApplicationsQuery,
  Paginated,
  UpdateApplicationInput,
} from '@jat/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toApplication, toApplicationEvent } from './applications.mapper.js';
import { buildApplicationsOrderBy, buildApplicationsWhere } from './applications.query.js';
import { gmailWebUrl } from '../gmail/message-headers.js';
import { normalizeCompanyName } from './company-name.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListApplicationsQuery): Promise<Paginated<Application>> {
    const where = buildApplicationsWhere(userId, query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: { company: true },
        orderBy: buildApplicationsOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);
    return { items: rows.map(toApplication), total, page: query.page, pageSize: query.pageSize };
  }

  async get(userId: string, id: string): Promise<ApplicationDetail> {
    const row = await this.prisma.application.findFirst({
      where: { id, userId },
      include: {
        company: true,
        events: {
          orderBy: { occurredAt: 'desc' },
          include: {
            email: {
              select: { rfc822MessageId: true, connection: { select: { googleEmail: true } } },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Application not found');
    return {
      ...toApplication(row),
      events: row.events.map((event) =>
        toApplicationEvent(
          event,
          event.email
            ? gmailWebUrl(event.email.rfc822MessageId, event.email.connection.googleEmail)
            : null,
        ),
      ),
    };
  }

  async create(userId: string, input: CreateApplicationInput): Promise<ApplicationDetail> {
    const appliedAt = new Date(input.appliedAt);
    const id = await this.prisma.$transaction(async (tx) => {
      const company = await this.upsertCompany(tx, userId, input.companyName);
      const application = await tx.application.create({
        data: {
          userId,
          companyId: company.id,
          roleTitle: input.roleTitle,
          location: input.location,
          workMode: input.workMode,
          source: input.source,
          jobUrl: input.jobUrl,
          notes: input.notes,
          salaryMin: input.salary?.min ?? null,
          salaryMax: input.salary?.max ?? null,
          salaryCurrency: input.salary?.currency ?? null,
          salaryPeriod: input.salary?.period ?? null,
          status: input.status,
          appliedAt,
          lastActivityAt: appliedAt,
          origin: 'MANUAL',
        },
      });

      // The history always starts with APPLIED; if the application is being registered
      // late in the process, record the jump explicitly.
      await tx.applicationEvent.create({
        data: {
          applicationId: application.id,
          type: 'APPLIED',
          toStatus: 'APPLIED',
          occurredAt: appliedAt,
          source: 'MANUAL',
        },
      });
      if (input.status !== 'APPLIED') {
        await tx.applicationEvent.create({
          data: {
            applicationId: application.id,
            type: 'STATUS_CHANGED',
            fromStatus: 'APPLIED',
            toStatus: input.status,
            occurredAt: new Date(),
            source: 'MANUAL',
          },
        });
      }
      return application.id;
    });
    return this.get(userId, id);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateApplicationInput,
  ): Promise<ApplicationDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(tx, userId, id);
      const data: Prisma.ApplicationUncheckedUpdateInput = {};

      if (input.companyName !== undefined) {
        data.companyId = (await this.upsertCompany(tx, userId, input.companyName)).id;
      }
      if (input.roleTitle !== undefined) data.roleTitle = input.roleTitle;
      if (input.location !== undefined) data.location = input.location;
      if (input.workMode !== undefined) data.workMode = input.workMode;
      if (input.source !== undefined) data.source = input.source;
      if (input.jobUrl !== undefined) data.jobUrl = input.jobUrl;
      if (input.notes !== undefined) data.notes = input.notes;
      if (input.appliedAt !== undefined) data.appliedAt = new Date(input.appliedAt);
      if (input.salary !== undefined) {
        data.salaryMin = input.salary?.min ?? null;
        data.salaryMax = input.salary?.max ?? null;
        data.salaryCurrency = input.salary?.currency ?? null;
        data.salaryPeriod = input.salary?.period ?? null;
      }

      // Hand-edited fields win over future automatic extraction (Phase 5+).
      const edited = Object.keys(input).map((k) => (k === 'companyName' ? 'company' : k));
      data.lockedFields = [...new Set([...current.lockedFields, ...edited])];

      await tx.application.update({ where: { id }, data });
    });
    return this.get(userId, id);
  }

  async changeStatus(
    userId: string,
    id: string,
    input: ChangeStatusInput,
  ): Promise<ApplicationDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(tx, userId, id);
      if (current.status === input.status) {
        throw new BadRequestException('The application already has that status');
      }
      const now = new Date();
      await tx.applicationEvent.create({
        data: {
          applicationId: id,
          type: 'STATUS_CHANGED',
          fromStatus: current.status,
          toStatus: input.status,
          occurredAt: now,
          source: 'MANUAL',
          summary: input.note ?? null,
        },
      });
      await tx.application.update({
        where: { id },
        data: {
          status: input.status,
          lastActivityAt: now,
          lockedFields: [...new Set([...current.lockedFields, 'status'])],
        },
      });
    });
    return this.get(userId, id);
  }

  async addNote(userId: string, id: string, input: AddNoteInput): Promise<ApplicationEvent> {
    await this.findOwned(this.prisma, userId, id);
    const event = await this.prisma.applicationEvent.create({
      data: {
        applicationId: id,
        type: 'NOTE',
        occurredAt: new Date(),
        source: 'MANUAL',
        summary: input.text,
      },
    });
    return toApplicationEvent(event);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.application.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Application not found');
  }

  private async findOwned(db: Tx | PrismaService, userId: string, id: string) {
    const row = await db.application.findFirst({
      where: { id, userId },
      select: { id: true, status: true, lockedFields: true },
    });
    if (!row) throw new NotFoundException('Application not found');
    return row;
  }

  private upsertCompany(tx: Tx, userId: string, name: string) {
    const normalizedName = normalizeCompanyName(name);
    return tx.company.upsert({
      where: { userId_normalizedName: { userId, normalizedName } },
      update: {},
      create: { userId, name: name.trim(), normalizedName },
      select: { id: true },
    });
  }
}
