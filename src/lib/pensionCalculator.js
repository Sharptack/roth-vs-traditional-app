// The pension calculator (the plan's "small calculators after phase 2"): take the lump sum, or
// the monthly benefit? Pure. The answer is an internal rate of return: the return the lump sum
// would have to earn, every year, to pay out exactly what the pension pays. Above what the client
// expects to earn -> the pension is the better deal; below -> the lump sum.
//
// Cash flows are monthly, from the day the pension would start: the lump sum given up at month 0,
// then a payment at the end of each month until the owner's end age; cost-of-living increases
// step up once a year; after the owner's end age a survivor share continues to the spouse's end
// age. Both options are taxed alike (the lump sum rolls into a Pre-tax account, the pension is
// ordinary income), so tax is left out. Not modeled: the plan's own solvency, PBGC limits.
import { parseNumber } from './formInputs.js';
import { deathRates, lifeExpectancy, survivalCurve } from './lifeTable.js';
import { LIFE_TABLE } from '../data/lifeTable.js';

// The calculator's own form fields (stored in the household under calculators.pension).
export const PENSION_DEFAULT_VALUES = {
  penLumpSum: '300000',
  penMonthly: '1800',
  penStartAge: '65',
  penCola: '0', // yearly increase in the benefit, e.g. '0.02'
  penSurvivor: '0', // share of the benefit a surviving spouse keeps: '0' | '0.5' | '0.75' | '1'
  penEndAge: '90', // the owner's age when payments stop (how long they expect to live)
  penSpouseEndAge: '90',
};

// The rate per period at which the cash flows' present value is zero (flows[0] is today). For a
// payment up front followed by receipts there is one such rate; found by bisection between -99%
// and +100% a period. null when the flows never change sign (no rate exists).
export function irr(flows) {
  const npv = (r) => flows.reduce((s, f, i) => s + f / (1 + r) ** i, 0);
  let lo = -0.99;
  let hi = 1;
  if (!(npv(lo) > 0 && npv(hi) < 0)) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Monthly payments from the start: own benefit for (endAge - startAge) years, growing by `cola`
// each year, then `survivorShare` of it until the spouse reaches spouseEndAge.
//   spouseAgeAtStart: the spouse's age when the pension starts (null = no spouse).
export function pensionPayments({ monthly, startAge, cola = 0, survivorShare = 0, endAge, spouseAgeAtStart = null, spouseEndAge }) {
  const ownMonths = Math.max(0, Math.round((endAge - startAge) * 12));
  const survivorMonths =
    survivorShare > 0 && spouseAgeAtStart !== null
      ? Math.max(0, Math.round((spouseEndAge - (spouseAgeAtStart + (endAge - startAge))) * 12))
      : 0;
  const payments = [];
  for (let k = 0; k < ownMonths + survivorMonths; k++) {
    const base = monthly * (1 + cola) ** Math.floor(k / 12);
    payments.push(k < ownMonths ? base : base * survivorShare);
  }
  return { payments, ownMonths, survivorMonths };
}

const annual = (monthlyRate) => (monthlyRate === null ? null : (1 + monthlyRate) ** 12 - 1);

// -> { irr (a year), totalPayments, breakEvenAge (when payments received add up to the lump sum,
//      no interest; null if never), presentValueAt(rate a year), byEndAge: [{ endAge, irr }] }
//   expected: the same on life expectancy (pensionOnLifeTable, SSA's period life table, by each
//     person's sex: inputs.sex, inputs.spouseSex; '' = the average of the two). With it, the
//     byEndAge rows run a survivor share to the spouse's life expectancy.
export function pensionResult(inputs) {
  const { lumpSum, startAge } = inputs;
  const expected = pensionOnLifeTable(inputs, deathRates(LIFE_TABLE, inputs.sex ?? ''), deathRates(LIFE_TABLE, inputs.spouseSex ?? ''));
  const spouseEndAge =
    expected.spouseLifeExpectancy !== null ? inputs.spouseAgeAtStart + expected.spouseLifeExpectancy : inputs.spouseEndAge;
  const { payments, ownMonths, survivorMonths } = pensionPayments(inputs);
  const rate = annual(irr([-lumpSum, ...payments]));
  let sum = 0;
  const breakEvenMonth = payments.findIndex((p) => (sum += p) >= lumpSum - 1e-9);
  const presentValueAt = (yearlyRate) => {
    const m = (1 + yearlyRate) ** (1 / 12) - 1;
    return payments.reduce((s, p, i) => s + p / (1 + m) ** (i + 1), 0);
  };
  const byEndAge = [75, 80, 85, 90, 95, 100]
    .filter((age) => age > startAge)
    .map((endAge) => ({ endAge, irr: annual(irr([-lumpSum, ...pensionPayments({ ...inputs, endAge, spouseEndAge }).payments])) }));
  return {
    irr: rate,
    totalPayments: payments.reduce((s, p) => s + p, 0),
    months: { own: ownMonths, survivor: survivorMonths },
    breakEvenAge: breakEvenMonth < 0 ? null : startAge + (breakEvenMonth + 1) / 12,
    presentValueAt,
    byEndAge,
    expected,
  };
}

// ---- On life expectancy (round 2 phase 1) ----
//
// Each payment weighted by the chance of being alive to receive it, from the start age on (the
// owner is alive when the pension starts): the owner's monthly benefit by the owner's survival;
// the survivor share by the chance the spouse is alive and the owner isn't (lives independent).
// The expected return is the rate at which the lump sum equals those expected payments.
//   qs, spouseQs: death rates by age (lifeTable.js deathRates); spouseAgeAtStart null = no spouse.
// -> { irr (a year), expectedPayments (total), lifeExpectancy (owner, years from the start),
//      spouseLifeExpectancy, flows (expected monthly payments), presentValueAt(rate a year) }
export function pensionOnLifeTable({ lumpSum, monthly, startAge, cola = 0, survivorShare = 0, spouseAgeAtStart = null }, qs, spouseQs) {
  const own = survivalCurve(qs, startAge);
  const spouse = spouseAgeAtStart !== null && survivorShare > 0 ? survivalCurve(spouseQs, spouseAgeAtStart) : null;
  const months = Math.max(own.length, spouse ? spouse.length : 0) - 1;
  const at = (curve, k) => (k < curve.length ? curve[k] : 0);
  const flows = [];
  for (let k = 1; k <= months; k++) {
    const base = monthly * (1 + cola) ** Math.floor((k - 1) / 12);
    const ownAlive = at(own, k);
    const survivor = spouse ? survivorShare * at(spouse, k) * (1 - ownAlive) : 0;
    flows.push(base * (ownAlive + survivor));
  }
  const rate = annual(irr([-lumpSum, ...flows]));
  const presentValueAt = (yearlyRate) => {
    const m = (1 + yearlyRate) ** (1 / 12) - 1;
    return flows.reduce((sum, f, i) => sum + f / (1 + m) ** (i + 1), 0);
  };
  return {
    irr: rate,
    expectedPayments: flows.reduce((a, f) => a + f, 0),
    lifeExpectancy: lifeExpectancy(qs, startAge),
    spouseLifeExpectancy: spouse ? lifeExpectancy(spouseQs, spouseAgeAtStart) : null,
    flows,
    presentValueAt,
  };
}

// The calculator's inputs from the household (ages from the shared inputs; the rest its own).
// The pension's owner is "you" here, the other person the spouse (calculators.pension.owner;
// person 1 when not given).
export function householdToPensionInputs(household) {
  const own = household.calculators?.pension ?? {};
  const owner = household.people.find((p) => p.id === own.owner) ?? household.people[0];
  const p1 = owner;
  const p2 = household.people.find((p) => p !== owner);
  const startAge = own.startAge;
  const yearsUntilStart = startAge - (household.year - p1.birthYear);
  return {
    lumpSum: own.lumpSum,
    monthly: own.monthly,
    startAge,
    cola: own.cola,
    survivorShare: p2 ? own.survivorShare : 0,
    endAge: own.endAge,
    spouseAgeAtStart: p2 ? household.year - p2.birthYear + yearsUntilStart : null,
    spouseEndAge: own.spouseEndAge,
    sex: p1.sex ?? '',
    spouseSex: p2 ? (p2.sex ?? '') : '',
  };
}

// Form strings -> the household's calculators.pension object.
export function pensionFromValues(values) {
  const num = (text, fallback) => {
    const n = parseNumber(text);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    lumpSum: num(values.penLumpSum, 0),
    monthly: num(values.penMonthly, 0),
    startAge: num(values.penStartAge, 65),
    cola: Number(values.penCola ?? 0),
    survivorShare: Number(values.penSurvivor ?? 0),
    endAge: num(values.penEndAge, 90),
    spouseEndAge: num(values.penSpouseEndAge, 90),
  };
}
