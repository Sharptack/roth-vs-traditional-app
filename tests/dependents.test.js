import { describe, it, expect } from 'vitest';
import { dependentsInYear } from '../src/lib/dependents.js';
import { DEFAULT_HOUSEHOLD_VALUES as D, addRow, setGroupField, updateRow } from '../src/lib/householdValues.js';
import { toHouseholdV2, validateHouseholdV2 } from '../src/lib/householdV2.js';
import { householdToCompareInputs } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { householdToYearTaxParams, taxCalculatorResult } from '../src/lib/taxCalculator.js';
import { calculateYearTax } from '../src/lib/yearTax.js';

describe('children and dependents', () => {
  it('children count while under 17; other dependents this year only', () => {
    const h = { dependents: [{ kind: 'child', age: 15 }, { kind: 'child', age: 3 }, { kind: 'other', age: null }] };
    expect(dependentsInYear(h, 0)).toEqual({ children: 2, otherDependents: 1 });
    // two years on the 15-year-old is 17
    expect(dependentsInYear(h, 2)).toEqual({ children: 1, otherDependents: 0 });
    expect(dependentsInYear(h, 14)).toEqual({ children: 0, otherDependents: 0 });
  });

  // joint, one earner, $120,000 of wages, saving Roth (nothing deducted), two children 5 and 10:
  //   taxable 87,800 -> 10,040; credit 4,400 -> 5,640 (childTaxCredit.test.js)
  const values = () => {
    let v = setGroupField({ ...D, filingStatus: 'mfj' }, 'spending', 'debtPayments', '0');
    v = updateRow(v, 'incomes', 'i1', 'amount', '120000');
    v = updateRow(v, 'contributions', 'c1', 'tax', 'roth');
    v = addRow(v, 'dependents', { age: '5' });
    return addRow(v, 'dependents', { age: '10' });
  };

  it('the tax calculator and the Roth comparison take the credit this year', () => {
    const h = toHouseholdV2(values(), 2026);
    expect(validateHouseholdV2(h)).toEqual([]);
    expect(taxCalculatorResult(householdToYearTaxParams(h)).result.incomeTax).toBeCloseTo(5640, 6);
    const r = compareRothVsTraditional(householdToCompareInputs(h));
    expect(r.current.tax).toBeCloseTo(5640, 6);
    expect(r.retirementNeed.breakdown.childTaxCredit).toBe(4400);
    // the marginal rate today stays the bracket: taxable 87,800 is in 12%
    expect(r.current.marginalRate).toBe(0.12);
  });

  it('in the phase-out, the next $1,000 also loses $50 of credit: 24% + 5% = 29%', () => {
    // joint, 420,000 of wages, one child: taxable 387,800 (24%); MAGI 20,000 over -> credit 2,200 − 1,000 = 1,200;
    // $1,000 more: 21,000 over -> another 50 lost
    const r = calculateYearTax({ filingStatus: 'mfj', year: 2026, people: [{ wages: 420000 }], children: 1 });
    expect(r.lines.childTaxCredit).toBe(1200);
    expect(r.marginalRates.wages.incomeTax).toBeCloseTo(0.29, 9);
  });

  it("a child's age is required", () => {
    const v = updateRow(values(), 'dependents', 'd1', 'age', '');
    expect(validateHouseholdV2(toHouseholdV2(v, 2026))).toContain("Enter each child's age (0 to 30).");
  });
});
