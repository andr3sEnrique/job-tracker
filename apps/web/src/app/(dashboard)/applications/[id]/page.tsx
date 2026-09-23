import type { Metadata } from 'next';
import { ApplicationDetailView } from '@/components/applications/application-detail-view';

export const metadata: Metadata = { title: 'Candidatura' };

export default async function ApplicationDetailPage({ params }: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationDetailView id={id} />;
}
