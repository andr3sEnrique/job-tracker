'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { useCreateApplication } from '@/lib/api/queries';
import { errorMessage } from '@/lib/errors';
import { ApplicationForm } from './application-form';
import { emptyFormValues, toCreateInput, type FieldErrors } from './application-form-values';

export function NewApplicationView() {
  const router = useRouter();
  const create = useCreateApplication();
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <Card>
      <CardContent>
        <ApplicationForm
          initialValues={emptyFormValues()}
          showStatus
          submitLabel="Crear candidatura"
          submitting={create.isPending}
          errors={errors}
          onCancel={() => router.back()}
          onSubmit={(values) => {
            const parsed = toCreateInput(values);
            if (!parsed.ok) return setErrors(parsed.errors);
            setErrors({});
            create.mutate(parsed.input, {
              onSuccess: (app) => {
                toast.success('Candidatura creada');
                router.push(`/applications/${app.id}`);
              },
              onError: (error) => toast.error(errorMessage(error)),
            });
          }}
        />
      </CardContent>
    </Card>
  );
}
