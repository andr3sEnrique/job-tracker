import type { StatsSummary } from '@jat/shared';
import { Activity, Briefcase, CalendarCheck, Trophy, XCircle, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const KPIS: { key: keyof StatsSummary; label: string; icon: LucideIcon; hint: string }[] = [
  { key: 'total', label: 'Total', icon: Briefcase, hint: 'Candidaturas registradas' },
  { key: 'active', label: 'Activas', icon: Activity, hint: 'Sin respuesta final' },
  {
    key: 'interviews',
    label: 'Entrevistas',
    icon: CalendarCheck,
    hint: 'Con al menos una entrevista',
  },
  { key: 'offers', label: 'Ofertas', icon: Trophy, hint: 'Ofertas recibidas' },
  { key: 'rejected', label: 'Rechazadas', icon: XCircle, hint: 'Cerradas con rechazo' },
];

export function KpiCards({ summary }: { summary?: StatsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
      {KPIS.map(({ key, label, icon: Icon, hint }) => (
        <Card key={key} className="gap-2 py-4 last:col-span-2 md:last:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent className="px-4">
            {summary ? (
              <p className="text-3xl font-semibold tabular-nums">{summary[key]}</p>
            ) : (
              <Skeleton className="h-9 w-16" />
            )}
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
