'use client';

import type { EmailProcessingStatus, EmailSummary } from '@jat/shared';
import { ExternalLink, Inbox, MailX } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Pagination } from '@/components/applications/pagination';
import { QueryError } from '@/components/query-error';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmails, useGmailStatus } from '@/lib/api/queries';
import { formatDateTime } from '@/lib/format';
import { CategoryBadge } from './category-badge';
import { EmailActions } from './email-actions';

const PAGE_SIZE = 25;

const TABS: { value: string; label: string; status?: EmailProcessingStatus[] }[] = [
  { value: 'review', label: 'Revisar', status: ['NEEDS_REVIEW'] },
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes', status: ['PENDING', 'FAILED'] },
];

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

function ApplicationLink({ email }: { email: EmailSummary }) {
  if (!email.applicationId) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Link
      href={`/applications/${email.applicationId}`}
      className="line-clamp-2 text-sm hover:underline"
    >
      {email.applicationLabel}
    </Link>
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
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const gmail = useGmailStatus();
  const reviewCount = gmail.data?.connected ? gmail.data.counts.needsReview : 0;

  // Land on "review" when there is something to review.
  const tab = params.get('tab') ?? (reviewCount > 0 ? 'review' : 'all');
  const [page, setPage] = useState(1);
  const status = TABS.find((t) => t.value === tab)?.status;
  const { data, isPending, isError, refetch } = useEmails({ status, page, pageSize: PAGE_SIZE });

  const selectTab = (value: string) => {
    setPage(1);
    router.replace(`${pathname}?tab=${value}`, { scroll: false });
  };

  if (isError || gmail.isError) return <QueryError onRetry={() => refetch()} />;

  if (gmail.data && !gmail.data.connected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <MailX className="size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">Gmail no está conectado</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Conecta tu buzón en Ajustes para detectar automáticamente las respuestas de tus
          candidaturas.
        </p>
        <Button asChild variant="outline">
          <Link href="/settings">Ir a Ajustes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {t.value === 'review' && reviewCount > 0 && (
                <Badge variant="secondary" className="ml-1 rounded-sm px-1 tabular-nums">
                  {reviewCount}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data.total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <Inbox className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">
            {tab === 'review' ? 'Nada que revisar' : 'No hay emails aquí'}
          </p>
          <p className="text-sm text-muted-foreground">
            {tab === 'review'
              ? 'Todo lo detectado se ha clasificado con seguridad.'
              : 'Lanza una sincronización desde Ajustes.'}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Remitente</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden xl:table-cell">Candidatura</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Recibido</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="max-w-48 py-2.5">
                      <Sender email={email} />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate">{email.subject}</p>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={email.category} classifier={email.classifier} />
                    </TableCell>
                    <TableCell className="hidden max-w-56 xl:table-cell">
                      <ApplicationLink email={email} />
                    </TableCell>
                    <TableCell className="hidden text-sm whitespace-nowrap text-muted-foreground 2xl:table-cell">
                      {formatDateTime(email.receivedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <GmailLink url={email.gmailUrl} />
                        <EmailActions email={email} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y rounded-lg border md:hidden">
            {data.items.map((email) => (
              <li key={email.id} className="flex items-start gap-1 p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Sender email={email} />
                  <p className="line-clamp-2 text-sm">{email.subject}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={email.category} classifier={email.classifier} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(email.receivedAt)}
                    </span>
                  </div>
                  <ApplicationLink email={email} />
                </div>
                <GmailLink url={email.gmailUrl} />
                <EmailActions email={email} />
              </li>
            ))}
          </ul>

          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
