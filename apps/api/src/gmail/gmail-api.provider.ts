import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { AppConfig } from '../config/app-config.service.js';
import { mapWithConcurrency } from './concurrency.js';
import {
  GMAIL_READONLY_SCOPE,
  MailAuthError,
  MailProvider,
  MailTransientError,
  type MessageMetadata,
} from './mail-provider.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const METADATA_HEADERS = ['From', 'Subject', 'Message-ID'];
const MAX_RETRIES = 3;

interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gmail REST adapter. Uses the refresh token to obtain short-lived access tokens on demand. */
@Injectable()
export class GmailApiProvider extends MailProvider {
  readonly name = 'gmail' as const;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri: string;

  constructor(config: AppConfig) {
    super();
    this.clientId = config.get('GOOGLE_CLIENT_ID');
    this.clientSecret = config.get('GOOGLE_CLIENT_SECRET');
    this.redirectUri = `${config.get('FRONTEND_URL')}/api/v1/gmail/callback`;
  }

  private client(refreshToken?: string): OAuth2Client {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }
    const client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    });
    if (refreshToken) client.setCredentials({ refresh_token: refreshToken });
    return client;
  }

  buildConnectUrl({
    state,
    codeChallenge,
    loginHint,
  }: {
    state: string;
    codeChallenge: string;
    loginHint?: string;
  }) {
    return this.client().generateAuthUrl({
      scope: [GMAIL_READONLY_SCOPE],
      access_type: 'offline', // ask for a refresh token…
      prompt: 'consent', // …and make Google issue a new one even if consent was given before
      include_granted_scopes: true,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      ...(loginHint && { login_hint: loginHint }),
    });
  }

  async exchangeConnectCode({ code, codeVerifier }: { code: string; codeVerifier: string }) {
    const client = this.client();
    const { tokens } = await client.getToken({ code, codeVerifier });
    client.setCredentials(tokens);
    const profile = await this.call<{ emailAddress: string }>(client, `${API}/profile`);
    return {
      refreshToken: tokens.refresh_token ?? null,
      scopes: (tokens.scope ?? '').split(' ').filter(Boolean),
      email: profile.emailAddress.toLowerCase(),
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.client().revokeToken(refreshToken);
  }

  async getHistoryId(refreshToken: string): Promise<string> {
    const profile = await this.call<{ historyId: string }>(
      this.client(refreshToken),
      `${API}/profile`,
    );
    return profile.historyId;
  }

  async listMessages(
    refreshToken: string,
    { query, pageToken, pageSize }: { query: string; pageToken?: string; pageSize: number },
  ) {
    const params = new URLSearchParams({ q: query, maxResults: String(pageSize) });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await this.call<{
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
    }>(this.client(refreshToken), `${API}/messages?${params}`);
    return { messages: res.messages ?? [], nextPageToken: res.nextPageToken };
  }

  async getMetadata(refreshToken: string, ids: readonly string[]): Promise<MessageMetadata[]> {
    const client = this.client(refreshToken);
    const params = new URLSearchParams({ format: 'metadata' });
    for (const h of METADATA_HEADERS) params.append('metadataHeaders', h);

    // 10 in flight stays far below Gmail's per-user quota (messages.get = 5 units).
    return mapWithConcurrency(ids, 10, async (id) => {
      const msg = await this.call<GmailMessage>(client, `${API}/messages/${id}?${params}`);
      const header = (name: string) =>
        msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: header('From'),
        subject: header('Subject'),
        rfc822MessageId: header('Message-ID'),
        receivedAt: new Date(Number(msg.internalDate ?? Date.now())),
        labels: msg.labelIds ?? [],
      };
    });
  }

  /** GET with typed errors and exponential backoff (with jitter) on 429/5xx. */
  private async call<T>(client: OAuth2Client, url: string, attempt = 0): Promise<T> {
    try {
      const res = await client.request<T>({ url, method: 'GET' });
      return res.data;
    } catch (error) {
      const status = (error as { status?: number; response?: { status?: number } }).response
        ?.status;
      const message = (error as Error).message ?? '';
      if (message.includes('invalid_grant') || status === 401) {
        throw new MailAuthError('Gmail access was revoked or expired');
      }
      if (status === 429 || status === 403 || (status !== undefined && status >= 500)) {
        if (attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 500 + Math.random() * 250);
          return this.call<T>(client, url, attempt + 1);
        }
        throw new MailTransientError(`Gmail API unavailable (${status})`);
      }
      throw error;
    }
  }
}
