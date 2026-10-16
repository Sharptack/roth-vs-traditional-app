// The three-scenario Visualization page (decided 2026-10-16, roadmap "Three-scenario
// visualization"). Pure. Each grid point is a sample household (src/data/threeWayGrid.js) run through
// the Roth page's comparison with conversions in the lower years (lowerYearConversions.js): all Roth,
// all Pre-tax, and all Pre-tax with the phase 7 rule. No new financial logic: wiring, extraction and
// the winner among three.
//
// The winner is the most after-tax wealth at the end age, spending the plan's need (sustainable
// spending can't show conversions: at the highest steady spending the low brackets are full, so the
// rule converts nothing); when the money runs out in all three, sustainable spending. Lifetime tax
// and sustainable spending come along for the tables.
import { compareRothVsTraditional } from './compare.js';
import { householdToCompareInputs } from './household.js';
import { toHouseholdV2, validateHouseholdV2 } from './householdV2.js';
import { DEFAULT_HOUSEHOLD_VALUES } from './householdValues.js';
import { lifetimeOptions } from './lifetimeComparison.js';
import { compareWithConversions } from './lowerYearConversions.js';
import { THREE_WAY_SAMPLE } from '../data/threeWayGrid.js';

export const SCENARIOS = ['roth', 'pretax', 'converting'];

// Within 0.5% of the best is "about even" (the app's rule, compare.js winnerOf).
const EVEN_TOLERANCE = 0.005;
// Less than a dollar converted over the whole plan: the rule found no room.
const NOTHING_CONVERTED = 1;

// The form values of the sample household at one grid point.
export function threeWayValues({ age, income, balance }, sample = THREE_WAY_SAMPLE) {
  const d = DEFAULT_HOUSEHOLD_VALUES;
  return {
    ...d,
    people: [{ ...d.people[0], age: String(age), retirementAge: String(sample.retirementAge), planToAge: String(sample.planToAge) }],
    incomes: [{ ...d.incomes[0], amount: String(income) }, d.incomes[1]],
    contributions: [{ ...d.contributions[0], amount: String(Math.round(income * sample.savingsRate)) }],
    accounts: [{ ...d.accounts[0], type: 'pretax', balance: String(balance) }],
    spending: { ...d.spending, debtPayments: '0' },
  };
}

// The winner among the scenarios by `value` (larger is better).
//   scenarios: { [key]: number }
// -> { winner: a key, or 'even' when another is within 0.5% of the best; tied: the keys within 0.5%
//      of the best (best first); lead: how far the best is ahead of the next best, as a share of it
//      (0 when there is only one) }
export function threeWayWinner(scenarios) {
  const ranked = Object.entries(scenarios).sort((a, b) => b[1] - a[1]);
  const [bestKey, best] = ranked[0];
  const within = (v) => best === 0 || (best - v) / Math.abs(best) < EVEN_TOLERANCE;
  const tied = ranked.filter(([, v]) => within(v)).map(([k]) => k);
  const second = ranked[1]?.[1];
  const lead = second === undefined || second === 0 ? 0 : (best - second) / Math.abs(second);
  return { winner: tied.length > 1 ? 'even' : bestKey, tied, lead };
}

// One grid point: the three scenarios' results and the winner.
// -> { point, need, rate, scenarios: { roth, pretax, converting: { endingAfterTax, totalTax,
//      sustainable, runsOut, converted } }, noConversions, allRunOut, measure, winner, tied, lead }
//   noConversions: the rule converted nothing at the need, so "converting" is the Pre-tax scenario
//   itself; it is left out of the winner (it would only ever tie Pre-tax).
//   allRunOut: the money runs out before the end age in every scenario, so each leaves nothing and
//   wealth can't rank them; they are ranked by sustainable spending instead (`measure`), with all
//   three in (at a lower spending the rule can find room).
export function threeWayPoint(point, year, sample = THREE_WAY_SAMPLE) {
  const household = toHouseholdV2(threeWayValues(point, sample), year);
  const errors = validateHouseholdV2(household);
  if (errors.length > 0) throw new Error(`Invalid sample household: ${errors.join('; ')}`);
  const result = compareRothVsTraditional({ ...householdToCompareInputs(household), skipBlend: true });
  if (!result.valid) throw new Error(`Invalid sample household: ${result.errors.join('; ')}`);
  const c = compareWithConversions(household, result, lifetimeOptions(household));
  const of = (run, converted) => ({
    endingAfterTax: run.summary.endingAfterTax,
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
  const noConversions = c.converted.pretax < NOTHING_CONVERTED;
  const allRunOut = SCENARIOS.every((k) => scenarios[k].runsOut);
  const measure = allRunOut ? 'sustainable' : 'endingAfterTax';
  const ranked = Object.fromEntries(
    SCENARIOS.filter((k) => allRunOut || !(noConversions && k === 'converting')).map((k) => [k, scenarios[k][measure]]),
  );
  return { point, need: c.without.need, rate: c.rate, scenarios, noConversions, allRunOut, measure, ...threeWayWinner(ranked) };
}
