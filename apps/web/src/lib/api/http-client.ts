import {
  aiStatusSchema,
  applicationDetailSchema,
  applicationEventSchema,
  applicationSchema,
  currentUserSchema,
  dashboardStatsSchema,
  emailSummarySchema,
  gmailStatusSchema,
  reprocessResultSchema,
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

/** Fired while the API is waking up (free hosts sleep when idle); the UI shows a notice. */
export const SERVER_WAKING_EVENT = 'jat:server-waking';
/** Gateway errors while a sleeping instance boots (30–60 s on Render Free). */
const WAKING_STATUSES = new Set([502, 503, 504]);
const WAKE_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads (GET) are retried while the API wakes up; writes are not, since the first attempt
 * may have reached the server.
 */
async function fetchWithWakeRetry(url: string, init: RequestInit): Promise<Response> {
  const idempotent = !init.method || init.method === 'GET';
  for (let attempt = 0; ; attempt++) {
    let response: Response | null = null;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (!idempotent || attempt >= WAKE_RETRY_DELAYS_MS.length) throw error;
    }
    if (response && (!idempotent || !WAKING_STATUSES.has(response.status))) return response;
    if (attempt >= WAKE_RETRY_DELAYS_MS.length) return response as Response;
    if (attempt === 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SERVER_WAKING_EVENT));
    }
    await sleep(WAKE_RETRY_DELAYS_MS[attempt]!);
  }
}

async function request<T extends z.ZodType>(
  path: string,
  schema: T | null,
  init: RequestInit = {},
): Promise<z.infer<T>> {
  const response = await fetchWithWakeRetry(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      // Required by the API's CSRF guard on state-changing requests.
      'X-Requested-With': 'fetch',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'same-origin',
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    // Session missing, expired or revoked: back to the login page. A full navigation (not
    // the router) on purpose: this runs outside React and must drop all in-memory state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/login?error=session');
    throw new ApiError(401, 'Sesión caducada');
  }

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
  getAiStatus: () => request('/ai/status', aiStatusSchema),
  async deleteAccount() {
    await request('/account', null, { method: 'DELETE' });
  },

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

  async resolveEmail(id, input) {
    await request(`/emails/${encodeURIComponent(id)}/resolve`, null, {
      method: 'POST',
      ...json(input),
    });
  },

  reprocessEmails: () => request('/emails/reprocess', reprocessResultSchema, { method: 'POST' }),

  async deleteApplication(id) {
    await request(`/applications/${encodeURIComponent(id)}`, null, { method: 'DELETE' });
  },
};
