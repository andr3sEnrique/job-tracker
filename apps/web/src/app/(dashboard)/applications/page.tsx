import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ApplicationsView } from '@/components/applications/applications-view';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Candidaturas' };

export default function ApplicationsPage() {
  return (
    <>
      <PageHeader
        title="Candidaturas"
        description="Todas tus candidaturas, con búsqueda y filtros."
        actions={
          <Button asChild>
            <Link href="/applications/new">
              <Plus />
              Nueva candidatura
            </Link>
          </Button>
        }
      />
      {/* useSearchParams() needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ApplicationsView />
      </Suspense>
    </>
  );
}
