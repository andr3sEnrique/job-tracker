import {
  createApplicationSchema,
  type ApplicationDetail,
  type ApplicationSource,
  type ApplicationStatus,
  type CreateApplicationInput,
  type UpdateApplicationInput,
  type WorkMode,
} from '@jat/shared';

/** Raw form state: everything is a string, as in the inputs. */
export interface ApplicationFormValues {
  companyName: string;
  roleTitle: string;
  location: string;
  workMode: WorkMode;
  source: ApplicationSource;
  status: ApplicationStatus;
  jobUrl: string;
  appliedAt: string; // yyyy-mm-dd
  salaryMin: string;
  salaryMax: string;
  notes: string;
}

export type FieldErrors = Partial<Record<keyof ApplicationFormValues, string>>;

const today = () => new Date().toISOString().slice(0, 10);

export function emptyFormValues(): ApplicationFormValues {
  return {
    companyName: '',
    roleTitle: '',
    location: '',
    workMode: 'UNKNOWN',
    source: 'LINKEDIN',
    status: 'APPLIED',
    jobUrl: '',
    appliedAt: today(),
    salaryMin: '',
    salaryMax: '',
    notes: '',
  };
}

export function formValuesFrom(app: ApplicationDetail): ApplicationFormValues {
  return {
    companyName: app.company.name,
    roleTitle: app.roleTitle,
    location: app.location ?? '',
    workMode: app.workMode,
    source: app.source,
    status: app.status,
    jobUrl: app.jobUrl ?? '',
    appliedAt: app.appliedAt.slice(0, 10),
    salaryMin: app.salary?.min?.toString() ?? '',
    salaryMax: app.salary?.max?.toString() ?? '',
    notes: app.notes ?? '',
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());
const toInt = (value: string) => (value.trim() === '' ? null : Number(value));

/** Form values → API input, validated with the same schema the API uses. */
export function toCreateInput(
  values: ApplicationFormValues,
): { ok: true; input: CreateApplicationInput } | { ok: false; errors: FieldErrors } {
  const salaryMin = toInt(values.salaryMin);
  const salaryMax = toInt(values.salaryMax);
  const result = createApplicationSchema.safeParse({
    companyName: values.companyName,
    roleTitle: values.roleTitle,
    location: orNull(values.location),
    workMode: values.workMode,
    source: values.source,
    status: values.status,
    jobUrl: orNull(values.jobUrl),
    // Noon UTC keeps the chosen calendar day in every European timezone.
    appliedAt: values.appliedAt ? `${values.appliedAt}T12:00:00.000Z` : '',
    notes: orNull(values.notes),
    salary:
      salaryMin === null && salaryMax === null
        ? null
        : { min: salaryMin, max: salaryMax, currency: 'EUR', period: 'YEAR' },
  });
  if (result.success) return { ok: true, input: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const [head, sub] = issue.path.map(String);
    const field = (
      head === 'salary' ? (sub === 'max' ? 'salaryMax' : 'salaryMin') : head
    ) as keyof ApplicationFormValues;
    errors[field] ??= FIELD_MESSAGES[field] ?? issue.message;
  }
  return { ok: false, errors };
}

const FIELD_MESSAGES: FieldErrors = {
  companyName: 'Indica la empresa',
  roleTitle: 'Indica el puesto',
  jobUrl: 'URL no válida (incluye https://)',
  appliedAt: 'Fecha no válida',
  salaryMin: 'El mínimo debe ser un número positivo y no mayor que el máximo',
  salaryMax: 'El máximo debe ser un número positivo',
};

/** Only the fields that actually changed, so edits lock as few fields as possible. */
export function diffForUpdate(
  before: CreateApplicationInput,
  after: CreateApplicationInput,
): UpdateApplicationInput {
  const patch: Record<string, unknown> = {};
  const keys = [
    'companyName',
    'roleTitle',
    'location',
    'workMode',
    'source',
    'jobUrl',
    'appliedAt',
    'notes',
    'salary',
  ] as const;
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) patch[key] = after[key];
  }
  return patch as UpdateApplicationInput;
}
