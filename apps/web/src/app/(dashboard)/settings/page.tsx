import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { GmailCard } from '@/components/settings/gmail-card';
import { GmailConnectFeedback } from '@/components/settings/gmail-connect-feedback';

export const metadata: Metadata = { title: 'Ajustes' };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" description="Conexión con Gmail y sincronización." />
      <Suspense>
        <GmailConnectFeedback />
      </Suspense>
      <div className="max-w-2xl">
        <GmailCard />
      </div>
    </>
  );
}
