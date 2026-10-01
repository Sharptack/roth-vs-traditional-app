// Required minimum distributions (roadmap phase 3). Pure.
// RMD for a year = the Pre-tax balance on December 31 of the year before ÷ the Uniform Lifetime
// Table divisor for the owner's age that year (data/rmdTable.js). Per owner: with a spouse, each
// person's Pre-tax accounts use their own age. Not modeled: the Joint Life table (a spouse more
// than 10 years younger as sole beneficiary), delaying the first RMD to April 1, the still-working
// exception, inherited accounts.
import { RMD_START_AGES, UNIFORM_LIFETIME_TABLE } from '../data/rmdTable.js';

export function rmdStartAge(birthYear) {
  return RMD_START_AGES.find((r) => birthYear >= r.fromBirthYear).startAge;
}

// The divisor for an age (120 and over: the age-120 figure).
export function uniformLifetimeDivisor(age) {
  const divisor = UNIFORM_LIFETIME_TABLE[Math.min(120, Math.floor(age))];
  if (divisor === undefined) throw new Error(`No Uniform Lifetime divisor for age ${age}`);
  return divisor;
}

// age: the owner's age at their birthday in the distribution year.
// -> { required, divisor, startAge } (required 0, divisor null before the start age)
export function requiredMinimumDistribution({ priorYearEndBalance, age, birthYear }) {
  const startAge = rmdStartAge(birthYear);
  if (age < startAge) return { required: 0, divisor: null, startAge };
  const divisor = uniformLifetimeDivisor(age);
  return { required: Math.max(0, priorYearEndBalance) / divisor, divisor, startAge };
}
