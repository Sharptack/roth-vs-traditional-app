// Reverse "gross-up" (Section 2 solver): given a target AFTER-TAX retirement
// income, find the gross withdrawal needed from ONE account (the one being
// modeled), stacked on top of other income sources.
//
// Because taxable Social Security depends on the withdrawal itself (a bigger
// withdrawal pulls more benefits into taxable income), there is no clean
// closed-form answer, so we binary-search. After-tax income is monotonic
// increasing in the withdrawal (see solver.js).
//
//   total after-tax income(G) =
//       ssBenefit                      (the FULL benefit is received; only the
//                                       taxable part enters the tax calc)
//     + otherPretaxWithdrawal + otherRothWithdrawal + otherTaxableWithdrawal
//     + G
//     - total tax paid on the whole stack
//
// `retirementEffectiveTaxRate` is the blended rate on THIS withdrawal:
//
//     (G - remaining after-tax need from this account) / G
//
// where "remaining after-tax need" is the target minus what the other sources
// already deliver after tax with G = 0. So G - remaining is exactly the EXTRA
// tax caused by adding G on top of everything else — bracket creep and the
// Social Security phase-in included. It is a blended rate across G, not the
// bracket rate of its last dollar.
//
// Only meaningful for the Pre-tax scenario: a Roth withdrawal is tax-free at any
// size and never touches this stack.
import { calculateRetirementTax } from './retirementTaxStack.js';
import { solveMonotonicIncreasing } from './solver.js';
import { getMarginalRate, getStandardDeduction } from './taxCalculations.js';

// Fallback size of the probe withdrawal used to read an incremental tax rate
// when the other sources already cover the whole target (so G = 0 and 0/0 is
// undefined). Callers that know the size of the withdrawal this rate will
// actually be APPLIED to (e.g. compare.js applies it to the account's own 4%
// annual withdrawal) should pass that in as `probeSize` instead — measuring a
// tiny, arbitrary $1,000 probe when the real withdrawal is much bigger (or
// smaller) can read a noticeably different blended rate than the real
// withdrawal would face, which is confusing when only the *target* changes
// (see incomeNeed.test.js's "probe size" tests for a worked example).
const DEFAULT_PROBE_WITHDRAWAL = 1000;

export function solveGrossWithdrawal({
  targetAfterTaxIncome,
  ssBenefit = 0,
  otherPretaxWithdrawal = 0,
  otherRothWithdrawal = 0,
  otherTaxableWithdrawal = 0,
  otherTaxableGainShare = 1, // share of the taxable withdrawal that is gain (rest = cost basis)
  filingStatus,
  year,
  probeSize = DEFAULT_PROBE_WITHDRAWAL,
}) {
  const stack = (g) =>
    calculateRetirementTax({
      pretaxWithdrawal: otherPretaxWithdrawal + g,
      taxableWithdrawal: otherTaxableWithdrawal,
      taxableGainShare: otherTaxableGainShare,
      ssBenefit,
      filingStatus,
      year,
    });

  const afterTaxIncome = (g) =>
    ssBenefit +
    otherPretaxWithdrawal +
    otherRothWithdrawal +
    otherTaxableWithdrawal +
    g -
    stack(g).totalTax;

  const afterTaxFromOtherSources = afterTaxIncome(0);
  const { x: grossWithdrawal, bracketed } = solveMonotonicIncreasing(
    afterTaxIncome,
    targetAfterTaxIncome,
  );

  const remainingAfterTaxNeed = Math.max(0, targetAfterTaxIncome - afterTaxFromOtherSources);
  const baseStack = stack(0);

  // Whenever other sources already cover the target (G = 0), the rate is read
  // from a hypothetical withdrawal of `probeSize` instead (a fallback of
  // $1,000 if the caller didn't specify a size) — see the comment on
  // DEFAULT_PROBE_WITHDRAWAL above. `probeStack`/`probeExtraTax` are exposed
  // (always, not just when G = 0) so the UI can show the actual arithmetic
  // behind the rate instead of a misleading "$0 ÷ $0" when no withdrawal is
  // literally needed — solutionStack correctly stays at $0 extra tax in that
  // case (nothing is really being withdrawn), but the RATE shown up top comes
  // from this probe, so the two should never be presented as the same thing.
  const probeSizeUsed = probeSize > 0 ? probeSize : DEFAULT_PROBE_WITHDRAWAL;
  const probeStack = stack(probeSizeUsed);
  const probeExtraTax = probeStack.totalTax - baseStack.totalTax;

  let retirementEffectiveTaxRate;
  if (grossWithdrawal > 0) {
    retirementEffectiveTaxRate = (grossWithdrawal - remainingAfterTaxNeed) / grossWithdrawal;
  } else {
    retirementEffectiveTaxRate = probeExtraTax / probeSizeUsed;
  }

  const solutionStack = stack(grossWithdrawal);
  return {
    grossWithdrawal,
    afterTaxFromOtherSources,
    remainingAfterTaxNeed,
    retirementEffectiveTaxRate,
    taxableSS: solutionStack.taxableSS,
    totalTaxPaid: solutionStack.totalTax,
    achievedAfterTaxIncome: afterTaxIncome(grossWithdrawal),
    converged: bracketed,
    // Full tax picture without this account's withdrawal, and with it. The
    // difference in totalTax is the tax this withdrawal causes; the difference
    // in taxableSS is how much Social Security it pulls into taxable income.
    // (Used by the UI to show its work.)
    baseStack,
    solutionStack,
    // The hypothetical probe withdrawal actually used to derive the rate when
    // grossWithdrawal is 0 (harmless/unused otherwise — solutionStack already
    // reflects the real, actual withdrawal in that case).
    probeSize: probeSizeUsed,
    probeStack,
    probeExtraTax,
  };
}

// Breaks the effective rate from solveGrossWithdrawal into the things that set
// it, for the UI to explain. Reads the withdrawal the rate was actually measured
// on: the real gross-up G, or the probe withdrawal when G = 0 (`hypothetical`).
//
//   startBracket / endBracket  ordinary bracket of the withdrawal's first and last
//                              dollar (0 while still under the standard deduction).
//                              Income already on the stack (other Pre-tax
//                              withdrawals + taxable Social Security) is taxed
//                              first, so it decides where the withdrawal starts.
//   deductionUsedBefore        how much of the standard deduction that income uses.
//   extraTaxableSS             Social Security the withdrawal pulls into taxable income.
//   extraOrdinaryTax / extraCapitalGainsTax
//                              the two parts of the extra tax. Capital-gains tax rises
//                              because gains are stacked on top of ordinary income: more
//                              ordinary income pushes a fixed taxable-account withdrawal
//                              into a higher capital-gains bracket.
//   extraNiit                  Net Investment Income Tax the withdrawal adds: it raises
//                              MAGI, exposing more taxable-account gains to the 3.8%.
export function explainWithdrawalRate(grossUp, { otherPretaxWithdrawal = 0, filingStatus, year }) {
  const hypothetical = !(grossUp.grossWithdrawal > 0);
  const withdrawal = hypothetical ? grossUp.probeSize : grossUp.grossWithdrawal;
  const before = grossUp.baseStack;
  const after = hypothetical ? grossUp.probeStack : grossUp.solutionStack;
  const standardDeduction = getStandardDeduction(filingStatus, year);
  const extraOrdinaryTax = after.ordinaryTax - before.ordinaryTax;
  const extraCapitalGainsTax = after.capitalGainsTax - before.capitalGainsTax;
  const extraNiit = after.niit - before.niit;
  return {
    hypothetical,
    withdrawal,
    standardDeduction,
    otherPretaxWithdrawal,
    taxableSSBefore: before.taxableSS,
    ordinaryIncomeBefore: before.grossOrdinaryIncome,
    deductionUsedBefore: Math.min(standardDeduction, before.grossOrdinaryIncome),
    startBracket: getMarginalRate(before.grossOrdinaryIncome - standardDeduction, filingStatus, year),
    endBracket: getMarginalRate(after.grossOrdinaryIncome - standardDeduction, filingStatus, year),
    extraTaxableSS: after.taxableSS - before.taxableSS,
    extraOrdinaryTax,
    extraCapitalGainsTax,
    extraNiit,
    extraTax: extraOrdinaryTax + extraCapitalGainsTax + extraNiit,
  };
}
