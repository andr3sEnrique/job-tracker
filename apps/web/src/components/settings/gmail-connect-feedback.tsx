'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

const REASONS: Record<string, string> = {
  state: 'La solicitud caducó o no es válida. Vuelve a intentarlo.',
  oauth: 'Google no ha podido completar la autorización.',
  scope: 'Necesitamos el permiso de lectura de Gmail. Marca la casilla en la pantalla de Google.',
  'no-refresh-token': 'Google no ha emitido un token de acceso duradero. Vuelve a intentarlo.',
  cancelled: 'Has cancelado la conexión con Gmail.',
};

/** Turns the ?gmail=… result of the OAuth redirect into a toast, then cleans the URL. */
export function GmailConnectFeedback() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const result = params.get('gmail');
    if (!result) return;
    if (result === 'connected')
      toast.success('Gmail conectado. Ya puedes lanzar la primera sincronización.');
    else toast.error(REASONS[params.get('reason') ?? ''] ?? 'No se pudo conectar Gmail.');
    router.replace(pathname, { scroll: false });
  }, [params, router, pathname]);

  return null;
}
