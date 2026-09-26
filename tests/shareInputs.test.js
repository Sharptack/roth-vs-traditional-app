import { describe, it, expect } from 'vitest';
import { DEFAULT_FORM_VALUES } from '../src/lib/formInputs.js';
import { shareText, valuesFromSearch, valuesToSearch } from '../src/lib/shareInputs.js';

describe('valuesToSearch / valuesFromSearch', () => {
  it('round-trips every form value', () => {
    const values = { ...DEFAULT_FORM_VALUES, grossIncome: '$150,000', filingStatus: 'mfj', retirementLifestyle: '0.7' };
    const back = valuesFromSearch(valuesToSearch(values));
    expect(back.values).toEqual(values);
    expect(back.compareValues).toBeNull();
  });

  it('carries the "Compare a change" second set separately', () => {
    const values = { ...DEFAULT_FORM_VALUES };
    const compareValues = { ...DEFAULT_FORM_VALUES, retirementAge: '60' };
    const back = valuesFromSearch(valuesToSearch(values, compareValues));
    expect(back.values).toEqual(values);
    expect(back.compareValues).toEqual(compareValues);
  });

  it('fills missing keys with defaults, ignores unknown ones, and returns null for no inputs', () => {
    const back = valuesFromSearch('?grossIncome=80000&bogus=1');
    expect(back.values).toEqual({ ...DEFAULT_FORM_VALUES, grossIncome: '80000' });
    expect(back.values).not.toHaveProperty('bogus');
    expect(valuesFromSearch('').values).toBeNull();
    expect(valuesFromSearch('?utm=x').values).toBeNull();
  });
});

describe('shareText', () => {
  it('lists the inputs, headline results and the link', () => {
    const text = shareText({ values: DEFAULT_FORM_VALUES, year: 2025, url: 'https://example.test/?a=1' });
    expect(text).toContain('Link: https://example.test/?a=1');
    expect(text).toContain('- Gross income: $100,000');
    expect(text).toContain('- Retirement age: 65');
    expect(text).toContain('- Retirement income number: $');
    expect(text).toContain('- Effective rate on these withdrawals:');
    expect(text).not.toContain('Compared with a change');
  });

  it('adds the changed inputs and their results when comparing', () => {
    const text = shareText({
      values: DEFAULT_FORM_VALUES,
      compareValues: { ...DEFAULT_FORM_VALUES, retirementAge: '60' },
      year: 2025,
      url: 'u',
    });
    expect(text).toContain('Baseline inputs');
    expect(text).toContain('- Retirement age: 65 -> 60');
    expect(text).toContain('Results with the change');
  });
});
