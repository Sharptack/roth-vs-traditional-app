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
  return { ...benefitFromPIA({ pia, currentAge, retirementAge, year }), aime, dataYear };
}

// The benefit from a PIA (monthly, at full retirement age, in today's dollars) claimed at
// `retirementAge` (clamped to 62-70): the PIA times the claiming adjustment for that age.
// Used for a PIA the user enters (the version 2 household, round 2 phase 0) and by the estimate.
export function benefitFromPIA({ pia, currentAge, retirementAge, year }) {
  const birthYear = year - currentAge;
  const fraMonths = getFullRetirementAgeMonths(birthYear);
  const claimingAge = Math.min(LATEST_CLAIMING_AGE, Math.max(EARLIEST_CLAIMING_AGE, retirementAge));
  const adjustmentFactor = claimingAdjustmentFactor(claimingAge * 12 - fraMonths);

  const monthlyBenefit = pia * adjustmentFactor;
  return {
    annualBenefit: monthlyBenefit * 12,
    monthlyBenefit,
    pia,
    fullRetirementAge: fraMonths / 12,
    claimingAge,
    adjustmentFactor,
  };
}

// Reduction for a SPOUSAL benefit started `monthsEarly` months before full retirement age:
// 25/36 of 1% per month for the first 36 months, 5/12 of 1% per month beyond (steeper than the
// worker's own 5/9 of 1%). There are no delayed credits on a spousal benefit, so the factor is 1
// at or after full retirement age. Source: SSA POMS RS 00615.201 (Reduced Spouse's Benefits).
export function spousalAdjustmentFactor(monthsFromFRA) {
  if (monthsFromFRA >= 0) return 1;
  const early = -monthsFromFRA;
  return 1 - ((Math.min(early, 36) * 25) / 36 + (Math.max(0, early - 36) * 5) / 12) / 100;
}

// Household Social Security (the household model, phase 1): each person's benefit from their
// OWN earnings, plus a spousal top-up when half the other spouse's PIA is larger than their own.
//   earners: [{ earnings, currentAge, claimAge, knowsSocialSecurity, socialSecurityBenefit, pia? }]
//     earnings = covered earnings (W-2 wages + net self-employment earnings) for the estimate;
//     pia = OPTIONAL, the monthly benefit at full retirement age as entered (version 2 household):
//     their own benefit is worked out from it instead of from earnings, and it counts for the
//     spousal top-up both ways, like an estimated PIA;
//     claimAge defaults to the person's retirement age as passed (clamped to 62-70), the same
//     rule estimateSocialSecurityBenefit uses.
// Rules (SSA): the spousal benefit is up to 50% of the other spouse's PIA. When a person is
// entitled to their own benefit too, they receive their own (reduced/increased for their own
// claiming age) plus the EXCESS of 50% of the other's PIA over their own PIA, reduced by
// spousalAdjustmentFactor for their age when the spousal part starts. That is the later of their
// own claim and the other spouse's claim (a spousal benefit can't start before the worker files).
// Simplifications: a person whose benefit is entered (known) gets exactly that figure, and their
// PIA is unknown, so it gives the other spouse no spousal top-up; the benefit is the steady
// annual amount once both have claimed (no year-by-year timing; that's the projection's job);
// no survivor benefits. Same estimator shortcuts as estimateSocialSecurityBenefit above.
// For one earner the result equals estimateSocialSecurityBenefit (or the known benefit).
export function estimateHouseholdSocialSecurity({ earners, year }) {
  const own = earners.map((e) => {
    if (e.knowsSocialSecurity) {
      return { known: true, annualBenefit: e.socialSecurityBenefit, ownBenefit: e.socialSecurityBenefit, spousalTopUp: 0 };
    }
    if (e.pia !== undefined) {
      const fromPia = benefitFromPIA({ pia: e.pia, currentAge: e.currentAge, retirementAge: e.claimAge, year });
      return { known: false, fromPia: true, ...fromPia, ownBenefit: fromPia.annualBenefit, spousalTopUp: 0 };
    }
    const est = estimateSocialSecurityBenefit({
      annualIncome: e.earnings,
      currentAge: e.currentAge,
      retirementAge: e.claimAge,
      year,
    });
    return { known: false, ...est, ownBenefit: est.annualBenefit, spousalTopUp: 0 };
  });

  const people = own.map((p, i) => {
    const other = own[1 - i];
    if (earners.length !== 2 || p.known || !other || other.known) return p;
    const excessMonthly = Math.max(0, 0.5 * other.pia - p.pia);
    if (excessMonthly <= 0) return p;
    // The other spouse claims at their claimingAge; this person's age then:
    const ageWhenOtherClaims = other.claimingAge + (earners[i].currentAge - earners[1 - i].currentAge);
    const spousalStartAge = Math.max(p.claimingAge, ageWhenOtherClaims);
    const factor = spousalAdjustmentFactor(spousalStartAge * 12 - Math.round(p.fullRetirementAge * 12));
    const spousalTopUp = excessMonthly * factor * 12;
    return {
      ...p,
      spousalStartAge,
      spousalAdjustmentFactor: factor,
      spousalTopUp,
      annualBenefit: p.ownBenefit + spousalTopUp,
    };
  });

  return {
    annualBenefit: people.reduce((acc, p) => acc + p.annualBenefit, 0),
    estimated: people.some((p) => !p.known && !p.fromPia), // worked out from earnings (not entered)
    people,
  };
}
