/**
 * Cheap, deterministic first pass over email HEADERS (no body). It runs on every listed
 * message and decides which ones are worth keeping for classification (Phase 5).
 * Irrelevant mail is discarded here, so later stages (and any AI) never see it.
 */

/**
 * Bump whenever the rules below change: connected mailboxes are then re-scanned over the
 * whole sync window (and previously discarded mail re-evaluated) on their next sync.
 */
export const PREFILTER_VERSION = 2;

/** Applicant tracking systems and job platforms: mail from them is job-related by default. */
export const JOB_SENDER_DOMAINS = [
  'greenhouse.io',
  'greenhouse-mail.io',
  'lever.co',
  'hire.lever.co',
  'ashbyhq.com',
  'myworkday.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'workable.com',
  'workablemail.com',
  'teamtailor.com',
  'teamtailor-mail.com',
  'recruitee.com',
  'personio.de',
  'personio.com',
  'bamboohr.com',
  'icims.com',
  'successfactors.com',
  'successfactors.eu',
  'taleo.net',
  'jobvite.com',
  'breezy.hr',
  'join.com',
  'factorialhr.com',
  'infojobs.net',
  'indeed.com',
  'indeedemail.com',
  'glassdoor.com',
  'welcometothejungle.com',
  'getmanfred.com',
  'tecnoempleo.com',
  'wellfound.com',
  'otta.com',
  'hired.com',
  'turing.com',
  // France
  'hellowork.com',
  'welcomekit.co',
  'apec.fr',
  'talent-soft.com',
  'beetween.com',
  'beetween-software.com',
  'jobteaser.com',
  'francetravail.fr',
  'pole-emploi.fr',
  'cadremploi.fr',
  'meteojob.com',
  'monster.fr',
  'flatchr.io',
  'taleez.com',
  'digitalrecruiters.com',
  'jobaffinity.fr',
  // Other ATS
  'softgarden.io',
  'zohorecruit.com',
  'pinpointhq.com',
  'recruitcrm.io',
  'homerun.co',
] as const;

/** LinkedIn sends everything from linkedin.com; only these mailboxes are about jobs. */
const LINKEDIN_JOB_SENDERS = [
  'jobs-noreply@linkedin.com',
  'jobs-listings@linkedin.com',
  'jobalerts-noreply@linkedin.com',
];

/** Subject keywords (ES / EN / FR). Matched on whole words, accent-insensitive. */
export const JOB_SUBJECT_KEYWORDS = [
  // es
  'candidatura',
  'candidato',
  'solicitud de empleo',
  'proceso de seleccion',
  'entrevista',
  'oferta de empleo',
  'oferta de trabajo',
  'tu perfil',
  'vacante',
  'puesto de',
  'postulacion',
  // en
  'application',
  'applying',
  'applied',
  'interview',
  'job offer',
  'offer letter',
  'recruiter',
  'hiring',
  'position',
  'role at',
  'your candidacy',
  'next steps',
  'assessment',
  'coding challenge',
  'your profile',
  'thank you for your interest',
  // fr
  'candidature',
  'entretien',
  "offre d'emploi",
  'recrutement',
  'poste de',
  'postulation',
  'votre profil',
  'merci pour votre interet',
  'suite a votre',
  'processus de recrutement',
] as const;

/** Never job mail, whatever the headers say. */
const EXCLUDED_LABELS = new Set(['SENT', 'DRAFT', 'SPAM', 'TRASH', 'CHAT']);

export interface PrefilterInput {
  fromEmail: string | null;
  fromDomain: string | null;
  subject: string | null;
  labels: readonly string[];
  /** The connected mailbox itself: its own messages are never candidates. */
  ownEmail: string;
}

export type PrefilterResult =
  { candidate: true; reason: string } | { candidate: false; reason: string };

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function matchesDomain(domain: string, list: readonly string[]): string | undefined {
  return list.find((d) => domain === d || domain.endsWith(`.${d}`));
}

const KEYWORD_PATTERNS = JOB_SUBJECT_KEYWORDS.map((kw) => ({
  keyword: kw,
  pattern: new RegExp(
    `(^|[^\\p{L}])${normalize(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`,
    'u',
  ),
}));

export function prefilter(input: PrefilterInput): PrefilterResult {
  const excluded = input.labels.find((l) => EXCLUDED_LABELS.has(l));
  if (excluded) return { candidate: false, reason: `label:${excluded}` };
  if (input.fromEmail && input.fromEmail === input.ownEmail.toLowerCase()) {
    return { candidate: false, reason: 'own-message' };
  }

  if (input.fromEmail && LINKEDIN_JOB_SENDERS.includes(input.fromEmail)) {
    return { candidate: true, reason: `job-sender:${input.fromEmail}` };
  }
  const domain = input.fromDomain ? matchesDomain(input.fromDomain, JOB_SENDER_DOMAINS) : undefined;
  if (domain) return { candidate: true, reason: `ats-sender:${domain}` };

  if (input.subject) {
    const subject = normalize(input.subject);
    const hit = KEYWORD_PATTERNS.find(({ pattern }) => pattern.test(subject));
    if (hit) return { candidate: true, reason: `subject:${hit.keyword}` };
  }
  return { candidate: false, reason: 'no-signal' };
}

/**
 * Gmail search query used to LIST messages, so most irrelevant mail never leaves Gmail.
 * The prefilter still re-checks every result with the real headers.
 */
export function buildGmailSearchQuery({ days, after }: { days?: number; after?: Date }): string {
  const window = after
    ? `after:${Math.floor(after.getTime() / 1000)}`
    : `newer_than:${days ?? 180}d`;
  const senders = [...JOB_SENDER_DOMAINS, ...LINKEDIN_JOB_SENDERS].join(' OR ');
  const keywords = JOB_SUBJECT_KEYWORDS.map((k) =>
    k.includes(' ') || k.includes("'") ? `"${k}"` : k,
  ).join(' OR ');
  return `${window} -in:chats -in:spam -in:trash -in:sent -in:drafts {from:(${senders}) subject:(${keywords})}`;
}
