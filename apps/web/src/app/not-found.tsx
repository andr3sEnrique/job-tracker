import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-5xl font-semibold tabular-nums">404</p>
      <p className="text-muted-foreground">Esta página no existe.</p>
      <Button asChild variant="outline">
        <Link href="/">Volver al resumen</Link>
      </Button>
    </div>
  );
}
