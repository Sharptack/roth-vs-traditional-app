import { describe, it, expect } from 'vitest';
import { applyContributionSwitch, contributionSwitch } from '../src/lib/useInPlan.js';
import { DEFAULT_HOUSEHOLD_VALUES as D, addRow, setIncludeSpouse, updateRow } from '../src/lib/householdValues.js';
import { previewResult } from '../src/next/NextApp.jsx';

const run = (values) => {
  const { household, result } = previewResult(values, 2026, { blend: false });
  return contributionSwitch(values, household, result);
};

describe('Use in the plan: Roth or Pre-tax at the same take-home cost (HAND CALC)', () => {
  it('$10,000 Pre-tax at 22% switches to $7,800 Roth, and back to $10,000', () => {
    // single, 100,000: the whole $10,000 deduction sits in the 22% bracket (taxable 73,900-83,900),
    // so it saves 22% across the contribution: Roth at the same cost = 10,000 × (1 − 0.22) = 7,800
    const sw = run(D);
    expect(sw).toMatchObject({ current: 'pretax', other: 'roth', currentTotal: 10000, otherTotal: 7800, amounts: { p1: 7800 } });
    const roth = applyContributionSwitch(D, sw);
    expect(roth.contributions).toEqual([{ ...D.contributions[0], tax: 'roth', amount: '7800' }]);
    // back: 7,800 Roth grossed up at 22% = 10,000 Pre-tax
    const back = run(roth);
    expect(back).toMatchObject({ current: 'roth', other: 'pretax', otherTotal: 10000 });
    expect(applyContributionSwitch(roth, back).contributions[0]).toMatchObject({ tax: 'pretax', amount: '10000' });
  });

  it('a couple: each person switches at their own amount', () => {
    let v = setIncludeSpouse({ ...D, filingStatus: 'mfj' }, true);
    v = addRow(v, 'incomes', { owner: 'p2', amount: '60000' });
    v = addRow(v, 'contributions', { owner: 'p2', amount: '5000' });
    const sw = run(v);
    expect(Object.keys(sw.amounts)).toEqual(['p1', 'p2']);
    // both switch at the one rate the comparison used for the household (they file one return)
    const rate = 1 - sw.amounts.p1 / 10000;
    expect(sw.amounts.p2).toBe(Math.round(5000 * (1 - rate)));
    const after = applyContributionSwitch(v, sw).contributions;
    expect(after.map((r) => r.tax)).toEqual(['roth', 'roth']);
  });

  it('nothing to switch: no savings, a mix of types, or invalid inputs', () => {
    expect(run({ ...D, contributions: [] })).toBeNull();
    const mixed = addRow(D, 'contributions', { tax: 'roth', account: 'ira', amount: '3000' });
    expect(run(mixed)).toBeNull();
    expect(run(updateRow(D, 'incomes', 'i1', 'amount', ''))).toBeNull();
  });
});
