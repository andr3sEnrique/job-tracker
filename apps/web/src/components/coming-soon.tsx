import type { LucideIcon } from 'lucide-react';

export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
        {phase}
      </span>
    </div>
  );
}
