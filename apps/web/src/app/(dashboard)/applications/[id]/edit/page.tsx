import type { Metadata } from 'next';
import { EditApplicationView } from '@/components/applications/edit-application-view';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Editar candidatura' };

export default async function EditApplicationPage({
  params,
}: PageProps<'/applications/[id]/edit'>) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar candidatura"
        description="Los campos que edites a mano no se sobrescribirán con datos extraídos de emails."
      />
      <EditApplicationView id={id} />
    </div>
  );
}
