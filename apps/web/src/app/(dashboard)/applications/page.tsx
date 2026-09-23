import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApplicationsView } from '@/components/applications/applications-view';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Candidaturas' };

export default function ApplicationsPage() {
  return (
    <>
      <PageHeader
        title="Candidaturas"
        description="Todas tus candidaturas, con búsqueda y filtros."
      />
      {/* useSearchParams() needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ApplicationsView />
      </Suspense>
    </>
  );
}
