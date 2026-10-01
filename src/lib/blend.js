// Explores mixing Roth and Pre-tax within a single year's Future Contributions, instead of
// putting it all in one or the other — the same thing a real 401(k)'s Roth/Traditional
// deferral election splits, just parameterized as a slider from 0% to 100% Roth. Pure and
// framework-free: no UI, no new financial rules beyond what compare.js already applies.
//
// Why this can beat either pure extreme: "tax saved now" is close to flat (your marginal rate
// on one year's contribution), but "effective rate later" is a CURVE — it rises as the Pre-tax
// withdrawal grows, because a bigger withdrawal climbs through brackets, the Social Security
// phase-in band, and (if there is a taxable side account) pushes more capital gains into a
// higher bracket. Where that curve crosses today's marginal rate partway through the account,
// a blend can out-earn both pure strategies. Where it doesn't (the curve stays below or above
// marginal-now the whole way), the optimum sits at one of the two ends — i.e. a pure strategy
// already was optimal, and the blend curve just confirms it rather than finding something new.
import { futureValueAnnuity } from './growthCalculations.js';
import { calculateRetirementTax } from './retirementTaxStack.js';
import { WITHDRAWAL_RATE } from './constants.js';

// Splits a take-home budget C between a Roth and a Pre-tax contribution to the SAME
// tax-advantaged account, at a chosen Roth share r (0 = all Pre-tax, 1 = all Roth) of the
// ACCOUNT DOLLARS (not of the budget) — the same thing a 401(k) Roth/Traditional deferral
// election splits. Whatever doesn't fit under the combined IRS limit spills to a taxable
// account, the same mechanism as compare.js's splitAtTakeHome, which this generalizes:
//   A_uncapped = C / (1 - (1 - r) * t)      -- account dollars this budget buys, before capping
//   A = min(A_uncapped, limit)              -- capped at the combined IRS limit
//   rothToAccount = r * A, pretaxToAccount = (1 - r) * A
//   costOfAccount = A * (1 - (1 - r) * t)   -- take-home cost of those A dollars
//   excessToTaxable = C - costOfAccount     -- whatever of the budget didn't fit, after-tax
// PROVEN (and tested against splitAtTakeHome directly): at r = 0 this is EXACTLY
// splitAtTakeHome's pretax branch (A_uncapped reduces to C / (1 - t), the Pre-tax-equivalent
// formula), and at r = 1 it is EXACTLY the roth branch (A_uncapped reduces to C) — for any
// C, t, limit, capped or not. A blend is a genuine generalization, not a new set of rules.
export function splitBlended(takeHomeCost, marginalRate, limit, rothShare) {
  const C = Math.max(0, takeHomeCost);
  const r = Math.min(1, Math.max(0, rothShare));
  const keepFactor = 1 - (1 - r) * marginalRate; // cost per account dollar at this split
  const accountUncapped = keepFactor > 0 ? C / keepFactor : 0;
  const A = Math.min(accountUncapped, limit);
  const rothToAccount = r * A;
  const pretaxToAccount = (1 - r) * A;
  const costOfAccount = A * keepFactor;
  return { rothToAccount, pretaxToAccount, excessToTaxable: Math.max(0, C - costOfAccount) };
}

// splitBlended per person at the same Roth share (one household election), each at their own
// IRS limit, summed. contributors: [{ takeHomeCost, limit }].
export function splitBlendedByPerson(contributors, marginalRate, rothShare) {
  const parts = contributors.map((c) => splitBlended(c.takeHomeCost, marginalRate, c.limit, rothShare));
  const sum = (key) => parts.reduce((acc, p) => acc + p[key], 0);
  return { rothToAccount: sum('rothToAccount'), pretaxToAccount: sum('pretaxToAccount'), excessToTaxable: sum('excessToTaxable') };
}

// One point on the blend curve: split the budget at this Roth share, grow each piece to
// retirement, and work out the total after-tax income it delivers in the first retirement
// year. `other` (Existing Accounts' 4% withdrawals) and `existingTax` (the tax on Social
// Security + Existing Accounts alone, with nothing from this year's contribution added — the
// same "existing" stack sideAwareRates.js computes) put Social Security and Existing Accounts
// in the stack first, so this account's own tax is the EXTRA tax it causes on top of them —
// exactly the same incremental measure the rest of the app uses, just evaluated at an
// arbitrary Roth share instead of only the two pure endpoints (0 and 1).
export function evaluateBlend({
  rothShare,
  takeHomeCost,
  marginalRate,
  limit,
  contributors, // optional (household model): [{ takeHomeCost, limit }], each split at its own limit
  taxRules, // optional: retirement-year tax rules (see calculateRetirementTax); absent = today's
  savedByDeduction, // optional (preview): x -> tax saved by deducting x; then this mix's Pre-tax part
  //                   saves its own AVERAGE rate (fixed point), not marginalRate on every dollar
  returnRate,
  years,
  other, // { pretaxGross, taxableGross, taxableGains } — Existing Accounts' 4% withdrawals
  existingTax, // tax on Social Security + Existing Accounts alone
  ssBenefit,
  filingStatus,
  year,
}) {
  const splitAt = (t) =>
    contributors ? splitBlendedByPerson(contributors, t, rothShare) : splitBlended(takeHomeCost, t, limit, rothShare);
  let rateNow = marginalRate;
  let split = splitAt(rateNow);
  if (savedByDeduction) {
    for (let i = 0; i < 100; i++) {
      const P = split.pretaxToAccount;
      const next = P > 0 ? savedByDeduction(P) / P : rateNow;
      if (Math.abs(next - rateNow) < 1e-13) break;
      rateNow = next;
      split = splitAt(rateNow);
    }
  }
  const rothFV = futureValueAnnuity(split.rothToAccount, returnRate, years);
  const pretaxFV = futureValueAnnuity(split.pretaxToAccount, returnRate, years);
  const sideFV = futureValueAnnuity(split.excessToTaxable, returnRate, years);
  const rothWithdrawal = WITHDRAWAL_RATE * rothFV;
  const pretaxWithdrawal = WITHDRAWAL_RATE * pretaxFV;
  const sideWithdrawal = WITHDRAWAL_RATE * sideFV;
  // Every dollar that spills into the side account is cost basis, so only its growth is gain
  // (same convention as compare.js's side accounts).
  const sideBasis = split.excessToTaxable * years;
  const sideGainShare = sideFV > 0 ? Math.max(0, 1 - sideBasis / sideFV) : 1;
  const sideGains = sideWithdrawal * sideGainShare;

  const taxable = other.taxableGross + sideWithdrawal;
  const stack = calculateRetirementTax({
    pretaxWithdrawal: other.pretaxGross + pretaxWithdrawal,
    taxableWithdrawal: taxable,
    taxableGainShare: taxable > 0 ? (other.taxableGains + sideGains) / taxable : 1,
    ssBenefit,
    filingStatus,
    year,
    taxRules,
  });
  // The same stack without the Pre-tax slice (Existing Accounts + Social Security + this mix's
  // side account): what blendRates() needs to measure the Pre-tax slice's own rate.
  const taxWithoutPretaxSlice = calculateRetirementTax({
    pretaxWithdrawal: other.pretaxGross,
    taxableWithdrawal: taxable,
    taxableGainShare: taxable > 0 ? (other.taxableGains + sideGains) / taxable : 1,
    ssBenefit,
    filingStatus,
    year,
    taxRules,
  }).totalTax;
  const extraTax = stack.totalTax - existingTax;
  const totalAfterTaxIncome = rothWithdrawal + pretaxWithdrawal + sideWithdrawal - extraTax;

  return {
    rothShare,
    ...split,
    rateNow, // the rate this mix's Pre-tax part saves (marginalRate unless savedByDeduction)
    rothFV,
    pretaxFV,
    sideFV,
    rothWithdrawal,
    pretaxWithdrawal,
    sideWithdrawal,
    sideGainShare,
    taxWithoutPretaxSlice,
    pretaxSliceTax: stack.totalTax - taxWithoutPretaxSlice,
    extraTax,
    totalAfterTaxIncome,
  };
}

// The two rates of the Tax rate comparison card, at any mix: this mix measured against the
// all-Roth mix, exactly as sideAwareRates.js measures all-Pre-tax against all-Roth (W = this
// mix's Pre-tax withdrawal; its side account is stacked BEFORE W, same order):
//   effectiveRate = [tax(Existing + side + W) - tax(Existing + side)] / W
//   taxSavedNow   = [(W + Roth withdrawal - all-Roth withdrawal) + (side - all-Roth side)
//                    - (tax(Existing + side) - tax(Existing + all-Roth side))] / W
// so (taxSavedNow - effectiveRate) x W = this mix's after-tax income minus all-Roth's, to the
// cent, and at r = 0 both equal compare.js's rates.taxSavedNow / rates.effectiveRetirement.
// Under the IRS limit there is no side account and taxSavedNow is exactly the marginal rate
// (the extra account dollars a mix buys over all-Roth are its Pre-tax dollars x t). Both are
// null at all-Roth, where there is no Pre-tax withdrawal to measure.
export function blendRates(point, allRoth) {
  const W = point.pretaxWithdrawal;
  if (!(W > 0.005)) return { taxSavedNow: null, effectiveRate: null };
  const effectiveRate = point.pretaxSliceTax / W;
  const gained =
    W +
    point.rothWithdrawal -
    allRoth.rothWithdrawal +
    (point.sideWithdrawal - allRoth.sideWithdrawal) -
    (point.taxWithoutPretaxSlice - allRoth.taxWithoutPretaxSlice);
  return { taxSavedNow: gained / W, effectiveRate };
}

// The whole curve (for charting) plus its best point, by dense grid search. Deliberately not a
// faster search (ternary/golden-section): bracket edges and the Social Security phase-in can
// put a local kink or a flat stretch in the curve, so nothing here assumes it is smooth or
// concave — a fine grid finds the true global max regardless of the curve's shape.
export function findOptimalBlend(params, steps = 101) {
  const points = [];
  let best = null;
  for (let i = 0; i < steps; i++) {
    const rothShare = i / (steps - 1);
    const point = evaluateBlend({ ...params, rothShare });
    points.push(point);
    if (!best || point.totalAfterTaxIncome > best.totalAfterTaxIncome) best = point;
  }
  const allRoth = points[points.length - 1];
  for (const point of points) Object.assign(point, blendRates(point, allRoth));
  return { points, best };
}
