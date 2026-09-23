import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RecentActivityItem } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { EVENT_LABELS } from '@/lib/labels';

export function RecentActivity({ items }: { items?: RecentActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
        <CardDescription>Últimos eventos en tus candidaturas</CardDescription>
      </CardHeader>
      <CardContent>
        {items ? (
          <ul className="divide-y">
            {items.map(({ event, application }) => (
              <li key={event.id} className="py-2.5 first:pt-0 last:pb-0">
                <Link
                  href={`/applications/${application.id}`}
                  className="group flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:underline">
                      {application.company.name}
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        · {application.roleTitle}
                      </span>
                    </p>
                    <p className="text-muted-foreground">{EVENT_LABELS[event.type]}</p>
                  </div>
                  <time
                    dateTime={event.occurredAt}
                    className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
                  >
                    {formatRelative(event.occurredAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
