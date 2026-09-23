import type { Application, ApplicationEvent } from '@jat/shared';
import type {
  Application as ApplicationRow,
  ApplicationEvent as ApplicationEventRow,
  Company as CompanyRow,
} from '../generated/prisma/client.js';

export type ApplicationWithCompany = ApplicationRow & { company: CompanyRow };

/** DB row → API contract (@jat/shared). Keeps Prisma types out of HTTP responses. */
export function toApplication(row: ApplicationWithCompany): Application {
  const hasSalary = row.salaryMin !== null || row.salaryMax !== null;
  return {
    id: row.id,
    company: { id: row.company.id, name: row.company.name, domain: row.company.domain },
    roleTitle: row.roleTitle,
    location: row.location,
    workMode: row.workMode,
    salary: hasSalary
      ? {
          min: row.salaryMin,
          max: row.salaryMax,
          currency: row.salaryCurrency ?? 'EUR',
          period: row.salaryPeriod ?? 'YEAR',
        }
      : null,
    source: row.source,
    jobUrl: row.jobUrl,
    status: row.status,
    appliedAt: row.appliedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    needsReview: row.needsReview,
    notes: row.notes,
  };
}

export function toApplicationEvent(
  row: ApplicationEventRow,
  emailUrl: string | null = null,
): ApplicationEvent {
  return {
    id: row.id,
    applicationId: row.applicationId,
    type: row.type,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    occurredAt: row.occurredAt.toISOString(),
    source: row.source,
    summary: row.summary,
    emailUrl,
  };
}
