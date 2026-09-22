import { describe, it, expect } from 'vitest';
import {
  calculatePaycheckEquivalents,
  compareRothVsTraditional,
  validateInputs,
} from '../src/lib/compare.js';
import { estimateSocialSecurityBenefit } from '../src/lib/socialSecurity.js';
import { futureValueAnnuity as futureValueAnnuityRef } from '../src/lib/growthCalculations.js';

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

describe('withoutSocialSecurity — the simple view (HAND CALC)', () => {
  // Single, 2025, $60,000 gross, saves $5,000 Pre-tax, ages 35 -> 65, 7%, no other accounts.
  //   taxable = 60,000 - 15,750 = 44,250; tax = 1,192.50 + 12% x 32,325 (3,879) = 5,071.50; marginal 12%
  //   FICA = 7.65% x 60,000 = 4,590;  take-home = 60,000 - 5,071.50 - 4,590 = 50,338.50
  //   need = 50,338.50 - 5,000 = 45,338.50;   P = 5,000, R = 5,000 x 0.88 = 4,400
  // Without Social Security the accounts must supply all 45,338.50 after tax. T in the 12% bracket:
  //   net = 0.88 T + 15,988.50 = 45,338.50  ->  T = 29,350 / 0.88 = 33,352.27  (in 12%: OK)
  //   G = 33,352.27 + 15,750 = 49,102.27;  tax = 0.12 T - 238.50 = 3,763.77
  //   blended (effective) rate = 3,763.77 / 49,102.27 = 0.07666;  MARGINAL rate = 12%
  // Annual 4% withdrawals (FV factor 94.46079): Roth 4,400 -> 415,627.5 -> 16,625.10.
  //   Pre-tax 5,000 -> 472,303.9 -> 18,892.16;  x (1 - 0.07665) = 17,444.0 at the BLENDED rate
  //   (the headline: same method as the main comparison, minus the Social Security phase-in),
  //   or x (1 - 0.12) = 16,625.10 at the marginal rate (reference only). Marginal later (12%) =
  //   marginal now (12%), so at the marginal rate the two are exactly equal: P x 0.88 = R.
  const inputs = { ...baseInputs, grossIncome: 60000, savings: 5000 };
  const r = compareRothVsTraditional(inputs);
  const s = r.withoutSocialSecurity;

  it('Section 1 inputs for this case', () => {
    expect(r.current.tax).toBeCloseTo(5071.5, 6);
    expect(r.rates.marginalNow).toBe(0.12);
    expect(r.retirementNeed.target).toBeCloseTo(45338.5, 6);
    expect(r.contribution.roth).toBeCloseTo(4400, 6);
  });

  it('solves the gross-up with no Social Security', () => {
    expect(s.grossUp.grossWithdrawal).toBeCloseTo(49102.27, 1);
    expect(s.grossUp.totalTaxPaid).toBeCloseTo(3763.77, 1);
    expect(s.grossUp.solutionStack.taxableSS).toBe(0);
    expect(s.effectiveRateRetirement).toBeCloseTo(0.07666, 4);
  });

  it('reads the MARGINAL rate at the top of the stack', () => {
    expect(s.marginalRateRetirement).toBe(0.12);
    expect(s.taxableIncomeAtTop).toBeCloseTo(33352.27, 1);
  });

  it('headline compares Roth and Pre-tax at the BLENDED rate: Pre-tax wins (7.7% < 12% now)', () => {
    expect(s.annuity.roth.afterTaxWithdrawal).toBeCloseTo(16625.1, 0);
    expect(s.annuity.pretax.afterTaxWithdrawal).toBeCloseTo(17444.0, 0);
    expect(s.comparison.winner).toBe('pretax');
    expect(s.comparison.afterTaxIncomeDifference).toBeCloseTo(17444.0 - 16625.1, 0);
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
  // Single, 2025, $100,000 gross, $10,000 Pre-tax savings: need 68,901 at the same lifestyle (see above).
  it('a 25% higher retirement lifestyle scales the need to 86,126.25', () => {
    // need = 68,901 x 1.25 = 86,126.25.  Gross-up in the 22% bracket: 0.78 T + 20,836 = 86,126.25
    //   T = 65,290.25 / 0.78 = 83,705.45 (in 22%);  G = 83,705.45 + 15,750 = 99,455.45
    //   tax = 0.22 T - 5,086 = 13,329.20;  effective rate = 13,329.20 / 99,455.45 = 0.13402
    const r = compareRothVsTraditional({ ...baseInputs, retirementLifestyle: 1.25 });
    expect(r.retirementNeed.beforeLifestyleAdjustment).toBeCloseTo(68901, 6);
    expect(r.retirementNeed.lifestyleFactor).toBe(1.25);
    expect(r.retirementNeed.target).toBeCloseTo(86126.25, 6);
    expect(r.grossUp.grossWithdrawal).toBeCloseTo(99455.45, 1);
    expect(r.grossUp.totalTaxPaid).toBeCloseTo(13329.2, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.13402, 4);
    // both portfolio scenarios are solved to the higher target
    expect(r.portfolio.roth.achievedAfterTaxIncome).toBeCloseTo(86126.25, 2);
  });

  it('a lower lifestyle scales the need down', () => {
    expect(compareRothVsTraditional({ ...baseInputs, retirementLifestyle: 0.8 }).retirementNeed.target).toBeCloseTo(
      68901 * 0.8,
      6,
    );
  });

  it('defaults to 1 (same lifestyle) and leaves every earlier result unchanged', () => {
    const r = compareRothVsTraditional(baseInputs);
    expect(r.retirementNeed.lifestyleFactor).toBe(1);
    expect(r.retirementNeed.target).toBeCloseTo(68901, 6);
  });

  it('a much higher future lifestyle can push the retirement bracket ABOVE today\'s and favor Roth (HAND CALC)', () => {
    // Single, 2025, $60,000 gross, $5,000 saved: need 45,338.50 (see above), marginal now 12%.
    // Expect twice the lifestyle: need = 90,677.  22% bracket: 0.78 T + 20,836 = 90,677
    //   T = 69,841 / 0.78 = 89,539.74 (in 22%);  G = 105,289.74;  tax = G - 90,677 = 14,612.74
    //   blended rate = 14,612.74 / 105,289.74 = 0.13879 (> 12% now);  marginal later 22% (> 12%)
    const r = compareRothVsTraditional({
      ...baseInputs,
      grossIncome: 60000,
      savings: 5000,
      retirementLifestyle: 2,
    });
    expect(r.rates.marginalNow).toBe(0.12);
    expect(r.retirementNeed.target).toBeCloseTo(90677, 6);
    expect(r.grossUp.grossWithdrawal).toBeCloseTo(105289.74, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.13879, 4);
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
    // no Social Security, no other accounts: total gross = G = 77,371.79, total tax = 8,470.79
    const r = compareRothVsTraditional(baseInputs);
    expect(r.rates.overallEffectiveRetirement).toBeCloseTo(0.10948, 4);
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
    // SE tax = 15.3% x 92,350 = 14,129.55; half deducted = 7,064.775
    // taxable = 100,000 - 7,064.775 - 15,750 = 77,185.225
    // tax = 5,578.50 + 22% x (77,185.225 - 48,475 = 28,710.225) = 5,578.50 + 6,316.2495 = 11,894.7495
    // take-home = 100,000 - 11,894.7495 - 14,129.55 = 73,975.7005;  need = 63,975.70
    const r = compareRothVsTraditional({ ...baseInputs, selfEmploymentIncome: 100000 });
    expect(r.current.fica.selfEmployment.tax).toBeCloseTo(14129.55, 6);
    expect(r.current.adjustments).toBeCloseTo(7064.775, 6);
    expect(r.current.taxableIncome).toBeCloseTo(77185.225, 6);
    expect(r.current.tax).toBeCloseTo(11894.7495, 4);
    expect(r.rates.marginalNow).toBe(0.22);
    expect(r.current.afterTaxIncome).toBeCloseTo(73975.7005, 4);
    expect(r.retirementNeed.target).toBeCloseTo(63975.7005, 4);
    expect(r.retirementNeed.breakdown.selfEmploymentTax).toBeCloseTo(14129.55, 6);
  });

  it('$60,000 W-2 + $40,000 1099', () => {
    // payroll = 3,720 + 870 + 5,651.82 = 10,241.82;  half of SE tax = 2,825.91
    // taxable = 100,000 - 2,825.91 - 15,750 = 81,424.09
    // tax = 5,578.50 + 22% x (81,424.09 - 48,475 = 32,949.09) = 5,578.50 + 7,248.8 = 12,827.30
    // take-home = 100,000 - 12,827.30 - 10,241.82 = 76,930.88
    const r = compareRothVsTraditional({ ...baseInputs, selfEmploymentIncome: 40000 });
    expect(r.current.fica.total).toBeCloseTo(10241.82, 6);
    expect(r.current.tax).toBeCloseTo(12827.3, 1);
    expect(r.current.afterTaxIncome).toBeCloseTo(76930.88, 1);
  });

  it('all W-2 is unchanged from the earlier results', () => {
    const r = compareRothVsTraditional({ ...baseInputs, selfEmploymentIncome: 0 });
    expect(r.current.fica.total).toBeCloseTo(7650, 6);
    expect(r.current.adjustments).toBe(0);
    expect(r.retirementNeed.target).toBeCloseTo(68901, 6);
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
