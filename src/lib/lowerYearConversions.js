// Roth vs. Pre-tax with conversions in the lower years (roadmap phase 7, decided 2026-10-15). Pure.
//
// The rule: in every retired year whose bracket is below a chosen rate (today's rate on
// contributions by default), convert Pre-tax money to Roth until ordinary taxable income reaches the
// top of the bracket under that rate (22% chosen: the top of 12%), so every converted dollar is taxed
// below it. Each person converts once they have retired, RMD years included (on top of the RMD).
// Optionally each year's conversion also stops at the next IRMAA tier (for the premium two years on,
// when anyone will be on Medicare by then).
//
// The rule wraps the plan's withdrawal strategy: the spending withdrawals are the strategy's own, and
// the rule's conversions come on top of any the strategy or the planner makes (their tax lines count
// when sizing it). The conversions' tax is the engine's to pay, as for every conversion.
//
// The comparison: the lifetime Roth vs. Pre-tax comparison (lifetimeComparison.js) twice, without
// and with the rule, so four runs (contributing Roth or Pre-tax, each with and without the
// conversions; the Roth side's existing Pre-tax money converts too).
import { compareLifetime } from './lifetimeComparison.js';
import { getBrackets } from './taxCalculations.js';
import { irmaaTier, medicareEnrollees } from './irmaa.js';
import { proportionalStrategy } from './projection.js';
import { IRMAA_LOOKBACK_YEARS } from '../data/irmaa.js';

const EPS = 1e-9;

// The bracket a year fills to: the highest one whose rate (with any retirement rate shift) is below
// `rate`. null when none is (nothing converts).
export function fillBracket(filingStatus, taxYear, rate, rateShift = 0) {
  const below = getBrackets(filingStatus, taxYear).filter((b) => b.rate + rateShift < rate - EPS);
  if (below.length === 0) return null;
  const b = below[below.length - 1];
  return { rate: b.rate + rateShift, top: b.upTo };
}

// The strategy: `base` (the plan's) plus the rule's conversions.
export function convertBelowRate(base, { rate, irmaaCap = false }) {
  const strategy = (args) => {
    const { accounts, rmdByAccount, evaluate, filingStatus, taxYear, rateShift = 0, household, ages, working, alive } = args;
    const planned = base(args);
    const fill = fillBracket(filingStatus, taxYear, rate, rateShift);
    if (!fill) return planned;
    // The engine's rules on the withdrawals (at least the RMD, at most the balance), so the sizing
    // below sees the income the year will have.
    const withdrawals = {};
    for (const a of accounts) {
      const w = Math.max(planned.withdrawals?.[a.id] ?? 0, rmdByAccount[a.id] ?? 0);
      if (w > 0) withdrawals[a.id] = Math.min(a.balance, w);
    }
    const baseConversions = planned.conversions ?? [];
    const eligible = household.people.filter((p, i) => alive?.[i] !== false && !working[i]).map((p) => p.id);
    const sources = accounts
      .filter((a) => a.type === 'pretax' && eligible.includes(a.owner))
      .map((a) => ({
        id: a.id,
        left: a.balance - (withdrawals[a.id] ?? 0) - baseConversions.filter((c) => c.from === a.id).reduce((s, c) => s + c.amount, 0),
      }))
      .filter((a) => a.left > 0);
    if (sources.length === 0) return { withdrawals, conversions: baseConversions };
    const asConversions = (amount) => {
      const out = [];
      let left = amount;
      for (const a of sources) {
        const take = Math.min(left, a.left);
        if (take > 0) out.push({ from: a.id, amount: take });
        left -= take;
        if (left <= 0) break;
      }
      return [...baseConversions, ...out];
    };
    const lines = (amount) => evaluate(withdrawals, asConversions(amount)).tax.lines;
    // The IRMAA edge: the most MAGI can be and keep the tier the year is in without the rule.
    let magiLimit = Infinity;
    if (irmaaCap && household.assumptions?.medicareIrmaa) {
      const later = ages.filter((_, i) => alive?.[i] !== false).map((a) => a + IRMAA_LOOKBACK_YEARS);
      if (medicareEnrollees(later) > 0) {
        const m0 = lines(0).magi;
        const t = irmaaTier(m0, filingStatus, taxYear);
        if (t.roomToNext !== null) magiLimit = m0 + t.roomToNext;
      }
    }
    const fits = (amount) => {
      const l = lines(amount);
      return l.ordinaryTaxableIncome <= fill.top + EPS && l.magi <= magiLimit + EPS;
    };
    // Bisection: the largest conversion that fits (it can pull Social Security into tax with it).
    let amount = 0;
    const most = sources.reduce((s, a) => s + a.left, 0);
    if (fits(0)) {
      if (fits(most)) amount = most;
      else {
        let lo = 0;
        let hi = most;
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        amount = lo;
      }
    }
    return { withdrawals, conversions: asConversions(amount) };
  };
  strategy.label = `Convert to Roth in the years below ${Math.round(rate * 100)}%`;
  return strategy;
}

// Each year the rule converts in, from a run with the rule and the same run without it.
// -> [{ year, ages, converted, bracketBefore, irmaaRoom }]
//   bracketBefore: the year's bracket without the rule.
//   irmaaRoom: how far MAGI (with the conversion) is under the next IRMAA tier, for the premium two
//   years on; null when IRMAA is off, no one will be on Medicare by then, or at the top tier.
export function conversionYears(household, withRows, withoutRows) {
  return withRows
    .map((r, i) => {
      const before = withoutRows[i];
      const converted = r.conversions - (before?.conversions ?? 0);
      if (!(converted > 0.5)) return null;
      const later = r.ages.filter((_, j) => r.alive?.[j] !== false).map((a) => a + IRMAA_LOOKBACK_YEARS);
      const counts = household.assumptions?.medicareIrmaa && medicareEnrollees(later) > 0;
      return {
        year: r.year,
        ages: r.ages,
        converted,
        bracketBefore: before?.ordinaryBracketRate ?? null,
        irmaaRoom: counts ? irmaaTier(r.magi, r.filingStatus, household.year).roomToNext : null,
      };
    })
    .filter(Boolean);
}

// The comparison. options: compareLifetime's (endAge, heirTaxRate, charityShare, strategy) plus
// rate (default: today's rate on contributions) and irmaaCap. `without` (optional): the comparison
// without the rule, already run with the same options (the page has it).
// -> { rate, fill, without, with, roth: years, pretax: years, converted: { roth, pretax } }
export function compareWithConversions(household, compareResult, { rate, irmaaCap = false, without, ...options } = {}) {
  const chosen = rate ?? compareResult.rates.contributionRate ?? compareResult.rates.marginalNow;
  const base = options.strategy ?? proportionalStrategy;
  const plain = without ?? compareLifetime(household, compareResult, options);
  const converting = compareLifetime(household, compareResult, { ...options, strategy: convertBelowRate(base, { rate: chosen, irmaaCap }) });
  const shift = household.assumptions?.retirementRateShift ?? 0;
  const roth = conversionYears(household, converting.roth.rows, plain.roth.rows);
  const pretax = conversionYears(household, converting.pretax.rows, plain.pretax.rows);
  const total = (ys) => ys.reduce((s, y) => s + y.converted, 0);
  return {
    rate: chosen,
    fill: fillBracket(household.filingStatus ?? 'single', household.year, chosen, shift),
    without: plain,
    with: converting,
    roth,
    pretax,
    converted: { roth: total(roth), pretax: total(pretax) },
  };
}
