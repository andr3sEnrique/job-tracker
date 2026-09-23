import { describe, expect, it } from 'vitest';
import {
  extractLinks,
  htmlToText,
  normalizeText,
  prepareEmail,
  stripQuotedReply,
} from './prepare-email.js';

describe('htmlToText', () => {
  it('drops markup, scripts and styles and decodes entities', () => {
    const html =
      '<html><head><style>p{}</style></head><body><p>Hola&nbsp;Ana,</p><p>Tu candidatura &amp; CV</p><script>x()</script><br>Fin&#33;</body></html>';
    expect(htmlToText(html)).toBe('Hola Ana,\nTu candidatura & CV\nFin!');
  });
});

describe('stripQuotedReply', () => {
  it.each([
    'Thanks!\n\nOn Mon, 1 Sep 2026 at 10:00, Ana <ana@x.com> wrote:\n> Hi',
    'Merci !\n\nLe lun. 1 sept. 2026 à 10:00, Ana <ana@x.com> a écrit :\n> Bonjour',
    'Gracias!\n\nEl lun, 1 sept 2026 a las 10:00, Ana <ana@x.com> escribió:\n> Hola',
  ])('removes the quoted message', (text) => {
    expect(stripQuotedReply(text)).toMatch(/^(Thanks|Merci|Gracias) ?!$/);
  });

  it('removes > quoted lines', () => {
    expect(stripQuotedReply('New text\n> old\n>> older')).toBe('New text');
  });
});

describe('extractLinks', () => {
  it('collects links from text and href attributes, without trailing punctuation', () => {
    expect(
      extractLinks(
        'See https://jobs.lever.co/acme/123. Thanks',
        '<a href="https://boards.greenhouse.io/acme/jobs/1?a=1&amp;b=2">x</a>',
      ),
    ).toEqual([
      'https://boards.greenhouse.io/acme/jobs/1?a=1&b=2',
      'https://jobs.lever.co/acme/123',
    ]);
  });
});

describe('prepareEmail', () => {
  it('prefers the text part, falls back to HTML, and truncates', () => {
    const prepared = prepareEmail({
      subject: '  Hello ',
      from: '"Acme Talent" <talent@acme.com>',
      text: null,
      html: `<p>${'x'.repeat(5000)}</p>`,
    });
    expect(prepared).toMatchObject({
      subject: 'Hello',
      fromName: 'Acme Talent',
      fromDomain: 'acme.com',
    });
    expect(prepared.body.length).toBe(4000);
  });
});

describe('normalizeText', () => {
  it('lowercases, strips accents and normalises quotes and spaces', () => {
    expect(normalizeText('Nous avons  bien reçu\nvotre candidature – l’équipe')).toBe(
      "nous avons bien recu votre candidature – l'equipe",
    );
  });
});
