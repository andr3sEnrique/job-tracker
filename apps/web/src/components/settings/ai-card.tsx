'use client';

import { Sparkles } from 'lucide-react';
import { QueryError } from '@/components/query-error';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiStatus } from '@/lib/api/queries';

const usd = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);

export function AiCard() {
  const { data: status, isPending, isError, refetch } = useAiStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" aria-hidden />
          Clasificación con IA
        </CardTitle>
        <CardDescription>
          Solo para los emails en los que las reglas dudan. Se envía el asunto, el dominio del
          remitente y el texto recortado, sin direcciones de email ni teléfonos. Nunca se guarda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <QueryError onRetry={() => void refetch()} />
        ) : !status.enabled ? (
          <p className="text-sm text-muted-foreground">
            Desactivada: todo se clasifica con reglas, sin salir del servidor. Se activa con{' '}
            <code className="rounded bg-muted px-1">AI_PROVIDER</code> en la configuración de la
            API.
          </p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              <span className="font-medium">{status.model}</span>{' '}
              <span className="text-muted-foreground">
                ({status.provider}, {status.promptVersion})
              </span>
            </p>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Este mes: {usd(status.spentThisMonthUsd)} de {usd(status.monthlyBudgetUsd)} ·{' '}
                  {status.callsThisMonth} llamadas
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Presupuesto mensual usado"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  (100 * status.spentThisMonthUsd) / Math.max(status.monthlyBudgetUsd, 1e-9),
                )}
              >
                <div
                  className={status.budgetExceeded ? 'h-full bg-destructive' : 'h-full bg-primary'}
                  style={{
                    width: `${Math.min(100, (100 * status.spentThisMonthUsd) / Math.max(status.monthlyBudgetUsd, 1e-9))}%`,
                  }}
                />
              </div>
            </div>
            {status.budgetExceeded && (
              <p className="text-xs text-destructive">
                Presupuesto agotado: hasta el mes que viene se usan solo reglas.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
