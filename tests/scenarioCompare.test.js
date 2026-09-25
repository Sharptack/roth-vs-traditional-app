import { describe, it, expect } from 'vitest';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { alignRows, changedInputs, compareScenarios } from '../src/lib/scenarioCompare.js';
import { effectiveRateSteps } from '../src/lib/rateSteps.js';

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
  // Baseline (compare.test.js): need 71,101; G = 80,192.31; extra tax 9,091.31; rate 0.11337.
  // $120,000, $10,000 Pre-tax:
  //   taxable = 120,000 - 10,000 - 15,750 = 94,250
  //   tax = 5,578.50 + 22% x (94,250 - 48,475 = 45,775) 10,070.50 = 15,649
  //   FICA 7.65% x 120,000 = 9,180;  take-home = 120,000 - 15,649 - 9,180 = 95,171;  need = 85,171
  //   gross-up, 22% bracket: 0.78 T + 20,836 = 85,171 -> T = 64,335 / 0.78 = 82,480.77
  //   G = 98,230.77;  extra tax = G - need = 13,059.77;  rate = 13,059.77 / 98,230.77 = 0.13295
  const c = compareScenarios(run(baseInputs), run({ ...baseInputs, grossIncome: 120000 }));
  const row = (rows, key) => rows.find((r) => r.key === key);

  it('names the one changed input', () => {
    expect(c.changes).toEqual([{ label: 'Gross income', from: '$100,000', to: '$120,000' }]);
  });

  it('headline: retirement number and effective rate, both sides and the change', () => {
    const need = row(c.headline, 'need');
    expect(need.baseline.value).toBeCloseTo(71101, 6);
    expect(need.current.value).toBeCloseTo(85171, 6);
    expect(need.delta).toBeCloseTo(14070, 6);
    const eff = row(c.headline, 'effectiveRetirement');
    expect(eff.current.value).toBeCloseTo(0.13295, 4);
    expect(eff.delta).toBeCloseTo(0.13295 - 0.11337, 4);
    expect(row(c.headline, 'lean').current.value).toBe('Pre-tax (Traditional)');
  });

  it('rate steps line up step by step, with each side\'s own arithmetic', () => {
    const gross = row(c.rateSteps, 'grossWithdrawal');
    expect(gross.baseline.value).toBeCloseTo(80192.31, 1);
    expect(gross.current.value).toBeCloseTo(98230.77, 1);
    const extra = row(c.rateSteps, 'extraTax');
    expect(extra.current.value).toBeCloseTo(13059.77, 1);
    expect(extra.delta).toBeCloseTo(13059.77 - 9091.31, 1);
    expect(row(c.rateSteps, 'stillNeeded').current.detail).toBe('$85,171 − $0');
    expect(row(c.rateSteps, 'effectiveRate').current.detail).toBe('$13,060 ÷ $98,231');
  });

  it('drivers: nothing taxed first in either, last dollar in the 22% bracket in both', () => {
    expect(row(c.drivers, 'driverStart').delta).toBe(0);
    expect(row(c.drivers, 'driverEnd').current.value).toBe(0.22);
  });
});

describe('effectiveRateSteps', () => {
  it('uses the probe rows when no withdrawal is needed, and never shows "÷ $0"', () => {
    // SS $90,000 alone covers the need, so G = 0 and the rate comes from the probe.
    const r = compareRothVsTraditional({ ...baseInputs, socialSecurityBenefit: 90000 });
    const rows = effectiveRateSteps(r);
    const keys = rows.map((x) => x.key);
    expect(keys).toContain('probeSize');
    expect(keys).not.toContain('solutionTaxableSS');
    const eff = rows.find((x) => x.key === 'effectiveRate');
    expect(eff.detail).not.toMatch(/÷ \$0$/);
    expect(eff.value).toBe(r.rates.effectiveRetirement);
  });

  it('splits tax into ordinary and capital-gains rows when there is a taxable account', () => {
    const r = compareRothVsTraditional({ ...baseInputs, otherTaxableBalance: 100000 });
    const keys = effectiveRateSteps(r).map((x) => x.key);
    expect(keys).toContain('baseCapitalGainsTax');
    expect(keys).toContain('solutionOrdinaryTax');
    expect(effectiveRateSteps(compareRothVsTraditional(baseInputs)).map((x) => x.key)).not.toContain(
      'baseCapitalGainsTax',
    );
  });
});
