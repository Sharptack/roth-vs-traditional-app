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
import { LTCG_RATE } from './constants.js';

// Size of the probe withdrawal used to read an incremental tax rate when the
// other sources already cover the whole target (so G = 0 and 0/0 is undefined).
const PROBE_WITHDRAWAL = 1000;

export function solveGrossWithdrawal({
  targetAfterTaxIncome,
  ssBenefit = 0,
  otherPretaxWithdrawal = 0,
  otherRothWithdrawal = 0,
  otherTaxableWithdrawal = 0,
  filingStatus,
  year,
  ltcgRate = LTCG_RATE,
}) {
  const stack = (g) =>
    calculateRetirementTax({
      pretaxWithdrawal: otherPretaxWithdrawal + g,
      taxableWithdrawal: otherTaxableWithdrawal,
      ssBenefit,
      filingStatus,
      year,
      ltcgRate,
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

  let retirementEffectiveTaxRate;
  if (grossWithdrawal > 0) {
    retirementEffectiveTaxRate = (grossWithdrawal - remainingAfterTaxNeed) / grossWithdrawal;
  } else {
    // Other sources already cover the target, so no withdrawal is required.
    // Report the rate an incremental withdrawal WOULD face on top of that stack.
    const gained = afterTaxIncome(PROBE_WITHDRAWAL) - afterTaxFromOtherSources;
    retirementEffectiveTaxRate = (PROBE_WITHDRAWAL - gained) / PROBE_WITHDRAWAL;
  }

  const baseStack = stack(0);
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
  };
}
