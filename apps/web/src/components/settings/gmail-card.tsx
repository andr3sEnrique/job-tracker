'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Unplug,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { QueryError } from '@/components/query-error';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMailboxSync } from '@/hooks/use-mailbox-sync';
import { ApiError } from '@/lib/api';
import { useDisconnectGmail, useGmailStatus, useReprocessEmails } from '@/lib/api/queries';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative } from '@/lib/format';

const SYNC_ERRORS: Record<string, string> = {
  auth: 'Google ha revocado el acceso. Vuelve a conectar Gmail.',
  provider_unavailable: 'Gmail no está disponible ahora mismo. Se reanudará donde se quedó.',
  internal: 'La sincronización ha fallado. Inténtalo de nuevo.',
};

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const content = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border p-3 hover:bg-muted">
      {content}
    </Link>
  ) : (
    <div className="rounded-lg border p-3">{content}</div>
  );
}

export function GmailCard() {
  const { data: status, isPending, isError, refetch } = useGmailStatus();
  const sync = useMailboxSync();
  const disconnect = useDisconnectGmail();
  const reprocess = useReprocessEmails();

  async function runSync() {
    try {
      const run = await sync.start();
      if (run?.status === 'SUCCESS') toast.success('Sincronización completada');
      else if (run?.errorCode) toast.error(SYNC_ERRORS[run.errorCode] ?? SYNC_ERRORS.internal);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.info('Ya hay una sincronización en curso.');
      } else {
        toast.error(errorMessage(error));
      }
    }
  }

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" aria-hidden />
          Gmail
        </CardTitle>
        <CardDescription>
          Acceso de solo lectura. Solo se guardan metadatos (remitente, asunto y fecha) de los
          emails relacionados con tu búsqueda de empleo; nunca el contenido.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : !status.connected ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">No hay ningún buzón conectado.</p>
            <Button asChild>
              <a href="/api/v1/gmail/connect">Conectar Gmail</a>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                {status.status === 'ACTIVE' ? (
                  <CheckCircle2 className="size-4 text-status-offer" aria-hidden />
                ) : (
                  <AlertTriangle className="size-4 text-amber-500" aria-hidden />
                )}
                <span className="font-medium">{status.googleEmail}</span>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>
                  {status.lastSyncedAt
                    ? `Última sincronización ${formatRelative(status.lastSyncedAt)}`
                    : 'Aún no se ha sincronizado'}
                </p>
                <p>
                  {status.lastAutomaticSyncAt
                    ? `Automática: ${formatRelative(status.lastAutomaticSyncAt)}`
                    : 'Sin sincronizaciones automáticas aún'}
                </p>
              </div>
            </div>

            {status.status !== 'ACTIVE' && (
              <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p>Google ha revocado o caducado el acceso. Reconecta para seguir sincronizando.</p>
                <Button size="sm" asChild>
                  <a href="/api/v1/gmail/connect">Reconectar</a>
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Relevantes" value={status.counts.candidates} />
              <Stat
                label="Por revisar"
                value={status.counts.needsReview}
                href={status.counts.needsReview ? '/emails?tab=review' : undefined}
              />
              <Stat label="Por clasificar" value={status.counts.pending} />
              <Stat label="Descartados" value={status.counts.skipped} />
            </div>

            {sync.running && (
              <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {!sync.progress
                  ? 'Iniciando…'
                  : sync.progress.processing
                    ? `Clasificando… quedan ${sync.progress.processing.remaining}`
                    : `Revisados ${sync.progress.run.messagesListed} emails · ${sync.progress.run.candidates} relevantes`}
              </div>
            )}

            {!status.initialSyncCompleted && !sync.running && status.status === 'ACTIVE' && (
              <p className="text-sm text-muted-foreground">
                La primera sincronización revisa los últimos {status.syncWindowDays} días.
                {status.lastRun &&
                  status.lastRun.status !== 'SUCCESS' &&
                  ' Continuará donde se quedó.'}
              </p>
            )}

            {status.lastRun?.errorCode && !sync.running && (
              <p className="text-sm text-destructive">
                {SYNC_ERRORS[status.lastRun.errorCode] ?? SYNC_ERRORS.internal}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button onClick={runSync} disabled={sync.running || status.status !== 'ACTIVE'}>
                <RefreshCw className={sync.running ? 'animate-spin' : undefined} />
                {status.initialSyncCompleted
                  ? 'Sincronizar ahora'
                  : 'Iniciar primera sincronización'}
              </Button>

              <div className="flex flex-wrap items-center gap-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sync.running || reprocess.isPending}
                    >
                      <RotateCcw />
                      Reprocesar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Reprocesar todos los emails?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se borrarán las candidaturas y eventos creados automáticamente y los emails
                        se volverán a clasificar con las reglas actuales. Lo que hayas creado o
                        editado a mano se conserva.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          reprocess.mutate(undefined, {
                            onSuccess: async (r) => {
                              toast.success(`${r.emailsReset} emails en cola. Clasificando…`);
                              await runSync();
                            },
                            onError: (error) => toast.error(errorMessage(error)),
                          })
                        }
                      >
                        Reprocesar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={sync.running}>
                      <Unplug />
                      Desconectar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Desconectar Gmail?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se revocará el acceso en Google y se borrarán los metadatos de los{' '}
                        {status.counts.candidates + status.counts.skipped} emails sincronizados. Tus
                        candidaturas y su historial se conservan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() =>
                          disconnect.mutate(undefined, {
                            onSuccess: () => toast.success('Gmail desconectado y datos borrados'),
                            onError: (error) => toast.error(errorMessage(error)),
                          })
                        }
                      >
                        Desconectar y borrar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Conectado el {formatDateTime(status.connectedAt)}.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
