'use client';

import type { EmailSummary } from '@jat/shared';
import { ExternalLink, MailX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Pagination } from '@/components/applications/pagination';
import { QueryError } from '@/components/query-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEmails, useGmailStatus } from '@/lib/api/queries';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 25;

const STATUS_TEXT: Record<EmailSummary['processingStatus'], string> = {
  PENDING: 'Pendiente de clasificar',
  PROCESSED: 'Procesado',
  NEEDS_REVIEW: 'Revisar',
  FAILED: 'Error',
  SKIPPED: 'Descartado',
};

/** "ats-sender:greenhouse.io" → "Remitente ATS · greenhouse.io" */
function describeReason(reason: string | null) {
  if (!reason) return '—';
  const [kind, value] = reason.split(':');
  const label = {
    'ats-sender': 'Remitente ATS',
    'job-sender': 'Remitente de empleo',
    subject: 'Asunto',
  }[kind ?? ''];
  return label ? `${label} · ${value}` : reason;
}

function Sender({ email }: { email: EmailSummary }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{email.fromName ?? email.fromEmail ?? '—'}</p>
      {email.fromName && (
        <p className="truncate text-xs text-muted-foreground">{email.fromEmail}</p>
      )}
    </div>
  );
}

function GmailLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <Button variant="ghost" size="icon-sm" asChild>
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Gmail">
        <ExternalLink />
      </a>
    </Button>
  );
}

export function EmailsView() {
  const [page, setPage] = useState(1);
  const gmail = useGmailStatus();
  const { data, isPending, isError, refetch } = useEmails({ page, pageSize: PAGE_SIZE });

  if (isError || gmail.isError) return <QueryError onRetry={() => refetch()} />;
  if (isPending || gmail.isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!gmail.data.connected || data.total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <MailX className="size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">
          {gmail.data.connected ? 'Aún no hay emails relevantes' : 'Gmail no está conectado'}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {gmail.data.connected
            ? 'Lanza una sincronización desde Ajustes para traer los emails de tu búsqueda de empleo.'
            : 'Conecta tu buzón en Ajustes para detectar automáticamente las respuestas de tus candidaturas.'}
        </p>
        <Button asChild variant="outline">
          <Link href="/settings">Ir a Ajustes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Remitente</TableHead>
              <TableHead>Asunto</TableHead>
              <TableHead className="hidden xl:table-cell">Detectado por</TableHead>
              <TableHead>Recibido</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((email) => (
              <TableRow key={email.id}>
                <TableCell className="max-w-56 py-2.5">
                  <Sender email={email} />
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="truncate">{email.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_TEXT[email.processingStatus]}
                  </p>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                  {describeReason(email.prefilterReason)}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                  {formatDateTime(email.receivedAt)}
                </TableCell>
                <TableCell>
                  <GmailLink url={email.gmailUrl} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y rounded-lg border md:hidden">
        {data.items.map((email) => (
          <li key={email.id} className="flex items-start gap-2 p-3">
            <div className="min-w-0 flex-1 space-y-1">
              <Sender email={email} />
              <p className="line-clamp-2 text-sm">{email.subject}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(email.receivedAt)}</p>
            </div>
            <GmailLink url={email.gmailUrl} />
          </li>
        ))}
      </ul>

      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
    </div>
  );
}
