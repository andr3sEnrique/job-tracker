import type { SourceCount } from '@jat/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SOURCE_LABELS } from '@/lib/labels';

export function SourceCard({ data }: { data?: SourceCount[] }) {
  const max = Math.max(1, ...(data ?? []).map((s) => s.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por fuente</CardTitle>
        <CardDescription>Dónde se originó cada candidatura</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? (
          <ul className="space-y-3">
            {data.map((s) => (
              <li key={s.source} className="space-y-1 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{SOURCE_LABELS[s.source]}</span>
                  <span className="font-medium tabular-nums">{s.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-chart-2"
                    style={{ width: `${(s.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </CardContent>
    </Card>
  );
}
