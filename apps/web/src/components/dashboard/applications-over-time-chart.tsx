'use client';

import type { TimelinePoint } from '@jat/shared';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

const config = {
  applications: { label: 'Candidaturas', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const weekLabel = (period: string) =>
  format(new Date(`${period}T00:00:00`), 'd MMM', { locale: es });

export function ApplicationsOverTimeChart({ data }: { data?: TimelinePoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidaturas por semana</CardTitle>
        <CardDescription>Últimas 12 semanas</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={data} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
                tickFormatter={weekLabel}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => `Semana del ${weekLabel(String(value))}`}
                  />
                }
              />
              <Bar dataKey="applications" fill="var(--color-applications)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </CardContent>
    </Card>
  );
}
