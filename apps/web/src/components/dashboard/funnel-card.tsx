import type { Funnel } from '@jat/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function conversionRate(part: number, whole: number): string {
  if (whole === 0) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

export function FunnelCard({ funnel }: { funnel?: Funnel }) {
  const steps = funnel
    ? [
        { label: 'Aplicadas', value: funnel.applied, rate: null },
        {
          label: 'Con entrevista',
          value: funnel.interviewed,
          rate: conversionRate(funnel.interviewed, funnel.applied),
        },
        {
          label: 'Con oferta',
          value: funnel.offered,
          rate: conversionRate(funnel.offered, funnel.interviewed),
        },
      ]
    : null;
  const max = funnel?.applied || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embudo</CardTitle>
        <CardDescription>Conversión entre etapas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps
          ? steps.map((step) => (
              <div key={step.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{step.label}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{step.value}</span>
                    {step.rate && (
                      <span className="ml-2 text-xs text-muted-foreground">{step.rate}</span>
                    )}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-chart-1"
                    style={{ width: `${Math.max((step.value / max) * 100, step.value ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            ))
          : Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </CardContent>
    </Card>
  );
}
