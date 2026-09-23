'use client';

import type { SyncResult, SyncRun } from '@jat/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';

/** Safety net: a real mailbox needs a handful of chunks, never hundreds. */
const MAX_CHUNKS = 200;

/**
 * Runs a sync as a sequence of short API calls (each processes one chunk and reports
 * `hasMore`), so it survives request timeouts on free hosting and can show progress.
 */
export function useMailboxSync() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Pick<SyncResult, 'run' | 'processing'> | null>(null);
  const cancelled = useRef(false);

  const start = useCallback(async (): Promise<SyncRun | null> => {
    setRunning(true);
    cancelled.current = false;
    let last: SyncRun | null = null;
    try {
      for (let i = 0; i < MAX_CHUNKS && !cancelled.current; i++) {
        const { run, processing, hasMore } = await api.runSync();
        last = run;
        setProgress({ run, processing });
        if (!hasMore) break;
      }
      return last;
    } finally {
      setRunning(false);
      await Promise.all(
        ['gmail', 'emails', 'applications', 'stats'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    }
  }, [queryClient]);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  return { start, cancel, running, progress };
}
