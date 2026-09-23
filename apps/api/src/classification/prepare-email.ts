import { parseFromHeader } from '../gmail/message-headers.js';
import type { PreparedEmail } from './types.js';

const MAX_BODY_CHARS = 4000;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#')) {
      const n =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Small, dependency-free HTML → text: good enough for classification, never rendered. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function extractLinks(text: string, html: string | null): string[] {
  const links = new Set<string>();
  for (const m of html?.matchAll(/href\s*=\s*["']([^"']+)["']/gi) ?? [])
    links.add(decodeEntities(m[1]!));
  for (const m of text.matchAll(/https?:\/\/[^\s<>"')\]]+/g))
    links.add(m[0].replace(/[.,;:!?]+$/, ''));
  return [...links].filter((l) => /^https?:\/\//i.test(l));
}

/** Cuts the quoted previous message from replies ("On … wrote:", "Le … a écrit :", "> …"). */
export function stripQuotedReply(text: string): string {
  const markers = [
    /^On .{3,200} wrote:$/m,
    /^Le .{3,200} a écrit\s?:$/m,
    /^El .{3,200} escribió:$/m,
    /^-{2,}\s*(Original Message|Message d'origine|Mensaje original)\s*-{2,}$/im,
    /^From: .+$/m,
    /^De\s?: .+$/m,
  ];
  let cut = text.length;
  for (const marker of markers) {
    const index = text.search(marker);
    if (index > 0 && index < cut) cut = index;
  }
  return text
    .slice(0, cut)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n')
    .trim();
}

export function prepareEmail(input: {
  subject: string | null;
  from: string | null;
  text: string | null;
  html: string | null;
}): PreparedEmail {
  const from = parseFromHeader(input.from ?? undefined);
  const rawText = input.text?.trim() ? input.text : input.html ? htmlToText(input.html) : '';
  const body = stripQuotedReply(rawText.replace(/\r\n/g, '\n')).slice(0, MAX_BODY_CHARS);
  return {
    subject: (input.subject ?? '').trim(),
    fromName: from.name,
    fromEmail: from.email,
    fromDomain: from.domain,
    body,
    links: extractLinks(rawText, input.html),
  };
}

/** Lowercase, accent-free, single-spaced: the form every rule matches against. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
