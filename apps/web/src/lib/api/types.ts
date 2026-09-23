import type {
  AddNoteInput,
  Application,
  ApplicationDetail,
  ApplicationEvent,
  ChangeStatusInput,
  CreateApplicationInput,
  CurrentUser,
  DashboardStats,
  ListApplicationsQuery,
  Paginated,
  UpdateApplicationInput,
} from '@jat/shared';

export type { DashboardStats, RecentActivityItem } from '@jat/shared';

/**
 * Everything the UI needs from the backend. Two implementations share this shape:
 * the HTTP client (NestJS API) and an in-memory mock for demos and offline work.
 */
export interface ApiClient {
  listApplications(query: ListApplicationsQuery): Promise<Paginated<Application>>;
  getApplication(id: string): Promise<ApplicationDetail | null>;
  getDashboardStats(): Promise<DashboardStats>;
  createApplication(input: CreateApplicationInput): Promise<ApplicationDetail>;
  updateApplication(id: string, input: UpdateApplicationInput): Promise<ApplicationDetail>;
  changeStatus(id: string, input: ChangeStatusInput): Promise<ApplicationDetail>;
  addNote(id: string, input: AddNoteInput): Promise<ApplicationEvent>;
  deleteApplication(id: string): Promise<void>;
  getCurrentUser(): Promise<CurrentUser>;
  logout(): Promise<void>;
}
