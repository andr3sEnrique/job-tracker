import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { AiCard } from '@/components/settings/ai-card';
import { GmailCard } from '@/components/settings/gmail-card';
import { GmailConnectFeedback } from '@/components/settings/gmail-connect-feedback';

export const metadata: Metadata = { title: 'Ajustes' };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Ajustes"
        description="Conexión con Gmail, sincronización y clasificación."
      />
      <Suspense>
        <GmailConnectFeedback />
      </Suspense>
      <div className="flex max-w-2xl flex-col gap-6">
        <GmailCard />
        <AiCard />
      </div>
    </>
  );
}
