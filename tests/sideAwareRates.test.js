import { describe, it, expect } from 'vitest';
import { calculateSideAwareRates } from '../src/lib/sideAwareRates.js';

// 2025 single: standard deduction $15,750; ordinary brackets 10% to $11,925, 12% to $48,475,
// 22% to $103,350; long-term capital gains 0% up to $48,350 of taxable income, then 15%.
const common = { filingStatus: 'single', year: 2025, ssBenefit: 0 };
const noOther = { pretaxGross: 0, taxableGross: 0, taxableGains: 0 };

describe('calculateSideAwareRates', () => {
  it('HAND CALC: nothing over the limit (no taxable account) reduces to marginal-now minus effective-later', () => {
    // The Pre-tax account withdraws W = 40,000; nothing else. The Roth account (same take-home cost at a
    // 22% marginal rate) withdraws RW = 40,000 x 0.78 = 31,200, tax-free.
    //   ordinary taxable income = 40,000 - 15,750 = 24,250
    //   tax = 10% x 11,925 + 12% x (24,250 - 11,925) = 1,192.50 + 1,479.00 = 2,671.50
    //   e = 2,671.50 / 40,000 = 0.0667875
    //   no taxable account: extra = 0, s = 0
    //   X = (40,000 - 31,200) / 40,000 = 0.22 (= the marginal rate)
    //   gap = 0.22 - 0.0667875 = 0.1532125;  dollars = 0.1532125 x 40,000 = 6,128.50
    //   (check: the 8,800 more the Pre-tax withdrawal delivers, less its 2,671.50 of tax)
    const r = calculateSideAwareRates({
      ...common,
      other: noOther,
      pretaxAccountWithdrawal: 40000,
      rothAccountWithdrawal: 31200,
    });
    expect(r.available).toBe(true);
    expect(r.effectiveRate).toBeCloseTo(0.0667875, 10);
    expect(r.extraSideRate).toBe(0);
    expect(r.taxSavedNow).toBeCloseTo(0.22, 10);
    expect(r.gap).toBeCloseTo(0.1532125, 10);
    expect(r.dollarDifference).toBeCloseTo(6128.5, 6);
  });

  it('HAND CALC: a taxable account in the stack raises the account rate, and the extra money has its own rate', () => {
    // Capped: both accounts withdraw W = RW = 80,000. The Pre-tax world's taxable account withdraws 100,000
    // (all gain); the Roth world's withdraws 60,000 (all gain), so the extra is 40,000.
    //
    // Pre-tax world (account + its taxable account):
    //   ordinary taxable income = 80,000 - 15,750 = 64,250
    //   ordinary tax = 1,192.50 + 12% x 36,550 (=4,386.00) + 22% x (64,250 - 48,475 = 15,775) (=3,470.50) = 9,049.00
    //   capital gains: 100,000 stacked on 64,250, already above the 0% band -> all at 15% = 15,000
    //   NIIT: MAGI = 80,000 + 100,000 = 180,000, under 200,000 -> 0
    //   total = 24,049
    // Pre-tax world without the account (gains alone): unused standard deduction 15,750 shelters gains,
    //   taxable gains = 84,250; 0% on the first 48,350, 15% on 35,900 = 5,385; MAGI 100,000 -> no NIIT; total = 5,385
    //   e = (24,049 - 5,385) / 80,000 = 18,664 / 80,000 = 0.2333
    // Roth world (its taxable account alone): gains 60,000 - 15,750 = 44,250, all inside the 0% band -> tax 0
    //   extra tax on the extra money = 5,385 - 0 = 5,385;  s = 5,385 / 40,000 = 0.134625
    // X = [(80,000 - 80,000) + 40,000 x (1 - 0.134625)] / 80,000 = 34,615 / 80,000 = 0.4326875
    // gap = 0.4326875 - 0.2333 = 0.1993875;  dollars = 0.1993875 x 80,000 = 15,951
    //   check by the identity W(1-e) + extra(1-s) - RW = 80,000 - 18,664 + 34,615 - 80,000 = 15,951
    const r = calculateSideAwareRates({
      ...common,
      other: noOther,
      pretaxAccountWithdrawal: 80000,
      rothAccountWithdrawal: 80000,
      pretaxSide: { withdrawal: 100000, gains: 100000 },
      rothSide: { withdrawal: 60000, gains: 60000 },
    });
    expect(r.stacks.preTaxWorld.totalTax).toBeCloseTo(24049, 6);
    expect(r.stacks.preTaxWorldBeforeAccount.totalTax).toBeCloseTo(5385, 6);
    expect(r.stacks.rothWorld.totalTax).toBeCloseTo(0, 6);
    expect(r.effectiveRate).toBeCloseTo(0.2333, 10);
    expect(r.extraSide.withdrawal).toBe(40000);
    expect(r.extraSideRate).toBeCloseTo(0.134625, 10);
    expect(r.taxSavedNow).toBeCloseTo(0.4326875, 10);
    expect(r.gap).toBeCloseTo(0.1993875, 10);
    expect(r.dollarDifference).toBeCloseTo(15951, 6);
  });

  it('the account rate in that case is HIGHER than it would be without the taxable account in the stack', () => {
    // Same 80,000 withdrawal alone: tax 9,049 / 80,000 = 0.1131125 vs 0.2333 with 100,000 of gains
    // sharing the stack (they lose the 0% bracket the withdrawal fills).
    const alone = calculateSideAwareRates({
      ...common,
      other: noOther,
      pretaxAccountWithdrawal: 80000,
      rothAccountWithdrawal: 80000,
    });
    expect(alone.effectiveRate).toBeCloseTo(9049 / 80000, 10);
    expect(0.2333).toBeGreaterThan(alone.effectiveRate);
  });

  it('is unavailable when there is no account withdrawal to measure', () => {
    const r = calculateSideAwareRates({
      ...common,
      other: noOther,
      pretaxAccountWithdrawal: 0,
      rothAccountWithdrawal: 0,
    });
    expect(r.available).toBe(false);
  });
});

// ---- wired into compare.js: result.sideAware ----
import { compareRothVsTraditional } from '../src/lib/compare.js';

const scenario = {
  filingStatus: 'single',
  selfEmploymentIncome: 0,
  currentAge: 35,
  retirementAge: 65,
  debtPayments: 0,
  otherExpenses: 0,
  currentType: 'pretax',
  accountType: '401k',
  knowsSocialSecurity: false,
  socialSecurityBenefit: 0,
  returnRate: 0.07,
  retirementLifestyle: 1,
  otherPretaxBalance: 0,
  otherRothBalance: 0,
  otherTaxableBalance: 0,
  otherTaxableBasis: 0.5,
  year: 2026,
};

describe('result.sideAware (in compare.js)', () => {
  it('with no taxable account, "tax saved now" is exactly the marginal rate while working', () => {
    // $100,000 saving $10,000 is far under the $24,500 limit, so nothing goes to a taxable account and
    // the Roth equivalent is 10,000 x (1 - 0.22): X = (W - RW) / W = 1 - 0.78 = 0.22 = the marginal rate.
    const r = compareRothVsTraditional({ ...scenario, grossIncome: 100000, savings: 10000 });
    expect(r.contributionSplit.pretax.excessToTaxable).toBe(0);
    expect(r.sideAware.available).toBe(true);
    expect(r.sideAware.extraSide.withdrawal).toBe(0);
    expect(r.sideAware.marginalNow).toBeCloseTo(0.22, 10);
    expect(r.sideAware.taxSavedNow).toBeCloseTo(0.22, 10);
  });

  it('REGRESSION ($500,000 income, $50,000 saved, 2026): the rates now agree with the exact dollar comparison', () => {
    // Checked by hand in conversation: the calculator's dollar total said Roth +0.4%, its rates said Pre-tax,
    // and the portfolio section said Pre-tax. Here: tax saved now after the tax on investing it = 29.5%,
    // effective rate on the account withdrawal with the taxable account in the stack = 23.6%, a 5.9-point gap
    // = $5,492 a year of after-tax income for Pre-tax, equal to the exact stack at a plain 4%.
    const r = compareRothVsTraditional({ ...scenario, grossIncome: 500000, savings: 50000 });
    const s = r.sideAware;
    expect(s.marginalNow).toBeCloseTo(0.35, 10);
    expect(s.taxSavedNow).toBeCloseTo(0.2949, 3);
    expect(s.effectiveRate).toBeCloseTo(0.2355, 3);
    expect(s.extraSideRate).toBeCloseTo(0.1575, 3);
    expect(s.lean).toBe('pretax');
    expect(s.dollarDifference).toBeCloseTo(5492, 0);
  });

  it('IDENTITY: the rates reproduce, to the cent, the exact after-tax income difference at a plain 4% (portfolioTax atBaseline)', () => {
    let checked = 0;
    for (const filingStatus of ['single', 'mfj']) {
      for (const currentType of ['pretax', 'roth']) {
        for (const grossIncome of [30000, 75000, 150000, 300000, 500000]) {
          for (const rate of [0.05, 0.1, 0.3]) {
            for (const otherPretaxBalance of [0, 1000000]) {
              for (const otherTaxableBalance of [0, 300000]) {
                const r = compareRothVsTraditional({
                  ...scenario,
                  filingStatus,
                  currentType,
                  grossIncome,
                  savings: Math.round(grossIncome * rate),
                  otherPretaxBalance,
                  otherTaxableBalance,
                });
                if (!r.sideAware.available) continue;
                const exact =
                  r.portfolio.pretax.atBaseline.afterTaxIncome - r.portfolio.roth.atBaseline.afterTaxIncome;
                expect(Math.abs(r.sideAware.dollarDifference - exact)).toBeLessThan(0.01);
                checked++;
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('is { available: false } when nothing is being saved', () => {
    const r = compareRothVsTraditional({ ...scenario, grossIncome: 100000, savings: 0 });
    expect(r.sideAware.available).toBe(false);
  });
});
