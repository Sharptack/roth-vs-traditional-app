import { describe, it, expect } from 'vitest';
import {
  calculatePaycheckEquivalents,
  compareRothVsTraditional,
  validateInputs,
} from '../src/lib/compare.js';
import { estimateSocialSecurityBenefit } from '../src/lib/socialSecurity.js';

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

describe('calculatePaycheckEquivalents (Section 8, HAND CALC)', () => {
  it('currently Pre-tax P = 10,000 at t = 22%: Roth R = 7,800', () => {
    const r = calculatePaycheckEquivalents(10000, 'pretax', 0.22);
    expect(r.pretax).toBe(10000);
    expect(r.roth).toBeCloseTo(7800, 8);
  });
  it('currently Roth R = 7,800 at t = 22%: Pre-tax P = 10,000', () => {
    const r = calculatePaycheckEquivalents(7800, 'roth', 0.22);
    expect(r.roth).toBe(7800);
    expect(r.pretax).toBeCloseTo(10000, 8);
  });
  it('the two directions are inverses at any rate', () => {
    for (const t of [0, 0.1, 0.24, 0.37]) {
      const fromPretax = calculatePaycheckEquivalents(5000, 'pretax', t);
      const back = calculatePaycheckEquivalents(fromPretax.roth, 'roth', t);
      expect(back.pretax).toBeCloseTo(5000, 8);
    }
  });
});

describe('compareRothVsTraditional — end-to-end HAND CALC (no SS, no other accounts)', () => {
  // Single, $100,000 gross, 35 -> 65 (30 years), 7%, saves $10,000 Pre-tax.
  //
  // Section 1
  //   taxable = 100,000 - 15,750 = 84,250; tax = 1,192.50 + 4,386 + 22% x 35,775 = 13,449.00
  //   FICA = 6.2% x 100,000 + 1.45% x 100,000 = 6,200 + 1,450 = 7,650
  //   marginal 22%; take-home = 100,000 - 13,449 - 7,650 = 78,901
  //   need = 78,901 - 10,000 = 68,901
  // Section 8:  P = 10,000; R = 10,000 x (1 - 0.22) = 7,800
  // Gross-up (no other income, so no SS effects): T = taxable withdrawal in the 22% bracket
  //   tax = 5,578.50 + 22% (T - 48,475) = 0.22 T - 5,086
  //   net = (T + 15,750) - 0.22 T + 5,086 = 0.78 T + 20,836 = 68,901
  //   T = 48,065 / 0.78 = 61,621.79;  G = 77,371.79;  tax = 0.22 x 61,621.79 - 5,086 = 8,470.79
  //   effective rate = 8,470.79 / 77,371.79 = 0.10948
  // Growth: 1.07^30 = 7.612255; annuity factor = 6.612255 / 0.07 = 94.46079
  //   FV(P) = 944,607.86;  FV(R) = 7,800 x 94.46079 = 736,794.13
  // Section 2 (annual 4% withdrawals):
  //   Roth 29,471.77;  Pre-tax 37,784.31 x (1 - 0.10948) = 33,647.6  -> Pre-tax wins (10.9% < 22%)
  // Section 3: Roth scenario = all Roth, so no tax; Pre-tax scenario = one pre-tax
  //   bucket, so it IS the gross-up: pays 8,470.79, k = 77,371.79 / 37,784.31 = 2.0477
  //   (Roth: k = 68,901 / 29,471.77 = 2.3379)
  const r = compareRothVsTraditional(baseInputs);

  it('Section 1: current tax position and retirement income need', () => {
    expect(r.valid).toBe(true);
    expect(r.current.taxableIncome).toBe(84250);
    expect(r.current.tax).toBeCloseTo(13449, 6);
    expect(r.rates.marginalNow).toBe(0.22);
    expect(r.current.fica.total).toBeCloseTo(7650, 6);
    expect(r.current.afterTaxIncome).toBeCloseTo(78901, 6);
    expect(r.retirementNeed.target).toBeCloseTo(68901, 6);
    // the budget walk shown in the UI
    expect(r.retirementNeed.breakdown).toMatchObject({
      grossIncome: 100000,
      incomeTax: expect.closeTo(13449, 6),
      fica: expect.closeTo(7650, 6),
      takeHome: expect.closeTo(78901, 6),
      savings: 10000,
    });
  });

  it('Section 8: contribution equivalents', () => {
    expect(r.contribution.pretax).toBe(10000);
    expect(r.contribution.roth).toBeCloseTo(7800, 6);
  });

  it('Section 6: gross-up and effective retirement rate', () => {
    expect(r.grossUp.grossWithdrawal).toBeCloseTo(77371.79, 1);
    expect(r.grossUp.totalTaxPaid).toBeCloseTo(8470.79, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.10948, 4);
  });

  it('Sections 9-10: growth of the contribution and after-tax income', () => {
    expect(r.annuity.pretax.futureValue).toBeCloseTo(944607.86, 0);
    expect(r.annuity.roth.futureValue).toBeCloseTo(736794.13, 0);
    expect(r.lumpSum.roth.futureValue).toBeCloseTo(7800 * 7.612255, 0);
    expect(r.lumpSum.pretax.futureValueGross).toBeCloseTo(10000 * 7.612255, 0);
    expect(r.lumpSum.pretax.afterTaxValue).toBeCloseTo(10000 * 7.612255 * (1 - 0.10948), 0);
    expect(r.annuity.roth.afterTaxWithdrawal).toBeCloseTo(29471.77, 1);
    expect(r.annuity.pretax.annualWithdrawal).toBeCloseTo(37784.31, 1);
    expect(r.annuity.pretax.afterTaxWithdrawal).toBeCloseTo(33647.6, -1);
  });

  it('Section 2 verdict: Pre-tax wins because the retirement rate is below the current rate', () => {
    expect(r.rates.effectiveRetirement).toBeLessThan(r.rates.marginalNow);
    expect(r.comparison.winner).toBe('pretax');
    expect(r.comparison.afterTaxIncomeDifference).toBeCloseTo(33647.6 - 29471.77, -1);
  });

  it('Section 11: the two scenarios are built from the right buckets', () => {
    expect(r.portfolio.roth.buckets).toEqual({
      pretax: 0,
      roth: r.annuity.roth.futureValue,
      taxable: 0,
    });
    expect(r.portfolio.pretax.buckets).toEqual({
      pretax: r.annuity.pretax.futureValue,
      roth: 0,
      taxable: 0,
    });
  });

  it('Section 11: portfolio solver agrees with the single-account gross-up (cross-check)', () => {
    expect(r.portfolio.roth.totalTaxPaid).toBe(0);
    expect(r.portfolio.roth.scaleFactor).toBeCloseTo(2.3379, 3);
    expect(r.portfolio.pretax.totalTaxPaid).toBeCloseTo(8470.79, 1);
    expect(r.portfolio.pretax.scaleFactor).toBeCloseTo(2.0477, 3);
    expect(r.portfolio.pretax.totalGrossWithdrawal).toBeCloseTo(r.grossUp.grossWithdrawal, 2);
  });

  it('Section 11: both scenarios deliver the same after-tax income as the Section 1 need', () => {
    expect(r.portfolio.roth.achievedAfterTaxIncome).toBeCloseTo(68901, 2);
    expect(r.portfolio.pretax.achievedAfterTaxIncome).toBeCloseTo(68901, 2);
  });

  it('Section 11: tax difference headline', () => {
    expect(r.taxDifference.amount).toBeCloseTo(8470.79, 1);
    expect(r.taxDifference.lowerTaxScenario).toBe('roth');
  });
});

describe('compareRothVsTraditional — wiring', () => {
  it('subtracts debt, other expenses and savings from after-tax income (Section 3)', () => {
    const r = compareRothVsTraditional({ ...baseInputs, debtPayments: 6000, otherExpenses: 4000 });
    // 78,901 - 6,000 - 4,000 - 10,000 = 58,901
    expect(r.retirementNeed.target).toBeCloseTo(58901, 6);
  });

  it('floors a negative need at zero and keeps the raw value', () => {
    const r = compareRothVsTraditional({ ...baseInputs, debtPayments: 90000 });
    expect(r.retirementNeed.raw).toBeCloseTo(78901 - 90000 - 10000, 6);
    expect(r.retirementNeed.target).toBe(0);
    expect(r.grossUp.grossWithdrawal).toBe(0);
  });

  it('uses a known SS benefit as given', () => {
    const r = compareRothVsTraditional({ ...baseInputs, socialSecurityBenefit: 24000 });
    expect(r.socialSecurity).toEqual({ annualBenefit: 24000, estimated: false });
  });

  it('estimates SS from income and retirement age when the user does not know it', () => {
    const r = compareRothVsTraditional({ ...baseInputs, knowsSocialSecurity: false });
    const expected = estimateSocialSecurityBenefit({
      annualIncome: 100000,
      currentAge: 35,
      retirementAge: 65,
      year: 2025,
    });
    expect(r.socialSecurity.estimated).toBe(true);
    expect(r.socialSecurity.annualBenefit).toBeCloseTo(expected.annualBenefit, 6);
    expect(r.socialSecurity.annualBenefit).toBeGreaterThan(0);
  });

  it('grows other balances at the same return and takes 4% (HAND CALC)', () => {
    // 100,000 x 1.07^30 = 761,225.50 pre-tax -> 4% = 30,449.02
    // 50,000 Roth -> 380,612.75 -> 15,224.51;  20,000 taxable -> 152,245.10 -> 6,089.80
    const r = compareRothVsTraditional({
      ...baseInputs,
      otherPretaxBalance: 100000,
      otherRothBalance: 50000,
      otherTaxableBalance: 20000,
    });
    expect(r.grown.pretax).toBeCloseTo(761225.5, 0);
    expect(r.otherWithdrawals.pretaxGross).toBeCloseTo(30449.02, 1);
    expect(r.otherWithdrawals.roth).toBeCloseTo(15224.51, 1);
    expect(r.otherWithdrawals.taxableGross).toBeCloseTo(6089.8, 1);
    // Other balances appear in BOTH scenarios' totals, and this account's future value only in its own bucket.
    expect(r.portfolio.roth.buckets.pretax).toBeCloseTo(761225.5, 0);
    expect(r.portfolio.pretax.buckets.pretax).toBeCloseTo(761225.5 + r.annuity.pretax.futureValue, 0);
    expect(r.portfolio.roth.buckets.taxable).toBeCloseTo(r.portfolio.pretax.buckets.taxable, 6);
  });

  it('other pre-tax money stacks under this account and lifts its effective rate', () => {
    const without = compareRothVsTraditional(baseInputs);
    const withOther = compareRothVsTraditional({ ...baseInputs, otherPretaxBalance: 150000 });
    expect(withOther.rates.effectiveRetirement).toBeGreaterThan(without.rates.effectiveRetirement);
  });

  it('achieved after-tax income equals the target in both scenarios for a realistic mix', () => {
    const r = compareRothVsTraditional({
      ...baseInputs,
      grossIncome: 140000,
      filingStatus: 'mfj',
      debtPayments: 12000,
      otherExpenses: 8000,
      savings: 15000,
      knowsSocialSecurity: false,
      otherPretaxBalance: 250000,
      otherRothBalance: 60000,
      otherTaxableBalance: 90000,
    });
    expect(r.valid).toBe(true);
    expect(r.portfolio.roth.achievedAfterTaxIncome).toBeCloseTo(r.retirementNeed.target, 2);
    expect(r.portfolio.pretax.achievedAfterTaxIncome).toBeCloseTo(r.retirementNeed.target, 2);
    // These other balances alone already fund the need, so no withdrawal from
    // this account is required (the gross-up is 0 and income exceeds the target).
    expect(r.grossUp.grossWithdrawal).toBe(0);
    expect(r.grossUp.achievedAfterTaxIncome).toBeGreaterThan(r.retirementNeed.target);
  });

  it('when a withdrawal IS required, the gross-up lands exactly on the target', () => {
    const r = compareRothVsTraditional({
      ...baseInputs,
      grossIncome: 140000,
      knowsSocialSecurity: false,
      otherPretaxBalance: 20000,
      otherRothBalance: 10000,
    });
    expect(r.grossUp.grossWithdrawal).toBeGreaterThan(0);
    expect(r.grossUp.achievedAfterTaxIncome).toBeCloseTo(r.retirementNeed.target, 2);
  });

  it('works with a 0% return', () => {
    const r = compareRothVsTraditional({ ...baseInputs, returnRate: 0 });
    expect(r.valid).toBe(true);
    expect(r.annuity.pretax.futureValue).toBe(300000); // 10,000 x 30
  });

  it('flags the contribution limit for the selected account type', () => {
    expect(compareRothVsTraditional({ ...baseInputs, savings: 22000 }).limitCheck.atLimit).toBe(true);
    expect(compareRothVsTraditional({ ...baseInputs, savings: 10000 }).limitCheck.atLimit).toBe(false);
    // $10,000 is over the IRA limit
    expect(
      compareRothVsTraditional({ ...baseInputs, savings: 10000, accountType: 'ira' }).limitCheck.overLimit,
    ).toBe(true);
  });

  it('is symmetric: entering the Roth equivalent gives the same P and R', () => {
    const fromPretax = compareRothVsTraditional(baseInputs).contribution;
    const fromRoth = compareRothVsTraditional({ ...baseInputs, savings: 7800, currentType: 'roth' }).contribution;
    expect(fromRoth.pretax).toBeCloseTo(fromPretax.pretax, 6);
    expect(fromRoth.roth).toBeCloseTo(fromPretax.roth, 6);
  });

  it('breaks even when marginal now equals the effective rate later: winner "even"', () => {
    // Below the standard deduction, taxes are 0% now (marginal 0) and in retirement (0%).
    const r = compareRothVsTraditional({
      ...baseInputs,
      grossIncome: 14000,
      savings: 1000,
      debtPayments: 0,
    });
    expect(r.rates.marginalNow).toBe(0);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0, 6);
    expect(r.comparison.winner).toBe('even');
  });
});

describe('validateInputs', () => {
  it('accepts the base inputs', () => {
    expect(validateInputs(baseInputs)).toEqual([]);
  });
  it('rejects a retirement age that is not after the current age', () => {
    const r = compareRothVsTraditional({ ...baseInputs, retirementAge: 35 });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/retirement age/i);
  });
  it('rejects missing or negative numbers', () => {
    expect(validateInputs({ ...baseInputs, grossIncome: NaN }).length).toBeGreaterThan(0);
    expect(validateInputs({ ...baseInputs, savings: -1 }).length).toBeGreaterThan(0);
    expect(validateInputs({ ...baseInputs, currentAge: NaN }).length).toBeGreaterThan(0);
  });
  it('requires an SS benefit only when the user says they know it', () => {
    expect(validateInputs({ ...baseInputs, socialSecurityBenefit: NaN }).length).toBeGreaterThan(0);
    expect(
      validateInputs({ ...baseInputs, knowsSocialSecurity: false, socialSecurityBenefit: NaN }),
    ).toEqual([]);
  });
});

describe('compareRothVsTraditional — 2026 rules, end-to-end HAND CALC (no SS, no other accounts)', () => {
  // Same person as the 2025 scenario (Single, $100,000, 35 -> 65, 7%, $10,000 Pre-tax),
  // under 2026 rules.
  //   taxable = 100,000 - 16,100 = 83,900; tax = 1,240 + 4,560 + 22% x 33,500 (7,370) = 13,170
  //   FICA 7,650;  take-home = 100,000 - 13,170 - 7,650 = 79,180;  need = 69,180
  //   Gross-up, taxable T in the 22% bracket: tax = 5,800 + 0.22 (T - 50,400) = 0.22 T - 5,288
  //     net = (T + 16,100) - 0.22 T + 5,288 = 0.78 T + 21,388 = 69,180
  //     T = 47,792 / 0.78 = 61,271.79;  G = 77,371.79;  tax = G - 69,180 = 8,191.79
  //     effective rate = 8,191.79 / 77,371.79 = 0.10588
  const r = compareRothVsTraditional({ ...baseInputs, year: 2026 });

  it('uses the 2026 data', () => {
    expect(r.dataYear).toBe(2026);
    expect(r.current.standardDeduction).toBe(16100);
    expect(r.current.tax).toBeCloseTo(13170, 6);
    expect(r.rates.marginalNow).toBe(0.22);
    expect(r.retirementNeed.target).toBeCloseTo(69180, 6);
  });

  it('gross-up and effective rate', () => {
    expect(r.grossUp.grossWithdrawal).toBeCloseTo(77371.79, 1);
    expect(r.grossUp.totalTaxPaid).toBeCloseTo(8191.79, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.10588, 4);
  });

  it('contribution limit check uses the 2026 limit', () => {
    expect(r.limitCheck.limit).toBe(24500);
    expect(r.limitCheck.year).toBe(2026);
  });
});
