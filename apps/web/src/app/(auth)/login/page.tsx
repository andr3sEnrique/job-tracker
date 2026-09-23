import { BriefcaseBusiness } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-5" aria-hidden />
          </div>
          <CardTitle>Job Tracker</CardTitle>
          <CardDescription>Acceso privado. Solo cuentas autorizadas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Phase 3: points to /api/v1/auth/google (handled by NestJS). */}
          <Button className="w-full" disabled>
            Continuar con Google
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            El login se activa en la fase 3.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
