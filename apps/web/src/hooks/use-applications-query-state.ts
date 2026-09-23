'use client';

import type { ListApplicationsQuery } from '@jat/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  parseApplicationsSearchParams,
  serializeApplicationsQuery,
} from '@/lib/applications-search-params';

/** Filters, sorting and pagination live in the URL so views can be reloaded and shared. */
export function useApplicationsQueryState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = useMemo(
    () => parseApplicationsSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setQuery = useCallback(
    (patch: Partial<ListApplicationsQuery>) => {
      // Any change other than paging sends you back to page 1.
      const next = { ...query, ...patch, page: patch.page ?? 1 };
      const qs = serializeApplicationsQuery(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [query, router, pathname],
  );

  return [query, setQuery] as const;
}
