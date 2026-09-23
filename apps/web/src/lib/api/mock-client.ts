import { generateSampleDataset, type Application, type ApplicationEvent } from '@jat/shared';
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

function pushEvent(event: Omit<ApplicationEvent, 'id'>): ApplicationEvent {
  const created = { ...event, id: newId() };
  db().events.push(created);
  return created;
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

  deleteApplication(id) {
    const data = db();
    data.applications = data.applications.filter((a) => a.id !== id);
    data.events = data.events.filter((e) => e.applicationId !== id);
    return delay(undefined);
  },
};
