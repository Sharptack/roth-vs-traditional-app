import { describe, it, expect } from 'vitest';
import { CLEARED_FORM_VALUES, DEFAULT_FORM_VALUES, toCompareInputs } from '../src/lib/formInputs.js';

describe('CLEARED_FORM_VALUES ("Clear all")', () => {
  it('zeroes every dollar amount, blanks the ages, and keeps the choices at their defaults', () => {
    const inputs = toCompareInputs(CLEARED_FORM_VALUES, 2026);
    for (const key of ['grossIncome', 'selfEmploymentIncome', 'debtPayments', 'otherExpenses', 'savings', 'otherPretaxBalance', 'otherRothBalance', 'otherTaxableBalance']) {
      expect(inputs[key], key).toBe(0);
    }
    expect(inputs.currentAge).toBeNaN();
    expect(inputs.retirementAge).toBeNaN();
    for (const key of ['filingStatus', 'incomeType', 'currentType', 'accountType', 'knowsSocialSecurity', 'returnRate', 'retirementLifestyle', 'otherTaxableBasis']) {
      expect(CLEARED_FORM_VALUES[key], key).toBe(DEFAULT_FORM_VALUES[key]);
    }
  });
});
