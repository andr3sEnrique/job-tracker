import { describe, expect, it } from 'vitest';
import { gmailWebUrl, parseFromHeader } from './message-headers.js';

describe('parseFromHeader', () => {
  it.each([
    [
      '"Ana García" <Ana@Acme.com>',
      { name: 'Ana García', email: 'ana@acme.com', domain: 'acme.com' },
    ],
    [
      'Talent Team <no-reply@greenhouse.io>',
      { name: 'Talent Team', email: 'no-reply@greenhouse.io', domain: 'greenhouse.io' },
    ],
    ['<jobs@lever.co>', { name: null, email: 'jobs@lever.co', domain: 'lever.co' }],
    ['plain@example.org', { name: null, email: 'plain@example.org', domain: 'example.org' }],
  ])('%s', (input, expected) => {
    expect(parseFromHeader(input)).toEqual(expected);
  });

  it('tolerates missing or malformed values', () => {
    expect(parseFromHeader(undefined)).toEqual({ name: null, email: null, domain: null });
    expect(parseFromHeader('Just A Name')).toEqual({ name: null, email: null, domain: null });
  });
});

describe('gmailWebUrl', () => {
  it('builds an rfc822msgid search link for the right account', () => {
    expect(gmailWebUrl('<abc@mail.example>', 'me@gmail.com')).toBe(
      'https://mail.google.com/mail/?authuser=me%40gmail.com#search/rfc822msgid%3Aabc%40mail.example',
    );
  });

  it('returns null without a Message-ID', () => {
    expect(gmailWebUrl(null, 'me@gmail.com')).toBeNull();
  });
});
