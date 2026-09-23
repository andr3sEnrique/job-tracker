'use client';

import type {
  AddNoteInput,
  ChangeStatusInput,
  CreateApplicationInput,
  ListApplicationsQuery,
  ListEmailsQuery,
  ResolveEmailInput,
  UpdateApplicationInput,
} from '@jat/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '.';

export const queryKeys = {
  applications: ['applications'] as const,
  applicationList: (query: ListApplicationsQuery) => ['applications', 'list', query] as const,
  application: (id: string) => ['applications', 'detail', id] as const,
  dashboard: ['stats', 'dashboard'] as const,
  me: ['auth', 'me'] as const,
  gmailStatus: ['gmail', 'status'] as const,
  aiStatus: ['ai', 'status'] as const,
  emails: (query: ListEmailsQuery) => ['emails', query] as const,
};

export function useGmailStatus() {
  return useQuery({ queryKey: queryKeys.gmailStatus, queryFn: () => api.getGmailStatus() });
}

export function useAiStatus() {
  return useQuery({ queryKey: queryKeys.aiStatus, queryFn: () => api.getAiStatus() });
}

export function useEmails(query: ListEmailsQuery) {
  return useQuery({
    queryKey: queryKeys.emails(query),
    queryFn: () => api.listEmails(query),
    placeholderData: keepPreviousData,
  });
}

/** Review decisions and reprocessing change emails, applications and stats alike. */
function useInvalidateMailData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['emails', 'gmail', 'applications', 'stats'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useResolveEmail() {
  const invalidate = useInvalidateMailData();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResolveEmailInput }) =>
      api.resolveEmail(id, input),
    onSuccess: invalidate,
  });
}

export function useReprocessEmails() {
  const invalidate = useInvalidateMailData();
  return useMutation({ mutationFn: () => api.reprocessEmails(), onSuccess: invalidate });
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.disconnectGmail(),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gmail'] }),
        queryClient.invalidateQueries({ queryKey: ['emails'] }),
      ]),
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.getCurrentUser(),
    staleTime: Infinity,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => {
      queryClient.clear(); // drop every cached response that belonged to this session
      router.replace('/login');
    },
  });
}

export function useApplications(query: ListApplicationsQuery) {
  return useQuery({
    queryKey: queryKeys.applicationList(query),
    queryFn: () => api.listApplications(query),
    placeholderData: keepPreviousData,
  });
}

export function useApplication(id: string) {
  return useQuery({ queryKey: queryKeys.application(id), queryFn: () => api.getApplication(id) });
}

export function useDashboardStats() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.getDashboardStats() });
}

/** Any write can change lists, the detail and the stats: refresh them all. */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.applications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
}

export function useCreateApplication() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CreateApplicationInput) => api.createApplication(input),
    onSuccess: invalidate,
  });
}

export function useUpdateApplication(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: UpdateApplicationInput) => api.updateApplication(id, input),
    onSuccess: invalidate,
  });
}

export function useChangeStatus(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: ChangeStatusInput) => api.changeStatus(id, input),
    onSuccess: invalidate,
  });
}

export function useAddNote(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: AddNoteInput) => api.addNote(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteApplication() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteApplication(id),
    onSuccess: invalidate,
  });
}
