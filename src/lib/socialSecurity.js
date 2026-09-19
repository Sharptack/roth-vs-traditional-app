// SIMPLIFIED Social Security BENEFIT estimator, for users who don't know their
// benefit. (How much of a known benefit is taxable is a separate concern — see
// socialSecurityTax.js.)
//
// This is NOT the SSA calculation. The real one needs a 35-year history of
// wage-indexed earnings. Shortcuts taken here:
//   1. AIME is approximated as current annual income / 12, capped at the taxable
//      wage base. This treats today's income as a lifetime average, so it tends
//      to OVERSTATE the benefit for people who earned less earlier in their
//      career and for anyone with fewer than 35 working years.
//   2. Bend points for the requested year are used, rather than the year the
//      worker turns 62.
//   3. Birth year is approximated as (year - current age).
//   4. Benefits are assumed to be claimed at the planned retirement age, clamped
//      to the 62-70 range in which claiming is possible.
//   5. For married couples, the input income is treated as one earner's. Use a
//      known household figure from ssa.gov when you have one.
// Results are in today's dollars (no COLA modeled).
// UI copy: "Estimated — see ssa.gov for a precise figure".
import {
  SS_BEND_POINTS,
  FULL_RETIREMENT_AGE,
  EARLIEST_CLAIMING_AGE,
  LATEST_CLAIMING_AGE,
} from '../data/ssBendPoints.js';
import { FICA_RATES } from '../data/ficaRates.js';
import { getYearData } from './yearLookup.js';

// Full retirement age in months for someone born in `birthYear`.
export function getFullRetirementAgeMonths(birthYear) {
  const row = FULL_RETIREMENT_AGE.find(
    (r) => birthYear >= r.fromBirthYear && birthYear <= r.toBirthYear,
  );
  return row.months;
}

// Monthly PIA from monthly AIME using the bend-point formula.
export function calculatePIA(aime, bendPoint1, bendPoint2) {
  const tier1 = Math.min(aime, bendPoint1);
  const tier2 = Math.max(0, Math.min(aime, bendPoint2) - bendPoint1);
  const tier3 = Math.max(0, aime - bendPoint2);
  return 0.9 * tier1 + 0.32 * tier2 + 0.15 * tier3;
}

// Multiplier applied to PIA for claiming `monthsFromFRA` months after (+) or
// before (-) full retirement age.
//   Early: reduced 5/9 of 1% per month for the first 36 months, then 5/12 of 1%
//          per month beyond that.
//   Late:  increased 2/3 of 1% per month (8%/yr) — delayed retirement credits.
//          (Caller clamps the claiming age to 70, where credits stop.)
export function claimingAdjustmentFactor(monthsFromFRA) {
  if (monthsFromFRA >= 0) return 1 + (monthsFromFRA * 2) / 3 / 100;
  const early = -monthsFromFRA;
  const reduction = (Math.min(early, 36) * 5) / 9 / 100 + (Math.max(0, early - 36) * 5) / 12 / 100;
  return 1 - reduction;
}

export function estimateSocialSecurityBenefit({
  annualIncome,
  currentAge,
  retirementAge,
  year,
}) {
  const { year: dataYear, data } = getYearData(SS_BEND_POINTS, year);
  const { wageBase } = getYearData(FICA_RATES, year).data;

  const coveredIncome = Math.max(0, Math.min(annualIncome, wageBase));
  const aime = coveredIncome / 12;
  const pia = calculatePIA(aime, data.bendPoint1, data.bendPoint2);

  const birthYear = year - currentAge;
  const fraMonths = getFullRetirementAgeMonths(birthYear);
  const claimingAge = Math.min(LATEST_CLAIMING_AGE, Math.max(EARLIEST_CLAIMING_AGE, retirementAge));
  const adjustmentFactor = claimingAdjustmentFactor(claimingAge * 12 - fraMonths);

  const monthlyBenefit = pia * adjustmentFactor;
  return {
    annualBenefit: monthlyBenefit * 12,
    monthlyBenefit,
    pia,
    aime,
    fullRetirementAge: fraMonths / 12,
    claimingAge,
    adjustmentFactor,
    dataYear,
  };
}
