'use client';

import type { Application, ListApplicationsQuery } from '@jat/shared';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SOURCE_LABELS, WORK_MODE_LABELS } from '@/lib/labels';
import { StatusBadge } from './status-badge';

type SortBy = ListApplicationsQuery['sortBy'];

/** Secondary columns hide on narrower screens (the card list takes over below md). */
const RESPONSIVE_COLUMN_CLASS: Record<string, string> = {
  source: 'hidden xl:table-cell',
  location: 'hidden lg:table-cell',
};

function SortableHeader({
  label,
  field,
  query,
  onSort,
}: {
  label: string;
  field: SortBy;
  query: ListApplicationsQuery;
  onSort: (sortBy: SortBy, sortDir: 'asc' | 'desc') => void;
}) {
  const active = query.sortBy === field;
  const Icon = !active ? ArrowUpDown : query.sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-7"
      aria-sort={active ? (query.sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
      onClick={() => onSort(field, active && query.sortDir === 'desc' ? 'asc' : 'desc')}
    >
      {label}
      <Icon className={active ? 'size-3.5' : 'size-3.5 opacity-40'} />
    </Button>
  );
}

function buildColumns(
  query: ListApplicationsQuery,
  onSort: (sortBy: SortBy, sortDir: 'asc' | 'desc') => void,
): ColumnDef<Application>[] {
  const header = (label: string, field: SortBy) => {
    const Header = () => (
      <SortableHeader label={label} field={field} query={query} onSort={onSort} />
    );
    Header.displayName = `SortableHeader(${field})`;
    return Header;
  };

  return [
    {
      id: 'company',
      header: header('Empresa / puesto', 'company'),
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/applications/${row.original.id}`}
            className="flex items-center gap-1.5 font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.company.name}
            {row.original.needsReview && (
              <TriangleAlert
                className="size-3.5 text-amber-500"
                aria-label="Pendiente de revisión"
              />
            )}
          </Link>
          <p className="truncate text-muted-foreground">{row.original.roleTitle}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: header('Estado', 'status'),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'source',
      header: 'Fuente',
      cell: ({ row }) => SOURCE_LABELS[row.original.source],
    },
    {
      id: 'location',
      header: 'Ubicación',
      cell: ({ row }) => (
        <div>
          <p>{row.original.location ?? '—'}</p>
          <p className="text-muted-foreground">{WORK_MODE_LABELS[row.original.workMode]}</p>
        </div>
      ),
    },
    {
      id: 'appliedAt',
      header: header('Aplicada', 'appliedAt'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatDate(row.original.appliedAt)}</span>
      ),
    },
    {
      id: 'lastActivityAt',
      header: header('Última actividad', 'lastActivityAt'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatRelative(row.original.lastActivityAt)}
        </span>
      ),
    },
  ];
}

export function ApplicationsTable({
  data,
  query,
  onSort,
}: {
  data: Application[];
  query: ListApplicationsQuery;
  onSort: (sortBy: SortBy, sortDir: 'asc' | 'desc') => void;
}) {
  const router = useRouter();
  // Sorting and pagination happen "server-side" (in the API client), so the table is display-only.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is not compiler-aware
  const table = useReactTable({
    data,
    columns: buildColumns(query, onSort),
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((h) => (
                <TableHead key={h.id} className={RESPONSIVE_COLUMN_CLASS[h.column.id]}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => router.push(`/applications/${row.original.id}`)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn('max-w-72 py-2.5', RESPONSIVE_COLUMN_CLASS[cell.column.id])}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
