// A second way to work out the Roth-vs-Pre-tax tax rates, built to include the TAXABLE account
// that Future Contributions spill into once they exceed the IRS limit (compare.js: `side`).
// Kept beside the original calculation (compare.js `rates`) so the two can be compared; one of
// them will be dropped later. Pure and framework-free.
//
// Why a second version. The original effective rate is measured on the withdrawal needed to
// reach the retirement income number, with only Social Security and Existing Accounts in the
// stack. It ignores the taxable accounts the two scenarios build from their Future
// Contributions, and those differ in size: the Pre-tax scenario invests the tax its deduction
// saved, the Roth scenario does not. Capital gains stack on top of ordinary income, so the
// bigger taxable account (a) loses the cheap 0% bracket to the 401(k) withdrawal, (b) makes more
// Social Security taxable and (c) can trigger the 3.8% NIIT. Those costs belong in the rate.
//
// The comparison, in first-year-of-retirement terms (all withdrawals are 4% of each balance):
//   Roth world     = Existing + the Roth taxable account (its Roth account is tax-free)
//   Pre-tax world  = Existing + the Pre-tax taxable account + the Pre-tax account withdrawal W
//   e  effective rate on W, measured IN the Pre-tax world's stack:
//        e = [tax(Existing + sideP + W) - tax(Existing + sideP)] / W
//   s  tax rate on the EXTRA taxable money the Pre-tax world holds (extra = sideP - sideR):
//        s = [tax(Existing + sideP) - tax(Existing + sideR)] / extra
//   X  "tax saved now, after the tax on investing it":
//        X = [(W - RW) + extra * (1 - s)] / W          (RW = the Roth account's withdrawal)
// When everything fits under the limit (no taxable account) extra = 0 and RW = W(1 - t), so
// X = t and X - e is today's "marginal rate now minus effective rate later". When the limit
// caps both accounts (RW = W), X = t(1 - s).
//
// IDENTITY (tested): (X - e) * W equals, exactly, the after-tax income the Pre-tax portfolio
// delivers minus the Roth portfolio's at a plain 4% withdrawal (portfolioTax `atBaseline`):
//   PreTax - Roth = W(1 - e) + extra(1 - s) - RW
// so the rates cannot contradict the exact dollar comparison.
import { calculateRetirementTax } from './retirementTaxStack.js';

const NO_SIDE = { withdrawal: 0, gains: 0 };

export function calculateSideAwareRates({
  other, // { pretaxGross, taxableGross, taxableGains } — Existing Accounts' 4% withdrawals
  ssBenefit,
  filingStatus,
  year,
  pretaxAccountWithdrawal, // W: the Pre-tax scenario's account, 4% of its value
  rothAccountWithdrawal, // RW: the Roth scenario's account, 4% of its value (tax-free)
  pretaxSide = NO_SIDE, // { withdrawal, gains }: the Pre-tax scenario's taxable account, 4%
  rothSide = NO_SIDE,
  taxRules, // optional: retirement-year tax rules (see calculateRetirementTax); absent = today's
}) {
  const W = pretaxAccountWithdrawal;
  if (!(W > 0)) return { available: false };

  // The raw inputs behind each stack, kept alongside the totals so a "show the full tax
  // calculation" view can re-run them through explainFullTax (taxBreakdown.js) for a
  // bracket-by-bracket breakdown, without duplicating the stacking logic here.
  const stackInputs = (accountPretax, side) => {
    const taxable = other.taxableGross + side.withdrawal;
    return {
      pretaxWithdrawal: other.pretaxGross + accountPretax,
      taxableWithdrawal: taxable,
      taxableGainShare: taxable > 0 ? (other.taxableGains + side.gains) / taxable : 1,
      ssBenefit,
      filingStatus,
      year,
      ...(taxRules && { taxRules }),
    };
  };
  const stack = (accountPretax, side) => calculateRetirementTax(stackInputs(accountPretax, side));

  const extraSide = {
    withdrawal: Math.max(0, pretaxSide.withdrawal - rothSide.withdrawal),
    gains: Math.max(0, pretaxSide.gains - rothSide.gains),
  };

  // The four stacks the walk-through shows.
  const stacks = {
    existing: stack(0, NO_SIDE), // Social Security + Existing Accounts only
    rothWorld: stack(0, rothSide), // + the Roth scenario's taxable account
    preTaxWorldBeforeAccount: stack(0, pretaxSide), // + the Pre-tax scenario's taxable account
    preTaxWorld: stack(W, pretaxSide), // + the Pre-tax account's own withdrawal
  };
  // Same four keys, but the raw inputs each stack was built from (see stackInputs above).
  const stackDetails = {
    existing: stackInputs(0, NO_SIDE),
    rothWorld: stackInputs(0, rothSide),
    preTaxWorldBeforeAccount: stackInputs(0, pretaxSide),
    preTaxWorld: stackInputs(W, pretaxSide),
  };

  const extraSideTax = stacks.preTaxWorldBeforeAccount.totalTax - stacks.rothWorld.totalTax;
  const extraSideRate = extraSide.withdrawal > 0 ? extraSideTax / extraSide.withdrawal : 0;
  const extraTaxFromAccount = stacks.preTaxWorld.totalTax - stacks.preTaxWorldBeforeAccount.totalTax;
  const effectiveRate = extraTaxFromAccount / W;
  const taxSavedNow = (W - rothAccountWithdrawal + extraSide.withdrawal * (1 - extraSideRate)) / W;
  const gap = taxSavedNow - effectiveRate;

  return {
    available: true,
    accountWithdrawal: W,
    rothAccountWithdrawal,
    pretaxSide,
    rothSide,
    extraSide,
    extraSideTax,
    extraSideRate,
    extraTaxFromAccount,
    effectiveRate,
    taxSavedNow,
    gap,
    // Pre-tax minus Roth, in after-tax income per year of retirement (negative = Roth ahead).
    dollarDifference: gap * W,
    stacks,
    stackDetails,
  };
}
