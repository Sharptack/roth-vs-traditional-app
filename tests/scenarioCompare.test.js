import { describe, it, expect } from 'vitest';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { alignRows, changedInputs, compareScenarios } from '../src/lib/scenarioCompare.js';
import { sideAwareRateSteps } from '../src/lib/rateSteps.js';

const baseInputs = {
  grossIncome: 100000,
  filingStatus: 'single',
  currentAge: 35,
  retirementAge: 65,
  debtPayments: 0,
  otherExpenses: 0,
  savings: 10000,
  currentType: 'pretax',
  accountType: '401k',
  knowsSocialSecurity: true,
  socialSecurityBenefit: 0,
  returnRate: 0.07,
  otherPretaxBalance: 0,
  otherRothBalance: 0,
  otherTaxableBalance: 0,
  year: 2025,
};
const run = (inputs) => ({ inputs, result: compareRothVsTraditional(inputs) });

describe('changedInputs', () => {
  it('lists only the inputs that differ, formatted, in form order', () => {
    const changes = changedInputs(baseInputs, { ...baseInputs, retirementAge: 60, grossIncome: 120000 });
    expect(changes).toEqual([
      { label: 'Gross income', from: '$100,000', to: '$120,000' },
      { label: 'Retirement age', from: '65', to: '60' },
    ]);
  });

  it('is empty when nothing changed', () => {
    expect(changedInputs(baseInputs, { ...baseInputs })).toEqual([]);
  });

  it('reads the Social Security pair as one input, and names enums and the lifestyle in words', () => {
    const changes = changedInputs(baseInputs, {
      ...baseInputs,
      knowsSocialSecurity: false,
      filingStatus: 'mfj',
      retirementLifestyle: 1.25,
    });
    expect(changes).toEqual([
      { label: 'Filing status', from: 'Single', to: 'Married Filing Jointly' },
      { label: 'Social Security benefit', from: '$0', to: 'Estimated' },
      { label: 'Retirement lifestyle', from: 'Same as today', to: '25% higher than today' },
    ]);
  });
});

describe('alignRows', () => {
  it('pairs rows by key, computes numeric deltas, and slots current-only rows after their neighbour', () => {
    const a = [
      { key: 'x', label: 'X', value: 10, kind: '' },
      { key: 'z', label: 'Z', value: 5, kind: '' },
    ];
    const b = [
      { key: 'x', label: 'X', value: 13, kind: '' },
      { key: 'y', label: 'Y', value: 1, kind: '' },
      { key: 'z', label: 'Z', value: 5, kind: '' },
    ];
    const rows = alignRows(a, b);
    expect(rows.map((r) => r.key)).toEqual(['x', 'y', 'z']);
    expect(rows[0].delta).toBe(3);
    expect(rows[1].baseline).toBeNull();
    expect(rows[1].delta).toBeNull();
    expect(rows[2].delta).toBe(0);
  });

  it('keeps baseline-only rows, with a null current side', () => {
    const rows = alignRows([{ key: 'p', label: 'P', value: 1 }], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].current).toBeNull();
  });
});

describe('compareScenarios — raise gross income from $100,000 to $120,000 (2025 single, HAND CALC)', () => {
  // Savings ($10,000) and every other input stay fixed, so the account's own 4% withdrawal W is
  // IDENTICAL in both scenarios: FV = 10,000 x [(1.07^30 - 1) / 0.07] = 10,000 x 94.4608 = 944,608.15;
  // W = 4% x 944,608.15 = 37,784.33. Existing Accounts and Social Security are both $0, so the
  // effective rate on W is also identical between the two: taxable = 37,784.33 - 15,750 (2025 single
  // standard deduction) = 22,034.33; tax = 10% x 11,925 (1,192.50) + 12% x (22,034.33 - 11,925 =
  // 10,109.33 -> 1,213.12) = 2,405.62; effective rate = 2,405.62 / 37,784.33 = 0.06367.
  // Only "tax saved now" (no side account here, so it's just the marginal rate on the next dollar of
  // pay, read BEFORE the standard deduction moves) changes: at $100,000, taxable-before-brackets =
  // 100,000 - 15,750 = 84,250, in the 22% bracket; at $120,000, 120,000 - 15,750 = 104,250, in the
  // 24% bracket (starts at 103,350).
  const c = compareScenarios(run(baseInputs), run({ ...baseInputs, grossIncome: 120000 }));
  const row = (rows, key) => rows.find((r) => r.key === key);

  it('names the one changed input', () => {
    expect(c.changes).toEqual([{ label: 'Gross income', from: '$100,000', to: '$120,000' }]);
  });

  it('headline: retirement number changes, the effective rate does not, tax saved now does', () => {
    const need = row(c.headline, 'need');
    expect(need.baseline.value).toBeCloseTo(71101, 6);
    expect(need.current.value).toBeCloseTo(85171, 6);
    expect(need.delta).toBeCloseTo(14070, 6);
    const eff = row(c.headline, 'effectiveRetirement');
    expect(eff.baseline.value).toBeCloseTo(0.06367, 4);
    expect(eff.current.value).toBeCloseTo(0.06367, 4);
    expect(eff.delta).toBeCloseTo(0, 6);
    const saved = row(c.headline, 'taxSavedNow');
    expect(saved.baseline.value).toBeCloseTo(0.22, 10);
    expect(saved.current.value).toBeCloseTo(0.24, 10);
    expect(row(c.headline, 'lean').current.value).toBe('Pre-tax (Traditional)');
  });

  it('rate steps: Step 2 has nothing to add (no side account), Step 3 is identical on both sides', () => {
    expect(row(c.rateSteps, 'noSide')).toBeTruthy();
    const w = row(c.rateSteps, 'w');
    expect(w.baseline.value).toBeCloseTo(37784.33, 1);
    expect(w.current.value).toBeCloseTo(37784.33, 1);
    const extra = row(c.rateSteps, 'extraTax');
    expect(extra.baseline.value).toBeCloseTo(2405.62, 1);
    expect(extra.current.value).toBeCloseTo(2405.62, 1);
    expect(extra.delta).toBeCloseTo(0, 1);
    const eff = row(c.rateSteps, 'effective');
    expect(eff.current.detail).toBe('$2,406 ÷ $37,784');
  });
});

describe('sideAwareRateSteps', () => {
  const stepsFor = (result) =>
    sideAwareRateSteps({ sideAware: result.sideAware, socialSecurity: result.socialSecurity, otherWithdrawals: result.otherWithdrawals });

  it('is empty when there is no account withdrawal to measure ($0 saved)', () => {
    const r = compareRothVsTraditional({ ...baseInputs, savings: 0 });
    expect(stepsFor(r)).toEqual([]);
  });

  it('Step 1 shows the existing taxable account and its gains when there is one', () => {
    const r = compareRothVsTraditional({ ...baseInputs, otherTaxableBalance: 100000 });
    const keys = stepsFor(r).map((x) => x.key);
    expect(keys).toContain('otherTaxable');
    expect(keys).toContain('otherGains');
    expect(stepsFor(compareRothVsTraditional(baseInputs)).map((x) => x.key)).not.toContain('otherTaxable');
  });

  it('Step 2 shows the side-account rows only when savings exceed the IRS limit', () => {
    const under = stepsFor(compareRothVsTraditional(baseInputs)); // $10,000 saved, well under the limit
    expect(under.map((x) => x.key)).toContain('noSide');
    const over = stepsFor(compareRothVsTraditional({ ...baseInputs, savings: 30000 }));
    const overKeys = over.map((x) => x.key);
    expect(overKeys).toContain('extraSide');
    expect(overKeys).toContain('extraSideRate');
    expect(overKeys).not.toContain('noSide');
  });
});
