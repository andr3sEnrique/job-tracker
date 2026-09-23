'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { QueryError } from '@/components/query-error';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApplication, useUpdateApplication } from '@/lib/api/queries';
import { errorMessage } from '@/lib/errors';
import { ApplicationForm } from './application-form';
import {
  diffForUpdate,
  formValuesFrom,
  toCreateInput,
  type FieldErrors,
} from './application-form-values';

export function EditApplicationView({ id }: { id: string }) {
  const router = useRouter();
  const { data: app, isPending, isError, refetch } = useApplication(id);
  const update = useUpdateApplication(id);
  const [errors, setErrors] = useState<FieldErrors>({});

  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isPending) return <Skeleton className="h-[480px] w-full" />;
  if (!app)
    return (
      <p className="text-muted-foreground">No existe ninguna candidatura con ese identificador.</p>
    );

  const initialValues = formValuesFrom(app);
  const detailHref = `/applications/${id}`;

  return (
    <Card>
      <CardContent>
        <ApplicationForm
          initialValues={initialValues}
          showStatus={false}
          submitLabel="Guardar cambios"
          submitting={update.isPending}
          errors={errors}
          onCancel={() => router.push(detailHref)}
          onSubmit={(values) => {
            const before = toCreateInput(initialValues);
            const after = toCreateInput(values);
            if (!after.ok) return setErrors(after.errors);
            setErrors({});
            const patch = before.ok ? diffForUpdate(before.input, after.input) : after.input;
            if (Object.keys(patch).length === 0) return router.push(detailHref);
            update.mutate(patch, {
              onSuccess: () => {
                toast.success('Cambios guardados');
                router.push(detailHref);
              },
              onError: (error) => toast.error(errorMessage(error)),
            });
          }}
        />
      </CardContent>
    </Card>
  );
}
