import type {
  Application,
  ApplicationDetail,
  ApplicationEvent,
  Funnel,
  ListApplicationsQuery,
  Paginated,
  SourceCount,
  StatsSummary,
  StatusCount,
  TimelinePoint,
} from '@jat/shared';

export interface RecentActivityItem {
  event: ApplicationEvent;
  application: Pick<Application, 'id' | 'roleTitle' | 'company'>;
}

export interface DashboardStats {
  summary: StatsSummary;
  timeline: TimelinePoint[];
  statusDistribution: StatusCount[];
  sourceDistribution: SourceCount[];
  funnel: Funnel;
  recentActivity: RecentActivityItem[];
}

/**
 * Everything the UI needs from the backend. Phase 1 ships a mock implementation;
 * Phase 2 adds an HTTP implementation against the NestJS API with the same shape.
 */
export interface ApiClient {
  listApplications(query: ListApplicationsQuery): Promise<Paginated<Application>>;
  getApplication(id: string): Promise<ApplicationDetail | null>;
  getDashboardStats(): Promise<DashboardStats>;
}
