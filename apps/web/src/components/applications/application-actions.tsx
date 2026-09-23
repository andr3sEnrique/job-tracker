'use client';

import { APPLICATION_STATUSES, type ApplicationStatus } from '@jat/shared';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useChangeStatus, useDeleteApplication } from '@/lib/api/queries';
import { errorMessage } from '@/lib/errors';
import { STATUS_LABELS } from '@/lib/labels';

export function ApplicationActions({
  id,
  status,
  label,
}: {
  id: string;
  status: ApplicationStatus;
  label: string;
}) {
  const router = useRouter();
  const changeStatus = useChangeStatus(id);
  const remove = useDeleteApplication();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Select
        value={status}
        disabled={changeStatus.isPending}
        onValueChange={(next) =>
          changeStatus.mutate(
            { status: next as ApplicationStatus },
            {
              onSuccess: () =>
                toast.success(`Estado cambiado a «${STATUS_LABELS[next as ApplicationStatus]}»`),
              onError: (error) => toast.error(errorMessage(error)),
            },
          )
        }
      >
        <SelectTrigger size="sm" aria-label="Cambiar estado" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {APPLICATION_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" asChild>
        <Link href={`/applications/${id}/edit`}>
          <Pencil />
          Editar
        </Link>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 />
            Eliminar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta candidatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán «{label}» y todo su historial. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                remove.mutate(id, {
                  onSuccess: () => {
                    toast.success('Candidatura eliminada');
                    router.push('/applications');
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
