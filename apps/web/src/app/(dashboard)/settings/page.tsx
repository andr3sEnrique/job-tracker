import { Mail, RefreshCw } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Ajustes' };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" description="Conexión con Gmail y sincronización." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4" aria-hidden />
              Gmail
            </CardTitle>
            <CardDescription>
              Acceso de solo lectura (<code>gmail.readonly</code>). No se guarda el contenido de los
              emails, solo metadatos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">No conectado</p>
            <Button disabled>Conectar Gmail</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="size-4" aria-hidden />
              Sincronización
            </CardTitle>
            <CardDescription>Automática cada 15–30 minutos, o manual desde aquí.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Disponible en la fase 4</p>
            <Button variant="outline" disabled>
              Sincronizar ahora
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
