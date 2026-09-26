// Section 3 solver: tax on a WHOLE retirement portfolio (pre-tax + Roth + taxable
// buckets) needed to deliver a target after-tax income.
//
// Method:
//   1. Baseline withdrawal from each bucket = 4% of that bucket, independently
//      (equivalent to a proportional-to-balance split).
//   2. Binary-search ONE scale factor k, applied to all three withdrawals, until
//      total after-tax income matches the target:
//        pretax*k + roth*k + taxable*k + full SS benefit - total tax paid
//   3. At each step: taxable SS comes from the IRS combined-income formula using
//      (scaled pretax + scaled taxable withdrawal) as "other income"; ordinary
//      tax is applied to (scaled pretax + taxable SS - standard deduction); the
//      capital gains tax is the GAIN part of the scaled taxable withdrawal
//      (taxableGainShare; the rest is cost basis) run through the real
//      0%/15%/20% capital-gains brackets, stacked on top of ordinary income —
//      not a flat rate. (All in retirementTaxStack.js, shared with incomeNeed.js.)
//
// A scale factor above 1 means the 4% baseline is not enough to fund the target
// (k * 4% of the portfolio is being drawn per year); below 1 means it more than
// covers it.
//
// SIMPLIFICATION / FUTURE ENHANCEMENT: this assumes a proportional withdrawal
// strategy across all accounts, NOT tax-efficient sequencing (e.g. draining the
// taxable account first, filling low brackets with pre-tax money, or timing
// Roth draws). No RMD rules are modeled either.
import { calculateRetirementTax } from './retirementTaxStack.js';
import { solveMonotonicIncreasing } from './solver.js';
import { WITHDRAWAL_RATE } from './constants.js';

export function solvePortfolioWithdrawal(
  targetAfterTaxIncome,
  buckets,
  ssBenefit,
  filingStatus,
  year,
  // taxableGainShare: share of the taxable bucket that is gain (the rest is cost basis).
  { withdrawalRate = WITHDRAWAL_RATE, taxableGainShare = 1 } = {},
) {
  const balances = {
    pretax: Math.max(0, buckets.pretax || 0),
    roth: Math.max(0, buckets.roth || 0),
    taxable: Math.max(0, buckets.taxable || 0),
  };
  const baseline = {
    pretax: withdrawalRate * balances.pretax,
    roth: withdrawalRate * balances.roth,
    taxable: withdrawalRate * balances.taxable,
  };

  const scaled = (k) => ({
    pretax: baseline.pretax * k,
    roth: baseline.roth * k,
    taxable: baseline.taxable * k,
  });

  const evaluate = (k) => {
    const w = scaled(k);
    const tax = calculateRetirementTax({
      pretaxWithdrawal: w.pretax,
      taxableWithdrawal: w.taxable,
      taxableGainShare,
      ssBenefit,
      filingStatus,
      year,
    });
    return {
      withdrawals: w,
      tax,
      afterTaxIncome: w.pretax + w.roth + w.taxable + ssBenefit - tax.totalTax,
    };
  };

  const totalBalance = balances.pretax + balances.roth + balances.taxable;

  // With nothing to withdraw from, every k gives the same income, so there is
  // nothing to solve: report k = 0 and let `shortfall` describe the gap.
  const scaleFactor =
    totalBalance > 0
      ? solveMonotonicIncreasing((k) => evaluate(k).afterTaxIncome, targetAfterTaxIncome).x
      : 0;

  const result = evaluate(scaleFactor);
  const totalGrossWithdrawal =
    result.withdrawals.pretax + result.withdrawals.roth + result.withdrawals.taxable;
  const shortfall = Math.max(0, targetAfterTaxIncome - result.afterTaxIncome);
  // What the portfolio delivers after tax at a plain 4% from every bucket (k = 1),
  // whatever the target: compares what a bigger or smaller portfolio actually buys.
  const base = evaluate(1);

  return {
    withdrawals: result.withdrawals,
    totalTaxPaid: result.tax.totalTax,
    taxableSS: result.tax.taxableSS,
    scaleFactor,
    // extras used by the UI / tests
    baselineWithdrawals: baseline,
    ordinaryTaxableIncome: result.tax.ordinaryTaxableIncome,
    ordinaryTax: result.tax.ordinaryTax,
    capitalGainsTax: result.tax.capitalGainsTax,
    niit: result.tax.niit,
    taxableGains: result.tax.capitalGains,
    totalGrossWithdrawal,
    achievedAfterTaxIncome: result.afterTaxIncome,
    // true when the target is met (or exceeded, e.g. Social Security alone
    // already covers it and nothing needs to be withdrawn)
    targetMet: shortfall < 0.01,
    shortfall,
    impliedWithdrawalRate: totalBalance > 0 ? totalGrossWithdrawal / totalBalance : 0,
    atBaseline: {
      withdrawals: base.withdrawals,
      totalGrossWithdrawal: base.withdrawals.pretax + base.withdrawals.roth + base.withdrawals.taxable,
      totalTaxPaid: base.tax.totalTax,
      afterTaxIncome: base.afterTaxIncome,
    },
  };
}
