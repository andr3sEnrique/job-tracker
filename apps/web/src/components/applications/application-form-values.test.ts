import { describe, expect, it } from 'vitest';
import { diffForUpdate, emptyFormValues, toCreateInput } from './application-form-values';

const valid = {
  ...emptyFormValues(),
  companyName: 'Acme',
  roleTitle: 'Dev',
  appliedAt: '2026-09-10',
};

describe('toCreateInput', () => {
  it('builds a valid API input, trimming and nulling empty fields', () => {
    const result = toCreateInput({ ...valid, location: '  ', jobUrl: '' });
    expect(result.ok && result.input).toMatchObject({
      companyName: 'Acme',
      location: null,
      jobUrl: null,
      salary: null,
      appliedAt: '2026-09-10T12:00:00.000Z',
    });
  });

  it('maps schema errors to form fields with friendly messages', () => {
    const result = toCreateInput({ ...valid, companyName: '', jobUrl: 'nope' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['companyName', 'jobUrl']);
    }
  });

  it('validates the salary range', () => {
    const result = toCreateInput({ ...valid, salaryMin: '50000', salaryMax: '40000' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.salaryMin).toBeDefined();
  });

  it('accepts a single salary bound', () => {
    const result = toCreateInput({ ...valid, salaryMin: '45000' });
    expect(result.ok && result.input.salary).toEqual({
      min: 45000,
      max: null,
      currency: 'EUR',
      period: 'YEAR',
    });
  });
});

describe('diffForUpdate', () => {
  it('returns only changed fields', () => {
    const before = toCreateInput(valid);
    const after = toCreateInput({ ...valid, location: 'Madrid' });
    if (!before.ok || !after.ok) throw new Error('fixtures must be valid');
    expect(diffForUpdate(before.input, after.input)).toEqual({ location: 'Madrid' });
  });
});
