import type { Metadata } from 'next';
import { EmailsView } from '@/components/emails/emails-view';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Emails' };

export default function EmailsPage() {
  return (
    <>
      <PageHeader
        title="Emails"
        description="Emails de tu búsqueda de empleo detectados en Gmail. La clasificación automática llega en la fase 5."
      />
      <EmailsView />
    </>
  );
}
