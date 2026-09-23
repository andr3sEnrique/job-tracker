'use client';

import { APPLICATION_SOURCES, APPLICATION_STATUSES, WORK_MODES } from '@jat/shared';
import { Loader2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SOURCE_LABELS, STATUS_LABELS, WORK_MODE_LABELS } from '@/lib/labels';
import type { ApplicationFormValues, FieldErrors } from './application-form-values';

function Field({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5">
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function ApplicationForm({
  initialValues,
  showStatus,
  submitLabel,
  submitting,
  errors,
  onSubmit,
  onCancel,
}: {
  initialValues: ApplicationFormValues;
  /** Status is only chosen on creation; afterwards it changes through events. */
  showStatus: boolean;
  submitLabel: string;
  submitting: boolean;
  errors: FieldErrors;
  onSubmit: (values: ApplicationFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initialValues);
  const set =
    <K extends keyof ApplicationFormValues>(key: K) =>
    (value: ApplicationFormValues[K]) =>
      setValues((v) => ({ ...v, [key]: value }));

  const inputProps = (key: keyof ApplicationFormValues) => ({
    id: key,
    name: key,
    value: values[key],
    onChange: (e: { target: { value: string } }) => set(key)(e.target.value as never),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="companyName" label="Empresa *" error={errors.companyName}>
          <Input {...inputProps('companyName')} autoComplete="organization" autoFocus />
        </Field>
        <Field id="roleTitle" label="Puesto *" error={errors.roleTitle}>
          <Input {...inputProps('roleTitle')} autoComplete="organization-title" />
        </Field>
        <Field id="location" label="Ubicación" error={errors.location}>
          <Input {...inputProps('location')} placeholder="Madrid, Remoto (España)…" />
        </Field>
        <Field id="workMode" label="Modalidad">
          <Select value={values.workMode} onValueChange={set('workMode')}>
            <SelectTrigger id="workMode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORK_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {WORK_MODE_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="source" label="Fuente">
          <Select value={values.source} onValueChange={set('source')}>
            <SelectTrigger id="source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPLICATION_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {SOURCE_LABELS[source]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="appliedAt" label="Fecha de candidatura *" error={errors.appliedAt}>
          <Input
            {...inputProps('appliedAt')}
            type="date"
            max={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        {showStatus && (
          <Field id="status" label="Estado actual">
            <Select value={values.status} onValueChange={set('status')}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field id="jobUrl" label="URL de la oferta" error={errors.jobUrl}>
          <Input {...inputProps('jobUrl')} type="url" placeholder="https://…" inputMode="url" />
        </Field>
        <Field id="salaryMin" label="Salario mínimo (€/año)" error={errors.salaryMin}>
          <Input
            {...inputProps('salaryMin')}
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
          />
        </Field>
        <Field id="salaryMax" label="Salario máximo (€/año)" error={errors.salaryMax}>
          <Input
            {...inputProps('salaryMax')}
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
          />
        </Field>
        <Field id="notes" label="Notas" error={errors.notes} className="sm:col-span-2">
          <Textarea {...inputProps('notes')} rows={4} />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
