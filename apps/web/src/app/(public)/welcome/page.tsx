import { Bot, Inbox, LineChart, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Qué es Job Tracker' };

const FEATURES = [
  {
    icon: Inbox,
    title: 'Se alimenta de tu Gmail',
    text: 'Con acceso de solo lectura, detecta confirmaciones, entrevistas, rechazos y ofertas, y construye el historial de cada candidatura.',
  },
  {
    icon: LineChart,
    title: 'Un dashboard de tu búsqueda',
    text: 'Candidaturas, estados, embudo y actividad reciente en un solo sitio, con edición manual cuando hace falta.',
  },
  {
    icon: Bot,
    title: 'Reglas primero, IA opcional',
    text: 'La mayoría de emails se clasifican con reglas en el servidor. La IA, si se activa, solo ve los dudosos y anonimizados.',
  },
  {
    icon: ShieldCheck,
    title: 'Privado por diseño',
    text: 'El contenido de los emails nunca se guarda: se lee en memoria y se descarta. Solo usuarios autorizados pueden entrar.',
  },
];

export default function WelcomePage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Tus candidaturas de empleo, ordenadas solas
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Job Tracker es un dashboard privado que sigue tus candidaturas a partir de los emails que
          recibes de empresas y plataformas de empleo. Es un proyecto personal de código abierto; el
          acceso está limitado a las cuentas que autoriza su administrador.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/privacy">Política de privacidad</Link>
          </Button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-background p-5">
            <Icon className="mb-3 size-5 text-primary" aria-hidden />
            <h2 className="mb-1 font-medium">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
