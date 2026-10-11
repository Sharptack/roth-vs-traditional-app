// Social Security claiming rules (round 2 phase 5): each person's own benefit at every claiming
// age, the spousal top-up for a pair of claiming ages, and the survivor benefit. Monthly amounts in
// today's dollars (benefits rise with prices). Pure.
//
// Ages are whole years (as the household stores claiming ages); full retirement ages are in months
// by birth year, so a claim at 62 is 62 x 12 months against them.
//
// Survivor benefit (SSA, POMS RS 00615.301, .320, .706): the deceased's "original benefit" is
//   - their benefit as claimed, with any delayed credits, when they claimed after full retirement age;
//   - their PIA when they claimed early, with the result limited to the larger of their reduced
//     benefit and 82.5% of their PIA (the "RIB-LIM");
//   - their PIA, plus the delayed credits earned to the death, when they died before claiming.
// It is reduced if the survivor starts it before their survivor full retirement age: 71.5% at 60,
// in a straight line to 100% (the reduction applies to the whole original benefit, credits
// included). No survivor benefit before 60. A survivor entitled to their own benefit too receives
// the larger of the two (their own plus the excess); that choice is the caller's.
// Not modeled: the earnings test, the disabled-survivor rules from 50, children and ex-spouses.
import {
  EARLIEST_CLAIMING_AGE,
  LATEST_CLAIMING_AGE,
  SURVIVOR_FULL_RETIREMENT_AGE,
} from '../data/ssBendPoints.js';
import { claimingAdjustmentFactor, getFullRetirementAgeMonths, spousalAdjustmentFactor } from './socialSecurity.js';

export const CLAIM_AGES = Array.from(
  { length: LATEST_CLAIMING_AGE - EARLIEST_CLAIMING_AGE + 1 },
  (_, i) => EARLIEST_CLAIMING_AGE + i,
);
export const SURVIVOR_EARLIEST_AGE = 60;
const SURVIVOR_FLOOR = 0.715; // at 60
const RIB_LIMIT = 0.825; // of the PIA, after an early claim

const clampClaim = (age) => Math.min(LATEST_CLAIMING_AGE, Math.max(EARLIEST_CLAIMING_AGE, age));

// The own-benefit factor for a claim at `claimAge` (whole years, clamped to 62-70).
export function ownFactor(claimAge, birthYear) {
  return claimingAdjustmentFactor(clampClaim(claimAge) * 12 - getFullRetirementAgeMonths(birthYear));
}

// Own benefit at each claiming age 62 to 70: [{ claimAge, factor, monthly }].
export function ownBenefitsByClaimAge({ pia, birthYear }) {
  return CLAIM_AGES.map((claimAge) => {
    const factor = ownFactor(claimAge, birthYear);
    return { claimAge, factor, monthly: pia * factor };
  });
}

// The spousal top-up (monthly) for a person claiming their own at `claimAge`, when the other spouse
// files at the person's age `otherClaimAgeInOwnYears` (the other's claiming age plus the age gap):
// 50% of the other's PIA less their own PIA, reduced for the person's age when it starts (the later
// of the two filings; no delayed credits). { monthly, startAge, factor }.
export function spousalTopUpMonthly({ pia, otherPia, birthYear, claimAge, otherClaimAgeInOwnYears }) {
  const excess = Math.max(0, 0.5 * otherPia - pia);
  const startAge = Math.max(clampClaim(claimAge), otherClaimAgeInOwnYears);
  if (excess <= 0) return { monthly: 0, startAge, factor: 1 };
  const factor = spousalAdjustmentFactor(startAge * 12 - getFullRetirementAgeMonths(birthYear));
  return { monthly: excess * factor, startAge, factor };
}

export function survivorFullRetirementAgeMonths(birthYear) {
  return SURVIVOR_FULL_RETIREMENT_AGE.find((r) => birthYear >= r.fromBirthYear && birthYear <= r.toBirthYear).months;
}

// The survivor's reduction for starting at `startAge` (whole years): 0 before 60, 71.5% at 60,
// straight-line to 100% at survivor full retirement age.
export function survivorAdjustmentFactor(startAge, birthYear) {
  if (startAge < SURVIVOR_EARLIEST_AGE) return 0;
  const fra = survivorFullRetirementAgeMonths(birthYear);
  const early = fra - startAge * 12;
  if (early <= 0) return 1;
  return 1 - ((1 - SURVIVOR_FLOOR) * early) / (fra - SURVIVOR_EARLIEST_AGE * 12);
}

// The survivor benefit (monthly). The deceased claimed if their claiming age is at or below the age
// they died at (`deathAge`, whole years: credits run to the start of that year of age).
export function survivorBenefitMonthly({ deceasedPia, deceasedBirthYear, deceasedClaimAge, deathAge, survivorBirthYear, survivorStartAge }) {
  if (!(deceasedPia > 0)) return 0;
  const fra = getFullRetirementAgeMonths(deceasedBirthYear);
  let original;
  let limit = Infinity;
  if (clampClaim(deceasedClaimAge) <= deathAge) {
    const f = ownFactor(deceasedClaimAge, deceasedBirthYear);
    if (f >= 1) original = deceasedPia * f;
    else {
      original = deceasedPia;
      limit = Math.max(deceasedPia * f, RIB_LIMIT * deceasedPia);
    }
  } else {
    const credited = Math.max(0, Math.min(deathAge, LATEST_CLAIMING_AGE) * 12 - fra);
    original = deceasedPia * claimingAdjustmentFactor(credited);
  }
  return Math.min(original * survivorAdjustmentFactor(survivorStartAge, survivorBirthYear), limit);
}
