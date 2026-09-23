import type { Salary } from '@jat/shared';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDate(iso: string): string {
  return format(new Date(iso), 'd MMM yyyy', { locale: es });
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), 'd MMM yyyy, HH:mm', { locale: es });
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (diffMs < 60_000) return 'ahora';
  return `hace ${formatDistanceToNowStrict(new Date(iso), { locale: es })}`;
}

const PERIOD_SUFFIX: Record<Salary['period'], string> = { YEAR: '/año', MONTH: '/mes', HOUR: '/h' };

export function formatSalary(salary: Salary | null): string | null {
  if (!salary || (salary.min === null && salary.max === null)) return null;
  const fmt = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: salary.currency,
    maximumFractionDigits: 0,
    notation: salary.period === 'YEAR' ? 'compact' : 'standard',
  });
  const range =
    salary.min !== null && salary.max !== null
      ? `${fmt.format(salary.min)} – ${fmt.format(salary.max)}`
      : fmt.format((salary.min ?? salary.max) as number);
  return `${range}${PERIOD_SUFFIX[salary.period]}`;
}
