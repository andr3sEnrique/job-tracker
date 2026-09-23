import { describe, expect, it } from 'vitest';
import { normalizeCompanyName } from './company-name.js';

describe('normalizeCompanyName', () => {
  it.each([
    ['Acme Tecnología, S.L.', 'acme tecnologia'],
    ['ACME TECNOLOGIA', 'acme tecnologia'],
    ['Globex Inc.', 'globex'],
    ['Initech GmbH', 'initech'],
    ['  Nimbus   Labs  ', 'nimbus labs'],
    ['Foo-Bar S.A.', 'foo bar'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCompanyName(input)).toBe(expected);
  });

  it('does not strip suffix-like words inside the name', () => {
    expect(normalizeCompanyName('Salsa Studio')).toBe('salsa studio');
  });
});
