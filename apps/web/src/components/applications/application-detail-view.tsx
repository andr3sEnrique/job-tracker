'use client';

import { ArrowLeft, ExternalLink, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { QueryError } from '@/components/query-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApplication } from '@/lib/api/queries';
import { formatDate, formatRelative, formatSalary } from '@/lib/format';
import { SOURCE_LABELS, WORK_MODE_LABELS } from '@/lib/labels';
import { EventTimeline } from './event-timeline';
import { StatusBadge } from './status-badge';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href="/applications">
        <ArrowLeft />
        Candidaturas
      </Link>
    </Button>
  );
}

export function ApplicationDetailView({ id }: { id: string }) {
  const { data: app, isPending, isError, refetch } = useApplication(id);

  if (isError) return <QueryError onRetry={() => refetch()} />;

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-2/3" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-1" />
          <Skeleton className="h-72 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-muted-foreground">
          No existe ninguna candidatura con ese identificador.
        </p>
      </div>
    );
  }

  const salary = formatSalary(app.salary);

  return (
    <div className="space-y-6">
      <BackLink />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{app.roleTitle}</h1>
          <p className="text-muted-foreground">
            {app.company.name}
            {app.company.domain && <span> · {app.company.domain}</span>}
          </p>
        </div>
        <StatusBadge status={app.status} className="self-start text-sm" />
      </div>

      {app.needsReview && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
          <p>
            Esta candidatura se creó automáticamente con poca confianza. Revisa que los datos sean
            correctos.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Ubicación">{app.location ?? '—'}</Field>
                <Field label="Modalidad">{WORK_MODE_LABELS[app.workMode]}</Field>
                <Field label="Fuente">{SOURCE_LABELS[app.source]}</Field>
                <Field label="Salario">{salary ?? '—'}</Field>
                <Field label="Aplicada">{formatDate(app.appliedAt)}</Field>
                <Field label="Última actividad">{formatRelative(app.lastActivityAt)}</Field>
                {app.jobUrl && (
                  <div className="col-span-2">
                    <Field label="Oferta">
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
                      >
                        {app.jobUrl}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </Field>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {app.notes ?? 'Sin notas.'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>{app.events.length} eventos</CardDescription>
          </CardHeader>
          <CardContent>
            <EventTimeline events={app.events} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
