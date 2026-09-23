import type {
  ApplicationSource,
  ApplicationStatus,
  EmailCategory,
  EventType,
  WorkMode,
} from '@jat/shared';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Aplicada',
  SCREENING: 'En revisión',
  INTERVIEWING: 'Entrevistas',
  OFFER: 'Oferta',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  WITHDRAWN: 'Retirada',
  GHOSTED: 'Sin respuesta',
};

/** CSS variable holding each status colour (defined in globals.css, light and dark). */
export const STATUS_COLOR_VAR: Record<ApplicationStatus, string> = {
  APPLIED: 'var(--status-applied)',
  SCREENING: 'var(--status-screening)',
  INTERVIEWING: 'var(--status-interviewing)',
  OFFER: 'var(--status-offer)',
  ACCEPTED: 'var(--status-accepted)',
  REJECTED: 'var(--status-rejected)',
  WITHDRAWN: 'var(--status-withdrawn)',
  GHOSTED: 'var(--status-ghosted)',
};

export const SOURCE_LABELS: Record<ApplicationSource, string> = {
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  INFOJOBS: 'InfoJobs',
  COMPANY_SITE: 'Web de la empresa',
  REFERRAL: 'Referido',
  RECRUITER: 'Recruiter',
  OTHER: 'Otra',
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  REMOTE: 'Remoto',
  HYBRID: 'Híbrido',
  ONSITE: 'Presencial',
  UNKNOWN: 'Sin especificar',
};

export const EVENT_LABELS: Record<EventType, string> = {
  APPLIED: 'Candidatura enviada',
  CONFIRMATION_RECEIVED: 'Confirmación recibida',
  RECRUITER_CONTACT: 'Contacto de recruiter',
  INTERVIEW_SCHEDULED: 'Entrevista programada',
  TECHNICAL_INTERVIEW_SCHEDULED: 'Entrevista técnica programada',
  OFFER_RECEIVED: 'Oferta recibida',
  REJECTED: 'Rechazo',
  WITHDRAWN: 'Candidatura retirada',
  STATUS_CHANGED: 'Cambio de estado',
  NOTE: 'Nota',
};

export const CATEGORY_LABELS: Record<EmailCategory, string> = {
  APPLICATION_SUBMITTED: 'Candidatura enviada',
  APPLICATION_CONFIRMATION: 'Confirmación',
  RECRUITER_REPLY: 'Recruiter',
  INTERVIEW: 'Entrevista',
  TECHNICAL_INTERVIEW: 'Entrevista técnica',
  REJECTION: 'Rechazo',
  OFFER: 'Oferta',
  JOB_ALERT: 'Alerta de empleo',
  IRRELEVANT: 'Irrelevante',
  UNKNOWN: 'Sin clasificar',
};

/** Categories that belong to an application (the rest never create events). */
export const APPLICATION_CATEGORIES: EmailCategory[] = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_CONFIRMATION',
  'RECRUITER_REPLY',
  'INTERVIEW',
  'TECHNICAL_INTERVIEW',
  'REJECTION',
  'OFFER',
];
