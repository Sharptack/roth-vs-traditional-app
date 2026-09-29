import { describe, it, expect } from 'vitest';
import {
  calculatePaycheckEquivalents,
  compareRothVsTraditional,
  leanFromRates,
  validateInputs,
} from '../src/lib/compare.js';
import { estimateSocialSecurityBenefit } from '../src/lib/socialSecurity.js';
import { futureValueAnnuity as futureValueAnnuityRef } from '../src/lib/growthCalculations.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from '../src/lib/formInputs.js';
import { explainFullTax } from '../src/lib/taxBreakdown.js';

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
  // Growth: 1.07^30 = 7.612255; annuity factor = 6.612255 / 0.07 = 94.46079
  //   FV(P) = 944,607.86;  FV(R) = 7,800 x 94.46079 = 736,794.13
  //   W = 4% x 944,607.86 = 37,784.31; RW = 4% x 736,794.13 = 29,471.77
  // Rates (sideAwareRates.js; no Existing Accounts, no SS, no side account since $10,000 is well
  // under the $23,500 2025 limit): the account's own withdrawal W is taxed alone.
  //   taxable = 37,784.31 - 15,750 = 22,034.31
  //   tax = 1,192.50 (10% x 11,925) + 12% x (22,034.31 - 11,925 = 10,109.31 -> 1,213.12) = 2,405.62
  //   effective rate = 2,405.62 / 37,784.31 = 0.06367
  //   tax saved now (no side account) = marginal rate = 0.22 (unchanged from Section 1)
  // Section 2 (annual 4% withdrawals): Roth 29,471.77 (tax-free);
  //   Pre-tax 37,784.31 - 2,405.62 = 35,378.70  -> Pre-tax wins (6.4% effective < 22% marginal)
  const eff = 2405.6177 / 37784.3145;
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

  it('the rates (sideAwareRates.js): effective rate on the account withdrawal, tax saved now', () => {
    expect(r.sideAware.accountWithdrawal).toBeCloseTo(37784.31, 1);
    expect(r.sideAware.extraTaxFromAccount).toBeCloseTo(2405.62, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.06367, 4);
    expect(r.rates.taxSavedNow).toBeCloseTo(0.22, 10);
  });

  it('Sections 9-10: growth of the contribution and after-tax income', () => {
    expect(r.annuity.pretax.futureValue).toBeCloseTo(944607.86, 0);
    expect(r.annuity.roth.futureValue).toBeCloseTo(736794.13, 0);
    expect(r.lumpSum.roth.futureValue).toBeCloseTo(7800 * 7.612255, 0);
    expect(r.lumpSum.pretax.futureValueGross).toBeCloseTo(10000 * 7.612255, 0);
    expect(r.lumpSum.pretax.afterTaxValue).toBeCloseTo(10000 * 7.612255 * (1 - eff), 0);
    expect(r.annuity.roth.afterTaxWithdrawal).toBeCloseTo(29471.77, 1);
    expect(r.annuity.pretax.annualWithdrawal).toBeCloseTo(37784.31, 1);
    expect(r.annuity.pretax.afterTaxWithdrawal).toBeCloseTo(35378.7, 0);
  });

  it('Section 2 verdict: Pre-tax wins because the effective rate is below tax saved now', () => {
    expect(r.rates.effectiveRetirement).toBeLessThan(r.rates.taxSavedNow);
    expect(r.comparison.winner).toBe('pretax');
    expect(r.comparison.afterTaxIncomeDifference).toBeCloseTo(35378.7 - 29471.77, 0);
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

  it('Section 11: portfolio solver scales each scenario to hit the exact need (unaffected by the rates above — it solves independently)', () => {
    // HAND CALC (unchanged from before the rates migration): T = 50,265 / 0.78 = 64,442.31;
    // G = 80,192.31; tax = G - need = 9,091.31.
    expect(r.portfolio.roth.totalTaxPaid).toBe(0);
    expect(r.portfolio.roth.scaleFactor).toBeCloseTo(2.4125, 3);
    expect(r.portfolio.pretax.totalTaxPaid).toBeCloseTo(9091.31, 1);
    expect(r.portfolio.pretax.scaleFactor).toBeCloseTo(2.1224, 3);
    expect(r.portfolio.pretax.totalGrossWithdrawal).toBeCloseTo(80192.31, 1);
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
    // A $0 need doesn't mean $0 saved: the account itself still has its own natural withdrawal.
    expect(r.sideAware.accountWithdrawal).toBeGreaterThan(0);
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

  it('other pre-tax money is taxed ahead of this account and lifts its effective rate', () => {
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
    // Section 3 (the portfolio solve, unaffected by the rates migration — it independently
    // scales every bucket to hit the need exactly) needs less than a full 4% from every
    // bucket to reach it here, since the balances are generous relative to the need.
    expect(r.portfolio.pretax.scaleFactor).toBeLessThan(1);
  });

  it('when a withdrawal IS required, Section 3 lands exactly on the target', () => {
    const r = compareRothVsTraditional({
      ...baseInputs,
      grossIncome: 140000,
      knowsSocialSecurity: false,
      otherPretaxBalance: 20000,
      otherRothBalance: 10000,
    });
    expect(r.portfolio.pretax.totalGrossWithdrawal).toBeGreaterThan(0);
    expect(r.portfolio.pretax.achievedAfterTaxIncome).toBeCloseTo(r.retirementNeed.target, 2);
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
  // Rates (sideAwareRates.js): W = 37,784.31 (unchanged — growth doesn't depend on the tax year).
  //   2026 single brackets: 10% to $12,400, 12% to $50,400; standard deduction $16,100.
  //   taxable = 37,784.31 - 16,100 = 21,684.31
  //   tax = 1,240.00 (10% x 12,400) + 12% x (21,684.31 - 12,400 = 9,284.31 -> 1,114.12) = 2,354.12
  //   effective rate = 2,354.12 / 37,784.31 = 0.06230
  const r = compareRothVsTraditional({ ...baseInputs, year: 2026 });

  it('uses the 2026 data', () => {
    expect(r.dataYear).toBe(2026);
    expect(r.current.standardDeduction).toBe(16100);
    expect(r.current.tax).toBeCloseTo(10970, 6);
    expect(r.rates.marginalNow).toBe(0.22);
    expect(r.retirementNeed.target).toBeCloseTo(71380, 6);
  });

  it('the rates use the 2026 brackets and standard deduction', () => {
    expect(r.sideAware.accountWithdrawal).toBeCloseTo(37784.31, 1);
    expect(r.sideAware.extraTaxFromAccount).toBeCloseTo(2354.12, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.0623, 4);
  });

  it('contribution limit check uses the 2026 limit', () => {
    expect(r.limitCheck.limit).toBe(24500);
    expect(r.limitCheck.year).toBe(2026);
  });
});

describe('withoutSocialSecurity — the simple view (HAND CALC)', () => {
  // Single, 2025, $60,000 gross, saves $5,000 Pre-tax, ages 35 -> 65, 7%, no other accounts,
  // a KNOWN $24,000 Social Security benefit (nonzero, so the with/without comparison actually differs).
  //   taxable = 60,000 - 5,000 - 15,750 = 39,250; tax = 1,192.50 + 12% x 27,325 (3,279) = 4,471.50
  //   marginal 12% (before the deduction: 44,250 taxable)
  //   Annuity factor 94.46079: W (Pre-tax) = 5,000 x 94.46079 x 4% = 18,892.16; RW (Roth) = 4,400 x
  //   94.46079 x 4% = 16,625.10 (both are the account's own withdrawal, same either way).
  //
  // WITHOUT Social Security (sideAware with ssBenefit = 0; no Existing Accounts, no side account):
  //   taxable = 18,892.16 - 15,750 = 3,142.16 (all in the 10% bracket)
  //   tax = 10% x 3,142.16 = 314.22;  effective rate = 314.22 / 18,892.16 = 0.01663
  //
  // WITH the $24,000 benefit (the main comparison): combined income = W + 0.5 x 24,000 = 18,892.16 +
  //   12,000 = 30,892.16, between the single thresholds ($25,000 / $34,000) -> 50% tier:
  //   taxableSS = min(0.5 x (30,892.16 - 25,000) = 2,946.08, 0.5 x 24,000 = 12,000) = 2,946.08
  //   grossOrdinaryIncome = 18,892.16 + 2,946.08 = 21,838.24; taxable = 21,838.24 - 15,750 = 6,088.24
  //   tax = 10% x 6,088.24 = 608.82 (baseline, SS alone, is $0: combined = 0.5 x 24,000 = 12,000 <
  //   25,000 lower threshold, so 0 taxable SS and $0 tax)
  //   extra tax = 608.82; effective rate = 608.82 / 18,892.16 = 0.03223
  const inputs = { ...baseInputs, grossIncome: 60000, savings: 5000, socialSecurityBenefit: 24000 };
  const r = compareRothVsTraditional(inputs);
  const s = r.withoutSocialSecurity;

  it('Section 1 inputs for this case', () => {
    expect(r.current.tax).toBeCloseTo(4471.5, 6);
    expect(r.rates.marginalNow).toBe(0.12);
    expect(r.contribution.roth).toBeCloseTo(4400, 6);
  });

  it('the account withdrawal is identical with or without Social Security; the rate is not', () => {
    expect(s.sideAware.accountWithdrawal).toBeCloseTo(r.sideAware.accountWithdrawal, 6);
    expect(s.sideAware.accountWithdrawal).toBeCloseTo(18892.16, 1);
    expect(s.sideAware.extraTaxFromAccount).toBeCloseTo(314.22, 1);
    expect(s.sideAware.effectiveRate).toBeCloseTo(0.01663, 4);
    expect(r.sideAware.extraTaxFromAccount).toBeCloseTo(608.82, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.03223, 4);
    // Social Security's phase-in only ever ADDS tax, so the no-SS rate is always <= the with-SS one.
    expect(s.sideAware.effectiveRate).toBeLessThan(r.rates.effectiveRetirement);
  });

  it('Pre-tax wins both ways (both rates are well under the 12% marginal), by a wider margin without SS', () => {
    expect(s.comparison.winner).toBe('pretax');
    expect(r.comparison.winner).toBe('pretax');
    expect(s.comparison.afterTaxIncomeDifference).toBeGreaterThan(r.comparison.afterTaxIncomeDifference);
  });

  it('ignores whatever Social Security benefit is entered', () => {
    for (const ssBenefit of [0, 12000, 24000, 90000]) {
      const q = compareRothVsTraditional({ ...baseInputs, grossIncome: 60000, savings: 5000, socialSecurityBenefit: ssBenefit });
      expect(q.withoutSocialSecurity.sideAware.effectiveRate).toBeCloseTo(s.sideAware.effectiveRate, 10);
    }
    // ...while the with-Social-Security result does change with it
    const noSS = compareRothVsTraditional({ ...baseInputs, grossIncome: 60000, savings: 5000, socialSecurityBenefit: 0 });
    expect(noSS.rates.effectiveRetirement).toBeLessThan(r.rates.effectiveRetirement);
  });

  it('PROPERTY: the no-SS effective rate never exceeds the with-SS effective rate on the same account withdrawal', () => {
    // Removing Social Security can only remove its phase-in tax, never add tax, so this holds for
    // every scenario where there IS an account withdrawal to measure — no capital-gains-stacking or
    // "is this account needed" caveats required (those were artifacts of the old need-based gross-up).
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
              knowsSocialSecurity: true,
              socialSecurityBenefit: 20000,
            });
            const label = JSON.stringify({ filingStatus, grossIncome, savings, otherPretaxBalance });
            if (!q.sideAware.available) continue; // $0 saved: nothing to measure
            expect(q.withoutSocialSecurity.sideAware.effectiveRate, label).toBeLessThanOrEqual(
              q.rates.effectiveRetirement + 1e-9,
            );
          }
        }
      }
    }
  });

  it('big existing Pre-tax balances push the account withdrawal into a high bracket, favoring Roth (HAND CALC)', () => {
    // Single, 2025, $30,000 gross: taxable 14,250 -> marginal 12% now. $2,000 saved.
    // $1,500,000 of other Pre-tax money x 1.07^30 (7.612255) = 11,418,382.50; 4% = 456,735.30, taxed
    // FIRST (Step 1), so the $2,000 account's own withdrawal (4% of 2,000 x 94.46079 = 7,556.86) lands
    // entirely in the 35% bracket (456,735.30 - 15,750 = 440,985.30, already well past the $250,525
    // threshold, and +7,556.86 stays under the next one at $626,350).
    const q = compareRothVsTraditional({ ...baseInputs, grossIncome: 30000, savings: 2000, otherPretaxBalance: 1500000 });
    expect(q.rates.taxSavedNow).toBeCloseTo(0.12, 10);
    expect(q.withoutSocialSecurity.sideAware.effectiveRate).toBeCloseTo(0.35, 6);
    expect(q.withoutSocialSecurity.comparison.winner).toBe('roth');
  });

  it('income below the standard deduction is untaxed either way, so the two are "even"', () => {
    // W = 4% x 1,000 x 94.46079 = 3,778.43, below the $15,750 standard deduction on its own.
    const q = compareRothVsTraditional({ ...baseInputs, grossIncome: 14000, savings: 1000 });
    expect(q.withoutSocialSecurity.sideAware.effectiveRate).toBe(0);
    expect(q.withoutSocialSecurity.comparison.winner).toBe('even'); // 0% now, 0% later
  });

  it('is a plain object of numbers (no NaN) for awkward inputs', () => {
    for (const o of [
      { grossIncome: 10000 },
      { debtPayments: 90000 },
      { otherPretaxBalance: 5000000 },
      { filingStatus: 'mfj', grossIncome: 300000, savings: 23500 },
    ]) {
      const q = compareRothVsTraditional({ ...baseInputs, ...o }).withoutSocialSecurity;
      for (const v of [q.sideAware.effectiveRate, q.annuity.pretax.afterTaxWithdrawal, q.annuity.roth.afterTaxWithdrawal]) {
        expect(Number.isFinite(v), JSON.stringify(o)).toBe(true);
      }
    }
    // $0 saved: nothing to measure, but still no NaN/Infinity anywhere.
    const zero = compareRothVsTraditional({ ...baseInputs, savings: 0 }).withoutSocialSecurity;
    expect(zero.sideAware.available).toBe(false);
    expect(Number.isFinite(zero.annuity.pretax.afterTaxWithdrawal)).toBe(true);
    expect(Number.isFinite(zero.annuity.roth.afterTaxWithdrawal)).toBe(true);
  });
});

describe('retirement lifestyle factor (HAND CALC)', () => {
  // Single, 2025, $100,000 gross, $10,000 Pre-tax savings: need 71,101 at the same lifestyle (see above).
  //
  // Under the sideAware model, the account's own natural 4% withdrawal W (and so
  // rates.effectiveRetirement/taxSavedNow and comparison.winner) does NOT depend on the retirement
  // need at all — W = 4% x the annuity's future value, which is a function only of the contribution
  // and growth, never of lifestyle. Lifestyle still scales retirementNeed.target, and Section 3's
  // portfolio solver still scales its withdrawals to hit that target (portfolioTax.js is untouched
  // by this migration) — but the Section 2 rate comparison no longer moves with it. This is a real
  // behavior change from the old need-based gross-up model (documented in CLAUDE.md).
  it('a 25% higher retirement lifestyle scales the need to 88,876.25, but not the account rate', () => {
    const r = compareRothVsTraditional({ ...baseInputs, retirementLifestyle: 1.25 });
    expect(r.retirementNeed.beforeLifestyleAdjustment).toBeCloseTo(71101, 6);
    expect(r.retirementNeed.lifestyleFactor).toBe(1.25);
    expect(r.retirementNeed.target).toBeCloseTo(88876.25, 6);
    // same W and rate as lifestyle = 1 (see the end-to-end HAND CALC above: W = 37,784.31, eff = 0.06367)
    expect(r.sideAware.accountWithdrawal).toBeCloseTo(37784.31, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.06367, 4);
    // Section 3's portfolio solver is unaffected: it still hits the higher target exactly
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

  it('PROPERTY: lifestyle changes the need and the Section 3 portfolio solve, never the account rate or the verdict', () => {
    // Single, 2025, $60,000 gross, $5,000 saved Pre-tax: W = 18,892.16, eff = 0.01663, winner = pretax
    // (marginal now 12% > eff 1.66%), unchanged at any lifestyle — even one big enough that the OLD
    // need-based model would have pushed the bracket above 12% and flipped the verdict to Roth.
    for (const retirementLifestyle of [0.8, 1, 1.25, 2, 3]) {
      const r = compareRothVsTraditional({ ...baseInputs, grossIncome: 60000, savings: 5000, retirementLifestyle });
      expect(r.sideAware.accountWithdrawal, retirementLifestyle).toBeCloseTo(18892.16, 1);
      expect(r.rates.effectiveRetirement, retirementLifestyle).toBeCloseTo(0.01663, 4);
      expect(r.comparison.winner, retirementLifestyle).toBe('pretax');
      // ...only the need itself moves
      expect(r.retirementNeed.target, retirementLifestyle).toBeCloseTo(45938.5 * retirementLifestyle, 6);
    }
  });
});

describe('overall effective rate in retirement', () => {
  // retirementOverall.grossIncome/totalTax are the same totals sideAwareRates measures its
  // effectiveRate against (the "preTaxWorld" stack: Social Security + Existing Accounts + this
  // account's own withdrawal), so overallEffectiveRetirement is total tax / that total gross income.
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
      r.sideAware.accountWithdrawal;
    expect(r.retirementOverall.grossIncome).toBeCloseTo(gross, 6);
    expect(r.retirementOverall.totalTax).toBeCloseTo(r.sideAware.stacks.preTaxWorld.totalTax, 6);
    expect(r.rates.overallEffectiveRetirement).toBeCloseTo(r.sideAware.stacks.preTaxWorld.totalTax / gross, 10);
  });

  it('with a single pre-tax source it equals the effective rate on the withdrawal (HAND CALC)', () => {
    // no Social Security, no other accounts: total gross = W = 37,784.31, total tax = 2,405.62
    // (see the end-to-end HAND CALC above); overall = 2,405.62 / 37,784.31 = 0.06367 = the same
    // fraction sideAwareRates already computed, since there is only one income source to blend.
    const r = compareRothVsTraditional(baseInputs);
    expect(r.rates.overallEffectiveRetirement).toBeCloseTo(0.06367, 4);
    expect(r.rates.overallEffectiveRetirement).toBeCloseTo(r.rates.effectiveRetirement, 10);
  });

  it('is lower than the rate on the withdrawals when Social Security and Roth money share the income (HAND CALC)', () => {
    // Social Security 30,000 (known) and 4% of a 50,000 Roth balance grown 30y (15,224.51) are mostly
    // untaxed and join W = 37,784.31 in the gross total (83,008.82), while sideAwareRates.effectiveRate
    // only measures the extra tax caused by W on top of them (4,861.62 / 83,008.82 = 0.05857 overall,
    // vs 0.12867 on W alone).
    const r = compareRothVsTraditional({
      ...baseInputs,
      knowsSocialSecurity: true,
      socialSecurityBenefit: 30000,
      otherRothBalance: 50000,
    });
    expect(r.sideAware.accountWithdrawal).toBeGreaterThan(0);
    expect(r.rates.overallEffectiveRetirement).toBeCloseTo(0.05857, 4);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.12867, 4);
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

  // Both scenarios cost the SAME take-home pay, C (see splitAtTakeHome in compare.js):
  //   currently Roth:    C = savings
  //   currently Pre-tax: C = (part under the limit) x (1 - t) + (part over the limit, never deducted)
  // Roth puts min(C, limit) in the account; Pre-tax puts min(C / (1 - t), limit), which costs
  // that x (1 - t). Whatever take-home is left goes to a taxable account (the "taxable side").
  // Annuity factor (1.07^30 - 1)/0.07 = 94.4607862; lump-sum factor 1.07^30 = 7.6122550.

  it('currently Pre-tax, savings $30,000: both scenarios spill over, Roth by only $860 (HAND CALC)', () => {
    // C = 23,500 x 0.76 + 6,500 = 17,860 + 6,500 = 24,360 of take-home.
    // Pre-tax: 23,500 to the account (costs 17,860), 24,360 - 17,860 = 6,500 to taxable.
    // Roth: 24,360 > 23,500, so 23,500 to the account and 860 to taxable.
    // (The $6,500 over the limit was never deducted, so it is after-tax money in both.)
    const r = compareRothVsTraditional({ ...base, savings: 30000, currentType: 'pretax' });
    expect(r.rates.marginalNow).toBe(0.24);
    expect(r.contributionSplit.takeHomeCost).toBeCloseTo(24360, 6);
    expect(r.contribution.pretax).toBeCloseTo(30000, 6); // 23,500 + 6,500
    expect(r.contribution.roth).toBeCloseTo(24360, 6); // 23,500 + 860

    expect(r.contributionSplit.pretax.toAccount).toBe(23500);
    expect(r.contributionSplit.pretax.excessToTaxable).toBeCloseTo(6500, 6);
    expect(r.contributionSplit.roth.toAccount).toBe(23500);
    expect(r.contributionSplit.roth.excessToTaxable).toBeCloseTo(860, 6);

    // accounts: 23,500 x 94.4607862 = 2,219,828.48 on both sides
    expect(r.annuity.pretax.futureValue).toBeCloseTo(2219828.48, 1);
    expect(r.annuity.roth.futureValue).toBeCloseTo(2219828.48, 1);
    // taxable sides: 6,500 x 94.4607862 = 613,995.11; 860 x 94.4607862 = 81,236.28
    expect(r.portfolio.pretax.buckets.taxable).toBeCloseTo(613995.11, 1);
    expect(r.portfolio.roth.buckets.taxable).toBeCloseTo(81236.28, 1);
    expect(r.annuity.pretax.side.futureValue).toBeCloseTo(613995.11, 1);
    expect(r.annuity.roth.side.futureValue).toBeCloseTo(81236.28, 1);

    // The limit-check warning names the exact excess and explains where it goes.
    expect(r.limitCheck.overLimit).toBe(true);
    expect(r.limitCheck.message).toContain('extra $6,500/year');
    expect(r.limitCheck.message).toContain('taxable investment account');
  });

  it('currently Roth AT the limit ($23,500): Pre-tax invests its tax savings, $5,640, in a taxable account (HAND CALC)', () => {
    // C = 23,500. Roth: all 23,500 fits, nothing to taxable.
    // Pre-tax: 23,500 / 0.76 = 30,921.05 won't fit; 23,500 goes in (costs 17,860) and the
    //   tax it saves, 23,500 x 0.24 = 5,640, goes to taxable. (Old model: 30,921.05 - 23,500 = 7,421.05,
    //   i.e. it invested Pre-tax-sized dollars the saver never had.)
    // Pre-tax account: FV 2,219,828.48, 4% = 88,793.14 (ordinary income).
    // Taxable side: FV 5,640 x 94.4607862 = 532,758.83; 4% = 21,310.35.
    //   Cost basis = every dollar contributed: 5,640 x 30 = 169,200, so the withdrawal is
    //   169,200 / 532,758.83 basis -> basis part = 4% x 169,200 = 6,768; gain = 14,542.35.
    //
    // The reported side.taxRate now measures the side account ALONE, stacked on Existing Accounts
    // (here $0) but NOT the account's own withdrawal (sideAwareRates.js stacks the side account
    // BEFORE the account, see its "preTaxWorldBeforeAccount" stack) — so it no longer includes the
    // push from the account's own ordinary income. Here Existing = $0, so ordinary taxable income
    // ahead of the gain is $0: the whole $15,750 standard deduction is unused and shelters gains too
    // (capitalGainsTax.js), and 14,542.35 < 15,750, so the gain is entirely in the 0% bracket -> $0 tax.
    // One year's side contribution: 5,640 x 7.6122550 = 42,933.12, also untaxed (same 0% shelter).
    const r = compareRothVsTraditional({ ...base, savings: 23500, currentType: 'roth' });
    expect(r.contributionSplit.roth.toAccount).toBe(23500);
    expect(r.contributionSplit.roth.excessToTaxable).toBe(0);
    expect(r.contributionSplit.pretax.toAccount).toBe(23500);
    expect(r.contributionSplit.pretax.excessToTaxable).toBeCloseTo(5640, 6);
    expect(r.contribution.pretax).toBeCloseTo(29140, 6);

    const side = r.annuity.pretax.side;
    expect(side.futureValue).toBeCloseTo(532758.83, 1);
    expect(side.annualWithdrawal).toBeCloseTo(21310.35, 1);
    expect(side.gains).toBeCloseTo(14542.35, 1);
    expect(side.taxRate).toBe(0);
    expect(side.afterTaxWithdrawal).toBeCloseTo(21310.35, 1);
    expect(r.annuity.roth.side.futureValue).toBe(0);

    // Totals for Future Contributions = the account + its taxable side.
    expect(r.annuity.pretax.totalFutureValue).toBeCloseTo(2219828.48 + 532758.83, 1);
    expect(r.annuity.pretax.totalAfterTaxIncome).toBeCloseTo(r.annuity.pretax.afterTaxWithdrawal + 21310.35, 1);
    expect(r.annuity.roth.totalAfterTaxIncome).toBeCloseTo(r.annuity.roth.afterTaxWithdrawal, 6);
    expect(r.lumpSum.pretax.side.futureValue).toBeCloseTo(42933.12, 1);
    expect(r.lumpSum.pretax.side.afterTaxValue).toBeCloseTo(42933.12, 1);
    expect(r.lumpSum.pretax.totalAfterTaxValue).toBeCloseTo(r.lumpSum.pretax.afterTaxValue + 42933.12, 1);

    // The verdict uses the totals.
    const { roth, pretax } = r.annuity;
    expect(r.comparison.afterTaxIncomeDifference).toBeCloseTo(
      Math.abs(roth.totalAfterTaxIncome - pretax.totalAfterTaxIncome),
      6,
    );
  });

  it('currently Roth, savings $40,000: both scenarios spill over; both sides are sheltered by the unused standard deduction (HAND CALC)', () => {
    // C = 40,000. Roth: 23,500 in, 16,500 to taxable.
    // Pre-tax: 23,500 in (costs 17,860), 40,000 - 17,860 = 22,140 to taxable (old model: 29,131.58).
    const r = compareRothVsTraditional({ ...base, savings: 40000, currentType: 'roth' });
    expect(r.contribution.roth).toBeCloseTo(40000, 6);
    expect(r.contribution.pretax).toBeCloseTo(45640, 6);
    expect(r.contributionSplit.roth.toAccount).toBe(23500);
    expect(r.contributionSplit.roth.excessToTaxable).toBeCloseTo(16500, 6);
    expect(r.contributionSplit.pretax.toAccount).toBe(23500);
    expect(r.contributionSplit.pretax.excessToTaxable).toBeCloseTo(22140, 6);

    expect(r.annuity.roth.futureValue).toBeCloseTo(2219828.48, 1);
    expect(r.annuity.pretax.futureValue).toBeCloseTo(2219828.48, 1);
    // taxable: 16,500 x 94.4607862 = 1,558,602.97; 22,140 x 94.4607862 = 2,091,361.81
    expect(r.portfolio.roth.buckets.taxable).toBeCloseTo(1558602.97, 1);
    expect(r.portfolio.pretax.buckets.taxable).toBeCloseTo(2091361.81, 1);

    // Roth side: 4% = 62,344.12; gain (FV 1,558,602.97 - basis 495,000) x 4% = 42,544.12. As
    //   before, both sides are now measured BEFORE the account's own withdrawal, so this is
    //   unchanged from the old model (the Roth account was never ordinary income anyway):
    //   stacked with $0 ahead of it, gain < the $15,750 unused-deduction shelter is impossible here
    //   (42,544.12 > 15,750), but the remaining 42,544.12 - 15,750 = 26,794.12 stays under the
    //   $48,350 top of the 0% LTCG bracket -> still 0% tax.
    expect(r.annuity.roth.side.annualWithdrawal).toBeCloseTo(62344.12, 1);
    expect(r.annuity.roth.side.taxRate).toBe(0);
    expect(r.annuity.roth.side.afterTaxWithdrawal).toBeCloseTo(62344.12, 1);
    // Pre-tax side: 4% = 83,654.47; gain (FV 2,091,361.81 - basis 664,200) x 4% = 57,086.47.
    //   Stacked BEFORE the account (not on top of its 88,793.14 of ordinary income, unlike the old
    //   model): 57,086.47 - 15,750 (unused deduction) = 41,336.47, still under the $48,350 0% top
    //   -> $0 tax, so the after-tax withdrawal equals the full 83,654.47.
    expect(r.annuity.pretax.side.annualWithdrawal).toBeCloseTo(83654.47, 1);
    expect(r.annuity.pretax.side.taxRate).toBe(0);
    expect(r.annuity.pretax.side.afterTaxWithdrawal).toBeCloseTo(83654.47, 1);
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

describe('the effective rate no longer depends on the retirement need at all', () => {
  // Single, 2025, $60,000 gross (12% marginal), SS $40,000 (known), $15,000 saved Pre-tax,
  // no other account balances. The OLD model measured the rate on a hypothetical "probe"
  // withdrawal that had to be sized carefully once other income already covered the need
  // (see the "effective-rate probe size" fix, 2026-09-23, in CLAUDE.md) — an entire class of
  // bug that no longer exists under sideAwareRates.js: the rate is ALWAYS measured on the
  // account's own actual 4% withdrawal, never a hypothetical stand-in, so it cannot move just
  // because the target need changes (only a change in other income or the account's own size can).
  const base = {
    ...baseInputs,
    grossIncome: 60000,
    savings: 15000,
    currentType: 'pretax',
    knowsSocialSecurity: true,
    socialSecurityBenefit: 40000,
    otherPretaxBalance: 0,
  };

  it('the rate is measured on the account\'s own withdrawal, whatever the target need is (HAND CALC)', () => {
    // P = $15,000 (currentType pretax). Annuity FV = 15,000 x 94.460786 = 1,416,911.79.
    // W (account's own 4% annual withdrawal) = 56,676.47.
    // combined income at W = 56,676.47 + 0.5 x 40,000 = 76,676.47, well past the $34,000
    //   85%-taxable threshold, so taxableSS caps at 0.85 x 40,000 = $34,000.
    // ordinary taxable income = 56,676.47 + 34,000 - 15,750 = 74,926.47
    // tax = 1,192.50 + 4,386 + 22% x (74,926.47 - 48,475 = 26,451.47) = 11,397.82
    // rate = 11,397.82 / 56,676.47 = 0.20110...
    const r = compareRothVsTraditional({ ...base, debtPayments: 0 });
    expect(r.sideAware.accountWithdrawal).toBeCloseTo(56676.47, 1);
    expect(r.annuity.pretax.annualWithdrawal).toBeCloseTo(56676.47, 1);
    expect(r.rates.effectiveRetirement).toBeCloseTo(0.201103, 4);
  });

  it('PROPERTY: the rate stays IDENTICAL as the target need changes (debt payments, expenses, lifestyle)', () => {
    const rates = [0, 5000, 10000, 15000].map((debtPayments) => {
      const r = compareRothVsTraditional({ ...base, debtPayments });
      return r.rates.effectiveRetirement;
    });
    for (const rate of rates) expect(rate).toBeCloseTo(rates[0], 10);
  });

  it('the same is true for "Retirement years without Social Security"', () => {
    const withoutSS = (debtPayments) =>
      compareRothVsTraditional({ ...base, debtPayments, otherPretaxBalance: 2000000 })
        .withoutSocialSecurity;
    const a = withoutSS(0);
    const b = withoutSS(5000);
    expect(a.sideAware.effectiveRate).toBeCloseTo(b.sideAware.effectiveRate, 10);
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
    // Single, 2025, $30,000 gross (marginal now 12%), $2,000 saved, $1,500,000 existing Pre-tax:
    // that balance's forced 4% withdrawal (~$456,735/yr) sets the account's bracket at 35% (see
    // "big existing Pre-tax balances..." above), well above the 12% marginal now -> Roth.
    expect(
      compareRothVsTraditional({ ...baseInputs, grossIncome: 30000, savings: 2000, otherPretaxBalance: 1500000 }).rates
        .lean,
    ).toBe('roth');
  });
});

describe('sideAware.stackDetails — the raw inputs behind each rate-walkthrough stack', () => {
  it('base case: no Existing Accounts, so every stack before the account withdrawal is empty', () => {
    const r = compareRothVsTraditional(baseInputs);
    expect(r.sideAware.stackDetails.existing.pretaxWithdrawal).toBe(0);
    expect(r.sideAware.stackDetails.existing.taxableWithdrawal).toBe(0);
    expect(r.sideAware.stackDetails.preTaxWorld.pretaxWithdrawal).toBeCloseTo(r.sideAware.accountWithdrawal, 6);
    expect(r.sideAware.stacks.existing.totalTax).toBe(0);
    expect(r.sideAware.extraTaxFromAccount).toBeCloseTo(2405.62, 1);
    expect(r.withoutSocialSecurity.sideAware.accountWithdrawal).toBeCloseTo(r.sideAware.accountWithdrawal, 6);
  });

  it('other Pre-tax balances show up in every stack ahead of the account withdrawal', () => {
    const r = compareRothVsTraditional({ ...baseInputs, otherPretaxBalance: 150000 });
    expect(r.sideAware.stackDetails.existing.pretaxWithdrawal).toBeCloseTo(r.otherWithdrawals.pretaxGross, 6);
    expect(r.sideAware.stackDetails.preTaxWorld.pretaxWithdrawal).toBeCloseTo(
      r.otherWithdrawals.pretaxGross + r.sideAware.accountWithdrawal,
      6,
    );
    expect(r.sideAware.stacks.existing.totalTax).toBeGreaterThan(0);
  });
});

describe('Existing Accounts: taxable cost basis', () => {
  // Single, 2025, 35 -> 65 at 7% (lump-sum factor 7.6122550). Existing taxable $100,000 at 50% basis,
  // nothing else existing, Social Security known at $40,000.
  const base = {
    ...baseInputs,
    otherPretaxBalance: 0,
    otherTaxableBalance: 100000,
    knowsSocialSecurity: true,
    socialSecurityBenefit: 40000,
  };

  it('50% basis: only the growth and the other half are taxed (HAND CALC)', () => {
    // FV = 100,000 x 7.6122550 = 761,225.50; basis stays 50,000.
    // 4% withdrawal = 30,449.02; basis part = 4% x 50,000 = 2,000; gain = 28,449.02.
    // Stack without Future Contributions (sideAware.stacks.existing = Social Security + Existing
    // Accounts only, the same "before the account" stack the rate walk-through's Step 1 shows):
    //   combined income = 28,449.02 + 20,000 = 48,449.02 (> 34,000)
    //   taxable SS = min(0.85 x 40,000, 0.85 x (48,449.02 - 34,000) + 4,500)
    //              = min(34,000, 12,281.67 + 4,500) = 16,781.67
    //   ordinary taxable = 16,781.67 - 15,750 = 1,031.67 -> tax 103.17
    //   gains stack on 1,031.67: 1,031.67 + 28,449.02 = 29,480.69 < 48,350 -> 0% -> total tax 103.17
    const r = compareRothVsTraditional({ ...base, otherTaxableBasis: 0.5 });
    expect(r.otherWithdrawals.taxableGross).toBeCloseTo(30449.02, 1);
    expect(r.otherWithdrawals.taxableGains).toBeCloseTo(28449.02, 1);
    expect(r.sideAware.stacks.existing.taxableSS).toBeCloseTo(16781.67, 1);
    expect(r.sideAware.stacks.existing.totalTax).toBeCloseTo(103.17, 1);
  });

  it('omitting the basis treats the whole withdrawal as gain (backward compatible)', () => {
    // gain = 30,449.02 -> combined 50,449.02 -> taxable SS = 0.85 x 16,449.02 + 4,500 = 18,481.67
    //   ordinary taxable = 2,731.67 -> tax 273.17; gains 2,731.67 + 30,449.02 < 48,350 -> 0%
    const r = compareRothVsTraditional(base);
    expect(r.otherWithdrawals.taxableGains).toBeCloseTo(30449.02, 1);
    expect(r.sideAware.stacks.existing.totalTax).toBeCloseTo(273.17, 1);
  });

  it('rejects a basis outside 0-100%', () => {
    expect(validateInputs({ ...base, otherTaxableBasis: 1.2 }).join(' ')).toMatch(/basis/i);
    expect(validateInputs({ ...base, otherTaxableBasis: 0.5 })).toEqual([]);
  });
});

describe('Net Investment Income Tax flows through the comparison', () => {
  // $300k single, $300k Pre-tax and $600k taxable today (50% basis), age 35 -> 65: MAGI in
  // retirement is well over $200,000, so taxable-account gains owe the 3.8% NIIT.
  const r = compareRothVsTraditional(
    toCompareInputs({ ...DEFAULT_FORM_VALUES, grossIncome: '300000', otherPretaxBalance: '300000', otherTaxableBalance: '600000' }, 2025),
  );

  it('the full tax breakdown (taxBreakdown.js) on the before/after stacks still adds up to extraTaxFromAccount, NIIT included', () => {
    // explainFullTax on sideAware.stackDetails' preTaxWorld (Existing + this account's withdrawal)
    // and preTaxWorldBeforeAccount (Existing only) decomposes each into ordinary tax, capital-gains
    // tax and NIIT; the DIFFERENCE in each piece must sum to exactly extraTaxFromAccount, the same
    // number effectiveRate is built from.
    const before = explainFullTax(r.sideAware.stackDetails.preTaxWorldBeforeAccount);
    const after = explainFullTax(r.sideAware.stackDetails.preTaxWorld);
    const extraNiit = after.niit - before.niit;
    const extraOrdinaryTax = after.ordinaryTax - before.ordinaryTax;
    const extraCapitalGainsTax = after.capitalGainsTax - before.capitalGainsTax;
    expect(extraNiit).toBeGreaterThan(0);
    expect(r.sideAware.extraTaxFromAccount).toBeCloseTo(extraOrdinaryTax + extraCapitalGainsTax + extraNiit, 6);
    expect(after.totalTax).toBeCloseTo(r.sideAware.stacks.preTaxWorld.totalTax, 6);
    expect(before.totalTax).toBeCloseTo(r.sideAware.stacks.preTaxWorldBeforeAccount.totalTax, 6);
  });

  it('both portfolio scenarios carry the NIIT in their total tax', () => {
    for (const k of ['roth', 'pretax']) {
      const p = r.portfolio[k];
      expect(p.niit).toBeGreaterThan(0);
      expect(p.totalTaxPaid).toBeCloseTo(p.ordinaryTax + p.capitalGainsTax + p.niit, 6);
    }
  });
});

describe('result.blend — the Roth/Pre-tax split explorer (blend.js), wired into compare.js', () => {
  it('is unavailable when nothing is saved', () => {
    const r = compareRothVsTraditional({ ...baseInputs, savings: 0 });
    expect(r.blend.available).toBe(false);
    expect(r.blend.points).toBeUndefined();
  });

  it('at r=0 and r=1, matches the pure Pre-tax/Roth scenarios exactly (HAND CALC anchor)', () => {
    // Same defaults as the end-to-end HAND CALC above: no SS, no Existing Accounts.
    // r=0 (all Pre-tax of the take-home budget) must reproduce annuity.pretax.totalAfterTaxIncome
    // exactly, and r=1 must reproduce annuity.roth.totalAfterTaxIncome exactly, since blend.js's
    // splitBlended(...,0)/(...,1) are proven (and tested in blend.test.js) to exactly reproduce
    // splitAtTakeHome's own two branches.
    const r = compareRothVsTraditional(baseInputs);
    expect(r.blend.available).toBe(true);
    expect(r.blend.points).toHaveLength(101);
    const pure0 = r.blend.points[0];
    const pure1 = r.blend.points[r.blend.points.length - 1];
    expect(pure0.rothShare).toBe(0);
    expect(pure1.rothShare).toBe(1);
    expect(pure0.totalAfterTaxIncome).toBeCloseTo(r.annuity.pretax.totalAfterTaxIncome, 1);
    expect(pure1.totalAfterTaxIncome).toBeCloseTo(r.annuity.roth.totalAfterTaxIncome, 1);
    // and the "best" point can only ever be at least as good as either pure strategy
    expect(r.blend.best.totalAfterTaxIncome).toBeGreaterThanOrEqual(pure0.totalAfterTaxIncome - 0.01);
    expect(r.blend.best.totalAfterTaxIncome).toBeGreaterThanOrEqual(pure1.totalAfterTaxIncome - 0.01);
    // in this low-withdrawal default case Pre-tax dominates outright, so the best IS the r=0 end
    expect(r.blend.best.rothShare).toBe(0);
  });

  it('finds a genuine interior optimum in the same scenario blend.test.js hand-verifies', () => {
    // $60,000 income, $10,000 saved, $20,000 known Social Security, no Existing Accounts.
    const r = compareRothVsTraditional({
      ...baseInputs,
      grossIncome: 60000,
      savings: 10000,
      knowsSocialSecurity: true,
      socialSecurityBenefit: 20000,
    });
    expect(r.blend.best.rothShare).toBeGreaterThan(0.3);
    expect(r.blend.best.rothShare).toBeLessThan(0.8);
    const pure0 = r.blend.points[0];
    const pure1 = r.blend.points[r.blend.points.length - 1];
    expect(r.blend.best.totalAfterTaxIncome).toBeGreaterThan(pure0.totalAfterTaxIncome + 1000);
    expect(r.blend.best.totalAfterTaxIncome).toBeGreaterThan(pure1.totalAfterTaxIncome + 1000);
  });

  it('uses the SAME take-home cost as the current savings/currentType, not a different budget', () => {
    const pretaxSaver = compareRothVsTraditional({ ...baseInputs, savings: 10000, currentType: 'pretax' });
    const rothSaver = compareRothVsTraditional({ ...baseInputs, savings: 7800, currentType: 'roth' });
    // both cost 7,800 in take-home pay (see "Pre-tax savings are deducted before income tax" above),
    // so their blend curves' pure endpoints must land on the same two numbers, just possibly reversed
    expect(pretaxSaver.blend.points[0].totalAfterTaxIncome).toBeCloseTo(
      rothSaver.blend.points[0].totalAfterTaxIncome,
      1,
    );
    expect(pretaxSaver.blend.points[100].totalAfterTaxIncome).toBeCloseTo(
      rothSaver.blend.points[100].totalAfterTaxIncome,
      1,
    );
  });
});
