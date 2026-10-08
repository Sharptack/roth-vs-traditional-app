import { describe, it, expect } from 'vitest';
import { DEFAULT_HOUSEHOLD_VALUES as D, addRow, setIncludeSpouse, setPersonField, updateRow } from '../src/lib/householdValues.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { householdToCompareInputs } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { futureValueContributions } from '../src/lib/growthCalculations.js';

// Both 40, joint, $50,000 of wages each, Pre-tax 401(k)s, 7%: you save $10,000 and retire at 65
// (25 years), your spouse saves $5,000 and retires at 60 (20 years).
//   you:    10,000 × (1.07^25 − 1) / 0.07 = 10,000 × 63.24904 = 632,490.4
//   spouse:  5,000 × (1.07^20 − 1) / 0.07 = 5,000 × 40.99549 = 204,977.5, then × 1.07^5 (1.402552) = 287,491.6
//   together 919,982 at the LAST retirement (in 25 years); at the first (20 years, both saving): 15,000 × 40.99549 = 614,932
function couple() {
  let v = setIncludeSpouse({ ...D, filingStatus: 'mfj' }, true);
  v = setPersonField(v, 'p1', 'age', '40');
  v = setPersonField(v, 'p2', 'age', '40');
  v = setPersonField(v, 'p2', 'retirementAge', '60');
  v = updateRow(v, 'incomes', 'i1', 'amount', '50000');
  v = addRow(v, 'incomes', { owner: 'p2', amount: '50000' });
  return addRow(v, 'contributions', { owner: 'p2', amount: '5000' });
}

describe('the Roth comparison at the last retirement, each person saving to their own (HAND CALC)', () => {
  it('grows each person over their own years, then untouched to the last retirement', () => {
    expect(futureValueContributions(10000, 0.07, 25, 25)).toBeCloseTo(632490.37, 1);
    expect(futureValueContributions(5000, 0.07, 20, 25)).toBeCloseTo(287491.6, 0);
    const inputs = householdToCompareInputs(toHouseholdV2(couple(), 2026));
    expect(inputs.retirementAge - inputs.currentAge).toBe(25);
    expect(inputs.contributors.map((c) => c.years)).toEqual([25, 20]);
    const r = compareRothVsTraditional(inputs);
    expect(r.annuity.pretax.futureValue).toBeCloseTo(632490.37 + 287491.6, -1);
  });

  it('version 1 households keep the first retirement: 20 years, both saving', () => {
    const h = toHouseholdV2(couple(), 2026);
    h.assumptions = { ...h.assumptions, snapshotAtLastRetirement: false };
    const inputs = householdToCompareInputs(h);
    expect(inputs.retirementAge - inputs.currentAge).toBe(20);
    expect(inputs.contributors.every((c) => c.years === undefined)).toBe(true);
    expect(compareRothVsTraditional(inputs).annuity.pretax.futureValue).toBeCloseTo(15000 * 40.99549, -1);
  });
});
