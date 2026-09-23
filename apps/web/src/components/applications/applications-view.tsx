'use client';

import { SearchX } from 'lucide-react';
import { QueryError } from '@/components/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { useApplicationsQueryState } from '@/hooks/use-applications-query-state';
import { useApplications } from '@/lib/api/queries';
import { ApplicationsCardList } from './applications-card-list';
import { ApplicationsFilters } from './applications-filters';
import { ApplicationsTable } from './applications-table';
import { Pagination } from './pagination';

export function ApplicationsView() {
  const [query, setQuery] = useApplicationsQueryState();
  const { data, isPending, isError, isPlaceholderData, refetch } = useApplications(query);

  return (
    <div className="space-y-4">
      <ApplicationsFilters query={query} onChange={setQuery} />

      {isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <SearchX className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">Sin resultados</p>
          <p className="text-sm text-muted-foreground">Prueba a cambiar o limpiar los filtros.</p>
        </div>
      ) : (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="hidden md:block">
            <ApplicationsTable
              data={data.items}
              query={query}
              onSort={(sortBy, sortDir) => setQuery({ sortBy, sortDir })}
            />
          </div>
          <div className="md:hidden">
            <ApplicationsCardList data={data.items} />
          </div>
        </div>
      )}

      {data && data.total > 0 && (
        <Pagination
          page={query.page}
          pageSize={query.pageSize}
          total={data.total}
          onPageChange={(page) => setQuery({ page })}
        />
      )}
    </div>
  );
}
