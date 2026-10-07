// Medicare IRMAA: the Part B and Part D premium surcharges set by modified AGI two years earlier
// (data/irmaa.js). Pure.
//
// Only the SURCHARGE is a cost of income: the standard premium is paid whatever the income, so it
// belongs in spending. The tiers are cliffs: one dollar over a threshold costs the whole step, for
// every person on Medicare.
//
// In the projection (today's dollars) the thresholds stay fixed, since the law raises them with
// prices; the top $500,000 / $750,000 threshold is fixed in dollars until 2028 and the premiums
// have tended to rise faster than prices, both left out. MAGI here = AGI (no tax-exempt interest
// is modeled).
import { IRMAA, IRMAA_LOOKBACK_YEARS, MEDICARE_AGE } from '../data/irmaa.js';
import { getYearData } from './yearLookup.js';

// -> { tier (0 = no surcharge), partB, partD (monthly, per person), monthly, annual (per person),
//      nextThreshold (MAGI where the next tier starts; null at the top), roomToNext (the most MAGI
//      can rise and stay in this tier; null at the top), dataYear }
export function irmaaTier(magi, filingStatus, year) {
  const { year: dataYear, data } = getYearData(IRMAA, year);
  const m = Math.max(0, magi || 0);
  let tier = 0;
  data.tiers.forEach((t, i) => {
    if (t.over ? m > t.over[filingStatus] : m >= t.atLeast[filingStatus]) tier = i + 1;
  });
  const current = tier > 0 ? data.tiers[tier - 1] : { partB: 0, partD: 0 };
  const next = data.tiers[tier];
  // Above `over`: MAGI equal to it still stays below. At `atLeast`: one cent short stays below.
  const nextThreshold = next ? (next.over ?? next.atLeast)[filingStatus] : null;
  const roomToNext = next ? Math.max(0, next.over ? nextThreshold - m : nextThreshold - m - 0.01) : null;
  const monthly = current.partB + current.partD;
  return { tier, partB: current.partB, partD: current.partD, monthly, annual: monthly * 12, nextThreshold, roomToNext, dataYear };
}

// How many of these ages are on Medicare (65 or older; assumed enrolled in Parts B and D).
export function medicareEnrollees(ages) {
  return ages.filter((a) => a >= MEDICARE_AGE).length;
}

// The household's yearly surcharge: the per-person amount for each person on Medicare.
// -> irmaaTier's fields plus { enrolled, total }
export function irmaaCost({ magi, filingStatus, year, enrolled }) {
  const t = irmaaTier(magi, filingStatus, year);
  return { ...t, enrolled, total: t.annual * enrolled };
}

// The premium that THIS year's tax return sets: two years on, for whoever is 65 by then, at this
// year's amounts (today's dollars). ages: each person's age this year.
// -> irmaaCost's fields plus { magi, premiumYear }
export function irmaaFromThisYear({ magi, filingStatus, year, ages }) {
  const enrolled = medicareEnrollees(ages.map((a) => a + IRMAA_LOOKBACK_YEARS));
  return { magi, premiumYear: year + IRMAA_LOOKBACK_YEARS, ...irmaaCost({ magi, filingStatus, year, enrolled }) };
}
