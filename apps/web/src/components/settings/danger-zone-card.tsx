'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDeleteAccount } from '@/lib/api/queries';
import { errorMessage } from '@/lib/errors';

const CONFIRMATION = 'BORRAR';

export function DangerZoneCard() {
  const deleteAccount = useDeleteAccount();
  const [typed, setTyped] = useState('');

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Borrar la cuenta</CardTitle>
        <CardDescription>
          Revoca el acceso a Gmail y elimina tu cuenta y todos tus datos: candidaturas, historial y
          emails guardados. No se puede deshacer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog onOpenChange={() => setTyped('')}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 aria-hidden />
              Borrar cuenta y datos
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar la cuenta y todos los datos?</AlertDialogTitle>
              <AlertDialogDescription>
                Escribe <strong>{CONFIRMATION}</strong> para confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label={`Escribe ${CONFIRMATION} para confirmar`}
              autoComplete="off"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={typed !== CONFIRMATION || deleteAccount.isPending}
                onClick={() =>
                  deleteAccount.mutate(undefined, {
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
              >
                Borrar definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
