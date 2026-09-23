'use client';

import type { ListApplicationsQuery } from '@jat/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '.';

export const queryKeys = {
  applications: (query: ListApplicationsQuery) => ['applications', 'list', query] as const,
  application: (id: string) => ['applications', 'detail', id] as const,
  dashboard: ['stats', 'dashboard'] as const,
};

export function useApplications(query: ListApplicationsQuery) {
  return useQuery({
    queryKey: queryKeys.applications(query),
    queryFn: () => api.listApplications(query),
    placeholderData: keepPreviousData,
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: queryKeys.application(id),
    queryFn: () => api.getApplication(id),
  });
}

export function useDashboardStats() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.getDashboardStats() });
}
