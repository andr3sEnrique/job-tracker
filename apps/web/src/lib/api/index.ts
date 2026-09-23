import { mockApiClient } from './mock-client';
import type { ApiClient } from './types';

export type * from './types';

// Phase 2: switch to the HTTP client (same interface) once the NestJS API exists.
export const api: ApiClient = mockApiClient;
