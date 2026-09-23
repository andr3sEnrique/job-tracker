export interface MessageRef {
  id: string;
  threadId: string;
}

/** Headers-level view of a message: everything the prefilter and storage need, no body. */
export interface MessageMetadata extends MessageRef {
  from: string | undefined;
  subject: string | undefined;
  rfc822MessageId: string | undefined;
  receivedAt: Date;
  labels: string[];
}

/**
 * Message body, for classification only. Lives in memory while an email is processed and
 * is never persisted or logged.
 */
export interface MessageContent {
  text: string | null;
  html: string | null;
}

export interface ConnectResult {
  refreshToken: string | null;
  scopes: string[];
  email: string;
}

/** Access was revoked or expired (`invalid_grant`): the user must reconnect. */
export class MailAuthError extends Error {
  override readonly name = 'MailAuthError';
}

/** Quota exceeded or the provider is unavailable: safe to retry later. */
export class MailTransientError extends Error {
  override readonly name = 'MailTransientError';
}

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/**
 * Port for the mailbox. The Gmail adapter talks to Google; the fake serves synthetic
 * messages for development, demos and tests. Nothing outside this folder knows which.
 */
export abstract class MailProvider {
  abstract readonly name: 'gmail' | 'fake';
  abstract buildConnectUrl(params: {
    state: string;
    codeChallenge: string;
    loginHint?: string;
  }): string;
  abstract exchangeConnectCode(params: {
    code: string;
    codeVerifier: string;
  }): Promise<ConnectResult>;
  abstract revoke(refreshToken: string): Promise<void>;
  abstract getHistoryId(refreshToken: string): Promise<string>;
  abstract listMessages(
    refreshToken: string,
    params: { query: string; pageToken?: string; pageSize: number },
  ): Promise<{ messages: MessageRef[]; nextPageToken?: string }>;
  abstract getMetadata(refreshToken: string, ids: readonly string[]): Promise<MessageMetadata[]>;
  abstract getContent(refreshToken: string, id: string): Promise<MessageContent>;
}
