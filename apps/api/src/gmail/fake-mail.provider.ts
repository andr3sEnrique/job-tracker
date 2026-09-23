import { Injectable } from '@nestjs/common';
import { pkceChallenge } from '../auth/crypto.js';
import {
  DISCARDED,
  FAKE_COMPANIES,
  FAKE_ROLES,
  STANDALONE,
  STORIES,
  fill,
  type EmailTemplate,
} from './fake-mailbox.data.js';
import {
  GMAIL_READONLY_SCOPE,
  MailAuthError,
  MailProvider,
  type ConnectResult,
  type MessageContent,
  type MessageMetadata,
} from './mail-provider.js';

export interface FakeMessage extends MessageMetadata {
  body: string;
  /** Test oracle: which template produced it (absent for discarded mail). */
  template: EmailTemplate | null;
  company: string | null;
  role: string | null;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Deterministic synthetic mailbox built from application "stories" (confirmation →
 * interview → rejection…), interleaved with job alerts, newsletters and personal mail.
 * Returned newest first, like Gmail.
 */
export function generateFakeMailbox(count = 240, now = new Date()): FakeMessage[] {
  const messages: FakeMessage[] = [];
  const perStory = 3.4; // average messages per story, including the interleaved extras
  const stories = Math.ceil(count / perStory) + 1;

  for (let s = 0; messages.length < count + 10; s++) {
    const steps = STORIES[s % STORIES.length]!;
    const company = FAKE_COMPANIES[s % FAKE_COMPANIES.length]!;
    const role = FAKE_ROLES[s % FAKE_ROLES.length]!;
    const start = now.getTime() - (stories - s) * 2 * DAY - 12 * DAY;
    let threadId = `fake-thread-${s}-0`;

    steps.forEach((step, k) => {
      if (!step.sameThread) threadId = `fake-thread-${s}-${k}`;
      messages.push({
        id: `fake-msg-${s}-${k}`,
        threadId,
        from: fill(step.from, company, role),
        subject: fill(step.subject, company, role),
        body: fill(step.body, company, role),
        rfc822MessageId: `<fake-${s}-${k}@mail.fake>`,
        receivedAt: new Date(Math.min(start + k * 4 * DAY + (s % 7) * HOUR, now.getTime() - HOUR)),
        labels: ['INBOX'],
        template: step,
        company: step.expected.company ? company.name : null,
        role: step.expected.role ? role : null,
      });
    });

    // One unrelated message per story: alternately job-ish noise and discarded mail.
    const extra = s % 2 === 0 ? STANDALONE[(s / 2) % STANDALONE.length]! : null;
    const discarded = DISCARDED[s % DISCARDED.length]!;
    messages.push({
      id: `fake-extra-${s}`,
      threadId: `fake-extra-thread-${s}`,
      from: extra?.from ?? discarded.from,
      subject: extra?.subject ?? discarded.subject,
      body: extra?.body ?? discarded.body,
      rfc822MessageId: `<fake-extra-${s}@mail.fake>`,
      receivedAt: new Date(start - DAY),
      labels: ['INBOX'],
      template: extra,
      company: null,
      role: null,
    });
  }

  return messages.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()).slice(0, count);
}

/**
 * In-memory mailbox for development (`MAIL_PROVIDER=fake`) and tests. The connect "code"
 * is echoed back as the mailbox address; revocation and failures are observable.
 */
@Injectable()
export class FakeMailProvider extends MailProvider {
  readonly name = 'fake' as const;
  mailbox: FakeMessage[] = generateFakeMailbox();
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
    { query, pageToken, pageSize }: { query: string; pageToken?: string; pageSize: number },
  ) {
    this.check();
    // Honour the date window of the query, like Gmail (the sender/subject filter is left
    // to the prefilter, so tests also exercise discarding).
    const after = /after:(\d+)/.exec(query)?.[1];
    const newerThanDays = /newer_than:(\d+)d/.exec(query)?.[1];
    const since = after
      ? Number(after) * 1000
      : newerThanDays
        ? Date.now() - Number(newerThanDays) * 86_400_000
        : 0;
    const matching = this.mailbox.filter((m) => m.receivedAt.getTime() >= since);

    const start = pageToken ? Number(pageToken) : 0;
    const page = matching.slice(start, start + pageSize);
    const next = start + pageSize < matching.length ? String(start + pageSize) : undefined;
    return { messages: page.map(({ id, threadId }) => ({ id, threadId })), nextPageToken: next };
  }

  async getMetadata(_token: string, ids: readonly string[]): Promise<MessageMetadata[]> {
    this.check();
    const byId = new Map(this.mailbox.map((m) => [m.id, m]));
    return ids.flatMap((id) => {
      const m = byId.get(id);
      return m
        ? [
            {
              id: m.id,
              threadId: m.threadId,
              from: m.from,
              subject: m.subject,
              rfc822MessageId: m.rfc822MessageId,
              receivedAt: m.receivedAt,
              labels: m.labels,
            },
          ]
        : [];
    });
  }

  async getContent(_token: string, id: string): Promise<MessageContent> {
    this.check();
    const found = this.mailbox.find((m) => m.id === id);
    if (!found) throw new Error('Message not found');
    return { text: found.body, html: null };
  }

  private check() {
    if (this.failWithAuthError) throw new MailAuthError('invalid_grant');
  }
}
