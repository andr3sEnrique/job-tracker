'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { ServerWakingNotice } from '@/components/server-waking-notice';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppProviders({ children, nonce }: { children: ReactNode; nonce?: string }) {
  // One QueryClient per browser session (not per render, not shared across requests on the server).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // Its anti-flicker inline script must carry the CSP nonce.
      nonce={nonce}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster richColors position="bottom-right" />
          <ServerWakingNotice />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
