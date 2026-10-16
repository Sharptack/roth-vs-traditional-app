// The three-scenario Visualization page (decided 2026-10-16, roadmap "Three-scenario
// visualization"). Pure. Each grid point is a sample household (src/data/threeWayGrid.js) run through
// the Roth page's comparison with conversions in the lower years (lowerYearConversions.js): all Roth,
// all Pre-tax, and all Pre-tax with the phase 7 rule. No new financial logic: wiring, extraction and
// the winner among three.
//
// Ranked by after-tax wealth at the end age, spending the plan's need (sustainable spending can't
// show conversions: at the highest steady spending the low brackets are full, so the rule converts
// nothing), at a chosen heirs' rate; or by lifetime tax. Where the money would run out, the savings
// rate is raised until it lasts in all three; where even the highest step doesn't, they are ranked by
// sustainable spending.
import { compareRothVsTraditional } from './compare.js';
import { householdToCompareInputs } from './household.js';
import { toHouseholdV2, validateHouseholdV2 } from './householdV2.js';
import { DEFAULT_HOUSEHOLD_VALUES } from './householdValues.js';
import { lifetimeContributions, lifetimeOptions } from './lifetimeComparison.js';
import { compareWithConversions, convertBelowRate } from './lowerYearConversions.js';
import { proportionalStrategy, runProjection } from './projection.js';
import { summarizeProjection } from './projectionSummary.js';
import { THREE_WAY_HEIR_RATES, THREE_WAY_SAMPLE, THREE_WAY_SAVINGS_STEPS } from '../data/threeWayGrid.js';

export const SCENARIOS = ['roth', 'pretax', 'converting'];

// Within 0.5% of the best is "about even" (the app's rule, compare.js winnerOf).
const EVEN_TOLERANCE = 0.005;
// Less than a dollar converted over the whole plan: the rule found no room.
const NOTHING_CONVERTED = 1;

// The form values of the sample household at one grid point, saving `savingsRate` of pay.
export function threeWayValues({ age, income, balance }, sample = THREE_WAY_SAMPLE, savingsRate = sample.savingsRate) {
  const d = DEFAULT_HOUSEHOLD_VALUES;
  return {
    ...d,
    people: [{ ...d.people[0], age: String(age), retirementAge: String(sample.retirementAge), planToAge: String(sample.planToAge) }],
    incomes: [{ ...d.incomes[0], amount: String(income) }, d.incomes[1]],
    contributions: [{ ...d.contributions[0], amount: String(Math.round(income * savingsRate)) }],
    accounts: [{ ...d.accounts[0], type: 'pretax', balance: String(balance) }],
    spending: { ...d.spending, debtPayments: '0' },
  };
}

// The winner among the scenarios by their values.
//   scenarios: { [key]: number }; lowerIsBetter: true for a cost (lifetime tax)
// -> { winner: a key, or 'even' when another is within 0.5% of the best; tied: the keys within 0.5%
//      of the best (best first); lead: how far the best is from the next best, as a share of the next
//      best (0 when there is only one) }
export function threeWayWinner(scenarios, { lowerIsBetter = false } = {}) {
  const ranked = Object.entries(scenarios).sort((a, b) => (lowerIsBetter ? a[1] - b[1] : b[1] - a[1]));
  const [bestKey, best] = ranked[0];
  const within = (v) => best === 0 || Math.abs(v - best) / Math.abs(best) < EVEN_TOLERANCE;
  const tied = ranked.filter(([, v]) => within(v)).map(([k]) => k);
  const second = ranked[1]?.[1];
  const lead = second === undefined || second === 0 ? 0 : Math.abs(best - second) / Math.abs(second);
  return { winner: tied.length > 1 ? 'even' : bestKey, tied, lead };
}

// The sample household and its Roth comparison at a savings rate.
function setUp(point, year, sample, savingsRate) {
  const household = toHouseholdV2(threeWayValues(point, sample, savingsRate), year);
  const errors = validateHouseholdV2(household);
  if (errors.length > 0) throw new Error(`Invalid sample household: ${errors.join('; ')}`);
  const result = compareRothVsTraditional({ ...householdToCompareInputs(household), skipBlend: true });
  if (!result.valid) throw new Error(`Invalid sample household: ${result.errors.join('; ')}`);
  return { household, result };
}

// Whether the money lasts to the end age in all three scenarios: the same three projections
// compareWithConversions runs at the need, without its sustainable-spending searches (the slow part).
export function lastsInAll(household, result) {
  const { endAge, strategy } = lifetimeOptions(household);
  const base = strategy ?? proportionalStrategy;
  const plans = lifetimeContributions(household, result);
  const rate = result.rates.contributionRate ?? result.rates.marginalNow;
  const need = result.retirementNeed.target;
  const runs = [
    [plans.roth, base],
    [plans.pretax, base],
    [plans.pretax, convertBelowRate(base, { rate })],
  ];
  return runs.every(([contributions, s]) => runProjection(household, { endAge, contributions, strategy: s, need }).runOutYear === null);
}

// One grid point: the three scenarios' results, at the lowest savings rate (from the sample's, up the
// steps) at which the money lasts in all three.
// -> { point, savingsRate, raised, unfunded, need, rate, scenarios: { roth, pretax, converting: {
//      endingAt: { [heirs' rate]: after-tax wealth at the end age }, totalTax, sustainable, runsOut,
//      converted } }, noConversions, allRunOut }
//   unfunded: no step lasts in all three; the point is then run at the sample's own rate.
//   noConversions: the rule converted nothing at the need, so "converting" is the Pre-tax scenario
//   itself.
//   allRunOut: the money runs out before the end age in every scenario.
export function threeWayPoint(point, year, sample = THREE_WAY_SAMPLE, steps = THREE_WAY_SAVINGS_STEPS) {
  const tries = [sample.savingsRate, ...steps.filter((s) => s > sample.savingsRate)];
  let savingsRate = sample.savingsRate;
  let unfunded = true;
  let found = null;
  for (const s of tries) {
    const run = setUp(point, year, sample, s);
    if (lastsInAll(run.household, run.result)) {
      savingsRate = s;
      unfunded = false;
      found = run;
      break;
    }
  }
  const { household, result } = found ?? setUp(point, year, sample, savingsRate);
  const c = compareWithConversions(household, result, lifetimeOptions(household));
  const of = (run, converted) => ({
    endingAt: Object.fromEntries(THREE_WAY_HEIR_RATES.map((h) => [h, summarizeProjection(run.rows, { heirTaxRate: h }).endingAfterTax])),
    totalTax: run.summary.totalTax,
    sustainable: run.sustainable,
    runsOut: run.summary.runsOut,
    converted,
  });
  const scenarios = {
    roth: of(c.without.roth, 0),
    pretax: of(c.without.pretax, 0),
    converting: of(c.with.pretax, c.converted.pretax),
  };
  return {
    point,
    savingsRate,
    raised: savingsRate > sample.savingsRate,
    unfunded,
    need: c.without.need,
    rate: c.rate,
    scenarios,
    noConversions: c.converted.pretax < NOTHING_CONVERTED,
    allRunOut: SCENARIOS.every((k) => scenarios[k].runsOut),
  };
}

// A point's winner, ranked by `by`: 'wealth' (after-tax wealth at the end age at `heirRate`, more is
// better) or 'tax' (lifetime tax, less is better).
// -> threeWayWinner's { winner, tied, lead } plus measure ('wealth', 'tax', or 'sustainable' when the
//    money runs out in all three, so each leaves nothing) and values (each ranked scenario's figure).
//   With no conversions, "converting" is Pre-tax itself and sits out (it would only ever tie it);
//   ranked by sustainable spending, all three are in (at a lower spending the rule can find room).
export function threeWayRanking(r, { by = 'wealth', heirRate = THREE_WAY_SAMPLE.heirRate } = {}) {
  const measure = r.allRunOut ? 'sustainable' : by;
  const value = {
    wealth: (s) => s.endingAt[heirRate],
    tax: (s) => s.totalTax,
    sustainable: (s) => s.sustainable,
  }[measure];
  const values = Object.fromEntries(
    SCENARIOS.filter((k) => measure === 'sustainable' || !(r.noConversions && k === 'converting')).map((k) => [k, value(r.scenarios[k])]),
  );
  return { measure, values, ...threeWayWinner(values, { lowerIsBetter: measure === 'tax' }) };
}
