import type { ApplicationStatus } from '@jat/shared';
import { cn } from '@/lib/utils';
import { STATUS_COLOR_VAR, STATUS_LABELS } from '@/lib/labels';

export function StatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
      style={{
        color: STATUS_COLOR_VAR[status],
        borderColor: `color-mix(in oklch, ${STATUS_COLOR_VAR[status]} 35%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${STATUS_COLOR_VAR[status]} 10%, transparent)`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: STATUS_COLOR_VAR[status] }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
