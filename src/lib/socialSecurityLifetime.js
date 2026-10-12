// Lifetime Social Security by claiming age (round 2 phase 5): a household's benefits year by year to
// the plan-to ages, the break-even age between two claiming ages, and the couple's grid. Gross
// benefits (before tax) in today's dollars. Pure. Rules: socialSecurityClaiming.js.
//
// Timing, as the projection (decided 2026-10-10): a person is alive through the year they reach
// their plan-to age; with two people, the first to reach it dies that year and the survivor years
// start the next (both in the same year: no survivor years). Benefits are whole years: a claim at
// 67 pays the year the person is 67 and every year after.
//
// Each person's three streams: own (from their claiming age), spousal (the top-up, while both are
// alive, from the later of the two filings) and survivor (after the first death: the excess of the
// survivor benefit over their own, from the later of the year after the death and their own
// claiming age, never before 60).
//
// people: [{ birthYear, planToAge, pia } or { birthYear, planToAge, receiving }]
//   pia = the monthly benefit at full retirement age (a PIA of 0 = no benefit of their own);
//   receiving = the monthly check of someone already receiving it: paid as is from this year, and
//   with no PIA known it gives the spouse no spousal top-up (as the projection does); as a
//   survivor benefit it stands in for the original benefit.
// claimAges: one per person, whole years (null for someone receiving).
import { CLAIM_AGES, ownFactor, spousalTopUpMonthly, survivorAdjustmentFactor, survivorBenefitMonthly } from './socialSecurityClaiming.js';

const LAST_AGE = 119; // the life table's last age

const isReceiving = (p) => Number.isFinite(p.receiving);

// Each person's monthly own benefit and the age it starts.
function ownOf(p, claimAge, ageNow) {
  if (isReceiving(p)) return { monthly: p.receiving, startAge: ageNow };
  return { monthly: p.pia * ownFactor(claimAge, p.birthYear), startAge: claimAge };
}

export function lifetimeBenefits({ year, people, claimAges, discountRate = 0 }) {
  const ages0 = people.map((p) => year - p.birthYear);
  const own = people.map((p, i) => ownOf(p, claimAges[i], ages0[i]));
  const couple = people.length === 2;
  const spousal = people.map((p, i) => {
    const other = couple ? people[1 - i] : null;
    if (!other || isReceiving(p) || isReceiving(other)) return { monthly: 0, startAge: Infinity };
    return spousalTopUpMonthly({
      pia: p.pia,
      otherPia: other.pia,
      birthYear: p.birthYear,
      claimAge: claimAges[i],
      otherClaimAgeInOwnYears: claimAges[1 - i] + (other.birthYear - p.birthYear),
    });
  });
  // The year each person dies (the year they reach their plan-to age); the first death, if one.
  const deathYear = people.map((p) => p.birthYear + p.planToAge);
  const firstDeath = couple && deathYear[0] !== deathYear[1] ? (deathYear[0] < deathYear[1] ? 0 : 1) : -1;
  let survivor = { monthly: 0, startYear: Infinity };
  if (firstDeath >= 0) {
    const d = firstDeath;
    const s = 1 - d;
    const dp = people[d];
    const sp = people[s];
    const startAge = Math.max(deathYear[d] + 1 - sp.birthYear, own[s].startAge, 60);
    const monthly = isReceiving(dp)
      ? dp.receiving * survivorAdjustmentFactor(startAge, sp.birthYear)
      : survivorBenefitMonthly({
          deceasedPia: dp.pia,
          deceasedBirthYear: dp.birthYear,
          deceasedClaimAge: claimAges[d],
          deathAge: dp.planToAge,
          survivorBirthYear: sp.birthYear,
          survivorStartAge: startAge,
        });
    survivor = { monthly: Math.max(0, monthly - own[s].monthly), startYear: sp.birthYear + startAge };
  }

  const totals = people.map(() => ({ own: 0, spousal: 0, survivor: 0 }));
  const years = [];
  const lastYear = Math.max(...deathYear);
  for (let y = year; y <= lastYear; y++) {
    const t = y - year;
    const ages = people.map((p) => y - p.birthYear);
    const streams = people.map((p, i) => {
      if (y > deathYear[i]) return { own: 0, spousal: 0, survivor: 0 };
      const bothAlive = people.every((_, j) => y <= deathYear[j]);
      return {
        own: ages[i] >= own[i].startAge ? own[i].monthly * 12 : 0,
        spousal: bothAlive && ages[i] >= spousal[i].startAge ? spousal[i].monthly * 12 : 0,
        survivor: firstDeath === 1 - i && y >= survivor.startYear ? survivor.monthly * 12 : 0,
      };
    });
    streams.forEach((s, i) => {
      totals[i].own += s.own;
      totals[i].spousal += s.spousal;
      totals[i].survivor += s.survivor;
    });
    const total = streams.reduce((acc, s) => acc + s.own + s.spousal + s.survivor, 0);
    years.push({ year: y, ages, streams, total, discounted: total / (1 + discountRate) ** t });
  }
  return {
    people: totals,
    // Each person's monthly benefits in this strategy (the survivor's: the excess over their own).
    monthly: people.map((_, i) => ({
      own: own[i].monthly,
      spousal: totals[i].spousal > 0 ? spousal[i].monthly : 0,
      survivor: firstDeath === 1 - i ? survivor.monthly : 0,
    })),
    years,
    firstDeath,
    total: years.reduce((acc, r) => acc + r.total, 0),
    discountedTotal: years.reduce((acc, r) => acc + r.discounted, 0),
  };
}

// The exact age at which claiming at `lateAge` has paid as much as claiming at `earlyAge` (own
// benefit, alive throughout), each year discounted at `discountRate`; linear within the year it
// crosses. null if it never does by the table's last age.
export function breakEvenAge({ pia, birthYear, earlyAge, lateAge, discountRate = 0 }) {
  const early = pia * ownFactor(earlyAge, birthYear) * 12;
  const late = pia * ownFactor(lateAge, birthYear) * 12;
  let diff = 0; // late minus early, received by the start of age a
  for (let a = earlyAge; a <= LAST_AGE; a++) {
    const v = 1 / (1 + discountRate) ** (a - earlyAge);
    const step = ((a >= lateAge ? late : 0) - early) * v;
    if (diff < 0 && diff + step >= 0) return a + 1 - (diff + step) / step;
    diff += step;
  }
  return null;
}

// The claiming ages still open to a person: from their age now (62 at the earliest) to 70; [null]
// for someone already receiving.
export function openClaimAges(p, year) {
  if (isReceiving(p)) return [null];
  const now = year - p.birthYear;
  return CLAIM_AGES.filter((a) => a >= Math.min(70, now));
}

// Every pair of open claiming ages (one person: each age), with the best cell (the largest total at
// the discount rate).
export function claimingGrid({ year, people, discountRate = 0 }) {
  const ages = people.map((p) => openClaimAges(p, year));
  const pairs = people.length === 2 ? ages[0].flatMap((a) => ages[1].map((b) => [a, b])) : ages[0].map((a) => [a]);
  const cells = pairs.map((claimAges) => ({ claimAges, ...lifetimeBenefits({ year, people, claimAges, discountRate }) }));
  const best = cells.reduce((b, c) => (c.discountedTotal > b.discountedTotal ? c : b));
  return { ages, cells, best };
}

// A strategy (a lifetimeBenefits result) year by year, for its table (before phase 6, asked
// 2026-10-12): each year's streams and total, and the running total, not discounted. Today's
// dollars, or with futureDollars each year grown at the inflation input (benefits rise with prices).
// -> [{ year, ages, streams: [{ own, spousal, survivor }], total, cumulative }]
export function strategyRows(result, { year, inflationRate = 0, futureDollars = false }) {
  let cumulative = 0;
  return result.years.map((y) => {
    const g = futureDollars ? (1 + inflationRate) ** (y.year - year) : 1;
    const streams = y.streams.map((s) => ({ own: s.own * g, spousal: s.spousal * g, survivor: s.survivor * g }));
    cumulative += y.total * g;
    return { year: y.year, ages: y.ages, streams, total: y.total * g, cumulative };
  });
}

// The running total (today's dollars, at the result's discount rate) by the first person's age:
// 0 at their age now, then what has been received by the end of each year (by the next age).
// -> [{ x, y }]
export function cumulativeCurve(result) {
  const pts = [{ x: result.years[0].ages[0], y: 0 }];
  let sum = 0;
  for (const y of result.years) {
    sum += y.discounted;
    pts.push({ x: y.ages[0] + 1, y: sum });
  }
  return pts;
}

// Where two strategies' running totals (as cumulativeCurve) cross, by the first person's exact age;
// linear within the year it happens, as breakEvenAge. leader: the one ahead after the crossing.
// Both results are for the same people (the same years). -> [{ age, leader: 'a' | 'b' }]
export function benefitCrossings(a, b) {
  const out = [];
  let diff = 0; // b minus a, received by the start of the year
  a.years.forEach((ya, k) => {
    const step = b.years[k].discounted - ya.discounted;
    const next = diff + step;
    if ((diff < 0 && next >= 0) || (diff > 0 && next <= 0)) out.push({ age: ya.ages[0] - diff / step, leader: diff < 0 ? 'b' : 'a' });
    diff = next;
  });
  return out;
}
