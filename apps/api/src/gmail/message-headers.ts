/** Parses an RFC 5322 From header: `"Ana García" <ana@acme.com>` → name + lowercased address. */
export function parseFromHeader(value: string | undefined): {
  name: string | null;
  email: string | null;
  domain: string | null;
} {
  if (!value) return { name: null, email: null, domain: null };
  const angle = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(value);
  const email = (angle?.[2] ?? value).trim().toLowerCase();
  const name = angle?.[1]?.trim() || null;
  const at = email.lastIndexOf('@');
  if (at < 1 || !email.includes('.', at)) return { name, email: null, domain: null };
  return { name, email, domain: email.slice(at + 1) };
}

/**
 * Link that opens the original message in Gmail via an rfc822msgid search, which works
 * across Gmail UIs and accounts (the API message id is not a stable web URL).
 */
export function gmailWebUrl(rfc822MessageId: string | null, account: string): string | null {
  if (!rfc822MessageId) return null;
  const id = rfc822MessageId.replace(/^<|>$/g, '');
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#search/rfc822msgid%3A${encodeURIComponent(id)}`;
}
