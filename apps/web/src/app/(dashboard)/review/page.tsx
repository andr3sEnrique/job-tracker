import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Revisión' };

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Revisión"
        description="Emails que el clasificador no ha podido asociar con seguridad."
      />
      <ComingSoon
        icon={Inbox}
        title="Bandeja de revisión"
        description="Aquí aparecerán los emails con clasificación dudosa o sin candidatura asociada, para corregirlos a mano."
        phase="Fase 5 · Clasificación"
      />
    </>
  );
}
