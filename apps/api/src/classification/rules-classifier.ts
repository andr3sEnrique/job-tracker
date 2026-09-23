import type { EmailCategory } from '@jat/shared';
import { JOB_SENDER_DOMAINS } from '../emails/prefilter.js';
import { normalizeText } from './prepare-email.js';
import { EmailClassifier, type Classification, type PreparedEmail } from './types.js';

/**
 * Deterministic classifier. Rules run in priority order and the first match wins:
 * a rejection that starts with "thank you for applying" is a rejection, and an interview
 * invitation that mentions "your application" is an interview.
 *
 * Patterns match the normalized text (lowercase, no accents) of subject + body.
 */

interface Rule {
  id: string;
  category: EmailCategory;
  confidence: number;
  test: (ctx: RuleContext) => boolean;
}

interface RuleContext {
  subject: string;
  text: string;
  fromEmail: string;
  fromDomain: string;
  isPersonSender: boolean;
}

const anyOf = (patterns: RegExp[]) => (value: string) => patterns.some((p) => p.test(value));

const ALERT_SENDER =
  /(^|[.@-])(job-?alerts?|alerts?)[.@-]|jobalert|jobs-listings@|jobalerts-noreply@/;
const ALERT_SUBJECT = anyOf([
  /\bnew jobs?\b/,
  /\bjobs? (for you|you may|matching|recommended)/,
  /\bjob alert/,
  /nouvelles offres/,
  /offres? d'emploi (correspondant|pour vous|recommandees)/,
  /alerte emploi/,
  /nuevos empleos/,
  /empleos que coinciden/,
  /ofertas (para ti|recomendadas)/,
]);

const REJECTION = anyOf([
  /\bunfortunately\b/,
  /\bnot (to )?(move|moving) forward\b/,
  /\bwill not be (moving forward|proceeding)\b/,
  /\bdecided to (pursue|proceed with|move forward with|go with) other/,
  /\bposition has (been|now been) filled\b/,
  /\bno longer (considering|under consideration)\b/,
  /\bregret to inform\b/,
  /\bmalheureusement\b/,
  /\bne (pas )?(donner(ons|a)?|pouvons pas donner) (une suite|suite)\b/,
  /\bpas (pu )?(retenir|retenu)\b/,
  /\bn'avons pas (pu )?retenu\b/,
  /\bn'a pas ete retenue?\b/,
  /\blamentablemente\b/,
  /\bcontinuar con otros? (candidatos|perfiles)\b/,
  /\bhemos decidido no (continuar|seguir|avanzar)\b/,
  /\bno (has|ha) sido seleccionad[oa]\b/,
]);

const OFFER = anyOf([
  /\boffer letter\b/,
  /\b(pleased|thrilled|happy|delighted) to (extend|offer)\b/,
  /\bextend (you )?an offer\b/,
  /\bjob offer\b/,
  /\bproposition (d'embauche|de contrat)\b/,
  /\bpromesse d'embauche\b/,
  /\bnous avons le plaisir de vous (proposer|faire une offre)\b/,
  /\bcarta (de )?oferta\b/,
  /\b(nos complace|queremos) (ofrecerte|hacerte una oferta)\b/,
]);

const TECHNICAL = anyOf([
  /\btechnical (interview|test|assessment|challenge|round|screen)\b/,
  /\bcoding (challenge|interview|exercise|test|assessment)\b/,
  /\blive coding\b/,
  /\btake[- ]home\b/,
  /\b(hackerrank|codility|coderpad|codesignal|testgorilla)\b/,
  /\btest technique\b/,
  /\bentretien technique\b/,
  /\bexercice technique\b/,
  /\bprueba tecnica\b/,
  /\bentrevista tecnica\b/,
  /\breto tecnico\b/,
]);

const INTERVIEW_STRONG = anyOf([
  /\b(invite|like to schedule|schedule|book|arrange|set up)\b.{0,40}\b(interview|call|chat|meeting)\b/,
  /\bcalendly\.com\b/,
  /\byour availability\b/,
  /\bproposition d'entretien\b/,
  /\bvous rencontrer\b/,
  /\b(convier|inviter) a un entretien\b/,
  /\bvos disponibilites\b/,
  /\b(agendar|programar|concertar) (una )?(entrevista|llamada|reunion)\b/,
  /\binvitacion a (una )?entrevista\b/,
]);

const INTERVIEW_WEAK_SUBJECT = anyOf([/\binterview\b/, /\bentretien\b/, /\bentrevista\b/]);

const SUBMITTED = anyOf([
  /\byour application was sent to\b/,
  /\bapplication submitted\b/,
  /\byou applied (to|for)\b/,
  /\btu solicitud se ha enviado\b/,
  /\bhas (aplicado|postulado) a\b/,
  /\bvotre candidature a (bien )?ete envoyee\b/,
  /\bcandidature envoyee\b/,
  /\bvous avez postule\b/,
]);

const CONFIRMATION = anyOf([
  /\b(we('ve| have)|has been) received your application\b/,
  /\breceived your application\b/,
  /\bapplication (has been |was )?received\b/,
  /\bthank(s| you) for (applying|your application)\b/,
  /\bnous avons bien recu\b/,
  /\bbien recu votre candidature\b/,
  /\bmerci pour votre candidature\b/,
  /\bmerci d'avoir postule\b/,
  /\bhemos recibido tu (candidatura|solicitud)\b/,
  /\bgracias por (tu|su) (candidatura|solicitud)\b/,
]);

const RECRUITER_TOPIC = anyOf([
  /\byour (profile|application|background|experience)\b/,
  /\b(opportunity|opening|role|position)\b/,
  /\b(votre (profil|candidature)|opportunite|poste)\b/,
  /\b(tu (perfil|candidatura|solicitud)|oportunidad|puesto|vacante)\b/,
]);

const NEWSLETTER = anyOf([
  /\bunsubscribe\b/,
  /\bse desabonner\b/,
  /\bdarse de baja\b/,
  /\bread online\b/,
]);

const NO_REPLY =
  /^(no-?reply|noreply|do-?not-?reply|notifications?|mailer|news|newsletter|info|hello|team)[.@+-]/;
const FREEMAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
]);

function isJobPlatform(domain: string): boolean {
  return (
    JOB_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)) ||
    domain.endsWith('linkedin.com')
  );
}

const RULES: Rule[] = [
  {
    id: 'job-alert',
    category: 'JOB_ALERT',
    confidence: 0.9,
    test: (c) => ALERT_SENDER.test(c.fromEmail) || ALERT_SUBJECT(c.subject),
  },
  { id: 'rejection', category: 'REJECTION', confidence: 0.9, test: (c) => REJECTION(c.text) },
  { id: 'offer', category: 'OFFER', confidence: 0.85, test: (c) => OFFER(c.text) },
  {
    id: 'technical',
    category: 'TECHNICAL_INTERVIEW',
    confidence: 0.85,
    test: (c) => TECHNICAL(c.text),
  },
  {
    id: 'interview',
    category: 'INTERVIEW',
    confidence: 0.8,
    test: (c) => INTERVIEW_STRONG(c.text),
  },
  {
    id: 'submitted',
    category: 'APPLICATION_SUBMITTED',
    confidence: 0.9,
    test: (c) => SUBMITTED(c.text),
  },
  {
    id: 'confirmation',
    category: 'APPLICATION_CONFIRMATION',
    confidence: 0.85,
    test: (c) => CONFIRMATION(c.text),
  },
  {
    id: 'interview-subject',
    category: 'INTERVIEW',
    confidence: 0.6,
    test: (c) => INTERVIEW_WEAK_SUBJECT(c.subject),
  },
  {
    id: 'recruiter',
    category: 'RECRUITER_REPLY',
    confidence: 0.65,
    test: (c) => c.isPersonSender && RECRUITER_TOPIC(c.text),
  },
  {
    id: 'newsletter',
    category: 'IRRELEVANT',
    confidence: 0.7,
    test: (c) => NEWSLETTER(c.text),
  },
];

export class RulesClassifier extends EmailClassifier {
  readonly id = 'rules@1';

  classify(email: PreparedEmail): Classification {
    const fromEmail = email.fromEmail ?? '';
    const fromDomain = email.fromDomain ?? '';
    const ctx: RuleContext = {
      subject: normalizeText(email.subject),
      text: normalizeText(`${email.subject}\n${email.body}`),
      fromEmail,
      fromDomain,
      // A human at a company (not an ATS, a platform, a no-reply box or a personal mailbox).
      isPersonSender:
        fromEmail !== '' &&
        !NO_REPLY.test(fromEmail) &&
        !isJobPlatform(fromDomain) &&
        !FREEMAIL.has(fromDomain),
    };

    const rule = RULES.find((r) => r.test(ctx));
    if (!rule) return { category: 'UNKNOWN', confidence: 0, signals: [] };
    return { category: rule.category, confidence: rule.confidence, signals: [rule.id] };
  }
}
