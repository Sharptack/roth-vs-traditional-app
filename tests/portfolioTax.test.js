import { describe, it, expect } from 'vitest';
import { solvePortfolioWithdrawal } from '../src/lib/portfolioTax.js';

const Y = 2025;

// Hand-derived from the 2025 single brackets, $15,750 standard deduction, flat
// 15% LTCG rate, 4% baseline withdrawal, and the IRS SS formula.

describe('solvePortfolioWithdrawal — baseline', () => {
  it('starts each bucket at 4% of its own balance', () => {
    const r = solvePortfolioWithdrawal(
      40000,
      { pretax: 500000, roth: 250000, taxable: 250000 },
      0,
      'single',
      Y,
    );
    expect(r.baselineWithdrawals.pretax).toBeCloseTo(20000, 6);
    expect(r.baselineWithdrawals.roth).toBeCloseTo(10000, 6);
    expect(r.baselineWithdrawals.taxable).toBeCloseTo(10000, 6);
  });

  it('applies ONE scale factor to all three buckets (proportional split)', () => {
    const r = solvePortfolioWithdrawal(
      55000,
      { pretax: 500000, roth: 250000, taxable: 250000 },
      12000,
      'single',
      Y,
    );
    expect(r.withdrawals.pretax).toBeCloseTo(r.baselineWithdrawals.pretax * r.scaleFactor, 6);
    expect(r.withdrawals.roth).toBeCloseTo(r.baselineWithdrawals.roth * r.scaleFactor, 6);
    expect(r.withdrawals.taxable).toBeCloseTo(r.baselineWithdrawals.taxable * r.scaleFactor, 6);
  });
});

describe('solvePortfolioWithdrawal — hand-verified scenarios', () => {
  it('mixed portfolio, no SS, target $40,000 (HAND CALC)', () => {
    // buckets 500k / 250k / 250k -> baseline W = 20,000 / 10,000 / 10,000; scale k
    //   pre-tax = 20,000 k, Roth = 10,000 k, taxable = 10,000 k. No SS.
    //   ordinary T = 20,000 k - 15,750 (10% bracket while T < 11,925, i.e. k < 1.384)
    //   ordinary tax = 0.10 (20,000 k - 15,750) = 2,000 k - 1,575
    //   capital gains tax = 0.15 x 10,000 k = 1,500 k
    //   net = 40,000 k - (2,000 k - 1,575) - 1,500 k = 36,500 k + 1,575
    //   36,500 k + 1,575 = 40,000  ->  k = 38,425 / 36,500 = 1.052740
    //   withdrawals: 21,054.79 / 10,527.40 / 10,527.40
    //   tax: 0.10 x (21,054.79 - 15,750 = 5,304.79) = 530.48; CG 0.15 x 10,527.40 = 1,579.11
    //   total = 2,109.59
    const r = solvePortfolioWithdrawal(
      40000,
      { pretax: 500000, roth: 250000, taxable: 250000 },
      0,
      'single',
      Y,
    );
    expect(r.scaleFactor).toBeCloseTo(1.05274, 5);
    expect(r.withdrawals.pretax).toBeCloseTo(21054.79, 1);
    expect(r.withdrawals.roth).toBeCloseTo(10527.4, 1);
    expect(r.withdrawals.taxable).toBeCloseTo(10527.4, 1);
    expect(r.ordinaryTax).toBeCloseTo(530.48, 1);
    expect(r.capitalGainsTax).toBeCloseTo(1579.11, 1);
    expect(r.totalTaxPaid).toBeCloseTo(2109.59, 1);
    expect(r.taxableSS).toBe(0);
    expect(r.totalGrossWithdrawal).toBeCloseTo(42109.59, 1);
    expect(r.achievedAfterTaxIncome).toBeCloseTo(40000, 2);
    expect(r.targetMet).toBe(true);
  });

  it('all-Roth portfolio pays no tax at all (HAND CALC)', () => {
    // Roth 500k -> baseline 20,000 = target -> k = 1, tax 0
    const r = solvePortfolioWithdrawal(20000, { pretax: 0, roth: 500000, taxable: 0 }, 0, 'single', Y);
    expect(r.scaleFactor).toBeCloseTo(1, 8);
    expect(r.totalTaxPaid).toBe(0);
  });

  it('all-Roth portfolio does not reduce taxable SS or add tax even with a large SS benefit (HAND CALC)', () => {
    // Roth withdrawals are not "other income": combined = 0.5 x 20,000 = 10,000 -> 0 taxable.
    const r = solvePortfolioWithdrawal(50000, { pretax: 0, roth: 600000, taxable: 0 }, 20000, 'single', Y);
    expect(r.taxableSS).toBe(0);
    expect(r.totalTaxPaid).toBe(0);
    // needs 30,000 from Roth: baseline 24,000 -> k = 1.25
    expect(r.scaleFactor).toBeCloseTo(1.25, 8);
  });

  it('taxable-only portfolio: pays only the flat capital gains rate (HAND CALC)', () => {
    // 1,000,000 taxable -> baseline 40,000. Ordinary income 0. Net = 0.85 x 40,000 k.
    // target 34,000 -> k = 1; tax = 15% x 40,000 = 6,000.
    const r = solvePortfolioWithdrawal(34000, { pretax: 0, roth: 0, taxable: 1000000 }, 0, 'single', Y);
    expect(r.scaleFactor).toBeCloseTo(1, 8);
    expect(r.totalTaxPaid).toBeCloseTo(6000, 4);
    expect(r.ordinaryTax).toBe(0);
  });

  it('taxable withdrawals count as "other income" for SS taxability (HAND CALC)', () => {
    // 1,000,000 taxable (baseline 40,000), SS 20,000. At k = 1:
    //   combined = 40,000 + 10,000 = 50,000 -> taxable SS = min(17,000, 4,500 + 0.85 x 16,000) = 17,000
    //   ordinary T = 17,000 - 15,750 = 1,250 -> tax 125;  CG = 0.15 x 40,000 = 6,000
    //   net = 40,000 + 20,000 - 6,125 = 53,875  -> target 53,875 gives k = 1
    const r = solvePortfolioWithdrawal(53875, { pretax: 0, roth: 0, taxable: 1000000 }, 20000, 'single', Y);
    expect(r.scaleFactor).toBeCloseTo(1, 6);
    expect(r.taxableSS).toBeCloseTo(17000, 4);
    expect(r.ordinaryTax).toBeCloseTo(125, 4);
    expect(r.capitalGainsTax).toBeCloseTo(6000, 4);
    expect(r.totalTaxPaid).toBeCloseTo(6125, 4);
  });
});

describe('solvePortfolioWithdrawal — SS interaction, cross-checked against the gross-up hand calcs', () => {
  // With ONLY a pre-tax bucket, scaling the 4% baseline is the same problem as
  // the single-account gross-up in incomeNeed.test.js, so the same hand-derived
  // withdrawals must appear: pre-tax bucket 500k -> baseline 20,000.
  const buckets = { pretax: 500000, roth: 0, taxable: 0 };

  it('SS $20,000, target $40,000: G = 20,794.12, so k = 1.039706', () => {
    // (see incomeNeed.test.js: 50% phase-in tier, tax 794.12, taxable SS 2,897.06)
    const r = solvePortfolioWithdrawal(40000, buckets, 20000, 'single', Y);
    expect(r.withdrawals.pretax).toBeCloseTo(20794.12, 1);
    expect(r.scaleFactor).toBeCloseTo(1.039706, 5);
    expect(r.taxableSS).toBeCloseTo(2897.06, 1);
    expect(r.totalTaxPaid).toBeCloseTo(794.12, 1);
  });

  it('SS $20,000, target $55,000: G = 39,672.16, so k = 1.983608 (85% of SS taxable)', () => {
    const r = solvePortfolioWithdrawal(55000, buckets, 20000, 'single', Y);
    expect(r.withdrawals.pretax).toBeCloseTo(39672.16, 1);
    expect(r.scaleFactor).toBeCloseTo(1.983608, 5);
    expect(r.taxableSS).toBeCloseTo(17000, 4);
    expect(r.totalTaxPaid).toBeCloseTo(4672.16, 1);
  });
});

describe('solvePortfolioWithdrawal — edge cases', () => {
  it('when SS alone covers the target, nothing is withdrawn (k = 0)', () => {
    // SS 30,000 (combined 15,000 < 25,000, untaxed) vs target 20,000
    const r = solvePortfolioWithdrawal(20000, { pretax: 500000, roth: 0, taxable: 0 }, 30000, 'single', Y);
    expect(r.scaleFactor).toBe(0);
    expect(r.totalGrossWithdrawal).toBe(0);
    expect(r.totalTaxPaid).toBe(0);
    expect(r.achievedAfterTaxIncome).toBe(30000);
    expect(r.targetMet).toBe(true);
  });

  it('with empty balances, reports a shortfall instead of a nonsense scale factor', () => {
    const r = solvePortfolioWithdrawal(20000, { pretax: 0, roth: 0, taxable: 0 }, 10000, 'single', Y);
    expect(r.scaleFactor).toBe(0);
    expect(r.targetMet).toBe(false);
    expect(r.shortfall).toBeCloseTo(10000, 6);
  });

  it('a scale factor above 1 means the 4% baseline is not enough; the implied rate shows it', () => {
    const r = solvePortfolioWithdrawal(40000, { pretax: 0, roth: 500000, taxable: 0 }, 0, 'single', Y);
    // 40,000 / 500,000 = 8% -> k = 2
    expect(r.scaleFactor).toBeCloseTo(2, 8);
    expect(r.impliedWithdrawalRate).toBeCloseTo(0.08, 8);
  });

  it('works for married filing jointly (HAND CALC)', () => {
    // MFJ, pretax 1,000,000 -> baseline 40,000, no SS, deduction 31,500.
    //   T = 40,000 k - 31,500; 10% bracket to 23,850 (k up to 1.384).
    //   net = 40,000 k - 0.10 (40,000 k - 31,500) = 36,000 k + 3,150. Target 43,000 ->
    //   k = 39,850 / 36,000 = 1.106944; tax = 0.10 x (44,277.78 - 31,500) = 1,277.78
    const r = solvePortfolioWithdrawal(43000, { pretax: 1000000, roth: 0, taxable: 0 }, 0, 'mfj', Y);
    expect(r.scaleFactor).toBeCloseTo(1.106944, 5);
    expect(r.totalTaxPaid).toBeCloseTo(1277.78, 1);
  });
});

describe('solvePortfolioWithdrawal — solver properties', () => {
  it('achieved after-tax income matches the target for many combinations', () => {
    const buckets = { pretax: 800000, roth: 300000, taxable: 200000 };
    for (const status of ['single', 'mfj']) {
      for (const ss of [0, 15000, 40000]) {
        for (const target of [30000, 60000, 90000, 150000]) {
          const r = solvePortfolioWithdrawal(target, buckets, ss, status, Y);
          if (r.scaleFactor > 0) expect(r.achievedAfterTaxIncome).toBeCloseTo(target, 2);
          else expect(r.achievedAfterTaxIncome).toBeGreaterThanOrEqual(target - 0.01);
        }
      }
    }
  });

  it('the scale factor rises with the target', () => {
    const buckets = { pretax: 800000, roth: 300000, taxable: 200000 };
    let previous = -1;
    for (let target = 40000; target <= 200000; target += 20000) {
      const k = solvePortfolioWithdrawal(target, buckets, 25000, 'single', Y).scaleFactor;
      expect(k).toBeGreaterThan(previous);
      previous = k;
    }
  });

  it('a more Roth-heavy portfolio pays less tax for the same income', () => {
    const preTaxHeavy = solvePortfolioWithdrawal(80000, { pretax: 1000000, roth: 0, taxable: 0 }, 25000, 'single', Y);
    const rothHeavy = solvePortfolioWithdrawal(80000, { pretax: 0, roth: 1000000, taxable: 0 }, 25000, 'single', Y);
    expect(rothHeavy.totalTaxPaid).toBeLessThan(preTaxHeavy.totalTaxPaid);
  });
});
