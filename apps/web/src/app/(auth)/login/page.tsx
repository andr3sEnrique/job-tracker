import { AlertCircle, BriefcaseBusiness } from 'lucide-react';
import type { Metadata } from 'next';
import { GoogleIcon } from '@/components/google-icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Iniciar sesión' };

const ERRORS: Record<string, string> = {
  forbidden: 'Esta cuenta de Google no tiene acceso a esta aplicación.',
  unverified: 'El email de tu cuenta de Google no está verificado.',
  cancelled: 'Has cancelado el inicio de sesión.',
  state: 'La solicitud de inicio de sesión caducó o no es válida. Vuelve a intentarlo.',
  oauth: 'Google no ha podido completar el inicio de sesión. Vuelve a intentarlo.',
  config: 'El inicio de sesión con Google no está configurado en el servidor.',
  session: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error } = await searchParams;
  const message = typeof error === 'string' ? ERRORS[error] : undefined;

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
        <CardContent className="space-y-4">
          {message && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{message}</p>
            </div>
          )}
          {/* Full-page navigation: the API redirects to Google and back through the /api proxy. */}
          <Button className="w-full" size="lg" asChild>
            <a href="/api/v1/auth/google">
              <GoogleIcon className="size-4" />
              Continuar con Google
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Solo se solicita tu nombre y email. El acceso a Gmail se concede aparte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
