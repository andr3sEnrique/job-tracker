const LEGAL_SUFFIXES = [
  's.l.u.',
  's.l.',
  'sl',
  'slu',
  's.a.',
  'sa',
  'inc.',
  'inc',
  'ltd.',
  'ltd',
  'llc',
  'gmbh',
  'sas',
  's.a.s.',
  'b.v.',
  'bv',
  'plc',
  'corp.',
  'corp',
  'co.',
];

/**
 * Canonical form used to match companies: lowercase, no accents, no punctuation,
 * no legal suffix. "Acme Tecnología, S.L." and "ACME TECNOLOGIA" → "acme tecnologia".
 */
export function normalizeCompanyName(name: string): string {
  let value = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      if (value.endsWith(` ${suffix}`) || value.endsWith(`,${suffix}`)) {
        value = value.slice(0, -suffix.length).replace(/[\s,]+$/, '');
        changed = true;
      }
    }
  }
  return value.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
