import type { EmailCategory } from '@jat/shared';

/**
 * Synthetic job-search emails (EN / FR / ES). They power the fake mailbox used in
 * development and tests, and double as the classifier's evaluation dataset.
 * All companies, people and links are fictional.
 *
 * Placeholders: {c} company, {d} company domain, {s} company slug, {r} role.
 */
export interface EmailTemplate {
  key: string;
  from: string;
  subject: string;
  body: string;
  expected: {
    category: EmailCategory;
    /** Whether the extractor should find the company / role in this template. */
    company: boolean;
    role: boolean;
  };
}

type Step = EmailTemplate & { sameThread?: boolean };

const t = (
  key: string,
  from: string,
  subject: string,
  body: string,
  category: EmailCategory,
  { company = true, role = true, sameThread = false } = {},
): Step => ({ key, from, subject, body, expected: { category, company, role }, sameThread });

/** A story is the sequence of emails one application produces over time. */
export const STORIES: Step[][] = [
  [
    t(
      'en-greenhouse-confirmation',
      '"{c} Recruiting" <no-reply@greenhouse.io>',
      'Thank you for applying to {c}',
      'Hi,\n\nThank you for your interest in {c}! We have received your application for the {r} position. Our team will review your profile and get back to you.\n\nBest regards,\n{c} Talent Team\n\nhttps://boards.greenhouse.io/{s}/jobs/4401234',
      'APPLICATION_CONFIRMATION',
    ),
    t(
      'en-greenhouse-rejection',
      '"{c} Recruiting" <no-reply@greenhouse.io>',
      'Update on your application to {c}',
      'Hi,\n\nThank you for taking the time to apply for the {r} role at {c}. Unfortunately, after careful consideration, we have decided not to move forward with your application at this time.\n\nWe wish you the best in your job search.\n\n{c} Talent Team',
      'REJECTION',
      { sameThread: true },
    ),
  ],
  [
    t(
      'en-lever-confirmation',
      '"{c}" <no-reply@hire.lever.co>',
      'Your application to {c}',
      'Hello,\n\nThanks for applying to the {r} role at {c}. We received your application and will be in touch soon.\n\nhttps://jobs.lever.co/{s}/0f3a9c2e',
      'APPLICATION_CONFIRMATION',
    ),
    t(
      'en-recruiter-interview',
      '"Maya Chen" <maya.chen@{d}>',
      'Interview for {r} at {c}',
      "Hi,\n\nI'm Maya, a recruiter at {c}. We enjoyed reviewing your application and would like to schedule a 30-minute interview to get to know you. Please pick a slot that works for you: https://calendly.com/maya-{s}/30min\n\nThanks,\nMaya",
      'INTERVIEW',
    ),
    t(
      'en-technical-interview',
      '"Maya Chen" <maya.chen@{d}>',
      'Next steps: technical interview for {r}',
      'Hi again,\n\nGreat news: the team would like to move you to the technical interview. It is a 90-minute live coding session with two engineers from {c}. Let me know your availability next week.\n\nMaya',
      'TECHNICAL_INTERVIEW',
      // The company is only in the sender's domain: matching relies on it, not the text.
      { company: false },
    ),
    t(
      'en-offer',
      '"Maya Chen" <maya.chen@{d}>',
      'Offer letter — {r} at {c}',
      'Hi,\n\nWe are thrilled to extend you an offer to join {c} as {r}! Please find the offer letter attached. Let us know if you have any questions.\n\nCongratulations,\nMaya',
      'OFFER',
    ),
  ],
  [
    t(
      'fr-welcomekit-confirmation',
      '"{c}" <no-reply@candidates.welcomekit.co>',
      'Votre candidature chez {c}',
      "Bonjour,\n\nNous avons bien reçu votre candidature pour le poste de {r} chez {c}. Notre équipe l'étudie avec attention et reviendra vers vous rapidement.\n\nL'équipe {c}",
      'APPLICATION_CONFIRMATION',
    ),
    t(
      'fr-welcomekit-rejection',
      '"{c}" <no-reply@candidates.welcomekit.co>',
      'Suite à votre candidature chez {c}',
      "Bonjour,\n\nNous vous remercions de l'intérêt que vous portez à {c}. Malheureusement, nous ne donnerons pas suite à votre candidature pour le poste de {r}.\n\nNous vous souhaitons pleine réussite dans vos recherches.",
      'REJECTION',
      { sameThread: true },
    ),
  ],
  [
    t(
      'fr-teamtailor-confirmation',
      '"{c}" <no-reply@{s}.teamtailor-mail.com>',
      'Merci pour votre candidature – {r}',
      'Bonjour,\n\nMerci pour votre candidature au poste de {r}. Nous revenons vers vous très vite.\n\nRecrutement {c}',
      'APPLICATION_CONFIRMATION',
    ),
    t(
      'fr-interview',
      '"Julie Martin" <julie.martin@{d}>',
      "Proposition d'entretien – {c}",
      'Bonjour,\n\nVotre profil a retenu notre attention pour le poste de {r}. Nous souhaiterions vous rencontrer lors d’un entretien en visio. Pourriez-vous me communiquer vos disponibilités ?\n\nBien cordialement,\nJulie Martin, Talent Acquisition chez {c}',
      'INTERVIEW',
    ),
    t(
      'fr-technical',
      '"Julie Martin" <julie.martin@{d}>',
      'Test technique – {r}',
      'Bonjour,\n\nSuite à notre échange, nous vous proposons de passer à l’étape suivante : un test technique à réaliser en 48 h, puis un entretien technique avec l’équipe.\n\nJulie',
      'TECHNICAL_INTERVIEW',
      { company: false },
    ),
  ],
  [
    t(
      'es-linkedin-submitted',
      '"LinkedIn" <jobs-noreply@linkedin.com>',
      'Tu solicitud se ha enviado a {c}',
      'Tu solicitud se ha enviado a {c}\n\n{r}\n{c} · Madrid (Híbrido)\n\nVer empleo: https://www.linkedin.com/jobs/view/4012345678',
      'APPLICATION_SUBMITTED',
    ),
    t(
      'es-recruiter-contact',
      '"Laura Gómez" <laura.gomez@{d}>',
      'Tu candidatura en {c}',
      'Hola,\n\nSoy Laura, del equipo de talento de {c}. He revisado tu candidatura para {r} y me gustaría comentarte el proceso. ¿Te va bien una llamada breve esta semana?\n\nUn saludo',
      'RECRUITER_REPLY',
    ),
    t(
      'es-rejection',
      '"Laura Gómez" <laura.gomez@{d}>',
      'Re: Tu candidatura en {c}',
      'Hola,\n\nGracias por tu tiempo en el proceso para {r}. Lamentablemente hemos decidido continuar con otros candidatos cuyo perfil se ajusta más a lo que buscamos.\n\nTe deseamos mucha suerte.',
      'REJECTION',
      { sameThread: true },
    ),
  ],
  [
    t(
      'en-linkedin-submitted',
      '"LinkedIn" <jobs-noreply@linkedin.com>',
      'Your application was sent to {c}',
      'Your application was sent to {c}\n\n{r}\n{c} · Remote\n\nView job: https://www.linkedin.com/jobs/view/4087654321',
      'APPLICATION_SUBMITTED',
    ),
  ],
  [
    t(
      'en-cold-outreach',
      '"Sam Rivera" <sam@{d}>',
      'Opportunity at {c}',
      "Hi,\n\nI came across your profile and I think you'd be a great fit for our {r} opening at {c}. Would you be open to a quick chat?\n\nSam, Talent Partner at {c}",
      'RECRUITER_REPLY',
    ),
  ],
];

/** Job-related but not about one of your applications, and not job-related at all. */
export const STANDALONE: EmailTemplate[] = [
  t(
    'en-linkedin-alert',
    '"LinkedIn Job Alerts" <jobalerts-noreply@linkedin.com>',
    '30+ new jobs for "Backend Engineer"',
    'New jobs matching your search: Backend Engineer at Nimbus Labs, Senior Backend Engineer at Quantia, Platform Engineer at Orbital Pay… Unsubscribe from job alerts.',
    'JOB_ALERT',
    { company: false, role: false },
  ),
  t(
    'fr-indeed-alert',
    '"Indeed" <alert@jobalert.indeed.com>',
    "12 nouvelles offres d'emploi correspondant à votre recherche",
    'Nouvelles offres pour « Développeur Full Stack » à Paris. Voir toutes les offres. Se désabonner de cette alerte.',
    'JOB_ALERT',
    { company: false, role: false },
  ),
  t(
    'en-newsletter-opportunity',
    '"Startup Digest" <news@startupdigest.example>',
    'The opportunity nobody is talking about',
    'This week: three growth tactics for founders, a new funding round roundup and our favourite reads. Read online · Unsubscribe',
    'IRRELEVANT',
    { company: false, role: false },
  ),
];

/** Discarded by the prefilter: never stored with metadata, never classified. */
export const DISCARDED = [
  { from: 'pedidos@tienda.example', subject: 'Tu pedido ha sido enviado', body: 'Llegará mañana.' },
  { from: 'news@newsletter.example', subject: 'Las 10 noticias de la semana', body: 'Noticias.' },
  { from: 'amigo@gmail.com', subject: 'Cena el sábado?', body: '¿Te apuntas?' },
];

export const FAKE_COMPANIES = [
  { name: 'Nimbus Labs', domain: 'nimbuslabs.dev', slug: 'nimbuslabs' },
  { name: 'Quantia', domain: 'quantia.io', slug: 'quantia' },
  { name: 'Orbital Pay', domain: 'orbitalpay.com', slug: 'orbitalpay' },
  { name: 'Kora Systems', domain: 'korasystems.com', slug: 'korasystems' },
  { name: 'Lumen Data', domain: 'lumendata.ai', slug: 'lumendata' },
  { name: 'Tramuntana Software', domain: 'tramuntana.dev', slug: 'tramuntana' },
  { name: 'Brisa Energy', domain: 'brisaenergy.com', slug: 'brisaenergy' },
  { name: 'Helix Bio', domain: 'helixbio.eu', slug: 'helixbio' },
] as const;

export const FAKE_ROLES = [
  'Backend Engineer',
  'Senior Full Stack Engineer',
  'Frontend Developer',
  'Platform Engineer',
  'Product Engineer',
] as const;

export function fill(text: string, company: (typeof FAKE_COMPANIES)[number], role: string): string {
  return text
    .replaceAll('{c}', company.name)
    .replaceAll('{d}', company.domain)
    .replaceAll('{s}', company.slug)
    .replaceAll('{r}', role);
}
