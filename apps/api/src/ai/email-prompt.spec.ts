import { describe, expect, it } from 'vitest';
import { buildEmailPrompt, redact } from './email-prompt.js';

describe('redact', () => {
  it('removes email addresses and phone numbers', () => {
    const text = 'Écrivez à marie.dupont@acme.fr ou appelez le +33 6 12 34 56 78 / 06.12.34.56.78.';
    const out = redact(text);
    expect(out).not.toMatch(/marie|dupont|12 34|34\.56/);
    expect(out).toContain('[email]');
    expect(out.match(/\[phone\]/g)).toHaveLength(2);
  });

  it('keeps short numbers such as salaries, years and requisition ids', () => {
    expect(redact('45 000 € — 2026 — Req 4521')).toBe('45 000 € — 2026 — Req 4521');
  });

  it('strips query strings from links (tracking and unsubscribe tokens)', () => {
    expect(redact('https://jobs.example/apply/123?token=abc&u=me#x')).toBe(
      'https://jobs.example/apply/123',
    );
  });
});

describe('buildEmailPrompt', () => {
  it('sends the sender domain but never the address', () => {
    const prompt = buildEmailPrompt({
      subject: 'Entretien chez Acme',
      fromName: 'Marie Dupont',
      fromEmail: 'marie@acme.fr',
      fromDomain: 'acme.fr',
      body: 'Bonjour, pouvez-vous confirmer ? Mon mail : marie@acme.fr',
      links: ['https://acme.fr/jobs/42?ref=mail'],
    });
    expect(prompt).not.toContain('marie@acme.fr');
    expect(prompt).toContain('domain: acme.fr');
    expect(prompt).toContain('https://acme.fr/jobs/42\n');
  });

  it('truncates long bodies', () => {
    const prompt = buildEmailPrompt({
      subject: 's',
      fromName: null,
      fromEmail: null,
      fromDomain: null,
      body: 'x'.repeat(20_000),
      links: [],
    });
    expect(prompt.length).toBeLessThan(4500);
  });
});

describe('redact performance', () => {
  it('stays linear on long runs of word characters (no catastrophic backtracking)', () => {
    const started = performance.now();
    redact('x'.repeat(50_000));
    redact(`${'a.'.repeat(20_000)}@`);
    // The quadratic version took ~15 s on less text; 2 s leaves room for a busy CI machine.
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
