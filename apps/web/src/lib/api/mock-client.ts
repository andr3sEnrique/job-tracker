import type { ApiClient } from './types';
import { generateMockDataset } from '../mocks/generate';
import { queryApplications } from '../mocks/query';
import {
  computeFunnel,
  computeSourceDistribution,
  computeStatusDistribution,
  computeSummary,
  computeWeeklyTimeline,
} from '../mocks/stats';

const LATENCY_MS = 250;
const delay = <T>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

let dataset: ReturnType<typeof generateMockDataset> | undefined;
const getDataset = () => (dataset ??= generateMockDataset());

export const mockApiClient: ApiClient = {
  listApplications(query) {
    return delay(queryApplications(getDataset().applications, query));
  },

  getApplication(id) {
    const { applications, events } = getDataset();
    const application = applications.find((a) => a.id === id);
    if (!application) return delay(null);
    const timeline = events
      .filter((e) => e.applicationId === id)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    return delay({ ...application, events: timeline });
  },

  getDashboardStats() {
    const { applications, events } = getDataset();
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
};
