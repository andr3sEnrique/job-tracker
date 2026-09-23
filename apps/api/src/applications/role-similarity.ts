const STOPWORDS = new Set([
  'de',
  'la',
  'le',
  'el',
  'of',
  'the',
  'a',
  'and',
  'et',
  'y',
  'en',
  'in',
  'h',
  'f',
  'm',
  'x',
]);

/** Seniority and gender markers don't make two roles different. */
const NOISE = new Set([
  'senior',
  'sr',
  'junior',
  'jr',
  'lead',
  'mid',
  'confirme',
  'confirmee',
  'hf',
  'fh',
  'mf',
]);

function tokens(role: string): Set<string> {
  return new Set(
    role
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9+#]+/g, ' ')
      .split(' ')
      .filter((t) => t.length > 0 && !STOPWORDS.has(t) && !NOISE.has(t)),
  );
}

/** Jaccard similarity of meaningful words, 0..1. "Sr. Backend Engineer (H/F)" ≈ "Backend Engineer". */
export function roleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  return intersection / (ta.size + tb.size - intersection);
}

/**
 * Company names compared without spaces, punctuation, a leading article or a web suffix:
 * "Nimbus Labs" ≈ "nimbuslabs", "Checkout.com" ≈ "Checkout", "Le Mercato de l'Emploi" ≈
 * "Mercato de lEmploi".
 */
export function compactName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/^(the|le|la|les|l'|el|los)\s+/, '')
    .replace(/\.(com|io|ai|fr|co|net|org|dev|app|es|eu)$/, '')
    .replace(/[^a-z0-9]/g, '');
}
