import type { Metadata } from 'next';
import { NewApplicationView } from '@/components/applications/new-application-view';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Nueva candidatura' };

export default function NewApplicationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Nueva candidatura" description="Registra una candidatura a mano." />
      <NewApplicationView />
    </div>
  );
}
