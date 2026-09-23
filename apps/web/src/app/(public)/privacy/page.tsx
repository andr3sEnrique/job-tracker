import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Política de privacidad' };

const LAST_UPDATED = '23 de septiembre de 2026';
const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article className="flex flex-col gap-8 rounded-xl border bg-background p-6 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Política de privacidad</h1>
        <p className="text-sm text-muted-foreground">Última actualización: {LAST_UPDATED}</p>
      </header>

      <Section title="Qué es">
        <p>
          Job Tracker es una aplicación personal que organiza candidaturas de empleo a partir de los
          emails del usuario. Solo pueden usarla las cuentas de Google que su administrador autoriza
          expresamente. No se vende, no muestra publicidad y no comparte datos con terceros salvo lo
          indicado aquí.
        </p>
      </Section>

      <Section title="Datos de Google que se usan">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Inicio de sesión</strong> (openid, email, profile): nombre, email y foto, para
            identificarte.
          </li>
          <li>
            <strong>Gmail, solo lectura</strong> (<code>gmail.readonly</code>), que concedes aparte
            y puedes retirar cuando quieras. La aplicación no puede enviar, borrar ni modificar
            emails.
          </li>
        </ul>
      </Section>

      <Section title="Qué se guarda y qué no">
        <p>
          De los emails que parecen de procesos de selección se guardan metadatos: remitente,
          asunto, fecha, identificadores de Gmail y el resultado de la clasificación (categoría,
          empresa, puesto, ubicación). Del resto de emails solo se guarda el identificador y la
          fecha, para no volver a leerlos.
        </p>
        <p>
          <strong>El contenido de los emails nunca se guarda</strong>: se lee en memoria para
          clasificarlo y se descarta. Tampoco se guardan adjuntos, destinatarios ni HTML. El token
          de acceso a Gmail se guarda cifrado (AES-256-GCM).
        </p>
      </Section>

      <Section title="Clasificación con IA (opcional)">
        <p>
          Si el administrador la activa, los emails que las reglas no saben clasificar se envían a
          un proveedor de IA (Anthropic) para clasificarlos. Se envía solo el asunto, el dominio del
          remitente y un extracto del texto, <strong>sin direcciones de email ni teléfonos</strong>.
          Anthropic no usa los datos de su API para entrenar modelos. La respuesta (categoría,
          empresa, puesto) es lo único que se guarda.
        </p>
      </Section>

      <Section title="Uso limitado de los datos de Google">
        <p>
          El uso y la transferencia de la información recibida de las API de Google se ajustan a la{' '}
          <a
            className="underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            rel="noreferrer"
            target="_blank"
          >
            Google API Services User Data Policy
          </a>
          , incluidos los requisitos de uso limitado (Limited Use). Los datos solo se usan para
          ofrecerte las funciones de la aplicación; nunca para publicidad, ni se venden, ni los lee
          ninguna persona salvo con tu permiso, por seguridad o por obligación legal, ni se usan
          para entrenar modelos de IA.
        </p>
        <p lang="en">
          Job Tracker&apos;s use and transfer of information received from Google APIs adheres to
          the Google API Services User Data Policy, including the Limited Use requirements.
        </p>
      </Section>

      <Section title="Tus controles">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Desconectar Gmail</strong> (en Ajustes): revoca el acceso en Google y borra
            todos los emails guardados. Tus candidaturas se conservan.
          </li>
          <li>
            <strong>Borrar la cuenta</strong> (en Ajustes): elimina de inmediato tu cuenta y todos
            tus datos.
          </li>
          <li>
            También puedes retirar el acceso desde{' '}
            <a
              className="underline"
              href="https://myaccount.google.com/permissions"
              rel="noreferrer"
              target="_blank"
            >
              tu cuenta de Google
            </a>
            .
          </li>
        </ul>
      </Section>

      <Section title="Dónde se alojan los datos">
        <p>
          La aplicación se ejecuta en proveedores de hosting (Vercel, Render) y la base de datos en
          Neon (PostgreSQL), con conexiones cifradas (TLS). Los registros técnicos no contienen el
          contenido de los emails, ni tokens, ni cookies.
        </p>
      </Section>

      <Section title="Contacto">
        <p>
          {contact ? (
            <>
              Para cualquier consulta sobre tus datos:{' '}
              <a className="underline" href={`mailto:${contact}`}>
                {contact}
              </a>
              .
            </>
          ) : (
            'Para cualquier consulta sobre tus datos, contacta con el administrador de esta instancia.'
          )}
        </p>
      </Section>
    </article>
  );
}
