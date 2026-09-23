import type { Application, ApplicationEvent } from './applications.js';
import {
  isActiveStatus,
  type ApplicationSource,
  type ApplicationStatus,
  type EventType,
  type WorkMode,
} from './enums.js';

/**
 * Deterministic sample dataset: powers the web mock client and the database seed.
 * All company names are fictional.
 */

const COMPANIES = [
  { name: 'Nimbus Labs', domain: 'nimbuslabs.dev' },
  { name: 'Quantia', domain: 'quantia.io' },
  { name: 'Orbital Pay', domain: 'orbitalpay.com' },
  { name: 'Verdant Health', domain: 'verdanthealth.eu' },
  { name: 'Kora Systems', domain: 'korasystems.com' },
  { name: 'Lumen Data', domain: 'lumendata.ai' },
  { name: 'Atlas Mobility', domain: 'atlasmobility.es' },
  { name: 'Brisa Energy', domain: 'brisaenergy.com' },
  { name: 'Cobalt Security', domain: 'cobaltsec.io' },
  { name: 'Fjord Analytics', domain: 'fjordanalytics.com' },
  { name: 'Helix Bio', domain: 'helixbio.eu' },
  { name: 'Pixelforge', domain: 'pixelforge.studio' },
  { name: 'Tramuntana Software', domain: 'tramuntana.dev' },
  { name: 'Ondina Travel', domain: 'ondinatravel.com' },
  { name: 'Granito Fintech', domain: 'granito.finance' },
  { name: 'Sable Logistics', domain: 'sablelogistics.com' },
  { name: 'Aurora Retail', domain: 'auroraretail.es' },
  { name: 'Meridian Cloud', domain: 'meridiancloud.io' },
] as const;

const ROLES = [
  'Frontend Engineer',
  'Backend Engineer (Node.js)',
  'Full Stack Developer',
  'Senior Full Stack Engineer',
  'Software Engineer, Platform',
  'React Developer',
  'NestJS Backend Developer',
  'Product Engineer',
  'TypeScript Engineer',
  'Software Engineer II',
] as const;

const LOCATIONS = [
  'Madrid',
  'Barcelona',
  'Valencia',
  'Remoto (España)',
  'Remoto (UE)',
  'Málaga',
  'Bilbao',
];
const SOURCES: ApplicationSource[] = [
  'LINKEDIN',
  'LINKEDIN',
  'LINKEDIN',
  'INFOJOBS',
  'INDEED',
  'COMPANY_SITE',
  'COMPANY_SITE',
  'REFERRAL',
  'RECRUITER',
];
const ON_SITE_WORK_MODES: WorkMode[] = ['HYBRID', 'HYBRID', 'ONSITE', 'UNKNOWN'];

/** Weighted final statuses: most applications stay early in the funnel, like real life. */
const FINAL_STATUSES: ApplicationStatus[] = [
  'APPLIED',
  'APPLIED',
  'APPLIED',
  'APPLIED',
  'APPLIED',
  'SCREENING',
  'SCREENING',
  'INTERVIEWING',
  'INTERVIEWING',
  'INTERVIEWING',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'REJECTED',
  'REJECTED',
  'REJECTED',
  'REJECTED',
  'WITHDRAWN',
  'GHOSTED',
  'GHOSTED',
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** mulberry32: tiny seeded PRNG so the dataset is stable across reloads and tests. */
function createRng(seed: number) {
  let a = seed;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    chance: (p: number) => next() < p,
  };
}

type Step = { type: EventType; toStatus: ApplicationStatus | null; summary: string | null };

function stepsFor(final: ApplicationStatus, rng: ReturnType<typeof createRng>): Step[] {
  const applied: Step = { type: 'APPLIED', toStatus: 'APPLIED', summary: null };
  const confirmation: Step = {
    type: 'CONFIRMATION_RECEIVED',
    toStatus: null,
    summary: 'Hemos recibido tu candidatura',
  };
  const recruiter: Step = {
    type: 'RECRUITER_CONTACT',
    toStatus: 'SCREENING',
    summary: 'Llamada inicial con talent acquisition',
  };
  const interview: Step = {
    type: 'INTERVIEW_SCHEDULED',
    toStatus: 'INTERVIEWING',
    summary: 'Entrevista con el hiring manager',
  };
  const technical: Step = {
    type: 'TECHNICAL_INTERVIEW_SCHEDULED',
    toStatus: 'INTERVIEWING',
    summary: 'Prueba técnica / live coding',
  };
  const offer: Step = { type: 'OFFER_RECEIVED', toStatus: 'OFFER', summary: 'Oferta recibida' };

  const base = rng.chance(0.8) ? [applied, confirmation] : [applied];
  switch (final) {
    case 'APPLIED':
      return base;
    case 'SCREENING':
      return [...base, recruiter];
    case 'INTERVIEWING':
      return rng.chance(0.5)
        ? [...base, recruiter, interview]
        : [...base, recruiter, interview, technical];
    case 'OFFER':
      return [...base, recruiter, interview, technical, offer];
    case 'ACCEPTED':
      return [
        ...base,
        recruiter,
        interview,
        technical,
        offer,
        { type: 'STATUS_CHANGED', toStatus: 'ACCEPTED', summary: 'Oferta aceptada' },
      ];
    case 'REJECTED': {
      const progress = rng.pick([
        [],
        [recruiter],
        [recruiter, interview],
        [recruiter, interview, technical],
      ]);
      return [
        ...base,
        ...progress,
        {
          type: 'REJECTED',
          toStatus: 'REJECTED',
          summary: 'Hemos decidido continuar con otros candidatos',
        },
      ];
    }
    case 'WITHDRAWN':
      return [
        ...base,
        recruiter,
        { type: 'WITHDRAWN', toStatus: 'WITHDRAWN', summary: 'Retirada por mi parte' },
      ];
    case 'GHOSTED':
      return [
        ...base,
        { type: 'STATUS_CHANGED', toStatus: 'GHOSTED', summary: 'Más de 30 días sin respuesta' },
      ];
  }
}

export interface SampleDataset {
  applications: Application[];
  events: ApplicationEvent[];
}

export function generateSampleDataset({
  now = new Date(),
  count = 46,
  seed = 20260923,
}: { now?: Date; count?: number; seed?: number } = {}): SampleDataset {
  const rng = createRng(seed);
  const applications: Application[] = [];
  const events: ApplicationEvent[] = [];

  for (let i = 0; i < count; i++) {
    const id = `app_${String(i + 1).padStart(3, '0')}`;
    const company = rng.pick(COMPANIES);
    const final = rng.pick(FINAL_STATUSES);
    const steps = stepsFor(final, rng);

    // Work backwards from the total length of the process so no event lands in the future.
    // Active applications stay recent; closed ones can be months old.
    const gaps = steps.map((_, index) =>
      index === 0 ? 0 : rng.int(1, 9) * DAY + rng.int(0, 20) * HOUR,
    );
    const processLength = gaps.reduce((sum, gap) => sum + gap, 0);
    const idleDays = isActiveStatus(final) ? rng.int(0, 12) : rng.int(0, 90);
    let cursor = now.getTime() - processLength - idleDays * DAY - rng.int(1, 12) * HOUR;
    const appliedAt = new Date(cursor).toISOString();

    let status: ApplicationStatus = 'APPLIED';
    steps.forEach((step, index) => {
      cursor += gaps[index] ?? 0;
      const fromStatus = step.toStatus ? status : null;
      if (step.toStatus) status = step.toStatus;
      events.push({
        id: `${id}_evt_${index + 1}`,
        applicationId: id,
        type: step.type,
        fromStatus: index === 0 ? null : fromStatus,
        toStatus: step.toStatus,
        occurredAt: new Date(cursor).toISOString(),
        source: step.type === 'STATUS_CHANGED' && step.toStatus === 'GHOSTED' ? 'SYSTEM' : 'EMAIL',
        summary: step.summary,
      });
    });

    const location = rng.pick(LOCATIONS);
    const hasSalary = rng.chance(0.45);
    const salaryMin = rng.int(32, 58) * 1000;
    applications.push({
      id,
      company: { id: `cmp_${company.domain}`, name: company.name, domain: company.domain },
      roleTitle: rng.pick(ROLES),
      location,
      workMode: location.startsWith('Remoto') ? 'REMOTE' : rng.pick(ON_SITE_WORK_MODES),
      salary: hasSalary
        ? {
            min: salaryMin,
            max: salaryMin + rng.int(4, 15) * 1000,
            currency: 'EUR',
            period: 'YEAR',
          }
        : null,
      source: rng.pick(SOURCES),
      jobUrl: rng.chance(0.7) ? `https://${company.domain}/careers/${id}` : null,
      status,
      appliedAt,
      lastActivityAt: new Date(cursor).toISOString(),
      needsReview: rng.chance(0.08),
      notes: rng.chance(0.2) ? 'Preguntar por el stack y la política de remoto.' : null,
    });
  }

  return { applications, events };
}
