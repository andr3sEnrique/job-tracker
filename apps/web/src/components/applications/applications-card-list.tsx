import type { Application } from '@jat/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { SOURCE_LABELS } from '@/lib/labels';
import { StatusBadge } from './status-badge';

/** Mobile replacement for the table. */
export function ApplicationsCardList({ data }: { data: Application[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {data.map((app) => (
        <li key={app.id}>
          <Link
            href={`/applications/${app.id}`}
            className="flex items-center gap-3 p-3 active:bg-muted/60"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{app.company.name}</p>
                <StatusBadge status={app.status} />
              </div>
              <p className="truncate text-sm">{app.roleTitle}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(app.appliedAt)} · {SOURCE_LABELS[app.source]}
                {app.location ? ` · ${app.location}` : ''}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
