import {
  applicationDetailSchema,
  applicationEventSchema,
  applicationSchema,
  currentUserSchema,
  dashboardStatsSchema,
  emailSummarySchema,
  gmailStatusSchema,
  syncResultSchema,
  paginatedSchema,
  toListApplicationsParams,
} from '@jat/shared';
import type { z } from 'zod';
import type { ApiClient } from './types';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T extends z.ZodType>(
  path: string,
  schema: T | null,
  init: RequestInit = {},
): Promise<z.infer<T>> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
      issues?: { path: string; message: string }[];
    };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(response.status, message ?? response.statusText, body.issues);
  }
  if (!schema || response.status === 204) return undefined as z.infer<T>;

  // Validate at the boundary: a contract drift fails loudly here, not deep in a component.
  return schema.parse(await response.json());
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const httpApiClient: ApiClient = {
  listApplications: (query) =>
    request(
      `/applications?${new URLSearchParams(toListApplicationsParams(query))}`,
      paginatedSchema(applicationSchema),
    ),

  async getApplication(id) {
    try {
      return await request(`/applications/${encodeURIComponent(id)}`, applicationDetailSchema);
    } catch (error) {
      // Unknown or malformed ids both mean "no such application" for the UI.
      if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
      throw error;
    }
  },

  getDashboardStats: () => request('/stats/dashboard', dashboardStatsSchema),

  createApplication: (input) =>
    request('/applications', applicationDetailSchema, { method: 'POST', ...json(input) }),

  updateApplication: (id, input) =>
    request(`/applications/${encodeURIComponent(id)}`, applicationDetailSchema, {
      method: 'PATCH',
      ...json(input),
    }),

  changeStatus: (id, input) =>
    request(`/applications/${encodeURIComponent(id)}/status`, applicationDetailSchema, {
      method: 'POST',
      ...json(input),
    }),

  addNote: (id, input) =>
    request(`/applications/${encodeURIComponent(id)}/notes`, applicationEventSchema, {
      method: 'POST',
      ...json(input),
    }),

  getCurrentUser: () => request('/auth/me', currentUserSchema),

  async logout() {
    await request('/auth/logout', null, { method: 'POST' });
  },

  getGmailStatus: () => request('/gmail/status', gmailStatusSchema),

  runSync: () => request('/sync/run', syncResultSchema, { method: 'POST' }),

  async disconnectGmail() {
    await request('/gmail', null, { method: 'DELETE' });
  },

  listEmails: (query) => {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    if (query.status?.length) params.set('status', query.status.join(','));
    return request(`/emails?${params}`, paginatedSchema(emailSummarySchema));
  },

  async deleteApplication(id) {
    await request(`/applications/${encodeURIComponent(id)}`, null, { method: 'DELETE' });
  },
};
