import { describe, expect, it } from 'vitest';
import { compactName, roleSimilarity } from './role-similarity.js';

describe('roleSimilarity', () => {
  it('treats seniority, gender markers and punctuation as noise', () => {
    expect(roleSimilarity('Sr. Backend Engineer (H/F)', 'Backend Engineer')).toBe(1);
    expect(roleSimilarity('Développeur Full Stack', 'developpeur full-stack')).toBe(1);
  });

  it('scores partially overlapping roles', () => {
    expect(roleSimilarity('Backend Engineer', 'Platform Engineer')).toBeCloseTo(1 / 3);
  });

  it('returns 0 for unrelated or empty roles', () => {
    expect(roleSimilarity('Product Designer', 'Backend Engineer')).toBe(0);
    expect(roleSimilarity('', 'Backend Engineer')).toBe(0);
  });
});

describe('compactName', () => {
  it('ignores spacing, case and accents', () => {
    expect(compactName('Nimbus Labs')).toBe(compactName('nimbuslabs'));
    expect(compactName('Énergie Brisa')).toBe('energiebrisa');
  });
});
