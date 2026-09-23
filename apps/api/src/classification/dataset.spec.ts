import { describe, expect, it } from 'vitest';
import {
  FAKE_COMPANIES,
  FAKE_ROLES,
  REGRESSION_CASES,
  STANDALONE,
  STORIES,
  fill,
} from '../gmail/fake-mailbox.data.js';
import { extractJobData } from './extractor.js';
import { prepareEmail } from './prepare-email.js';
import { RulesClassifier } from './rules-classifier.js';

/**
 * Evaluation over the synthetic dataset (EN/FR/ES). Every template is rendered with several
 * companies and roles; the classifier and the extractor must get all of them right.
 * Add a template here whenever a real email is misclassified (anonymised!).
 */
const classifier = new RulesClassifier();
const templates = [...STORIES.flat(), ...STANDALONE];
// Index 5 (Tramuntana Software, tramuntana.dev): a domain that differs from the name.
const combos = [0, 3, 5].map((i) => ({
  company: FAKE_COMPANIES[i]!,
  role: FAKE_ROLES[i % FAKE_ROLES.length]!,
}));

const compact = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

const cases = templates.flatMap((template) =>
  combos.map(({ company, role }) => ({
    name: `${template.key} · ${company.name} · ${role}`,
    template,
    company,
    role,
    email: prepareEmail({
      subject: fill(template.subject, company, role),
      from: fill(template.from, company, role),
      text: fill(template.body, company, role),
      html: null,
    }),
  })),
);

describe('rules classifier on the evaluation dataset', () => {
  it.each(cases)('$name → category', ({ email, template }) => {
    expect(classifier.classify(email).category).toBe(template.expected.category);
  });
});

describe('extractor on the evaluation dataset', () => {
  it.each(cases.filter((c) => c.template.expected.company))(
    '$name → company',
    ({ email, company }) => {
      const extracted = extractJobData(email);
      expect(compact(extracted.company ?? '')).toBe(compact(company.name));
    },
  );

  it.each(cases.filter((c) => c.template.expected.role))('$name → role', ({ email, role }) => {
    expect(extractJobData(email).role?.toLowerCase()).toBe(role.toLowerCase());
  });
});

describe('regression cases from real mailboxes (anonymised)', () => {
  const prepared = REGRESSION_CASES.map((c) => ({
    ...c,
    email: prepareEmail({ subject: c.subject, from: c.from, text: c.body, html: null }),
  }));

  it.each(prepared)('$key → category', ({ email, expected }) => {
    expect(classifier.classify(email).category).toBe(expected.category);
  });

  it.each(prepared.filter((c) => c.expected.company))('$key → company', ({ email, expected }) => {
    expect(compact(extractJobData(email).company ?? '')).toBe(compact(expected.company!));
  });

  it.each(prepared.filter((c) => c.expected.role))('$key → role', ({ email, expected }) => {
    expect(extractJobData(email).role).toBe(expected.role);
  });

  it.each(
    prepared.filter(
      (c) => !c.expected.company && !['IRRELEVANT', 'JOB_ALERT'].includes(c.expected.category),
    ),
  )('$key → no made-up company', ({ email }) => {
    expect(extractJobData(email).company).toBeNull();
  });
});
