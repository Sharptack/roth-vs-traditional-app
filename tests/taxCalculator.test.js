import { describe, it, expect } from 'vitest';
import { householdToYearTaxParams, taxCalculatorResult } from '../src/lib/taxCalculator.js';
import { PREVIEW_DEFAULT_VALUES, toHousehold } from '../src/lib/household.js';

const Y = 2026;
const run = (values) => taxCalculatorResult(householdToYearTaxParams(toHousehold({ ...PREVIEW_DEFAULT_VALUES, ...values }, Y)));

describe('tax calculator (2026, HAND CALC)', () => {
  it('the default household this year: wages lead, Pre-tax savings are deducted', () => {
    // $100,000 wages, $10,000 Pre-tax savings -> taxable 100,000 - 10,000 - 16,100 = 73,900
    // tax 1,240 + 4,560 + 22% x 23,500 (5,170) = 10,970; payroll 7,650
    // the bar: 10% full (12,400), 12% full (38,000), 22% with 23,500 of 55,300, then 24% empty;
    // room left in 22%: 105,700 - 73,900 = 31,800
    const t = run({});
    expect(t.result.lines.pretaxDeferrals).toBe(10000);
    expect(t.result.incomeTax).toBeCloseTo(10970, 6);
    expect(t.marginal.source).toBe('wages');
    expect(t.marginal.incomeTax).toBeCloseTo(0.22, 9);
    expect(t.marginal.total).toBeCloseTo(0.2965, 9);
    expect(t.bar.segments.map((s) => [s.rate, s.from, s.to, s.filled])).toEqual([
      [0.1, 0, 12400, 12400],
      [0.12, 12400, 50400, 38000],
      [0.22, 50400, 105700, 23500],
      [0.24, 105700, 201775, 0],
    ]);
    expect(t.bar.room).toBe(31800);
  });

  it('a retiree at 70 with a pension and Social Security: Pre-tax withdrawals lead, 65+ deductions apply', () => {
    // pension/withdrawals 20,000, Social Security 30,000 -> taxable SS 5,350 (as the engine's case)
    // AGI 25,350; deduction 16,100 + 2,050 + 6,000 = 24,150 -> taxable 1,200 -> tax 120
    // next $100 withdrawn: +$85 of SS taxable too -> +$185 at 10% -> 18.5%
    const t = run({ grossIncome: '0', currentAge: '70', retirementAge: '71', savings: '0', taxOrdinaryIncome: '20000', taxSocialSecurity: '30000' });
    expect(t.result.lines.standardDeduction).toBe(24150);
    expect(t.result.incomeTax).toBeCloseTo(120, 6);
    expect(t.marginal.source).toBe('ordinaryIncome');
    expect(t.marginal.incomeTax).toBeCloseTo(0.185, 9);
    expect(t.others.map((o) => o.source)).toEqual([
      'wages', 'selfEmploymentIncome', 'investmentOrdinaryIncome', 'preferentialIncome', 'socialSecurity',
    ]);
  });

  it('each spouse deducts Pre-tax savings up to their own limit', () => {
    // you 30,000 (limit 24,500), spouse 30,000 at 55 (limit 32,500) -> 24,500 + 30,000 = 54,500
    const t = run({ filingStatus: 'mfj', includeSpouse: 'yes', savings: '30000', spouseSavings: '30000', spouseAge: '55', spouseRetirementAge: '67', spouseIncome: '90000' });
    expect(t.result.lines.pretaxDeferrals).toBe(54500);
    expect(t.result.payroll.people).toHaveLength(2);
  });

  it('Roth savings are not deducted', () => {
    expect(run({ currentType: 'roth' }).result.lines.pretaxDeferrals).toBe(0);
  });
});
