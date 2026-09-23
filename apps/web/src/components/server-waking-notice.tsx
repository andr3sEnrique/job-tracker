'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { SERVER_WAKING_EVENT } from '@/lib/api/http-client';

/**
 * The free API host sleeps when idle and takes up to a minute to wake: say so instead of
 * leaving the user staring at skeletons.
 */
export function ServerWakingNotice() {
  useEffect(() => {
    const onWaking = () =>
      toast.loading('Despertando el servidor…', {
        id: 'server-waking',
        description: 'Tras un rato sin uso puede tardar hasta un minuto.',
        duration: 20_000,
      });
    window.addEventListener(SERVER_WAKING_EVENT, onWaking);
    return () => window.removeEventListener(SERVER_WAKING_EVENT, onWaking);
  }, []);
  return null;
}
