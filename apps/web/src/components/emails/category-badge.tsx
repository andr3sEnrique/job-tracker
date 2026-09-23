import type { EmailCategory } from '@jat/shared';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/labels';

const TONE: Partial<Record<EmailCategory, string>> = {
  OFFER: 'var(--status-offer)',
  REJECTION: 'var(--status-rejected)',
  INTERVIEW: 'var(--status-interviewing)',
  TECHNICAL_INTERVIEW: 'var(--status-interviewing)',
  RECRUITER_REPLY: 'var(--status-screening)',
  APPLICATION_SUBMITTED: 'var(--status-applied)',
  APPLICATION_CONFIRMATION: 'var(--status-applied)',
};

export function CategoryBadge({
  category,
  className,
}: {
  category: EmailCategory | null;
  className?: string;
}) {
  if (!category) return <span className="text-xs text-muted-foreground">Pendiente</span>;
  const color = TONE[category] ?? 'var(--muted-foreground)';
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
      style={{
        color,
        borderColor: `color-mix(in oklch, ${color} 35%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${color} 8%, transparent)`,
      }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}
