import { httpApiClient } from './http-client';
import { mockApiClient } from './mock-client';
import type { ApiClient } from './types';

export type * from './types';
export { ApiError } from './http-client';

/** `NEXT_PUBLIC_API_MODE=mock` runs the UI without a backend (demos, UI work). */
export const API_MODE = process.env.NEXT_PUBLIC_API_MODE === 'mock' ? 'mock' : 'http';

export const api: ApiClient = API_MODE === 'mock' ? mockApiClient : httpApiClient;
