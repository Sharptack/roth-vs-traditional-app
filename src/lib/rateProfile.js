// The tax page's two buckets (round 2 phase 1; design in the plan doc's decision tables): for every
// level of total income, from $0 up through the next two brackets above today, the tax bracket
// (the marginal rate bucket) and the real federal income tax on the next dollar (the effective
// rate bucket), worked out by the tax engine. Pure.
//
// The path up the income scale:
//   - from $0 to today's income: the household's income as it is, every source scaled together
//     (so the bottom of the buckets is the household's own mix: wages, Social Security, gains...);
//   - above today: more of one kind of income, `source`: 'ordinaryIncome' (the default: a Pre-tax
//     withdrawal, a pension, a conversion; ordinary rates, no payroll tax) or 'preferentialIncome'
//     (long-term gains: a house sale, a taxable account sold off).
// "Through the next two brackets": ordinary brackets on ordinary taxable income for ordinary
// income; the capital-gains brackets on taxable income for gains.
//
// IRMAA (option irmaa, with ages): the Medicare surcharge two years on is a cliff, not a rate, so
// it is reported separately, as the jump in the yearly surcharge within each step.
import { CAPITAL_GAINS_BRACKETS } from '../data/capitalGainsBrackets.js';
import { calculateYearTax, calculateYearTaxTotals } from './yearTax.js';
import { getBrackets } from './taxCalculations.js';
import { getYearData } from './yearLookup.js';
import { irmaaFromThisYear } from './irmaa.js';

export const PROFILE_SOURCES = ['ordinaryIncome', 'preferentialIncome'];
const DEFAULT_STEPS = 200;

// params with every income source times t. Pre-tax deferrals stay as they are (a set amount),
// but never more than the pay they come out of.
function scaled(params, t) {
  const income = Object.fromEntries(Object.entries(params.income ?? {}).map(([k, v]) => [k, (v ?? 0) * t]));
  const people = (params.people ?? []).map((p) => ({ ...p, wages: (p.wages ?? 0) * t, selfEmploymentIncome: (p.selfEmploymentIncome ?? 0) * t }));
  const earned = people.reduce((a, p) => a + p.wages + p.selfEmploymentIncome, 0);
  return { ...params, income, people, pretaxDeferrals: Math.min(params.pretaxDeferrals ?? 0, earned) };
}

const plus = (params, source, x) => ({ ...params, income: { ...params.income, [source]: (params.income?.[source] ?? 0) + x } });

// The thresholds the source climbs through, and where it stands on them. sheltered: still under
// the deductions (no taxable income yet), which counts as a bracket of its own.
function ladder(params, r, source) {
  if (source === 'preferentialIncome') {
    const cg = getYearData(CAPITAL_GAINS_BRACKETS, params.year).data[params.filingStatus];
    return { tops: cg.map((b) => b.upTo), at: (x) => x.lines.taxableIncome, now: r.lines.taxableIncome, sheltered: r.lines.agi <= r.lines.deductions };
  }
  const brackets = getBrackets(params.filingStatus, params.year);
  return { tops: brackets.map((b) => b.upTo), at: (x) => x.lines.ordinaryTaxableIncome, now: r.lines.ordinaryTaxableIncome, sheltered: r.lines.ordinaryGross <= r.lines.deductions };
}

// How much more of `source` takes the household through the next two brackets above today's (or,
// past the top bracket, half as much again as today, at least $100,000). Under the deductions,
// the next two are the first two brackets.
export function extraThroughTwoBrackets(params, source = 'ordinaryIncome') {
  const r = calculateYearTaxTotals(params);
  const { tops, at, now, sheltered } = ladder(params, r, source);
  const i = tops.findIndex((top) => now < top);
  const target = tops[Math.min(sheltered ? 1 : i + 2, tops.length - 1)];
  if (!Number.isFinite(target)) return Math.max(100000, r.lines.grossIncome * 0.5);
  // Taxable income only grows with more income: double, then halve, in whole dollars, to the
  // smallest amount that reaches the target.
  const reaches = (x) => at(calculateYearTaxTotals(plus(params, source, x))) >= target - 1e-6;
  let hi = 1000;
  while (!reaches(hi) && hi < 1e8) hi *= 2;
  let lo = 0;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (reaches(mid)) hi = mid;
    else lo = mid;
  }
  return reaches(lo) ? lo : hi;
}

// -> { today, top, step, source, rows: [{ income, bracket, sheltered, nextRate, irmaaJump }], now }
//   income: total income (gross) at the bottom of the step; bracket: the ordinary bracket rate there
//   (the capital-gains rate for source 'preferentialIncome'); sheltered: under the deductions;
//   nextRate: the extra federal income tax over the step ÷ the step (payroll tax left out);
//   irmaaJump: the rise in the yearly IRMAA surcharge over the step (0 without the irmaa option).
//   now: today's { bracket, room (to the next bracket), nextRate (the next $100 of source) }.
// options: source; steps (default 200) or step (dollars); irmaa: true with ages (each person's age);
//   extra: how far above today to go (default: through the next two brackets).
export function rateProfile(params, { source = 'ordinaryIncome', steps = DEFAULT_STEPS, step: fixedStep, irmaa = false, ages = [], extra } = {}) {
  const base = calculateYearTax(params);
  const today = base.lines.grossIncome;
  const top = today + (extra ?? extraThroughTwoBrackets(params, source));
  const step = fixedStep ?? top / steps;
  const paramsAt = (y) => (y <= today ? (today > 0 ? scaled(params, y / today) : params) : plus(params, source, y - today));
  const cgRate = (r) => {
    const cg = getYearData(CAPITAL_GAINS_BRACKETS, params.year).data[params.filingStatus];
    return cg.find((b) => r.lines.taxableIncome < b.upTo).rate;
  };
  const point = (y) => {
    const r = calculateYearTaxTotals(paramsAt(y));
    const surcharge = irmaa ? irmaaFromThisYear({ magi: r.lines.magi, filingStatus: params.filingStatus, year: params.year, ages }).total : 0;
    return { r, surcharge };
  };
  const rows = [];
  let here = point(0);
  for (let y = 0; y < top - 1e-6; y += step) {
    const next = point(y + step);
    const sheltered = here.r.lines.ordinaryGross <= here.r.lines.deductions;
    rows.push({
      income: y,
      bracket: source === 'preferentialIncome' ? cgRate(here.r) : here.r.ordinaryBracketRate,
      sheltered,
      nextRate: (next.r.incomeTax - here.r.incomeTax) / step,
      irmaaJump: next.surcharge - here.surcharge,
    });
    here = next;
  }
  const room = source === 'preferentialIncome' ? base.bracketRoom.capitalGains : base.bracketRoom.ordinary;
  const probe = calculateYearTaxTotals(plus(params, source, 100));
  return {
    today,
    top,
    step,
    source,
    rows,
    now: { bracket: room.rate, room: room.room, nextBracket: room.nextRate, nextRate: (probe.incomeTax - base.incomeTax) / 100 },
  };
}
