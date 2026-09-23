import { describe, expect, it } from 'vitest';
import { formatSalary } from './format';

describe('formatSalary', () => {
  it('returns null when there is no salary', () => {
    expect(formatSalary(null)).toBeNull();
    expect(formatSalary({ min: null, max: null, currency: 'EUR', period: 'YEAR' })).toBeNull();
  });

  it('formats a yearly range compactly', () => {
    const text = formatSalary({ min: 40000, max: 50000, currency: 'EUR', period: 'YEAR' });
    expect(text).toMatch(/40.*50.*\/año$/);
  });

  it('formats a single bound', () => {
    expect(formatSalary({ min: null, max: 3000, currency: 'EUR', period: 'MONTH' })).toMatch(
      /3\.?000.*\/mes$/,
    );
  });
});
