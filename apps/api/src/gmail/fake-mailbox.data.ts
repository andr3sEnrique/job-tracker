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

/**
 * Regression cases: anonymised versions of real emails the rules once got wrong
 * (real phrasing, fictional companies and people). Each one pins the exact expected result.
 */
export interface RegressionCase {
  key: string;
  from: string;
  subject: string;
  body: string;
  expected: { category: EmailCategory; company: string | null; role: string | null };
}

const r = (
  key: string,
  from: string,
  subject: string,
  body: string,
  category: EmailCategory,
  company: string | null = null,
  role: string | null = null,
): RegressionCase => ({ key, from, subject, body, expected: { category, company, role } });

export const REGRESSION_CASES: RegressionCase[] = [
  // Account and platform notifications → irrelevant
  r(
    'fr-verification-code',
    'no-reply@emails.hellowork.com',
    '123456, votre code de vérification est disponible',
    'Votre code : 123456',
    'IRRELEVANT',
  ),
  r(
    'fr-account-created',
    'noreply@apec.fr',
    'Votre création de compte Apec',
    'Bienvenue, votre compte a été créé.',
    'IRRELEVANT',
  ),
  r(
    'en-login',
    '"Nordvik" <no-reply@nordvik-demo.teamtailor-mail.com>',
    'Login to Nordvik',
    'Click the link to log in to your candidate account.',
    'IRRELEVANT',
  ),
  r(
    'fr-data-deletion',
    'no-reply@talent-soft.com',
    'Suppression de vos données personnelles',
    'Conformément au RGPD, vos données seront supprimées.',
    'IRRELEVANT',
  ),
  r(
    'fr-candidate-space',
    'noreply@successfactors.eu',
    'Bienvenue dans votre espace candidat Zentro !',
    'Votre espace candidat a été créé.',
    'IRRELEVANT',
  ),
  r(
    'en-survey',
    'no-reply@ashbyhq.com',
    'Your experience at Pixelia',
    'Tell us about your candidate experience in a 2-minute survey.',
    'IRRELEVANT',
  ),
  r(
    'en-keep-account',
    '"Pixelia" <no-reply@pixelia.com>',
    "Let's stay in touch! Please Take Action to Keep Your Pixelia Candidate Account",
    'Your candidate account will be deleted unless you log in.',
    'IRRELEVANT',
  ),
  r(
    'en-activate',
    'no-reply@nordvik.example',
    "Nordvik | Now it's time to activate your application!",
    'Activate your candidate profile to continue.',
    'IRRELEVANT',
  ),
  r(
    'fr-finalise',
    'noreply@emails.hellowork.com',
    'Finalisez votre candidature sur le site de Zentro',
    "Il ne vous reste plus qu'une étape.",
    'IRRELEVANT',
  ),
  // Suggested jobs → job alert
  r(
    'fr-hellowork-suggestion',
    'alertes@emails.hellowork.com',
    'Alex, Nordvik recrute un Ingénieur Cloud Senior H/F',
    'Découvrez cette offre qui correspond à votre profil.',
    'JOB_ALERT',
  ),
  r(
    'en-jobs-match',
    'hello@remotejobs.example',
    '84 remote jobs match your profile',
    'New remote jobs this week. Unsubscribe.',
    'JOB_ALERT',
  ),
  r(
    'fr-company-recruits',
    '"Zentro" <no-reply@zentro.teamtailor-mail.com>',
    'Zentro recrute un(e) Engineering Manager à Paris',
    'Nous recrutons ! Découvrez le poste.',
    'JOB_ALERT',
  ),
  // Confirmations the rules missed or misread
  r(
    'en-application-is-in',
    '"Pixelia Careers" <pixelia@myworkday.com>',
    'Your Pixelia Careers Application Is In!',
    'Thank you for applying for the Software Engineer II position. Your application is in.',
    'APPLICATION_CONFIRMATION',
    'Pixelia',
    'Software Engineer II',
  ),
  r(
    'fr-conditional-rejection',
    'recrutement@kalmhealth.fr',
    'Confirmation candidature',
    "Bonjour, nous accusons bonne réception de votre candidature au poste de Développeur Python. Sans réponse de notre part sous 15 jours, considérez que votre candidature n'a pas été retenue.",
    'APPLICATION_CONFIRMATION',
    'Kalmhealth',
    'Développeur Python',
  ),
  r(
    'fr-arrived-chez',
    '"HelloWork" <noreply@emails.hellowork.com>',
    'Votre candidature est arrivée chez Team.io',
    'Votre candidature pour le poste de Lead Developer a bien été transmise à Team.io.',
    'APPLICATION_CONFIRMATION',
    'Team.io',
    'Lead Developer',
  ),
  r(
    'en-confirmation-mentions-interview',
    '"Nordvik" <no-reply@nordvik.teamtailor-mail.com>',
    '👋 Alex - We have received your application!',
    'Thanks for applying! If your profile matches, we will reach out to schedule an interview.',
    'APPLICATION_CONFIRMATION',
    'Nordvik',
  ),
  r(
    'fr-role-gender-marker',
    '"Zentro" <no-reply@beetween-software.com>',
    'Candidature bien reçue pour le poste de Software Engineer H/F',
    'Merci pour votre candidature.',
    'APPLICATION_CONFIRMATION',
    'Zentro',
    'Software Engineer',
  ),
  r(
    'en-zero-width',
    '"Pixelia" <noreply@smartrecruiters.com>',
    'Thank you for applying to \u200bBackend Engineer\u200b at \u200bPixelia\u200b',
    'We received your application.',
    'APPLICATION_CONFIRMATION',
    'Pixelia',
    'Backend Engineer',
  ),
  r(
    'en-application-to-join',
    '"Kalm Health" <no-reply@ashbyhq.com>',
    'Thank you for your application to join Kalm Health',
    'We have received your application.',
    'APPLICATION_CONFIRMATION',
    'Kalm Health',
  ),
  r(
    'fr-person-dash-company',
    '"Sara Lind - Nordvik" <no-reply@nordvik.teamtailor-mail.com>',
    'Nous avons bien reçu votre candidature !',
    'Bonjour, merci pour votre candidature au poste de Data Engineer.',
    'APPLICATION_CONFIRMATION',
    'Nordvik',
    'Data Engineer',
  ),
  r(
    'fr-role-then-status',
    'rh@zentro.fr',
    'Software Engineer Fullstack (Python-React) H/F - Votre candidature a été prise en compte',
    'Bonjour, votre candidature a bien été prise en compte.',
    'APPLICATION_CONFIRMATION',
    'Zentro',
    'Software Engineer Fullstack (Python-React)',
  ),
  r(
    'fr-company-dash-candidature',
    '"Pixelia" <no-reply@candidates.welcomekit.co>',
    'PIXELIA - Candidature Développeur.se Back-end Java - F/H - Paris',
    'Nous avons bien reçu votre candidature.',
    'APPLICATION_CONFIRMATION',
    'Pixelia',
    'Développeur.se Back-end Java',
  ),
  r(
    'fr-if-not-selected',
    'jobs@kalmhealth.io',
    'Candidature reçue pour le poste de Ingénieur logiciel',
    "Nous avons bien reçu votre candidature. Si votre profil n'est pas retenu, vous recevrez un email.",
    'APPLICATION_CONFIRMATION',
    'Kalmhealth',
    'Ingénieur logiciel',
  ),
  r(
    'en-underscore-role',
    '"Nordvik" <no-reply@hire.lever.co>',
    'Hi Alex, Thank you for your application _ Confirmed Backend Engineer - Payments',
    'We received your application.',
    'APPLICATION_CONFIRMATION',
    'Nordvik',
    'Confirmed Backend Engineer',
  ),
  r(
    'fr-pour-etre',
    '"Zentro" <noreply@reply.hellowork.com>',
    'Merci de votre candidature pour être Développeur Full Stack Java (H/F)',
    'Votre candidature a bien été reçue.',
    'APPLICATION_CONFIRMATION',
    'Zentro',
    'Développeur Full Stack Java',
  ),
  r(
    'en-bracket-company',
    '"Kalm Health" <no-reply@hire.lever.co>',
    "[Kalm Health] We've received your application!",
    'Thanks for applying.',
    'APPLICATION_CONFIRMATION',
    'Kalm Health',
  ),
  r(
    'fr-welcome-process',
    'noreply@smartrecruiters.com',
    'Bienvenue à bord du processus de recrutement NORDVIK',
    'Merci pour votre candidature, nous revenons vers vous rapidement.',
    'APPLICATION_CONFIRMATION',
    'NORDVIK',
  ),
  // Submissions
  r(
    'fr-apec-submitted',
    'noreply@apec.fr',
    "Candidature sur offre d'emploi N° 1234567W - ZENTRO - Founding Full-stack Engineer",
    'Votre candidature a bien été envoyée au recruteur.',
    'APPLICATION_SUBMITTED',
    'ZENTRO',
    'Founding Full-stack Engineer',
  ),
  // Closed applications
  r(
    'fr-talent-pool',
    '"Nordvik" <no-reply@nordvik.teamtailor-mail.com>',
    'Pouvons-nous vous garder dans notre vivier de talents?',
    'Nous avons choisi un autre profil mais aimerions garder votre CV.',
    'REJECTION',
    'Nordvik',
  ),
  r(
    'fr-archived',
    'noreply@recruitmail.com',
    "Notification d'archivage de votre candidature",
    'Votre candidature a été archivée.',
    'REJECTION',
  ),
  r(
    'en-rejection-req-number',
    '"Pixelia" <pixelia@myworkday.com>',
    'Thank You for Your Interest - Software Engineer II 10159879',
    'Unfortunately we have decided to move forward with other candidates.',
    'REJECTION',
    'Pixelia',
    'Software Engineer II',
  ),
  r(
    'fr-offer-closed',
    'noreply@francetravail.fr',
    "L'offre de Ingénieur Logiciel H/F n'est plus disponible",
    "L'offre à laquelle vous avez postulé n'est plus disponible.",
    'REJECTION',
    null,
    'Ingénieur Logiciel',
  ),
  r(
    'fr-indeed-submitted',
    'indeedapply@indeed.com',
    'Candidatures via Indeed : Software Engineer',
    'Votre candidature a été transmise.',
    'APPLICATION_SUBMITTED',
    null,
    'Software Engineer',
  ),
  r(
    'en-first-name-dash-company',
    '"Dagny - Nordvik" <no-reply@nordvik.teamtailor-mail.com>',
    'Thank you for your job application! ✨',
    'Unfortunately we have decided to move forward with other candidates.',
    'REJECTION',
    'Nordvik',
  ),
  r(
    'en-hq-domain',
    'recruiting@pixeliahq.com',
    'Your application - Manager I, Engineering - Code Security at Pixelia',
    'Unfortunately, we will not be moving forward.',
    'REJECTION',
    'Pixelia',
  ),
  // People
  r(
    'fr-indeed-message',
    'indeedapply@indeed.com',
    'Nouveau message envoyé par Elena Duval — Software Engineer',
    'Bonjour, merci pour votre intérêt pour le poste.',
    'RECRUITER_REPLY',
    null,
    'Software Engineer',
  ),
  r(
    'en-role-at-next-steps',
    '"Mia Park" <mia@venture.example>',
    'Fullstack Engineer Role at Kalm Health / Next Steps',
    'Hi, thanks for your interest in the role. Would you be available for a call?',
    'RECRUITER_REPLY',
    'Kalm Health',
    'Fullstack Engineer',
  ),
];
