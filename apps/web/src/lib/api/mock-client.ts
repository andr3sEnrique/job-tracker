import {
  generateSampleDataset,
  type Application,
  type ApplicationEvent,
  type EmailSummary,
} from '@jat/shared';
import type { ApiClient } from './types';
import { queryApplications } from '../mocks/query';
import {
  computeFunnel,
  computeSourceDistribution,
  computeStatusDistribution,
  computeSummary,
  computeWeeklyTimeline,
} from '../mocks/stats';

/** In-memory backend for demos and offline UI work (NEXT_PUBLIC_API_MODE=mock). */

const LATENCY_MS = 250;
const delay = <T>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

let dataset: { applications: Application[]; events: ApplicationEvent[] } | undefined;
const db = () => (dataset ??= generateSampleDataset());
const newId = () => crypto.randomUUID();

function detail(id: string) {
  const application = db().applications.find((a) => a.id === id);
  if (!application) return null;
  const events = db()
    .events.filter((e) => e.applicationId === id)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return { ...application, events };
}

function mustGet(id: string) {
  const found = detail(id);
  if (!found) throw new Error('Application not found');
  return found;
}

function pushEvent(event: Omit<ApplicationEvent, 'id' | 'emailUrl'>): ApplicationEvent {
  const created = { ...event, id: newId(), emailUrl: null };
  db().events.push(created);
  return created;
}

let emails: EmailSummary[] | undefined;
/** Email metadata derived from the sample events, as the Gmail sync would store it. */
function mockEmails(): EmailSummary[] {
  return (emails ??= db()
    .events.filter((e) => e.source === 'EMAIL')
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 60)
    .map((e) => {
      const app = db().applications.find((a) => a.id === e.applicationId);
      const domain = app?.company.domain ?? 'example.com';
      return {
        id: e.id,
        fromName: app ? `${app.company.name} Talent` : null,
        fromEmail: `careers@${domain}`,
        subject: e.summary ?? 'Actualización de tu candidatura',
        receivedAt: e.occurredAt,
        processingStatus: 'PROCESSED' as const,
        category: 'APPLICATION_CONFIRMATION' as const,
        prefilterReason: 'subject:candidatura',
        applicationId: e.applicationId,
        applicationLabel: app ? `${app.company.name} · ${app.roleTitle}` : null,
        confidence: 0.85,
        classifier: 'rules@3',
        gmailUrl: null,
      };
    }));
}

export const mockApiClient: ApiClient = {
  listApplications: (query) => delay(queryApplications(db().applications, query)),

  getApplication: (id) => delay(detail(id)),

  getDashboardStats() {
    const { applications, events } = db();
    const byId = new Map(applications.map((a) => [a.id, a]));
    const recentActivity = [...events]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 8)
      .flatMap((event) => {
        const app = byId.get(event.applicationId);
        return app
          ? [{ event, application: { id: app.id, roleTitle: app.roleTitle, company: app.company } }]
          : [];
      });

    return delay({
      summary: computeSummary(applications, events),
      timeline: computeWeeklyTimeline(applications),
      statusDistribution: computeStatusDistribution(applications),
      sourceDistribution: computeSourceDistribution(applications),
      funnel: computeFunnel(applications, events),
      recentActivity,
    });
  },

  createApplication(input) {
    const id = newId();
    db().applications.push({
      id,
      company: { id: newId(), name: input.companyName, domain: null },
      roleTitle: input.roleTitle,
      location: input.location,
      workMode: input.workMode,
      salary: input.salary,
      source: input.source,
      jobUrl: input.jobUrl,
      status: input.status,
      appliedAt: input.appliedAt,
      lastActivityAt: input.appliedAt,
      needsReview: false,
      notes: input.notes,
    });
    pushEvent({
      applicationId: id,
      type: 'APPLIED',
      fromStatus: null,
      toStatus: 'APPLIED',
      occurredAt: input.appliedAt,
      source: 'MANUAL',
      summary: null,
    });
    return delay(mustGet(id));
  },

  updateApplication(id, input) {
    const app = db().applications.find((a) => a.id === id);
    if (!app) throw new Error('Application not found');
    const { companyName, ...rest } = input;
    Object.assign(app, rest);
    if (companyName) app.company = { ...app.company, name: companyName };
    return delay(mustGet(id));
  },

  changeStatus(id, input) {
    const app = db().applications.find((a) => a.id === id);
    if (!app) throw new Error('Application not found');
    const now = new Date().toISOString();
    pushEvent({
      applicationId: id,
      type: 'STATUS_CHANGED',
      fromStatus: app.status,
      toStatus: input.status,
      occurredAt: now,
      source: 'MANUAL',
      summary: input.note ?? null,
    });
    app.status = input.status;
    app.lastActivityAt = now;
    return delay(mustGet(id));
  },

  addNote: (id, input) =>
    delay(
      pushEvent({
        applicationId: id,
        type: 'NOTE',
        fromStatus: null,
        toStatus: null,
        occurredAt: new Date().toISOString(),
        source: 'MANUAL',
        summary: input.text,
      }),
    ),

  getCurrentUser: () =>
    delay({ id: 'mock-user', email: 'demo@example.com', name: 'Usuario demo', avatarUrl: null }),

  logout: () => delay(undefined),

  getGmailStatus: () =>
    delay({
      connected: true as const,
      googleEmail: 'demo@gmail.com',
      status: 'ACTIVE' as const,
      connectedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      lastSyncedAt: new Date(Date.now() - 3_600_000).toISOString(),
      initialSyncCompleted: true,
      syncWindowDays: 180,
      counts: { candidates: mockEmails().length, pending: 0, needsReview: 3, skipped: 312 },
      lastRun: null,
      lastAutomaticSyncAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    }),

  getAiStatus: () =>
    delay({
      enabled: true,
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      promptVersion: 'prompt-v2',
      monthlyBudgetUsd: 1,
      spentThisMonthUsd: 0.0132,
      callsThisMonth: 9,
      budgetExceeded: false,
    }),

  runSync: () =>
    delay({
      hasMore: false,
      processing: { processed: 0, needsReview: 0, failed: 0, remaining: 0 },
      run: {
        id: 'mock-run',
        type: 'INCREMENTAL' as const,
        trigger: 'USER' as const,
        status: 'SUCCESS' as const,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        messagesListed: 0,
        candidates: 0,
        skipped: 0,
        failed: 0,
        errorCode: null,
      },
    }),

  disconnectGmail: () => delay(undefined),

  deleteAccount: () => delay(undefined),

  resolveEmail: () => delay(undefined),

  reprocessEmails: () => delay({ emailsReset: mockEmails().length, applicationsRemoved: 0 }),

  listEmails: (query) => {
    const all = mockEmails().filter(
      (e) => !query.category?.length || (e.category && query.category.includes(e.category)),
    );
    const start = (query.page - 1) * query.pageSize;
    return delay({
      items: all.slice(start, start + query.pageSize),
      total: all.length,
      page: query.page,
      pageSize: query.pageSize,
    });
  },

  deleteApplication(id) {
    const data = db();
    data.applications = data.applications.filter((a) => a.id !== id);
    data.events = data.events.filter((e) => e.applicationId !== id);
    return delay(undefined);
  },
};
