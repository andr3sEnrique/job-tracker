import { BriefcaseBusiness } from 'lucide-react';
import Link from 'next/link';

/** Public pages (no session): what Google's OAuth review needs to see, plus sign-in. */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/welcome" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BriefcaseBusiness className="size-4" aria-hidden />
            </span>
            Job Tracker
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacidad
            </Link>
            <Link href="/login" className="font-medium hover:underline">
              Entrar
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}
