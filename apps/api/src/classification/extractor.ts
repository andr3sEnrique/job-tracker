import type { WorkMode } from '@jat/shared';
import { JOB_SENDER_DOMAINS } from '../emails/prefilter.js';
import type { ExtractedData, PreparedEmail } from './types.js';

/**
 * Pulls company, role, location and job URL out of an email. Several sources are tried in
 * order of reliability; the confidence says which one produced the company.
 */

// A company or role name: runs until punctuation, a line break or a connector word.
const NAME = String.raw`([\p{L}\p{N}][\p{L}\p{N}&'’.\- ]{0,60}?)`;
const END = String.raw`(?=\s*(?:[.,!?:;|()\n]|\s[—–-]\s|\s(?:for|as|pour|para|en|at|chez|in|and|et|y|·)\s|$))`;

const COMPANY_PATTERNS: RegExp[] = [
  // en
  new RegExp(String.raw`thank(?:s| you) for applying (?:to|at|with) ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`your application (?:was sent )?to ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`update on your application (?:to|at|with) ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\b(?:role|position|opening|job) at ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\bjoin ${NAME} as\b`, 'iu'),
  new RegExp(String.raw`\binterest in ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\b(?:recruiter|talent partner|talent acquisition) at ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`^(?:interview|offer letter)\b.*? at ${NAME}${END}`, 'imu'),
  // fr
  new RegExp(String.raw`candidature chez ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\bchez ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`l'int[ée]r[êe]t que vous portez [àa] ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`^recrutement ${NAME}$`, 'imu'),
  new RegExp(String.raw`^L'[ée]quipe ${NAME}$`, 'imu'),
  // es
  new RegExp(String.raw`se ha enviado a ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`candidatura en ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`del equipo (?:de talento )?de ${NAME}${END}`, 'iu'),
];

const ROLE_PATTERNS: RegExp[] = [
  new RegExp(String.raw`for the ${NAME} (?:position|role)\b`, 'iu'),
  new RegExp(String.raw`applying (?:to|for) the ${NAME} (?:position|role)\b`, 'iu'),
  new RegExp(String.raw`\bour ${NAME} (?:opening|role|position)\b`, 'iu'),
  new RegExp(String.raw`^(?:interview for|offer letter\s*[—–-])\s*${NAME} at\b`, 'imu'),
  new RegExp(String.raw`technical interview for ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\bjoin .{1,60}? as ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\b(?:pour le|au) poste de ${NAME}${END}`, 'iu'),
  new RegExp(
    String.raw`^(?:merci pour votre candidature|test technique)\s*[—–-]\s*${NAME}$`,
    'imu',
  ),
  new RegExp(String.raw`\bpara (?:el puesto de )?${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\bcandidatura para ${NAME}${END}`, 'iu'),
];

/** Names that look like companies in sender display names but are platforms or people roles. */
const NOT_A_COMPANY = new Set(
  [
    'linkedin',
    'linkedin job alerts',
    'indeed',
    'infojobs',
    'welcome to the jungle',
    'hellowork',
    'glassdoor',
    'jobteaser',
    'apec',
    'monster',
    'greenhouse',
    'lever',
    'workday',
    'ashby',
    'teamtailor',
    'recruiting',
    'talent',
    'careers',
    'jobs',
    'hr',
    'rrhh',
    'rh',
    'no reply',
    'noreply',
    'notifications',
  ].map((n) => n.toLowerCase()),
);

const DISPLAY_NAME_PATTERNS = [
  /^(.+?)\s+(?:recruiting|recruitment|talent(?: team| acquisition)?|careers|hiring(?: team)?|jobs|hr)$/i,
  /^(?:talent|careers|recruiting|jobs) (?:at|@) (.+)$/i,
  /^recrutement (.+)$/i,
  /^(?:equipo de )?(?:talento|seleccion|selección) (?:de )?(.+)$/i,
];

/** Where each ATS puts the company slug (subdomain or first path segment). */
const SLUG_PATTERNS = [
  /^https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([a-z0-9-]+)/i,
  /^https?:\/\/jobs\.lever\.co\/([a-z0-9-]+)/i,
  /^https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9-]+)/i,
  /^https?:\/\/apply\.workable\.com\/([a-z0-9-]+)/i,
  /^https?:\/\/jobs\.smartrecruiters\.com\/([a-z0-9-]+)/i,
  /^https?:\/\/([a-z0-9-]+)\.(?:recruitee\.com|bamboohr\.com|teamtailor\.com|jobs\.personio\.de|breezy\.hr)/i,
  /^https?:\/\/([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com/i,
  /^https?:\/\/(?:www\.)?welcometothejungle\.com\/[a-z]{2}\/companies\/([a-z0-9-]+)/i,
];
const SENDER_SLUG_PATTERNS = [
  /^([a-z0-9-]+)\.teamtailor-mail\.com$/i,
  /^([a-z0-9-]+)\.myworkdayjobs\.com$/i,
];

const JOB_URL_PATTERNS = [
  /linkedin\.com\/jobs\/view\//i,
  /(boards|job-boards)\.greenhouse\.io\/.+\/jobs\//i,
  /jobs\.lever\.co\/[^/]+\/[0-9a-f-]+/i,
  /jobs\.ashbyhq\.com\/[^/]+\/[0-9a-f-]+/i,
  /apply\.workable\.com\/[^/]+\/j\//i,
  /myworkdayjobs\.com\/.+\/job\//i,
  /welcometothejungle\.com\/.+\/jobs\//i,
  /indeed\.[a-z.]+\/(viewjob|rc\/clk)/i,
  /infojobs\.net\/.+\/of-/i,
  /teamtailor\.com\/jobs\//i,
  /smartrecruiters\.com\/[^/]+\/\d+/i,
];

const WORK_MODE_PATTERNS: [RegExp, WorkMode][] = [
  [/\b(remote|remoto|en remoto|t[ée]l[ée]travail|full remote)\b/i, 'REMOTE'],
  [/\b(hybrid|h[íi]brido|hybride)\b/i, 'HYBRID'],
  [/\b(on-?site|presencial|sur site)\b/i, 'ONSITE'],
];

const FREEMAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
]);

function clean(value: string | undefined): string | null {
  const v = value
    ?.replace(/\s+/g, ' ')
    .replace(/^[\s"'“«]+|[\s"'”».,:;!?-]+$/g, '')
    .trim();
  return v && v.length >= 2 && v.length <= 80 ? v : null;
}

const titleCase = (slug: string) =>
  slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');

function firstMatch(patterns: RegExp[], texts: string[]): string | null {
  for (const text of texts) {
    for (const pattern of patterns) {
      const value = clean(pattern.exec(text)?.[1]);
      if (value && !NOT_A_COMPANY.has(value.toLowerCase())) return value;
    }
  }
  return null;
}

function isPlatformDomain(domain: string) {
  return (
    JOB_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)) ||
    domain.endsWith('linkedin.com')
  );
}

function companyFromDisplayName(email: PreparedEmail): string | null {
  const name = email.fromName?.trim();
  if (!name || !email.fromDomain) return null;
  for (const pattern of DISPLAY_NAME_PATTERNS) {
    const value = clean(pattern.exec(name)?.[1]);
    if (value && !NOT_A_COMPANY.has(value.toLowerCase())) return value;
  }
  // "Nimbus Labs" <no-reply@hire.lever.co>: an ATS sending on behalf of the company.
  const looksLikePerson =
    /^[\p{Lu}][\p{Ll}]+ [\p{Lu}][\p{Ll}]+$/u.test(name) && !isPlatformDomain(email.fromDomain);
  if (
    isPlatformDomain(email.fromDomain) &&
    !looksLikePerson &&
    !NOT_A_COMPANY.has(name.toLowerCase())
  ) {
    return clean(name);
  }
  return null;
}

function companyFromSlug(email: PreparedEmail): string | null {
  for (const pattern of SENDER_SLUG_PATTERNS) {
    const slug = email.fromDomain ? pattern.exec(email.fromDomain)?.[1] : undefined;
    if (slug) return titleCase(slug);
  }
  for (const link of email.links) {
    for (const pattern of SLUG_PATTERNS) {
      const slug = pattern.exec(link)?.[1];
      if (slug) return titleCase(slug);
    }
  }
  return null;
}

/** maya@nimbuslabs.dev → "Nimbuslabs" (only for humans writing from a company domain). */
function companyFromDomain(email: PreparedEmail): string | null {
  const domain = email.fromDomain;
  if (!domain || FREEMAIL.has(domain) || isPlatformDomain(domain)) return null;
  const parts = domain.split('.');
  const name = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return name ? titleCase(name) : null;
}

export function extractJobData(email: PreparedEmail): ExtractedData {
  const texts = [email.subject, email.body];

  let company = firstMatch(COMPANY_PATTERNS, texts);
  let companyConfidence = company ? 0.9 : 0;
  if (!company) {
    company = companyFromDisplayName(email);
    companyConfidence = company ? 0.8 : 0;
  }
  if (!company) {
    company = companyFromSlug(email);
    companyConfidence = company ? 0.6 : 0;
  }
  if (!company) {
    company = companyFromDomain(email);
    companyConfidence = company ? 0.5 : 0;
  }

  let role = firstMatch(ROLE_PATTERNS, texts);
  let location: string | null = null;
  let workMode: WorkMode | null = null;

  // LinkedIn-style block: "{role}\n{company} · {location} ({mode})".
  const lines = email.body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const dotLine = lines.findIndex((l) => /\s·\s/.test(l));
  if (dotLine > 0) {
    const [where, ...rest] = lines[dotLine]!.split(' · ').slice(1);
    const locationText = [where, ...rest].join(' · ');
    role ??= clean(lines[dotLine - 1]);
    location = clean(
      locationText.replace(/\(.*?\)/g, '').replace(/\b(remote|remoto|en remoto)\b/gi, ''),
    );
  }
  const modeSource = dotLine >= 0 ? lines[dotLine]! : email.subject;
  workMode = WORK_MODE_PATTERNS.find(([p]) => p.test(modeSource))?.[1] ?? null;

  const jobUrl = email.links.find((l) => JOB_URL_PATTERNS.some((p) => p.test(l))) ?? null;

  return { company, companyConfidence, role, location, workMode, jobUrl };
}
