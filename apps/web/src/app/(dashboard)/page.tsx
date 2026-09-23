import type { Metadata } from 'next';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Resumen' };

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Resumen" description="Estado general de tu búsqueda de empleo." />
      <DashboardOverview />
    </>
  );
}
