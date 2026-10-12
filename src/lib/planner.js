// The year-by-year planner (roadmap phase 6, decided 2026-10-12). Pure. The changes themselves are
// household.plannerChanges (runProjection's yearChanges); this module describes and weighs them.
//
// Every figure comes from whole projections (runProjection with the changes as yearChanges), run the
// way the projection page runs the plan (its strategy and end age):
//   cost          the year's federal income tax with the conversion minus without it (so all it
//                 drags along counts: Social Security made taxable, gains pushed up, NIIT, the senior
//                 deduction), plus the Medicare IRMAA it adds two years later
//   lifetime value  sustainable spending, lifetime tax (income tax + IRMAA) and after-tax wealth for
//                 heirs, with the change minus without it (every other change kept); for all the
//                 changes together, against the plan with none
//   room          what is left in the year's ordinary bracket, and before the next IRMAA tier (MAGI
//                 this year sets the premium two years on, for whoever is 65 by then)
//   fill          the conversion (from one owner) that brings the year to each of those edges, found
//                 by bisection on the year itself, since a conversion can pull Social Security into
//                 tax with it
import { formatCurrency } from './format.js';
import { runProjection } from './projection.js';
import { strategyById } from './strategies.js';
import { heirsOf, legacyOption, sustainableSpending } from './projectionSummary.js';
import { conversionTotals } from './conversionLifetime.js';
import { getBrackets } from './taxCalculations.js';
import { irmaaTier, medicareEnrollees } from './irmaa.js';
import { IRMAA_LOOKBACK_YEARS } from '../data/irmaa.js';

// The projection page's way of running the plan.
export function planRunOptions(household) {
  const own = household.calculators?.projection ?? {};
  return { endAge: own.endAge, strategy: strategyById(own.strategy) };
}

const changesOf = (household) => household.plannerChanges ?? [];
const sameChange = (a, b) => (a.id !== undefined && a.id === b.id) || a === b;

// The plan run with these changes (the rows, to the end, or only to `untilYear`).
function runWith(household, need, yearChanges, untilYear) {
  const options = planRunOptions(household);
  const endAge = untilYear !== undefined ? Math.min(untilYear - household.people[0].birthYear, options.endAge ?? Infinity) : options.endAge;
  return runProjection(household, { ...options, endAge, need, yearChanges }).rows;
}

// The three lifetime figures for the plan with these changes.
function lifetimeFigures(household, need, yearChanges) {
  const options = { ...planRunOptions(household), yearChanges };
  const rows = runProjection(household, { ...options, need }).rows;
  const { heirTaxRate, charityShare } = heirsOf(household);
  const t = conversionTotals(rows, heirTaxRate, charityShare);
  return {
    sustainable: sustainableSpending(household, { ...options, legacy: legacyOption(household) }),
    lifetimeTax: t.lifetimeTax,
    afterTaxForHeirs: t.legacyAfterTax,
  };
}

const compare = (withF, withoutF) => ({
  with: withF,
  without: withoutF,
  difference: Object.fromEntries(Object.keys(withF).map((k) => [k, withF[k] - withoutF[k]])),
});

// A change's lifetime value: the plan with it against the plan without it (every other change kept).
// The change may be in the plan already (matched by id) or new.
export function changeValue(household, need, change) {
  const others = changesOf(household).filter((c) => !sameChange(c, change));
  return compare(lifetimeFigures(household, need, [...others, change]), lifetimeFigures(household, need, others));
}

// All the planner's changes together against the plan with none (the base plan).
export function allChangesValue(household, need) {
  return compare(lifetimeFigures(household, need, changesOf(household)), lifetimeFigures(household, need, []));
}

// A conversion's cost in its year (see the header), against the plan without it.
// -> { converted (after the engine's limits), tax, irmaaLater, total, effectiveRate, heldBack, fromTaxable }
export function conversionCost(household, need, change) {
  const others = changesOf(household).filter((c) => !sameChange(c, change));
  const until = change.year + IRMAA_LOOKBACK_YEARS;
  const without = runWith(household, need, others, until);
  const withIt = runWith(household, need, [...others, change], until);
  const at = (rows, y) => rows.find((r) => r.year === y);
  const a = at(withIt, change.year);
  const b = at(without, change.year);
  if (!a || !b) return null;
  const later = (rows) => at(rows, until)?.irmaa ?? 0;
  const converted = a.conversions - b.conversions;
  const tax = a.incomeTax - b.incomeTax;
  const irmaaLater = later(withIt) - later(without);
  return {
    converted,
    tax,
    irmaaLater,
    total: tax + irmaaLater,
    effectiveRate: converted > 0 ? tax / converted : null,
    heldBack: a.conversionTaxWithheld - b.conversionTaxWithheld,
    fromTaxable: a.withdrawals.taxable - b.withdrawals.taxable,
  };
}

// The largest conversion (from `owner`, at most `max`) that keeps measure(row) at or under `limit`
// in that year; bisection (the measure rises with the conversion).
function conversionUpTo(household, need, year, owner, measure, limit, max) {
  const changes = changesOf(household);
  const valueAt = (x) => measure(runWith(household, need, [...changes, { year, kind: 'convert', owner, amount: x }], year).find((r) => r.year === year));
  if (!(max > 0) || valueAt(0) > limit) return 0;
  if (valueAt(max) <= limit) return max;
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (valueAt(mid) <= limit) lo = mid;
    else hi = mid;
  }
  return lo;
}

// The selected year: its row in the plan, the bracket and the room left in it, the IRMAA room (null
// when IRMAA is off or no one will be on Medicare when this year's MAGI counts), the most `owner`
// can convert, and the conversions that fill the bracket, the next bracket and the IRMAA room.
// owner: whose Pre-tax money converts (default the first person; the survivor's after a death).
export function plannerYear(household, need, year, { owner = household.people[0].id } = {}) {
  const rows = runWith(household, need, changesOf(household));
  const row = rows.find((r) => r.year === year);
  if (!row) return null;
  const i = household.people.findIndex((p) => p.id === owner);
  const holder = row.alive[i] === false ? household.people[1 - i].id : owner;
  const maxConversion = row.detail.accounts
    .filter((a) => a.type === 'pretax' && a.owner === holder)
    .reduce((s, a) => s + Math.max(0, a.start - a.withdrawn - a.convertedOut), 0);

  const brackets = getBrackets(row.filingStatus, household.year);
  const k = brackets.findIndex((b) => Math.abs(b.rate + (row.detail.taxParams.rateShift ?? 0) - row.ordinaryBracketRate) < 1e-9);
  const current = brackets[Math.max(0, k)];
  const next = brackets[Math.max(0, k) + 1];
  const ordinary = (r) => r.detail.tax.lines.ordinaryTaxableIncome;
  const bracket = {
    rate: row.ordinaryBracketRate,
    top: current.upTo,
    room: row.bracketRoom,
    nextRate: next ? next.rate + (row.detail.taxParams.rateShift ?? 0) : null,
    nextTop: next ? next.upTo : null,
  };

  const premiumRow = rows.find((r) => r.year === year + IRMAA_LOOKBACK_YEARS);
  // who is on Medicare in the premium year (past the plan's end: today's people two years older)
  const premiumAges = premiumRow
    ? premiumRow.ages.filter((_, j) => premiumRow.alive[j] !== false)
    : row.ages.filter((_, j) => row.alive[j] !== false).map((a) => a + IRMAA_LOOKBACK_YEARS);
  const enrolled = household.assumptions.medicareIrmaa ? medicareEnrollees(premiumAges) : 0;
  const premiumStatus = premiumRow?.filingStatus ?? row.filingStatus;
  const t = enrolled > 0 ? irmaaTier(row.magi, premiumStatus, household.year) : null;
  const irmaa = t && {
    premiumYear: year + IRMAA_LOOKBACK_YEARS,
    tier: t.tier,
    nextThreshold: t.nextThreshold,
    roomToNext: t.roomToNext,
    enrolled,
  };

  const fillTo = (measure, limit) => (Number.isFinite(limit) ? conversionUpTo(household, need, year, owner, measure, limit, maxConversion) : null);
  const fill = {
    bracket: row.bracketRoom > 0.005 ? fillTo(ordinary, current.upTo) : 0,
    nextBracket: next && Number.isFinite(next.upTo) ? fillTo(ordinary, next.upTo) : null,
    // the MAGI that stays in this tier: today's plus its room (irmaaTier knows which edges count)
    irmaa: irmaa && irmaa.roomToNext !== null ? fillTo((r) => r.magi, row.magi + irmaa.roomToNext) : null,
  };
  return { year, row, owner: holder, maxConversion, bracket, irmaa, fill };
}

// The suggested conversions for a year: to the top of its bracket, to the top of the next one, and
// to just under the next IRMAA tier; each rounded down to $100, in order of size, with its cost and
// (unless withValue is false) its lifetime value. None without Pre-tax money to convert.
export function suggestions(household, need, year, owner, { withValue = true } = {}) {
  const y = plannerYear(household, need, year, { owner });
  if (!y || !(y.maxConversion >= 100)) return [];
  const pct = (r) => `${Math.round(r * 100)}%`;
  const candidates = [
    { id: 'bracket', label: `Fill the ${pct(y.bracket.rate)} bracket`, raw: y.fill.bracket },
    y.bracket.nextRate !== null && { id: 'nextBracket', label: `Fill the ${pct(y.bracket.nextRate)} bracket too`, raw: y.fill.nextBracket },
    y.irmaa && { id: 'irmaa', label: `Up to the next IRMAA tier (for ${y.irmaa.premiumYear})`, raw: y.fill.irmaa },
  ].filter(Boolean);
  const seen = new Set();
  return candidates
    .map((c) => ({ ...c, amount: Math.floor((c.raw ?? 0) / 100) * 100 }))
    .filter((c) => c.amount >= 100 && !seen.has(c.amount) && seen.add(c.amount))
    .sort((a, b) => a.amount - b.amount)
    .map(({ raw: _raw, ...c }) => {
      const change = { year, kind: 'convert', owner: y.owner, amount: c.amount };
      return { ...c, change, cost: conversionCost(household, need, change), ...(withValue && { value: changeValue(household, need, change) }) };
    });
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const yearsOf = (list) => [...new Set(list.map((c) => c.year))].sort((a, b) => a - b).join(', ');

// One line for the pages that run the plan (decided 2026-10-12: every evaluator notes the changes),
// or null with none: "The plan includes 2 Roth conversions (2030, 2031) and 1 contribution change
// (2028) from the year-by-year planner." With conversionsOnly (the Roth page's comparison, which sets
// the contributions itself) the contribution changes are said not to count there.
export function plannerChangesNote(changes = [], { conversionsOnly = false } = {}) {
  const conversions = changes.filter((c) => c.kind === 'convert');
  const contributions = changes.filter((c) => c.kind === 'contribution');
  if (conversions.length + contributions.length === 0) return null;
  const parts = [];
  if (conversions.length > 0) {
    const total = conversions.reduce((s, c) => s + c.amount, 0);
    parts.push(`${plural(conversions.length, 'Roth conversion', 'Roth conversions')} (${yearsOf(conversions)}; ${formatCurrency(total)} in all)`);
  }
  if (contributions.length > 0) parts.push(`${plural(contributions.length, 'contribution change', 'contribution changes')} (${yearsOf(contributions)})`);
  let text = `The plan includes ${parts.join(' and ')} from the year-by-year planner.`;
  if (conversionsOnly && contributions.length > 0) text += ' This comparison sets the contributions itself, so only the conversions count here.';
  return text;
}
