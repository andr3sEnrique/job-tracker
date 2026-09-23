'use client';

import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  WORK_MODES,
  type ListApplicationsQuery,
} from '@jat/shared';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { SOURCE_LABELS, STATUS_LABELS, WORK_MODE_LABELS } from '@/lib/labels';
import { MultiSelectFilter } from './multi-select-filter';

export function ApplicationsFilters({
  query,
  onChange,
}: {
  query: ListApplicationsQuery;
  onChange: (patch: Partial<ListApplicationsQuery>) => void;
}) {
  const [search, setSearch] = useState(query.q ?? '');
  const debouncedSearch = useDebouncedValue(search);

  // Push the debounced search term to the URL.
  useEffect(() => {
    if ((debouncedSearch || undefined) !== query.q) onChange({ q: debouncedSearch || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced term
  }, [debouncedSearch]);

  const hasFilters = Boolean(
    query.q || query.status || query.source || query.workMode || query.activeOnly,
  );

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative lg:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa, puesto o ubicación…"
          aria-label="Buscar candidaturas"
          className="h-8 pl-8"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Estado"
          options={APPLICATION_STATUSES}
          labels={STATUS_LABELS}
          selected={query.status}
          onChange={(status) => onChange({ status })}
        />
        <MultiSelectFilter
          label="Fuente"
          options={APPLICATION_SOURCES}
          labels={SOURCE_LABELS}
          selected={query.source}
          onChange={(source) => onChange({ source })}
        />
        <MultiSelectFilter
          label="Modalidad"
          options={WORK_MODES}
          labels={WORK_MODE_LABELS}
          selected={query.workMode}
          onChange={(workMode) => onChange({ workMode })}
        />
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            id="active-only"
            checked={query.activeOnly ?? false}
            onCheckedChange={(checked) => onChange({ activeOnly: checked === true || undefined })}
          />
          <Label htmlFor="active-only" className="text-sm font-normal">
            Solo activas
          </Label>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              onChange({
                q: undefined,
                status: undefined,
                source: undefined,
                workMode: undefined,
                activeOnly: undefined,
              });
            }}
          >
            Limpiar filtros
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
