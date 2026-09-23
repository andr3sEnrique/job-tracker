'use client';

import type { EmailCategory, EmailSummary, ResolveEmailInput } from '@jat/shared';
import { Check, EyeOff, Link2, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useApplications, useResolveEmail } from '@/lib/api/queries';
import { errorMessage } from '@/lib/errors';
import { APPLICATION_CATEGORIES, CATEGORY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { CategorySelect } from './category-select';

/** Keep the classifier's guess when it is an application category; default otherwise. */
const initialCategory = (email: EmailSummary): EmailCategory =>
  email.category && APPLICATION_CATEGORIES.includes(email.category)
    ? email.category
    : 'APPLICATION_CONFIRMATION';

type Mode = 'assign' | 'create' | null;

export function EmailActions({ email }: { email: EmailSummary }) {
  const [mode, setMode] = useState<Mode>(null);
  const resolve = useResolveEmail();

  function run(input: ResolveEmailInput, message: string) {
    resolve.mutate(
      { id: email.id, input },
      {
        onSuccess: () => {
          toast.success(message);
          setMode(null);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Acciones del email"
            disabled={resolve.isPending}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {email.processingStatus === 'NEEDS_REVIEW' && (
            <DropdownMenuItem
              onSelect={() => run({ action: 'confirm' }, 'Clasificación confirmada')}
            >
              <Check />
              Confirmar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setMode('assign')}>
            <Link2 />
            Asignar a una candidatura…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode('create')}>
            <Plus />
            Crear candidatura…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => run({ action: 'ignore' }, 'Email marcado como irrelevante')}
          >
            <EyeOff />
            No es de mi búsqueda
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          {mode === 'assign' && (
            <AssignForm
              email={email}
              pending={resolve.isPending}
              onSubmit={(applicationId, category) =>
                run({ action: 'assign', applicationId, category }, 'Email asignado')
              }
            />
          )}
          {mode === 'create' && (
            <CreateForm
              email={email}
              pending={resolve.isPending}
              onSubmit={(companyName, roleTitle, category) =>
                run({ action: 'create', companyName, roleTitle, category }, 'Candidatura creada')
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmailContext({ email }: { email: EmailSummary }) {
  return (
    <DialogDescription>
      <span className="font-medium text-foreground">{email.subject}</span>
      <br />
      {email.fromName ?? email.fromEmail}
    </DialogDescription>
  );
}

function AssignForm({
  email,
  pending,
  onSubmit,
}: {
  email: EmailSummary;
  pending: boolean;
  onSubmit: (applicationId: string, category: EmailCategory) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(email.applicationId);
  const [category, setCategory] = useState<EmailCategory>(initialCategory(email));
  const q = useDebouncedValue(search);
  const { data } = useApplications({
    q: q || undefined,
    sortBy: 'lastActivityAt',
    sortDir: 'desc',
    page: 1,
    pageSize: 8,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) onSubmit(selected, category);
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Asignar a una candidatura</DialogTitle>
        <EmailContext email={email} />
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="assign-search">Candidatura</Label>
        <Input
          id="assign-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por empresa o puesto…"
          autoFocus
        />
        <ul className="max-h-56 space-y-1 overflow-y-auto" role="listbox" aria-label="Candidaturas">
          {data?.items.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected === app.id}
                onClick={() => setSelected(app.id)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted',
                  selected === app.id && 'border-primary bg-muted',
                )}
              >
                <span className="font-medium">{app.company.name}</span>
                <span className="text-muted-foreground"> · {app.roleTitle}</span>
              </button>
            </li>
          ))}
          {data?.items.length === 0 && (
            <li className="px-1 text-sm text-muted-foreground">Sin resultados.</li>
          )}
        </ul>
      </div>
      <div className="space-y-2">
        <Label htmlFor="assign-category">Qué es este email</Label>
        <CategorySelect id="assign-category" value={category} onChange={setCategory} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={!selected || pending}>
          Asignar como «{CATEGORY_LABELS[category]}»
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreateForm({
  email,
  pending,
  onSubmit,
}: {
  email: EmailSummary;
  pending: boolean;
  onSubmit: (companyName: string, roleTitle: string, category: EmailCategory) => void;
}) {
  const [label] = useState(() => email.applicationLabel?.split(' · ') ?? []);
  const [company, setCompany] = useState(label[0] ?? '');
  const [role, setRole] = useState(label[1] ?? '');
  const [category, setCategory] = useState<EmailCategory>(initialCategory(email));
  const valid = company.trim() && role.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(company.trim(), role.trim(), category);
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Crear candidatura</DialogTitle>
        <EmailContext email={email} />
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="create-company">Empresa</Label>
        <Input
          id="create-company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-role">Puesto</Label>
        <Input id="create-role" value={role} onChange={(e) => setRole(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-category">Qué es este email</Label>
        <CategorySelect id="create-category" value={category} onChange={setCategory} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={!valid || pending}>
          Crear candidatura
        </Button>
      </DialogFooter>
    </form>
  );
}
