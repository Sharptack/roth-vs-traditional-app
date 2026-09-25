import { describe, it, expect } from 'vitest';
import {
  calculatePaycheckEquivalents,
  compareRothVsTraditional,
  leanFromRates,
  validateInputs,
} from '../src/lib/compare.js';
import { estimateSocialSecurityBenefit } from '../src/lib/socialSecurity.js';
import { futureValueAnnuity as futureValueAnnuityRef } from '../src/lib/growthCalculations.js';
import { solveGrossWithdrawal } from '../src/lib/incomeNeed.js';

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
  // Section 1 (the $10,000 is Pre-tax, so it is deducted before income tax, not before FICA)
  //   taxable = 100,000 - 10,000 - 15,750 = 74,250
  //   tax = 1,192.50 + 4,386 + 22% x (74,250 - 48,475 = 25,775) 5,670.50 = 11,249.00
  //   (without the deduction: 84,250 taxable -> 13,449; the deduction saves 22% x 10,000 = 2,200)
  //   FICA = 6.2% x 100,000 + 1.45% x 100,000 = 6,200 + 1,450 = 7,650
  //   marginal 22% (read before the deduction: 84,250); take-home = 100,000 - 11,249 - 7,650 = 81,101
  //   need = 81,101 - 10,000 = 71,101
  // Section 8:  P = 10,000; R = 10,000 x (1 - 0.22) = 7,800
  // Gross-up (no other income, so no SS effects): T = taxable withdrawal in the 22% bracket
  //   tax = 5,578.50 + 22% (T - 48,475) = 0.22 T - 5,086
  //   net = (T + 15,750) - 0.22 T + 5,086 = 0.78 T + 20,836 = 71,101
  //   T = 50,265 / 0.78 = 64,442.31;  G = 80,192.31;  tax = G - need = 9,091.31
  //   effective rate = 9,091.31 / 80,192.31 = 0.11337
  // Growth: 1.07^30 = 7.612255; annuity factor = 6.612255 / 0.07 = 94.46079
  //   FV(P) = 944,607.86;  FV(R) = 7,800 x 94.46079 = 736,794.13
  // Section 2 (annual 4% withdrawals):
  //   Roth 29,471.77;  Pre-tax 37,784.31 x (1 - 0.11337) = 33,500.75  -> Pre-tax wins (11.3% < 22%)
  // Section 3: Roth scenario = all Roth, so no tax; Pre-tax scenario = one pre-tax
  //   bucket, so it IS the gross-up: pays 9,091.31, k = 80,192.31 / 37,784.31 = 2.1224
  //   (Roth: k = 71,101 / 29,471.77 = 2.4125)
  const eff = 9091.3077 / 80192.3077;
  const r = compareRothVsTraditional(baseInputs);

  it('Section 1: current tax position and retirement income need', () => {
    expect(r.valid).toBe(true);
    expect(r.current.pretaxDeduction).toBe(10000);
    expect(r.current.taxableIncome).toBe(74250);
    expect(r.current.tax).toBeCloseTo(11249, 6);
    expect(r.rates.marginalNow).toBe(0.22);
    expect(r.current.fica.total).toBeCloseTo(7650, 6);
    expect(r.current.afterTaxIncome).toBeCloseTo(81101, 6);
    expect(r.retirementNeed.target).toBeCloseTo(71101, 6);
    // the budget walk shown in the UI
    expect(r.retirementNeed.breakdown).toMatchObject({
      grossIncome: 100000,
      pretaxDeduction: 10000,
      standardDeduction: 15750,
      taxableIncome: 74250,
      incomeTax: expect.closeTo(11249, 6),
      incomeTaxWithoutPretaxDeduction: expect.closeTo(13449, 6),
      fica: expect.closeTo(7650, 6),
      takeHome: expect.closeTo(81101, 6),
      savings: 10000,
      currentType: 'pretax',
    });
  });

  it('Section 8: contribution equivalents', () => {
    expect(r.contribution.pretax).toBe(10000);
    expect(r.contribution.roth).toBeCloseTo(7800, 6);
  });

  it('Section 6: gross-up and effective retirement rate', () => {
    expect(r.grossUp.grossWithdrawal).toBeCloseTo(80192.31, 1);
    expect(r.grossUp.totalTaxPaid).toBeCloseTo(9091.31, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.11337, 4);
  });

  it('Sections 9-10: growth of the contribution and after-tax income', () => {
    expect(r.annuity.pretax.futureValue).toBeCloseTo(944607.86, 0);
    expect(r.annuity.roth.futureValue).toBeCloseTo(736794.13, 0);
    expect(r.lumpSum.roth.futureValue).toBeCloseTo(7800 * 7.612255, 0);
    expect(r.lumpSum.pretax.futureValueGross).toBeCloseTo(10000 * 7.612255, 0);
    expect(r.lumpSum.pretax.afterTaxValue).toBeCloseTo(10000 * 7.612255 * (1 - eff), 0);
    expect(r.annuity.roth.afterTaxWithdrawal).toBeCloseTo(29471.77, 1);
    expect(r.annuity.pretax.annualWithdrawal).toBeCloseTo(37784.31, 1);
    expect(r.annuity.pretax.afterTaxWithdrawal).toBeCloseTo(33500.75, -1);
  });

  it('Section 2 verdict: Pre-tax wins because the retirement rate is below the current rate', () => {
    expect(r.rates.effectiveRetirement).toBeLessThan(r.rates.marginalNow);
    expect(r.comparison.winner).toBe('pretax');
    expect(r.comparison.afterTaxIncomeDifference).toBeCloseTo(33500.75 - 29471.77, -1);
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
    expect(r.portfolio.roth.scaleFactor).toBeCloseTo(2.4125, 3);
    expect(r.portfolio.pretax.totalTaxPaid).toBeCloseTo(9091.31, 1);
    expect(r.portfolio.pretax.scaleFactor).toBeCloseTo(2.1224, 3);
    expect(r.portfolio.pretax.totalGrossWithdrawal).toBeCloseTo(r.grossUp.grossWithdrawal, 2);
  });

  it('Section 11: both scenarios deliver the same after-tax income as the Section 1 need', () => {
    expect(r.portfolio.roth.achievedAfterTaxIncome).toBeCloseTo(71101, 2);
    expect(r.portfolio.pretax.achievedAfterTaxIncome).toBeCloseTo(71101, 2);
  });

  it('Section 11: tax difference headline', () => {
    expect(r.taxDifference.amount).toBeCloseTo(9091.31, 1);
    expect(r.taxDifference.lowerTaxScenario).toBe('roth');
  });
});

describe('compareRothVsTraditional — wiring', () => {
  it('subtracts debt, other expenses and savings from after-tax income (Section 3)', () => {
    const r = compareRothVsTraditional({ ...baseInputs, debtPayments: 6000, otherExpenses: 4000 });
    // 81,101 - 6,000 - 4,000 - 10,000 = 61,101
    expect(r.retirementNeed.target).toBeCloseTo(61101, 6);
  });

  it('floors a negative need at zero and keeps the raw value', () => {
    const r = compareRothVsTraditional({ ...baseInputs, debtPayments: 90000 });
    expect(r.retirementNeed.raw).toBeCloseTo(81101 - 90000 - 10000, 6);
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
  //   taxable = 100,000 - 10,000 - 16,100 = 73,900; tax = 1,240 + 4,560 + 22% x 23,500 (5,170) = 10,970
  //   FICA 7,650;  take-home = 100,000 - 10,970 - 7,650 = 81,380;  need = 71,380
  //   Gross-up, taxable T in the 22% bracket: tax = 5,800 + 0.22 (T - 50,400) = 0.22 T - 5,288
  //     net = (T + 16,100) - 0.22 T + 5,288 = 0.78 T + 21,388 = 71,380
  //     T = 49,992 / 0.78 = 64,092.31;  G = 80,192.31;  tax = G - 71,380 = 8,812.31
  //     effective rate = 8,812.31 / 80,192.31 = 0.10989
  const r = compareRothVsTraditional({ ...baseInputs, year: 2026 });

  it('uses the 2026 data', () => {
    expect(r.dataYear).toBe(2026);
    expect(r.current.standardDeduction).toBe(16100);
    expect(r.current.tax).toBeCloseTo(10970, 6);
    expect(r.rates.marginalNow).toBe(0.22);
    expect(r.retirementNeed.target).toBeCloseTo(71380, 6);
  });

  it('gross-up and effective rate', () => {
    expect(r.grossUp.grossWithdrawal).toBeCloseTo(80192.31, 1);
    expect(r.grossUp.totalTaxPaid).toBeCloseTo(8812.31, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.10989, 4);
  });

  it('contribution limit check uses the 2026 limit', () => {
    expect(r.limitCheck.limit).toBe(24500);
    expect(r.limitCheck.year).toBe(2026);
  });
});

describe('withoutSocialSecurity — the simple view (HAND CALC)', () => {
  // Single, 2025, $60,000 gross, saves $5,000 Pre-tax, ages 35 -> 65, 7%, no other accounts.
  //   taxable = 60,000 - 5,000 - 15,750 = 39,250; tax = 1,192.50 + 12% x 27,325 (3,279) = 4,471.50
  //   marginal 12% (before the deduction: 44,250 taxable)
  //   FICA = 7.65% x 60,000 = 4,590;  take-home = 60,000 - 4,471.50 - 4,590 = 50,938.50
  //   need = 50,938.50 - 5,000 = 45,938.50;   P = 5,000, R = 5,000 x 0.88 = 4,400
  // Without Social Security the accounts must supply all 45,938.50 after tax. T in the 12% bracket:
  //   net = 0.88 T + 15,988.50 = 45,938.50  ->  T = 29,950 / 0.88 = 34,034.09  (in 12%: OK)
  //   G = 34,034.09 + 15,750 = 49,784.09;  tax = 0.12 T - 238.50 = 3,845.59
  //   blended (effective) rate = 3,845.59 / 49,784.09 = 0.07725;  MARGINAL rate = 12%
  // Annual 4% withdrawals (FV factor 94.46079): Roth 4,400 -> 415,627.5 -> 16,625.10.
  //   Pre-tax 5,000 -> 472,303.9 -> 18,892.16;  x (1 - 0.07725) = 17,432.8 at the BLENDED rate
  //   (the headline: same method as the main comparison, minus the Social Security phase-in),
  //   or x (1 - 0.12) = 16,625.10 at the marginal rate (reference only). Marginal later (12%) =
  //   marginal now (12%), so at the marginal rate the two are exactly equal: P x 0.88 = R.
  const inputs = { ...baseInputs, grossIncome: 60000, savings: 5000 };
  const r = compareRothVsTraditional(inputs);
  const s = r.withoutSocialSecurity;

  it('Section 1 inputs for this case', () => {
    expect(r.current.tax).toBeCloseTo(4471.5, 6);
    expect(r.rates.marginalNow).toBe(0.12);
    expect(r.retirementNeed.target).toBeCloseTo(45938.5, 6);
    expect(r.contribution.roth).toBeCloseTo(4400, 6);
  });

  it('solves the gross-up with no Social Security', () => {
    expect(s.grossUp.grossWithdrawal).toBeCloseTo(49784.09, 1);
    expect(s.grossUp.totalTaxPaid).toBeCloseTo(3845.59, 1);
    expect(s.grossUp.solutionStack.taxableSS).toBe(0);
    expect(s.effectiveRateRetirement).toBeCloseTo(0.07725, 4);
  });

  it('reads the MARGINAL rate at the top of the stack', () => {
    expect(s.marginalRateRetirement).toBe(0.12);
    expect(s.taxableIncomeAtTop).toBeCloseTo(34034.09, 1);
  });

  it('headline compares Roth and Pre-tax at the BLENDED rate: Pre-tax wins (7.7% < 12% now)', () => {
    expect(s.annuity.roth.afterTaxWithdrawal).toBeCloseTo(16625.1, 0);
    expect(s.annuity.pretax.afterTaxWithdrawal).toBeCloseTo(17432.8, 0);
    expect(s.comparison.winner).toBe('pretax');
    expect(s.comparison.afterTaxIncomeDifference).toBeCloseTo(17432.8 - 16625.1, 0);
  });

  it('the at-marginal-rate figure is reference only, and equals Roth exactly when the marginal rates match', () => {
    expect(s.annuity.pretax.afterTaxWithdrawalAtMarginal).toBeCloseTo(s.annuity.roth.afterTaxWithdrawal, 4);
    expect(s.annuity.pretax.afterTaxWithdrawal / s.annuity.pretax.afterTaxWithdrawalAtMarginal).toBeCloseTo(
      (1 - s.effectiveRateRetirement) / (1 - 0.12),
      8,
    );
  });

  it('ignores whatever Social Security benefit is entered', () => {
    const withSS = compareRothVsTraditional({ ...inputs, socialSecurityBenefit: 24000 });
    expect(withSS.withoutSocialSecurity.marginalRateRetirement).toBe(s.marginalRateRetirement);
    expect(withSS.withoutSocialSecurity.grossUp.grossWithdrawal).toBeCloseTo(s.grossUp.grossWithdrawal, 6);
    // ...while the with-Social-Security result does change
    expect(withSS.grossUp.grossWithdrawal).toBeLessThan(s.grossUp.grossWithdrawal);
  });

  it('PROPERTY: when this account is needed to fill the gap, the no-SS retirement bracket never exceeds today\'s, so Roth (almost) never wins', () => {
    // Reason: when withdrawals from this account are needed (gross-up > 0), total pre-tax income Y solves
    // net(Y) = need. Need <= today's take-home, so Y < today's gross income; brackets are monotone, so
    // marginal later <= marginal now. (Not true when other accounts' forced 4% draws already exceed the
    // need: see the next test.)
    //
    // NOTE ON THE EFFECTIVE RATE: we do NOT also assert effective <= marginal here. Capital gains
    // brackets stack on top of ordinary income (capitalGainsTax.js), so a bigger withdrawal from THIS
    // account can push a fixed taxable-account withdrawal from the 0% gains bracket into the 15% one.
    // That extra tax is real and gets counted as 'extra tax caused by this withdrawal,' so the blended
    // effective rate CAN exceed this account's own ordinary marginal rate when a taxable balance is
    // present (see incomeNeed.test.js's capital-gains-stacking tests for a clean, isolated example).
    // Empirically it still doesn't flip the verdict to Roth across this grid (checked below).
    for (const filingStatus of ['single', 'mfj']) {
      for (const grossIncome of [30000, 60000, 100000, 180000, 400000]) {
        for (const savings of [0, 5000, 20000]) {
          for (const otherPretaxBalance of [0, 150000, 1500000]) {
            const q = compareRothVsTraditional({
              ...baseInputs,
              filingStatus,
              grossIncome,
              savings,
              otherPretaxBalance,
              otherRothBalance: 50000,
              otherTaxableBalance: 30000,
            });
            const label = JSON.stringify({ filingStatus, grossIncome, savings, otherPretaxBalance });
            if (!(q.withoutSocialSecurity.grossUp.grossWithdrawal > 0)) continue; // other accounts already cover the need
            expect(q.withoutSocialSecurity.marginalRateRetirement, label).toBeLessThanOrEqual(q.rates.marginalNow);
            expect(q.withoutSocialSecurity.comparison.winner, label).not.toBe('roth');
          }
        }
      }
    }
  });

  it('big existing Pre-tax balances can push the bracket ABOVE today\'s, favoring Roth (HAND CALC)', () => {
    // Single, 2025, $30,000 gross: taxable 14,250 -> marginal 12% now. $2,000 saved (so both accounts hold something).
    // $1,500,000 of other Pre-tax money x 1.07^30 (7.612255) = 11,418,383; 4% = 456,735 of taxable
    // Pre-tax income every year, far more than the ~$25k need, so this account is not needed (G = 0)
    // and the bracket is set by those existing balances: 456,735 - 15,750 = 440,985 -> 35% bracket.
    const q = compareRothVsTraditional({ ...baseInputs, grossIncome: 30000, savings: 2000, otherPretaxBalance: 1500000 });
    expect(q.rates.marginalNow).toBe(0.12);
    expect(q.withoutSocialSecurity.grossUp.grossWithdrawal).toBe(0);
    expect(q.withoutSocialSecurity.marginalRateRetirement).toBe(0.35);
    expect(q.withoutSocialSecurity.comparison.winner).toBe('roth');
  });

  it('income below the standard deduction has a 0% marginal rate later, so Pre-tax beats Roth on paper', () => {
    // Need 11,929 (see the 14,000 case above): T = 0, so the last dollar is still sheltered.
    const q = compareRothVsTraditional({ ...baseInputs, grossIncome: 14000, savings: 1000 });
    expect(q.withoutSocialSecurity.marginalRateRetirement).toBe(0);
    expect(q.withoutSocialSecurity.comparison.winner).toBe('even'); // 0% now, 0% later
  });

  it('is a plain object of numbers (no NaN) for awkward inputs', () => {
    for (const o of [
      { grossIncome: 10000 },
      { savings: 0 },
      { debtPayments: 90000 },
      { otherPretaxBalance: 5000000 },
      { filingStatus: 'mfj', grossIncome: 300000, savings: 23500 },
    ]) {
      const q = compareRothVsTraditional({ ...baseInputs, ...o }).withoutSocialSecurity;
      for (const v of [q.marginalRateRetirement, q.effectiveRateRetirement, q.annuity.pretax.afterTaxWithdrawal, q.annuity.roth.afterTaxWithdrawal]) {
        expect(Number.isFinite(v), JSON.stringify(o)).toBe(true);
      }
    }
  });
});

describe('retirement lifestyle factor (HAND CALC)', () => {
  // Single, 2025, $100,000 gross, $10,000 Pre-tax savings: need 71,101 at the same lifestyle (see above).
  it('a 25% higher retirement lifestyle scales the need to 88,876.25', () => {
    // need = 71,101 x 1.25 = 88,876.25.  Gross-up in the 22% bracket: 0.78 T + 20,836 = 88,876.25
    //   T = 68,040.25 / 0.78 = 87,231.09 (in 22%);  G = 87,231.09 + 15,750 = 102,981.09
    //   tax = G - need = 14,104.84;  effective rate = 14,104.84 / 102,981.09 = 0.13697
    const r = compareRothVsTraditional({ ...baseInputs, retirementLifestyle: 1.25 });
    expect(r.retirementNeed.beforeLifestyleAdjustment).toBeCloseTo(71101, 6);
    expect(r.retirementNeed.lifestyleFactor).toBe(1.25);
    expect(r.retirementNeed.target).toBeCloseTo(88876.25, 6);
    expect(r.grossUp.grossWithdrawal).toBeCloseTo(102981.09, 1);
    expect(r.grossUp.totalTaxPaid).toBeCloseTo(14104.84, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.13697, 4);
    // both portfolio scenarios are solved to the higher target
    expect(r.portfolio.roth.achievedAfterTaxIncome).toBeCloseTo(88876.25, 2);
  });

  it('a lower lifestyle scales the need down', () => {
    expect(compareRothVsTraditional({ ...baseInputs, retirementLifestyle: 0.8 }).retirementNeed.target).toBeCloseTo(
      71101 * 0.8,
      6,
    );
  });

  it('defaults to 1 (same lifestyle) and leaves every earlier result unchanged', () => {
    const r = compareRothVsTraditional(baseInputs);
    expect(r.retirementNeed.lifestyleFactor).toBe(1);
    expect(r.retirementNeed.target).toBeCloseTo(71101, 6);
  });

  it('a much higher future lifestyle can push the retirement bracket ABOVE today\'s and favor Roth (HAND CALC)', () => {
    // Single, 2025, $60,000 gross, $5,000 saved Pre-tax: need 45,938.50 (see above), marginal now 12%.
    // Expect twice the lifestyle: need = 91,877.  22% bracket: 0.78 T + 20,836 = 91,877
    //   T = 71,041 / 0.78 = 91,078.21 (in 22%);  G = 106,828.21;  tax = G - 91,877 = 14,951.21
    //   blended rate = 14,951.21 / 106,828.21 = 0.13996 (> 12% now);  marginal later 22% (> 12%)
    const r = compareRothVsTraditional({
      ...baseInputs,
      grossIncome: 60000,
      savings: 5000,
      retirementLifestyle: 2,
    });
    expect(r.rates.marginalNow).toBe(0.12);
    expect(r.retirementNeed.target).toBeCloseTo(91877, 6);
    expect(r.grossUp.grossWithdrawal).toBeCloseTo(106828.21, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.13996, 4);
    expect(r.comparison.winner).toBe('roth');
    expect(r.withoutSocialSecurity.marginalRateRetirement).toBe(0.22);
    expect(r.withoutSocialSecurity.comparison.winner).toBe('roth');
  });
});

describe('overall effective rate in retirement', () => {
  it('equals total tax / total gross income (Social Security + every withdrawal, Roth included)', () => {
    const r = compareRothVsTraditional({
      ...baseInputs,
      knowsSocialSecurity: true,
      socialSecurityBenefit: 20000,
      otherPretaxBalance: 60000,
      otherRothBalance: 40000,
      otherTaxableBalance: 20000,
    });
    const gross =
      20000 +
      r.otherWithdrawals.pretaxGross +
      r.otherWithdrawals.roth +
      r.otherWithdrawals.taxableGross +
      r.grossUp.grossWithdrawal;
    expect(r.retirementOverall.grossIncome).toBeCloseTo(gross, 6);
    expect(r.retirementOverall.totalTax).toBeCloseTo(r.grossUp.solutionStack.totalTax, 6);
    expect(r.rates.overallEffectiveRetirement).toBeCloseTo(r.grossUp.solutionStack.totalTax / gross, 10);
  });

  it('with a single pre-tax source it equals the effective rate on the withdrawal (HAND CALC)', () => {
    // no Social Security, no other accounts: total gross = G = 80,192.31, total tax = 9,091.31
    const r = compareRothVsTraditional(baseInputs);
    expect(r.rates.overallEffectiveRetirement).toBeCloseTo(0.11337, 4);
    expect(r.rates.overallEffectiveRetirement).toBeCloseTo(r.rates.effectiveRetirement, 10);
  });

  it('is lower than the rate on the withdrawals when Social Security and Roth money share the income (HAND CALC)', () => {
    // Social Security 30,000 and 4% of a 50,000 Roth balance grown 30y (15,224.51) are mostly untaxed, and
    // together they leave about 23,677 for this account to supply, so total tax / total gross income
    // (spread over ~73,000) is well below the tax on the pre-tax withdrawal alone (spread over ~28,000).
    const r = compareRothVsTraditional({
      ...baseInputs,
      knowsSocialSecurity: true,
      socialSecurityBenefit: 30000,
      otherRothBalance: 50000,
    });
    expect(r.grossUp.grossWithdrawal).toBeGreaterThan(0);
    expect(r.rates.overallEffectiveRetirement).toBeLessThan(r.rates.effectiveRetirement);
  });
});

describe('W-2 vs 1099 income (2025 single, HAND CALC)', () => {
  it('all 1099, $100,000, $10,000 saved', () => {
    // SE tax = 15.3% x 92,350 = 14,129.55; half deducted = 7,064.775; plus the 10,000 Pre-tax savings
    // taxable = 100,000 - 7,064.775 - 10,000 - 15,750 = 67,185.225
    // tax = 5,578.50 + 22% x (67,185.225 - 48,475 = 18,710.225) = 5,578.50 + 4,116.2495 = 9,694.7495
    // take-home = 100,000 - 9,694.7495 - 14,129.55 = 76,175.7005;  need = 66,175.70
    const r = compareRothVsTraditional({ ...baseInputs, selfEmploymentIncome: 100000 });
    expect(r.current.fica.selfEmployment.tax).toBeCloseTo(14129.55, 6);
    expect(r.current.adjustments).toBeCloseTo(17064.775, 6);
    expect(r.retirementNeed.breakdown.selfEmploymentDeduction).toBeCloseTo(7064.775, 6);
    expect(r.current.taxableIncome).toBeCloseTo(67185.225, 6);
    expect(r.current.tax).toBeCloseTo(9694.7495, 4);
    expect(r.rates.marginalNow).toBe(0.22);
    expect(r.current.afterTaxIncome).toBeCloseTo(76175.7005, 4);
    expect(r.retirementNeed.target).toBeCloseTo(66175.7005, 4);
    expect(r.retirementNeed.breakdown.selfEmploymentTax).toBeCloseTo(14129.55, 6);
  });

  it('$60,000 W-2 + $40,000 1099', () => {
    // payroll = 3,720 + 870 + 5,651.82 = 10,241.82;  half of SE tax = 2,825.91
    // taxable = 100,000 - 2,825.91 - 10,000 - 15,750 = 71,424.09
    // tax = 5,578.50 + 22% x (71,424.09 - 48,475 = 22,949.09) = 5,578.50 + 5,048.80 = 10,627.30
    // take-home = 100,000 - 10,627.30 - 10,241.82 = 79,130.88
    const r = compareRothVsTraditional({ ...baseInputs, selfEmploymentIncome: 40000 });
    expect(r.current.fica.total).toBeCloseTo(10241.82, 6);
    expect(r.current.tax).toBeCloseTo(10627.3, 1);
    expect(r.current.afterTaxIncome).toBeCloseTo(79130.88, 1);
  });

  it('all W-2 is unchanged from the earlier results', () => {
    const r = compareRothVsTraditional({ ...baseInputs, selfEmploymentIncome: 0 });
    expect(r.current.fica.total).toBeCloseTo(7650, 6);
    expect(r.current.adjustments).toBe(10000); // only the Pre-tax savings, no self-employment tax
    expect(r.retirementNeed.breakdown.selfEmploymentDeduction).toBe(0);
    expect(r.retirementNeed.target).toBeCloseTo(71101, 6);
  });

  it('1099 income lowers take-home pay, so it lowers the retirement income number', () => {
    const w2 = compareRothVsTraditional(baseInputs);
    const se = compareRothVsTraditional({ ...baseInputs, selfEmploymentIncome: 100000 });
    expect(se.retirementNeed.target).toBeLessThan(w2.retirementNeed.target);
  });

  it('the Social Security estimate counts net self-employment earnings (92.35%)', () => {
    const r = compareRothVsTraditional({ ...baseInputs, knowsSocialSecurity: false, selfEmploymentIncome: 100000 });
    const expected = estimateSocialSecurityBenefit({
      annualIncome: 92350,
      currentAge: 35,
      retirementAge: 65,
      year: 2025,
    });
    expect(r.socialSecurity.annualBenefit).toBeCloseTo(expected.annualBenefit, 6);
  });
});

describe('validation of the new inputs', () => {
  it('1099 income cannot exceed gross income or be negative', () => {
    expect(validateInputs({ ...baseInputs, selfEmploymentIncome: 120000 }).join(' ')).toMatch(/1099/);
    expect(validateInputs({ ...baseInputs, selfEmploymentIncome: -5 }).join(' ')).toMatch(/1099/);
    expect(validateInputs({ ...baseInputs, selfEmploymentIncome: 100000 })).toEqual([]);
  });
  it('the lifestyle factor must be between 0.5 and 3', () => {
    expect(validateInputs({ ...baseInputs, retirementLifestyle: 0.4 }).join(' ')).toMatch(/lifestyle/i);
    expect(validateInputs({ ...baseInputs, retirementLifestyle: 3.5 }).join(' ')).toMatch(/lifestyle/i);
    expect(validateInputs({ ...baseInputs, retirementLifestyle: 1.5 })).toEqual([]);
  });
});

describe('contribution limits: excess above the IRS limit defaults to a taxable account', () => {
  // Single, 2025, $150,000 gross (24% marginal), 35 -> 65 (30y, 7%), 401(k) limit $23,500.
  // No other balances, no Social Security, so the portfolio's taxable bucket starts at 0 and
  // any nonzero taxable balance in the scenarios below comes entirely from the excess.
  const base = {
    ...baseInputs,
    grossIncome: 150000,
    debtPayments: 0,
    otherPretaxBalance: 0,
    knowsSocialSecurity: true,
    socialSecurityBenefit: 0,
  };

  it('currently Pre-tax, savings $30,000: Pre-tax spills $6,500/year into taxable, Roth fits entirely (HAND CALC)', () => {
    // P = 30,000 (currentType pretax); R = 30,000 x (1 - 0.24) = 22,800.
    // 401(k) limit $23,500: P is capped at 23,500 (excess 6,500); R (22,800) fits with no excess.
    // Annuity factor (1.07^30 - 1)/0.07 = 94.460786...
    const r = compareRothVsTraditional({ ...base, savings: 30000, currentType: 'pretax' });
    expect(r.rates.marginalNow).toBe(0.24);
    expect(r.contribution.pretax).toBe(30000);
    expect(r.contribution.roth).toBeCloseTo(22800, 6);

    expect(r.contributionSplit.pretax.toAccount).toBe(23500);
    expect(r.contributionSplit.pretax.excessToTaxable).toBe(6500);
    expect(r.contributionSplit.roth.toAccount).toBeCloseTo(22800, 6);
    expect(r.contributionSplit.roth.excessToTaxable).toBe(0);

    // The account itself grows from the CAPPED contribution, not the raw $30,000.
    expect(r.annuity.pretax.futureValue).toBeCloseTo(2219828.48, 1);
    expect(r.annuity.roth.futureValue).toBeCloseTo(2153705.93, 1);

    // The excess shows up as taxable-bucket growth in the Pre-tax scenario only.
    expect(r.portfolio.pretax.buckets.taxable).toBeCloseTo(613995.11, 1);
    expect(r.portfolio.roth.buckets.taxable).toBeCloseTo(0, 6);
    expect(r.portfolio.pretax.buckets.pretax).toBeCloseTo(2219828.48, 1);
    expect(r.portfolio.roth.buckets.roth).toBeCloseTo(2153705.93, 1);

    // The limit-check warning names the exact excess and explains where it goes.
    expect(r.limitCheck.overLimit).toBe(true);
    expect(r.limitCheck.message).toContain('extra $6,500/year');
    expect(r.limitCheck.message).toContain('taxable investment account');
  });

  it('currently Roth, savings $40,000: both scenarios spill over, by different amounts (HAND CALC)', () => {
    // R = 40,000 (currentType roth); P = 40,000 / (1 - 0.24) = 52,631.58.
    // Roth capped at 23,500 (excess 16,500); Pre-tax capped at 23,500 (excess 29,131.58).
    const r = compareRothVsTraditional({ ...base, savings: 40000, currentType: 'roth' });
    expect(r.contribution.roth).toBe(40000);
    expect(r.contribution.pretax).toBeCloseTo(52631.58, 1);

    expect(r.contributionSplit.roth.toAccount).toBe(23500);
    expect(r.contributionSplit.roth.excessToTaxable).toBe(16500);
    expect(r.contributionSplit.pretax.toAccount).toBe(23500);
    expect(r.contributionSplit.pretax.excessToTaxable).toBeCloseTo(29131.58, 1);

    // Both accounts grow identically (both capped at the same limit)...
    expect(r.annuity.roth.futureValue).toBeCloseTo(2219828.48, 1);
    expect(r.annuity.pretax.futureValue).toBeCloseTo(2219828.48, 1);
    // ...but the taxable spillover differs, since P > R at the same take-home cost.
    expect(r.portfolio.roth.buckets.taxable).toBeCloseTo(1558602.97, 1);
    expect(r.portfolio.pretax.buckets.taxable).toBeCloseTo(2751791.85, 1);
    expect(r.portfolio.pretax.buckets.taxable).toBeGreaterThan(r.portfolio.roth.buckets.taxable);
  });

  it('under the limit: nothing changes from the pre-cap behavior (backward-compatible)', () => {
    const r = compareRothVsTraditional({ ...base, savings: 10000, currentType: 'pretax' });
    expect(r.contributionSplit.pretax.excessToTaxable).toBe(0);
    expect(r.contributionSplit.roth.excessToTaxable).toBe(0);
    expect(r.annuity.pretax.futureValue).toBeCloseTo(
      futureValueAnnuityRef(r.contribution.pretax, 0.07, 30),
      1,
    );
    expect(r.portfolio.roth.buckets.taxable).toBe(0);
    expect(r.portfolio.pretax.buckets.taxable).toBe(0);
  });

  it('respects the IRA limit ($7,000 for 2025) instead of the 401(k) limit when accountType is ira', () => {
    const r = compareRothVsTraditional({ ...base, savings: 10000, currentType: 'pretax', accountType: 'ira' });
    expect(r.contributionSplit.pretax.toAccount).toBe(7000);
    expect(r.contributionSplit.pretax.excessToTaxable).toBe(3000);
    expect(r.limitCheck.limit).toBe(7000);
  });
});

describe('contribution limits: catch-up contributions raise the cap at age 50+ (HAND CALC)', () => {
  // Single, 2025, $150,000 gross, 401(k), $28,000 saved Pre-tax (so P = savings = 28,000
  // directly, since currentType is already pretax). Base 401(k) limit is $23,500.
  const base = {
    ...baseInputs,
    grossIncome: 150000,
    savings: 28000,
    currentType: 'pretax',
    accountType: '401k',
    retirementAge: 65,
  };

  it('at 45 (under 50): no catch-up, $28,000 exceeds the $23,500 base limit -> $4,500 spills to taxable', () => {
    const r = compareRothVsTraditional({ ...base, currentAge: 45 });
    expect(r.limitCheck.limit).toBe(23500);
    expect(r.limitCheck.catchUp).toBe(0);
    expect(r.limitCheck.overLimit).toBe(true);
    expect(r.contributionSplit.pretax.toAccount).toBe(23500);
    expect(r.contributionSplit.pretax.excessToTaxable).toBe(4500);
  });

  it('at 55 (50-59 catch-up): limit rises to $31,000 ($23,500 + $7,500), so $28,000 fits with no excess', () => {
    const r = compareRothVsTraditional({ ...base, currentAge: 55 });
    expect(r.limitCheck.limit).toBe(31000);
    expect(r.limitCheck.catchUp).toBe(7500);
    expect(r.limitCheck.overLimit).toBe(false);
    expect(r.contributionSplit.pretax.toAccount).toBe(28000);
    expect(r.contributionSplit.pretax.excessToTaxable).toBe(0);
  });

  it('at 62 (60-63 enhanced catch-up): limit rises further to $34,750 ($23,500 + $11,250)', () => {
    const r = compareRothVsTraditional({ ...base, savings: 33000, currentAge: 62 });
    expect(r.limitCheck.limit).toBe(34750);
    expect(r.limitCheck.catchUp).toBe(11250);
    expect(r.contributionSplit.pretax.toAccount).toBe(33000);
    expect(r.contributionSplit.pretax.excessToTaxable).toBe(0);
  });

  it('the over-limit message names the catch-up amount when one applies', () => {
    const r = compareRothVsTraditional({ ...base, savings: 36000, currentAge: 55 });
    // limit 31,000; 36,000 - 31,000 = 5,000 excess
    expect(r.limitCheck.message).toContain('$7,500 catch-up contribution for being 50 or older');
    expect(r.limitCheck.message).toContain('extra $5,000/year');
  });
});

describe('effective-rate probe size: stable and consistent when other income already covers the need', () => {
  // Single, 2025, $60,000 gross (12% marginal), SS $40,000 (known), $15,000 saved Pre-tax,
  // no other account balances. SS alone already covers modest targets, so the gross-up is
  // always $0 here — only the PROBE used to report a rate differs from the old fixed $1,000.
  const base = {
    ...baseInputs,
    grossIncome: 60000,
    savings: 15000,
    currentType: 'pretax',
    knowsSocialSecurity: true,
    socialSecurityBenefit: 40000,
    otherPretaxBalance: 0,
  };

  it('the reported rate is now measured on the account\'s own withdrawal, not a fixed $1,000 (HAND CALC)', () => {
    // P = $15,000 (currentType pretax). Annuity FV = 15,000 x 94.460786 = 1,416,911.79.
    // Account's own 4% annual withdrawal = 56,676.47 — that is the probe size used.
    // combined income at that probe = 56,676.47 + 0.5 x 40,000 = 76,676.47, well past the
    //   $34,000 85%-taxable threshold, so taxableSS caps at 0.85 x 40,000 = $34,000.
    // ordinary taxable income = 56,676.47 + 34,000 - 15,750 = 74,926.47
    // tax = 1,192.50 + 4,386 + 22% x (74,926.47 - 48,475 = 26,451.47) = 11,397.82
    // rate = 11,397.82 / 56,676.47 = 0.20110...
    const r = compareRothVsTraditional({ ...base, debtPayments: 0 });
    expect(r.grossUp.grossWithdrawal).toBe(0);
    expect(r.annuity.pretax.annualWithdrawal).toBeCloseTo(56676.47, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.201103, 4);
    // A fixed $1,000 probe on this same "other income" stack would have read 0% — completely
    // hiding the real cost, because $1,000 never leaves the SS 0%-taxable zone.
    const oldStyleProbe = solveGrossWithdrawal({
      targetAfterTaxIncome: r.retirementNeed.target,
      ssBenefit: 40000,
      filingStatus: 'single',
      year: 2025,
    });
    expect(oldStyleProbe.retirementEffectiveTaxRate).toBe(0);
  });

  it('PROPERTY: the rate stays IDENTICAL as the target need drops further, as long as G stays 0', () => {
    // This is the exact confusion reported: previously, lowering the need (e.g. an expense
    // going away) could change the reported rate, because it changed WHERE a fixed $1,000
    // probe landed relative to the target. Now the probe is tied to the account's own size,
    // which does not depend on the target at all, so the rate cannot move just because the
    // need dropped (only a change in other income or the account's own size can move it).
    const rates = [0, 5000, 10000, 15000].map((debtPayments) => {
      const r = compareRothVsTraditional({ ...base, debtPayments });
      expect(r.grossUp.grossWithdrawal).toBe(0); // stays in the "other income covers it" regime
      return r.rates.effectiveRetirement;
    });
    for (const rate of rates) expect(rate).toBeCloseTo(rates[0], 10);
  });

  it('the same fix applies to "Retirement years without Social Security"', () => {
    const withoutSS = (debtPayments) =>
      compareRothVsTraditional({ ...base, debtPayments, otherPretaxBalance: 2000000 })
        .withoutSocialSecurity;
    // A large other-Pre-tax balance covers the no-SS need on its own -> G = 0 in both cases.
    const a = withoutSS(0);
    const b = withoutSS(5000);
    expect(a.grossUp.grossWithdrawal).toBe(0);
    expect(b.grossUp.grossWithdrawal).toBe(0);
    expect(a.effectiveRateRetirement).toBeCloseTo(b.effectiveRateRetirement, 10);
  });
});

describe('Pre-tax savings are deducted before income tax (2025 single, HAND CALC)', () => {
  it('Pre-tax $10,000 and its Roth equivalent $7,800 leave the same retirement income number', () => {
    // Pre-tax: tax on 74,250 = 11,249;  take-home 100,000 - 11,249 - 7,650 = 81,101;  need 81,101 - 10,000 = 71,101
    // Roth:    no deduction, tax on 84,250 = 13,449;  take-home 78,901;  need 78,901 - 7,800 = 71,101
    // Same take-home cost, same spending left over (the whole 10,000 sits in the 22% bracket).
    const pretax = compareRothVsTraditional(baseInputs);
    const roth = compareRothVsTraditional({ ...baseInputs, savings: 7800, currentType: 'roth' });
    expect(roth.current.pretaxDeduction).toBe(0);
    expect(roth.current.tax).toBeCloseTo(13449, 6);
    expect(roth.retirementNeed.breakdown.incomeTaxWithoutPretaxDeduction).toBeCloseTo(13449, 6);
    expect(roth.retirementNeed.target).toBeCloseTo(71101, 6);
    expect(pretax.retirementNeed.target).toBeCloseTo(roth.retirementNeed.target, 6);
    // the marginal rate is read before the deduction either way
    expect(roth.rates.marginalNow).toBe(pretax.rates.marginalNow);
  });

  it('only the part under the IRS limit is deductible', () => {
    // $150,000 gross, $30,000 Pre-tax 401(k), limit 23,500 -> deduct 23,500 (the other 6,500 goes to taxable)
    //   taxable = 150,000 - 23,500 - 15,750 = 110,750
    //   tax = 1,192.50 + 4,386 + 12,072.50 + 24% x 7,400 (1,776) = 19,427
    //   without the deduction: 134,250 -> 17,651 + 24% x 30,900 (7,416) = 25,067 (saves 24% x 23,500 = 5,640)
    //   FICA = 9,300 + 2,175 = 11,475;  take-home = 150,000 - 19,427 - 11,475 = 119,098;  need = 89,098
    const r = compareRothVsTraditional({ ...baseInputs, grossIncome: 150000, savings: 30000 });
    expect(r.current.pretaxDeduction).toBe(23500);
    expect(r.current.taxableIncome).toBe(110750);
    expect(r.current.tax).toBeCloseTo(19427, 6);
    expect(r.retirementNeed.breakdown.incomeTaxWithoutPretaxDeduction).toBeCloseTo(25067, 6);
    expect(r.rates.marginalNow).toBe(0.24);
    expect(r.retirementNeed.target).toBeCloseTo(89098, 6);
  });
});

describe('leanFromRates — the rule-of-thumb lean from the two rates', () => {
  it('Pre-tax when the retirement rate is lower, Roth when higher, even within half a point', () => {
    expect(leanFromRates(0.22, 0.11337)).toBe('pretax');
    expect(leanFromRates(0.12, 0.13996)).toBe('roth');
    expect(leanFromRates(0.22, 0.216)).toBe('even'); // 0.4 points apart
    expect(leanFromRates(0.22, 0.224)).toBe('even');
    expect(leanFromRates(0, 0)).toBe('even');
  });

  it('is wired into the result', () => {
    expect(compareRothVsTraditional(baseInputs).rates.lean).toBe('pretax');
    expect(
      compareRothVsTraditional({ ...baseInputs, grossIncome: 60000, savings: 5000, retirementLifestyle: 2 }).rates.lean,
    ).toBe('roth');
  });
});

describe('rateDrivers — wired to the gross-up the rate came from', () => {
  it('base case: nothing else is taxed first, so the withdrawal runs from 0% up to the 22% bracket', () => {
    // G = 80,192.31, all of it this account's: the first 15,750 is under the deduction, the last dollar at 22%.
    const r = compareRothVsTraditional(baseInputs);
    expect(r.rateDrivers.hypothetical).toBe(false);
    expect(r.rateDrivers.withdrawal).toBeCloseTo(80192.31, 1);
    expect(r.rateDrivers.startBracket).toBe(0);
    expect(r.rateDrivers.endBracket).toBe(0.22);
    expect(r.rateDrivers.extraTax).toBeCloseTo(9091.31, 1);
    expect(r.rateDrivers.extraCapitalGainsTax).toBe(0);
    expect(r.withoutSocialSecurity.rateDrivers.withdrawal).toBeCloseTo(
      r.withoutSocialSecurity.grossUp.grossWithdrawal,
      6,
    );
  });

  it('other Pre-tax balances are taxed first and move the start bracket up', () => {
    const r = compareRothVsTraditional({ ...baseInputs, otherPretaxBalance: 150000 });
    expect(r.rateDrivers.otherPretaxWithdrawal).toBeCloseTo(r.otherWithdrawals.pretaxGross, 6);
    expect(r.rateDrivers.deductionUsedBefore).toBe(15750);
    expect(r.rateDrivers.startBracket).toBeGreaterThan(0);
  });
});
