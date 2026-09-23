import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QueryError({
  message = 'No se pudieron cargar los datos.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center"
    >
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
