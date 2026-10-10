// The lifetime Roth vs. Pre-tax comparison (roadmap phase 6). Pure. The projection (phase 4) runs
// twice from the same household: once with Future Contributions all Roth, once all Pre-tax, at the
// SAME take-home cost every year (the Roth calculator's contributionSplit and rate), with the same
// spending need. Both spend the same, so the difference shows up in how long the money lasts,
// taxes paid and wealth left.
//
// Headline (the plan's recommendation): SUSTAINABLE SPENDING, the highest steady after-tax income
// each scenario supports to the end age — the lifetime version of "withdrawal rate needed". Lifetime
// tax, money lasting and ending wealth are one outcome seen three ways, so they are shown, not
// blended into the verdict. The winner uses the app's usual 0.5% "about even" rule (winnerOf).
import { runProjection } from './projection.js';
import { afterTaxEnding, summarizeProjection, sustainableSpending } from './projectionSummary.js';
import { winnerOf } from './compare.js';

// The two scenarios' contributions, one per saver, from the Roth calculator's result.
export function lifetimeContributions(household, compareResult) {
  const split = compareResult.contributionSplit;
  const rate = compareResult.rates.contributionRate ?? compareResult.rates.marginalNow;
  const savers = split.people
    ? household.people.map((p, i) => ({ owner: p.id, takeHomeCost: split.people[i].takeHomeCost }))
    : [{ owner: household.people[0].id, takeHomeCost: split.takeHomeCost }];
  return {
    roth: savers.map((s) => ({ ...s, rate, type: 'roth' })),
    pretax: savers.map((s) => ({ ...s, rate, type: 'pretax' })),
  };
}

// After-tax wealth in a row: Pre-tax at the heirs' rate (less any charity's part, Pre-tax first),
// Roth and taxable in full (step-up).
const afterTaxWealth = (row, heirs) => afterTaxEnding(row.endBalances, heirs);

// -> { need, roth, pretax: { rows, summary, sustainable }, winner, difference, wealthGap, crossoverYear }
//   difference: Roth minus Pre-tax for sustainable spending, lifetime tax, ending after-tax wealth.
//   wealthGap: per year, Roth's after-tax wealth minus Pre-tax's (positive = Roth ahead).
//   crossoverYear: the first year the leader changes (null if it never does).
//   strategy (optional): the withdrawal strategy both runs use (default: proportional) — the
//   comparison generalized to scenario x strategy (phase 7).
export function compareLifetime(household, compareResult, { heirTaxRate = 0.24, charityShare = 0, endAge, retirementRateShift, strategy } = {}) {
  const heirs = { heirTaxRate, charityShare };
  const need = compareResult.retirementNeed.target;
  const plans = lifetimeContributions(household, compareResult);
  const run = (contributions) => {
    const options = { endAge, contributions, retirementRateShift, ...(strategy && { strategy }) };
    const p = runProjection(household, { ...options, need });
    return { ...p, summary: summarizeProjection(p.rows, heirs), sustainable: sustainableSpending(household, options) };
  };
  const roth = run(plans.roth);
  const pretax = run(plans.pretax);
  const wealthGap = roth.rows.map((r, i) => ({
    year: r.year,
    value: afterTaxWealth(r, heirs) - afterTaxWealth(pretax.rows[i], heirs),
  }));
  const lead = (v) => (Math.abs(v) < 0.5 ? 0 : Math.sign(v));
  let crossoverYear = null;
  for (let i = 1; i < wealthGap.length; i++) {
    const a = lead(wealthGap[i - 1].value);
    const b = lead(wealthGap[i].value);
    if (a !== 0 && b !== 0 && a !== b) {
      crossoverYear = wealthGap[i].year;
      break;
    }
  }
  return {
    need,
    roth,
    pretax,
    winner: winnerOf(roth.sustainable, pretax.sustainable),
    difference: {
      sustainable: roth.sustainable - pretax.sustainable,
      totalTax: roth.summary.totalTax - pretax.summary.totalTax,
      endingAfterTax: roth.summary.endingAfterTax - pretax.summary.endingAfterTax,
    },
    wealthGap,
    crossoverYear,
  };
}

// Break-even: how much ordinary rates in retirement would have to change (in points) for the two
// scenarios' sustainable spending to be equal. Positive = rates would have to RISE that much for
// Roth to catch up (Pre-tax is ahead today); negative = FALL for Pre-tax to catch up. Searched
// between -10 and +30 points; null if the leader doesn't change in that range. Slow (two
// sustainable-spending searches per step), so the page runs it on request.
export function breakEvenRateShift(household, compareResult, { endAge, lo = -0.1, hi = 0.3, steps = 16, strategy } = {}) {
  const plans = lifetimeContributions(household, compareResult);
  const s = strategy ? { strategy } : {};
  const gap = (shift) =>
    sustainableSpending(household, { endAge, contributions: plans.roth, retirementRateShift: shift, ...s }) -
    sustainableSpending(household, { endAge, contributions: plans.pretax, retirementRateShift: shift, ...s });
  let a = lo;
  let b = hi;
  let ga = gap(a);
  const gb = gap(b);
  if (Math.sign(ga) === Math.sign(gb) || ga === 0) return ga === 0 ? lo : null;
  for (let i = 0; i < steps; i++) {
    const m = (a + b) / 2;
    const gm = gap(m);
    if (Math.sign(gm) === Math.sign(ga)) {
      a = m;
      ga = gm;
    } else b = m;
  }
  return (a + b) / 2;
}
