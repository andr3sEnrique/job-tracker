import type { WorkMode } from '@jat/shared';
import { JOB_SENDER_DOMAINS } from '../emails/prefilter.js';
import type { ExtractedData, PreparedEmail } from './types.js';

/**
 * Pulls company, role, location and job URL out of an email. Real ATS emails put most of
 * it in the subject, so subject patterns run first; the body, the sender and the links are
 * fallbacks. The confidence says which source produced the company.
 */

// A company name inside running text: stops at punctuation, a line break or a connector.
// A dot only ends it when followed by a space ("Team.io" stays whole).
const NAME = String.raw`([\p{L}\p{N}][\p{L}\p{N}&'’.\- ]{0,60}?)`;
const CONNECTORS = String.raw`for|as|pour|para|en|at|chez|in|and|et|y|·|a (?:bien )?(?:ete|été)|has|have|is|est|was`;
const END = String.raw`(?=\s*(?:\.(?:\s|$)|[,!?:;|()\n]|\s[—–-]\s|\s(?:${CONNECTORS})\s|$))`;
// A role inside running text: like NAME but also allows "/", "()", "+", "#".
const ROLE = String.raw`([\p{L}\p{N}][\p{L}\p{N}&'’.\-/()+# ]{1,80}?)`;

// ------------------------------------------------------------------------------------------
// Company
// ------------------------------------------------------------------------------------------

const COMPANY_SUBJECT_PATTERNS: RegExp[] = [
  /^\[([^\]]{2,60})\]/u, // "[Acme] We've received your application"
  /applying (?:to|for) .+? at (.+)$/iu, // "Thank you for applying to Backend Engineer at Acme"
  /application to join (.+?)[!.]*$/iu,
  /\bprocessus de recrutement (.+?)[!.]*$/iu,
  /candidature sur offre d'emploi n[°o]\s*\S+\s*-\s*([^-]+?)\s*-/iu, // APEC
  /^.+? role at (.+?)(?:\s*[/|—–-]|$)/iu, // "Fullstack Engineer Role at Acme / Next Steps"
  /\byour (.+?) careers application\b/iu, // Workday: "Your Acme Careers Application Is In!"
  /^([^-–|:!?]{2,40}?)\s*[-–|]\s*(?:candidature|nous avons|your application|thank)/iu, // "ACME - Candidature …"
  new RegExp(String.raw`\bchez ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`thank(?:s| you) for applying (?:to|at|with) ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`your application (?:was sent )?(?:to|at) ${NAME}${END}`, 'iu'),
  new RegExp(
    String.raw`thank(?:s| you) for your (?:interest in|application to) ${NAME}${END}`,
    'iu',
  ),
  new RegExp(String.raw`^(?:interview|offer letter)\b.*? at ${NAME}${END}`, 'iu'),
];

const COMPANY_BODY_PATTERNS: RegExp[] = [
  // en
  new RegExp(String.raw`thank(?:s| you) for applying (?:to|at|with) ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`your application (?:was sent )?to ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`update on your application (?:to|at|with) ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\b(?:role|position|opening|job) at ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\bjoin ${NAME} as\b`, 'iu'),
  new RegExp(String.raw`\binterest in ${NAME}${END}`, 'iu'),
  new RegExp(String.raw`\b(?:recruiter|talent partner|talent acquisition) at ${NAME}${END}`, 'iu'),
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

/** Platform, team or generic words that patterns sometimes capture instead of a company. */
const NOT_A_COMPANY = new Set([
  'linkedin',
  'linkedin job alerts',
  'indeed',
  'indeed apply',
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
  'smartrecruiters',
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
  'our team',
  'the team',
  'team',
  'recrutement',
  'de recrutement',
  'nous',
  'vous',
  'we',
  'us',
  'you',
  'france travail',
]);

/** Leading words that belong to the sentence, not to the company name. */
const COMPANY_LEAD =
  /^(?:join|joining|the|recrutement[- ]?|l'[ée]quipe(?: de)?|equipe(?: de)?|team)\s+/iu;
const FIRST_WORD_STOP =
  /^(?:nous|notre|vous|votre|our|your|we|us|how|understand|de|du|des|la|le|les|a|an|this|that)\b/iu;

const DISPLAY_NAME_PATTERNS = [
  /^(.+?)\s+(?:recruiting|recruitment|talent(?: team| acquisition)?|careers|hiring(?: team)?|jobs|hr)$/iu,
  /^(?:talent|careers|recruiting|jobs) (?:at|@) (.+)$/iu,
  /^recrutement[- ](.+)$/iu,
  /^(?:equipo de )?(?:talento|seleccion|selección) (?:de )?(.+)$/iu,
  /^(?:[\p{L}'’.]+ ){0,2}[\p{L}'’.]+\s+[-–|@]\s+(.+)$/u, // "Sara Lind - Acme", "dagmara - Acme"
];

const PLATFORM_DISPLAY_NAMES =
  /^(?:linkedin|indeed|hellowork|welcome to the jungle|apec|glassdoor|jobteaser|france travail)\b/iu;

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
  /^([a-z0-9]+)(?:-[a-z0-9]+)*\.teamtailor-mail\.com$/i, // "acme-demo.teamtailor-mail.com" → acme
  /^([a-z0-9-]+)\.myworkdayjobs\.com$/i,
];

function cleanCompany(value: string | undefined): string | null {
  let v = value
    ?.replace(/\s+/g, ' ')
    .replace(/^[\s"'“«]+|[\s"'”».,:;!?-]+$/g, '')
    .trim();
  if (!v) return null;
  for (let i = 0; i < 2; i++) v = v.replace(COMPANY_LEAD, '');
  if (v.length < 2 || v.length > 60 || v.split(' ').length > 5) return null;
  if (FIRST_WORD_STOP.test(v) || NOT_A_COMPANY.has(v.toLowerCase())) return null;
  return v;
}

// ------------------------------------------------------------------------------------------
// Role
// ------------------------------------------------------------------------------------------

const ROLE_SUBJECT_PATTERNS: RegExp[] = [
  /applying (?:to|for) (?:the )?(.+?) (?:at|chez|@) /iu,
  /\bapplication\s*[_:–—]\s*(.+)$/iu, // "Thank you for your application _ Backend Engineer - Team"
  /candidature (?:bien )?re[cç]ue pour (?:le poste (?:de |d'))?(.+)$/iu,
  /merci (?:de|pour) votre candidature pour (?:être |etre |le poste (?:de |d'))?(.+)$/iu,
  /\bcandidature pour (?:le poste (?:de |d'))?(.+)$/iu,
  /^(.+?)\s+[-–]\s+votre candidature/iu,
  /candidature sur offre d'emploi n[°o]\s*\S+\s*-\s*[^-]+?\s*-\s*(.+)$/iu, // APEC: "… - COMPANY - Role"
  /\boffre (?:d'emploi )?n[°o]\s*\S+\s*[-–]\s*(.+)$/iu,
  /\binterest\s*[-–]\s*(.+)$/iu, // "Thank You for Your Interest - Software Engineer II 10159879"
  /^(.+?)\s+role at\b/iu,
  /\bvia indeed\s*:\s*(.+)$/iu,
  /\benvoy[ée] par [^—–-]+[—–-]\s*(.+)$/iu, // Indeed messages
  /^[^-–|]+[-–|]\s*candidature\s+(.+)$/iu, // "ACME - Candidature Role - F/H - Paris"
  /^(?:merci pour votre candidature|test technique)\s*[—–-]\s*(.+)$/iu,
  /^(?:interview for|offer letter\s*[—–-])\s*(.+?)\s+at\b/iu,
  /\btechnical interview for (.+)$/iu,
  /^l'offre de (.+?) n'est plus\b/iu,
];

const ROLE_BODY_PATTERNS: RegExp[] = [
  new RegExp(String.raw`for the ${ROLE} (?:position|role)\b`, 'iu'),
  new RegExp(String.raw`applying (?:to|for) the ${ROLE} (?:position|role)\b`, 'iu'),
  new RegExp(String.raw`\bour ${ROLE} (?:opening|role|position)\b`, 'iu'),
  new RegExp(String.raw`\bjoin .{1,60}? as ${ROLE}${END}`, 'iu'),
  new RegExp(String.raw`\b(?:pour le|au) poste de ${ROLE}${END}`, 'iu'),
  new RegExp(String.raw`\bpara (?:el puesto de )?${ROLE}${END}`, 'iu'),
  new RegExp(String.raw`\bcandidatura para ${ROLE}${END}`, 'iu'),
];

const GENDER_MARKER =
  /\(?\s*\b(?:[HFM]\s*\/\s*[HFMX](?:\s*\/\s*[HFMX])?|m\s*\/\s*w\s*\/\s*d)\b\s*\)?/giu;
const ROLE_STOPWORDS = /\b(?:this|that|our|your|we|needs|you|nous|vous|notre|votre)\b/iu;

function cleanRole(value: string | undefined): string | null {
  if (!value) return null;
  let v = value.replace(GENDER_MARKER, ' ').replace(/\s+/g, ' ').trim();
  // "Role - Team - Paris": the first segment is the role.
  v = v.split(/\s+[-–—|]\s+|\s+\/\s+/)[0] ?? '';
  v = v
    .replace(/\s+\d{5,}$/, '') // requisition numbers
    .replace(/^[\s"'“«]+|[\s"'”».,:;!?-]+$/g, '')
    .replace(/\s*\(\s*\)$/, '')
    .trim();
  if (v.length < 2 || v.length > 80 || ROLE_STOPWORDS.test(v)) return null;
  return v;
}

// ------------------------------------------------------------------------------------------
// Job URL, work mode, location
// ------------------------------------------------------------------------------------------

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

const titleCase = (slug: string) =>
  slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');

function isPlatformDomain(domain: string) {
  return (
    JOB_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)) ||
    domain.endsWith('linkedin.com')
  );
}

function firstMatch(
  patterns: RegExp[],
  text: string,
  clean: (v: string | undefined) => string | null,
) {
  for (const pattern of patterns) {
    const value = clean(pattern.exec(text)?.[1]);
    if (value) return value;
  }
  return null;
}

function companyFromDisplayName(email: PreparedEmail): string | null {
  const name = email.fromName?.trim();
  if (!name || !email.fromDomain || PLATFORM_DISPLAY_NAMES.test(name)) return null;
  for (const pattern of DISPLAY_NAME_PATTERNS) {
    const value = cleanCompany(pattern.exec(name)?.[1]);
    if (value) return value;
  }
  // "Acme" <no-reply@hire.lever.co>: an ATS sending on behalf of the company.
  const looksLikePerson = /^[\p{Lu}][\p{Ll}]+ [\p{Lu}][\p{Ll}]+$/u.test(name);
  return isPlatformDomain(email.fromDomain) && !looksLikePerson ? cleanCompany(name) : null;
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

/** maya@acme.dev → "Acme" (only for humans or teams writing from a company domain). */
function companyFromDomain(email: PreparedEmail): string | null {
  const domain = email.fromDomain;
  if (!domain || FREEMAIL.has(domain) || isPlatformDomain(domain)) return null;
  const parts = domain.split('.');
  const name = (parts.length >= 2 ? parts[parts.length - 2] : parts[0])
    // datadoghq.com → datadog, acmecareers.com → acme
    ?.replace(/(?<=.{3})(hq|careers|jobs|recruiting|talent|mail)$/, '');
  return name ? titleCase(name) : null;
}

export function extractJobData(email: PreparedEmail): ExtractedData {
  const sources: [() => string | null, number][] = [
    [() => firstMatch(COMPANY_SUBJECT_PATTERNS, email.subject, cleanCompany), 0.9],
    [() => firstMatch(COMPANY_BODY_PATTERNS, email.subject, cleanCompany), 0.9],
    [() => firstMatch(COMPANY_BODY_PATTERNS, email.body, cleanCompany), 0.85],
    [() => companyFromDisplayName(email), 0.8],
    [() => companyFromSlug(email), 0.6],
    [() => companyFromDomain(email), 0.5],
  ];
  let company: string | null = null;
  let companyConfidence = 0;
  for (const [source, confidence] of sources) {
    company = source();
    if (company) {
      companyConfidence = confidence;
      break;
    }
  }

  let role =
    firstMatch(ROLE_SUBJECT_PATTERNS, email.subject, cleanRole) ??
    firstMatch(ROLE_BODY_PATTERNS, email.body, cleanRole);

  // LinkedIn-style block: "{role}\n{company} · {location} ({mode})".
  let location: string | null = null;
  const lines = email.body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const dotLine = lines.findIndex((l) => /\s·\s/.test(l));
  if (dotLine > 0) {
    const locationText = lines[dotLine]!.split(' · ').slice(1).join(' · ');
    role ??= cleanRole(lines[dotLine - 1]);
    const place = locationText
      .replace(/\(.*?\)/g, '')
      .replace(/\b(remote|remoto|en remoto)\b/gi, '')
      .trim();
    location = place.length >= 2 ? place : null;
  }
  const modeSource = dotLine >= 0 ? lines[dotLine]! : email.subject;
  const workMode = WORK_MODE_PATTERNS.find(([p]) => p.test(modeSource))?.[1] ?? null;

  const jobUrl = email.links.find((l) => JOB_URL_PATTERNS.some((p) => p.test(l))) ?? null;

  return { company, companyConfidence, role, location, workMode, jobUrl };
}
