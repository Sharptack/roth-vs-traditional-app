// A pension in the retirement math (decided 2026-10-08: counted by every calculator). HAND CALC, 2026
// single: standard deduction 16,100; 10% to 12,400, 12% to 50,400, 22% to 105,700.
import { describe, it, expect } from 'vitest';
import { calculateRetirementTax } from '../src/lib/retirementTaxStack.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { runProjection } from '../src/lib/projection.js';

const Y = 2026;

describe('calculateRetirementTax with a pension (taxRules.otherOrdinaryIncome)', () => {
  it('the pension is ordinary income under the withdrawal', () => {
    // pension 30,000 + Pre-tax 20,000 = 50,000; taxable 33,900; 1,240 + 12% x 21,500 (2,580) = 3,820
    const withPension = calculateRetirementTax({ pretaxWithdrawal: 20000, filingStatus: 'single', year: Y, taxRules: { otherOrdinaryIncome: 30000 } });
    expect(withPension.totalTax).toBeCloseTo(3820, 6);
    // without: taxable 3,900 x 10% = 390
    expect(calculateRetirementTax({ pretaxWithdrawal: 20000, filingStatus: 'single', year: Y }).totalTax).toBeCloseTo(390, 6);
  });
});

describe('compareRothVsTraditional: pensionIncome', () => {
  // The Roth article's example: $100,000 W-2, $10,000 Pre-tax, 35 to 65, 7%, no Social Security, no
  // accounts. FV = 10,000 x (1.07^30 - 1) / 0.07 = 944,607.86; the 4% withdrawal 37,784.31.
  const inputs = {
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
    year: Y,
  };

  it('raises the effective rate on the withdrawal: a floor under it', () => {
    // no pension: taxable 37,784.31 - 16,100 = 21,684.31 -> 1,240 + 12% x 9,284.31 (1,114.12) = 2,354.12
    //   -> 2,354.12 / 37,784.31 = 6.2304%
    const none = compareRothVsTraditional(inputs);
    expect(none.rates.effectiveRetirement).toBeCloseTo(2354.12 / 37784.31, 5);
    // pension 30,000: floor taxable 13,900 -> 1,240 + 12% x 1,500 = 1,420
    //   with the withdrawal: taxable 51,684.31 -> 1,240 + 4,560 + 22% x 1,284.31 (282.55) = 6,082.55
    //   extra 4,662.55 / 37,784.31 = 12.340%
    const withPension = compareRothVsTraditional({ ...inputs, pensionIncome: 30000 });
    expect(withPension.rates.effectiveRetirement).toBeCloseTo(4662.55 / 37784.31, 5);
    expect(withPension.pensionIncome).toBe(30000);
    // today's side doesn't change
    expect(withPension.rates.marginalNow).toBe(none.rates.marginalNow);
    expect(withPension.retirementNeed.target).toBe(none.retirementNeed.target);
  });

  it('is cash toward the retirement income number: the portfolio draws less', () => {
    const none = compareRothVsTraditional(inputs);
    const some = compareRothVsTraditional({ ...inputs, pensionIncome: 20000 });
    expect(some.portfolio.pretax.impliedWithdrawalRate).toBeLessThan(none.portfolio.pretax.impliedWithdrawalRate);
    expect(some.portfolio.pretax.achievedAfterTaxIncome).toBeCloseTo(some.retirementNeed.target, 2);
    // a pension that covers the whole need on its own: nothing is drawn
    const plenty = compareRothVsTraditional({ ...inputs, pensionIncome: 200000 });
    expect(plenty.portfolio.pretax.scaleFactor).toBe(0);
    expect(plenty.portfolio.roth.scaleFactor).toBe(0);
  });
});

describe('runProjection with a pension', () => {
  it('a retiree: the pension is taxed and spent before any withdrawal (HAND CALC)', () => {
    // 70 (born 1956, RMDs from 73), $2,000 a month since 65, no COLA, no inflation, return 0.
    // Need 30,000 after tax with W from Pre-tax: taxable 24,000 + W - 16,100 = 7,900 + W (12%):
    //   tax = 1,240 + 12% x (W - 4,500) = 700 + 0.12 W; cash = 24,000 + W - 700 - 0.12 W = 30,000
    //   -> W = 6,700 / 0.88 = 7,613.6364; tax 1,613.6364
    const household = {
      version: 2,
      year: Y,
      filingStatus: 'single',
      people: [{ id: 'p1', birthYear: 1956, retirementAge: 65, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
      accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: 500000 }],
      pensions: [{ owner: 'p1', monthly: 2000, startAge: 65, cola: 0 }],
      futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
      spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
      calculators: {},
      assumptions: { returnRate: 0, inflationRate: 0, ageDeductions: false },
    };
    const { rows } = runProjection(household, { need: 30000, endAge: 71 });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.pension).toBe(24000);
      expect(r.withdrawals.pretax).toBeCloseTo(6700 / 0.88, 4);
      expect(r.totalTax).toBeCloseTo(1613.6364, 3);
      expect(r.afterTaxIncome).toBeCloseTo(30000, 4);
    }
  });
});
