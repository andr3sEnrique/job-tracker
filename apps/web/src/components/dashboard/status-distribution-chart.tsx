'use client';

import type { ApplicationStatus, StatusCount } from '@jat/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_COLOR_VAR, STATUS_LABELS } from '@/lib/labels';

const config = {
  count: { label: 'Candidaturas' },
} satisfies ChartConfig;

/** The applications list, filtered by one status (the filters live in the URL). */
export const applicationsWithStatus = (status: ApplicationStatus) =>
  `/applications?status=${status}`;

/** Horizontal bars read better than a donut for 8 categories. Each bar opens its list. */
export function StatusDistributionChart({ data }: { data?: StatusCount[] }) {
  const router = useRouter();
  const rows = data
    ?.filter((d) => d.count > 0)
    .map((d) => ({ ...d, label: STATUS_LABELS[d.status] }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución por estado</CardTitle>
        <CardDescription>
          Estado actual de cada candidatura · pulsa una barra para verlas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows ? (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 32 }}>
              <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={96} />
              <XAxis type="number" hide allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel nameKey="count" />}
              />
              <Bar dataKey="count" radius={4}>
                {rows.map((row) => (
                  <Cell
                    key={row.status}
                    fill={STATUS_COLOR_VAR[row.status]}
                    className="cursor-pointer"
                    onClick={() => router.push(applicationsWithStatus(row.status))}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : null}
        {rows ? (
          // The same links for keyboard and screen-reader users (the SVG bars are not focusable).
          <ul className="sr-only">
            {rows.map((row) => (
              <li key={row.status}>
                <Link href={applicationsWithStatus(row.status)}>
                  {row.label}: {row.count}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </CardContent>
    </Card>
  );
}
