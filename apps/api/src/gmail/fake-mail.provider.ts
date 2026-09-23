import { Injectable } from '@nestjs/common';
import { pkceChallenge } from '../auth/crypto.js';
import {
  GMAIL_READONLY_SCOPE,
  MailAuthError,
  MailProvider,
  type ConnectResult,
  type MessageMetadata,
} from './mail-provider.js';

/** Deterministic synthetic mailbox. All companies and people are fictional. */
export function generateFakeMailbox(count = 240, now = new Date()): MessageMetadata[] {
  const templates: { from: string; subject: (c: string) => string }[] = [
    { from: 'no-reply@greenhouse.io', subject: (c) => `Thank you for applying to ${c}` },
    { from: '"Talent at {c}" <talent@hire.lever.co>', subject: (c) => `Your application to ${c}` },
    { from: 'jobs-noreply@linkedin.com', subject: (c) => `Tu solicitud se ha enviado a ${c}` },
    {
      from: 'noreply@infojobs.net',
      subject: (c) => `Tu candidatura en ${c} ha cambiado de estado`,
    },
    {
      from: '"Laura (Recruiter)" <laura@{d}>',
      subject: (c) => `Entrevista con ${c} — ¿disponibilidad esta semana?`,
    },
    { from: 'careers@{d}', subject: (c) => `Actualización sobre tu proceso de selección en ${c}` },
    {
      from: 'jobalerts-noreply@linkedin.com',
      subject: () => 'Nuevos empleos que coinciden con tu búsqueda',
    },
    // Irrelevant mail the prefilter must discard:
    { from: 'pedidos@tienda.example', subject: () => 'Tu pedido ha sido enviado' },
    { from: 'news@newsletter.example', subject: () => 'Las 10 noticias de la semana' },
    { from: 'amigo@gmail.com', subject: () => 'Cena el sábado?' },
  ];
  const companies = [
    ['Nimbus Labs', 'nimbuslabs.dev'],
    ['Quantia', 'quantia.io'],
    ['Orbital Pay', 'orbitalpay.com'],
    ['Kora Systems', 'korasystems.com'],
    ['Lumen Data', 'lumendata.ai'],
    ['Tramuntana Software', 'tramuntana.dev'],
  ] as const;

  return Array.from({ length: count }, (_, i) => {
    const t = templates[i % templates.length]!;
    const [company, domain] = companies[i % companies.length]!;
    return {
      id: `fake-msg-${String(i).padStart(4, '0')}`,
      threadId: `fake-thread-${String(Math.floor(i / 2)).padStart(4, '0')}`,
      from: t.from.replace('{c}', company).replace('{d}', domain),
      subject: t.subject(company),
      rfc822MessageId: `<fake-${i}@mail.fake>`,
      receivedAt: new Date(now.getTime() - i * 9 * 60 * 60 * 1000),
      labels: ['INBOX'],
    };
  });
}

/**
 * In-memory mailbox for development (`MAIL_PROVIDER=fake`) and tests. The connect "code"
 * is echoed back as the mailbox address; revocation and failures are observable.
 */
@Injectable()
export class FakeMailProvider extends MailProvider {
  readonly name = 'fake' as const;
  mailbox: MessageMetadata[] = generateFakeMailbox();
  readonly revoked: string[] = [];
  /** When set, every call fails as if Google had revoked the grant. */
  failWithAuthError = false;
  private readonly challenges = new Set<string>();
  private issued = 0;

  buildConnectUrl({ state, codeChallenge }: { state: string; codeChallenge: string }) {
    this.challenges.add(codeChallenge);
    return `/api/v1/gmail/callback?${new URLSearchParams({ state, code: 'fake@gmail.test' })}`;
  }

  async exchangeConnectCode({
    code,
    codeVerifier,
  }: {
    code: string;
    codeVerifier: string;
  }): Promise<ConnectResult> {
    if (!this.challenges.has(pkceChallenge(codeVerifier))) throw new Error('PKCE mismatch');
    return {
      refreshToken: `fake-refresh-${++this.issued}`,
      scopes: [GMAIL_READONLY_SCOPE],
      email: code,
    };
  }

  async revoke(refreshToken: string) {
    this.revoked.push(refreshToken);
  }

  async getHistoryId() {
    this.check();
    return String(1000 + this.mailbox.length);
  }

  async listMessages(
    _token: string,
    { pageToken, pageSize }: { query: string; pageToken?: string; pageSize: number },
  ) {
    this.check();
    const start = pageToken ? Number(pageToken) : 0;
    const page = this.mailbox.slice(start, start + pageSize);
    const next = start + pageSize < this.mailbox.length ? String(start + pageSize) : undefined;
    return { messages: page.map(({ id, threadId }) => ({ id, threadId })), nextPageToken: next };
  }

  async getMetadata(_token: string, ids: readonly string[]) {
    this.check();
    const byId = new Map(this.mailbox.map((m) => [m.id, m]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  private check() {
    if (this.failWithAuthError) throw new MailAuthError('invalid_grant');
  }
}
