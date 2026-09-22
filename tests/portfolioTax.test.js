import { describe, it, expect } from 'vitest';
import { solvePortfolioWithdrawal } from '../src/lib/portfolioTax.js';

const Y = 2025;

// Hand-derived from the 2025 single brackets, $15,750 standard deduction, the
// real 0%/15%/20% capital-gains brackets stacked on top of ordinary income, a
// 4% baseline withdrawal, and the IRS SS formula.

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
    //   ordinary T = max(0, 20,000 k - 15,750); at these small k values this stays
    //     under $48,350, so ALL of the capital gain sits in the 0% bracket -> CG tax = 0.
    //   ordinary tax (10% bracket) = 0.10 (20,000 k - 15,750) = 2,000 k - 1,575
    //   net = 40,000 k - (2,000 k - 1,575) - 0 = 38,000 k + 1,575
    //   38,000 k + 1,575 = 40,000  ->  k = 38,425 / 38,000 = 1.011184
    //   withdrawals: 20,223.68 / 10,111.84 / 10,111.84
    //   ordinary taxable income = 20,223.68 - 15,750 = 4,473.68 -> tax = 447.37
    //   total taxable income = 30,000 k - 15,750 = 14,585.53, well under 48,350 -> CG tax = 0
    const r = solvePortfolioWithdrawal(
      40000,
      { pretax: 500000, roth: 250000, taxable: 250000 },
      0,
      'single',
      Y,
    );
    expect(r.scaleFactor).toBeCloseTo(1.011184, 5);
    expect(r.withdrawals.pretax).toBeCloseTo(20223.68, 1);
    expect(r.withdrawals.roth).toBeCloseTo(10111.84, 1);
    expect(r.withdrawals.taxable).toBeCloseTo(10111.84, 1);
    expect(r.ordinaryTax).toBeCloseTo(447.37, 1);
    expect(r.capitalGainsTax).toBe(0);
    expect(r.totalTaxPaid).toBeCloseTo(447.37, 1);
    expect(r.taxableSS).toBe(0);
    expect(r.totalGrossWithdrawal).toBeCloseTo(40447.37, 1);
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

  it('taxable-only portfolio, entirely inside the 0% capital-gains bracket: no tax at all (HAND CALC)', () => {
    // 1,000,000 taxable -> baseline 40,000. Ordinary income 0. Total taxable income at
    // k = 0.85 (withdrawal 34,000) is 34,000 - 15,750 = 18,250, well under the $48,350
    // 0% threshold, so the WHOLE withdrawal is tax-free -> net = 34,000 exactly -> k = 0.85.
    const r = solvePortfolioWithdrawal(34000, { pretax: 0, roth: 0, taxable: 1000000 }, 0, 'single', Y);
    expect(r.scaleFactor).toBeCloseTo(0.85, 6);
    expect(r.withdrawals.taxable).toBeCloseTo(34000, 1);
    expect(r.totalTaxPaid).toBe(0);
    expect(r.capitalGainsTax).toBe(0);
    expect(r.ordinaryTax).toBe(0);
  });

  it('a larger taxable-only withdrawal spans the 0% and 15% capital-gains brackets (HAND CALC)', () => {
    // Choose the target so total taxable income lands exactly $100,000 into the 15%
    // bracket: total taxable = 48,350 + 100,000 = 148,350 -> gross withdrawal
    // G = 148,350 + 15,750 = 164,100 -> k = 164,100 / 40,000 = 4.1025.
    // CG tax = 15% x 100,000 = 15,000 (the first 48,350 is tax-free).  net = 164,100 - 15,000 = 149,100.
    const r = solvePortfolioWithdrawal(149100, { pretax: 0, roth: 0, taxable: 1000000 }, 0, 'single', Y);
    expect(r.scaleFactor).toBeCloseTo(4.1025, 4);
    expect(r.withdrawals.taxable).toBeCloseTo(164100, 1);
    expect(r.capitalGainsTax).toBeCloseTo(15000, 1);
    expect(r.totalTaxPaid).toBeCloseTo(15000, 1);
    expect(r.ordinaryTax).toBe(0);
    expect(r.achievedAfterTaxIncome).toBeCloseTo(149100, 2);
  });

  it('taxable withdrawals count as "other income" for SS taxability (HAND CALC)', () => {
    // 1,000,000 taxable (baseline 40,000), SS 20,000. At k = 1:
    //   combined = 40,000 + 10,000 = 50,000 -> taxable SS = min(17,000, 4,500 + 0.85 x 16,000) = 17,000
    //   ordinary T = 17,000 - 15,750 = 1,250 -> ordinary tax 125
    //   capital gains: grossOrdinaryIncome = 0 + 17,000 (taxable SS) = 17,000; total taxable
    //     income = 17,000 + 40,000 - 15,750 = 41,250, under the $48,350 0% threshold the
    //     whole way -> CG tax = $0 (not a flat 15%).
    //   net = 40,000 + 20,000 - 0 - 125 = 59,875  -> target 59,875 gives k = 1
    const r = solvePortfolioWithdrawal(59875, { pretax: 0, roth: 0, taxable: 1000000 }, 20000, 'single', Y);
    expect(r.scaleFactor).toBeCloseTo(1, 6);
    expect(r.taxableSS).toBeCloseTo(17000, 4);
    expect(r.ordinaryTax).toBeCloseTo(125, 4);
    expect(r.capitalGainsTax).toBe(0);
    expect(r.totalTaxPaid).toBeCloseTo(125, 4);
  });

  it('SS plus a taxable withdrawal large enough to cross into the 15% capital-gains bracket (HAND CALC)', () => {
    // Same buckets and SS, but a bigger taxable balance so the gains push past $48,350.
    // At k = 3.6775, taxable withdrawal = 147,100. Combined income is well past the
    // 85%-taxable threshold, so taxableSS caps at 17,000 regardless of k, and ordinary
    // tax stays 125 (as in the previous test) for any k in this range.
    //   ordinaryTaxableIncome = 1,250 (as above); total taxable income =
    //     17,000 (grossOrdinaryIncome) + 147,100 (gain) - 15,750 (deduction) = 148,350.
    //   gains stack from 1,250 to 148,350: 0% x (48,350 - 1,250 = 47,100)
    //     + 15% x (148,350 - 48,350 = 100,000) = 15,000
    //   total tax = 125 (ordinary) + 15,000 (CG) = 15,125
    //   net = 147,100 + 20,000 - 15,125 = 151,975
    const r = solvePortfolioWithdrawal(151975, { pretax: 0, roth: 0, taxable: 1000000 }, 20000, 'single', Y);
    expect(r.scaleFactor).toBeCloseTo(3.6775, 3);
    expect(r.withdrawals.taxable).toBeCloseTo(147100, 1);
    expect(r.taxableSS).toBeCloseTo(17000, 4);
    expect(r.ordinaryTax).toBeCloseTo(125, 1);
    expect(r.capitalGainsTax).toBeCloseTo(15000, 1);
    expect(r.totalTaxPaid).toBeCloseTo(15125, 1);
    expect(r.achievedAfterTaxIncome).toBeCloseTo(151975, 1);
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
