// Runs the scenario batches (src/data/scenarioBatches.js) through the same
// compareRothVsTraditional engine the calculator uses, and extracts the numbers
// the "Visualization" page charts. Pure and framework-free — no new financial
// logic lives here, just wiring and extraction on top of already-tested compare.js.
import { compareRothVsTraditional } from './compare.js';
import { compareWithRisingIncome } from './risingIncome.js';

// One scenario's inputs -> the point the charts need.
//   gap            = tax saved now (net of any tax on investing the difference) minus the
//                     effective rate on the account withdrawal — sideAwareRates.js's rate
//                     gap, already the exact predictor: gap * W equals the dollar difference
//                     between the two scenarios' after-tax income (an identity, tested to the
//                     cent in tests/sideAwareRates.test.js), so it and advantagePct below are
//                     now exactly proportional, not just empirically correlated.
//   advantagePct   = how much more (or less) after-tax annual income Roth
//                     produces than Pre-tax, as a % of the Pre-tax figure
//                     (the "did Roth actually win" outcome)
export function runScenarioPoint(base, overrides, year) {
  const inputs = { ...base, ...overrides, year };
  const result = compareRothVsTraditional(inputs);
  if (!result.valid) {
    throw new Error(`Invalid scenario inputs: ${result.errors.join('; ')}`);
  }
  const taxSavedNow = result.rates.taxSavedNow;
  const effectiveRetirement = result.rates.effectiveRetirement;
  const gap = taxSavedNow - effectiveRetirement;
  const rothAfterTax = result.annuity.roth.totalAfterTaxIncome;
  const pretaxAfterTax = result.annuity.pretax.totalAfterTaxIncome;
  const advantagePct = pretaxAfterTax !== 0 ? ((rothAfterTax - pretaxAfterTax) / pretaxAfterTax) * 100 : 0;
  // True when the savings don't all fit under the IRS limit, so part goes to a taxable account.
  const overLimit =
    result.contributionSplit.roth.excessToTaxable > 0 || result.contributionSplit.pretax.excessToTaxable > 0;

  return {
    inputs,
    taxSavedNow,
    effectiveRetirement,
    gap,
    rothAfterTax,
    pretaxAfterTax,
    advantagePct,
    overLimit,
    winner: result.comparison.winner,
  };
}

// The same point shape for a batch with `engine: 'risingIncome'` (income rises partway to
// retirement; see risingIncome.js).
export function runRisingIncomePoint(base, overrides, year) {
  const inputs = { ...base, ...overrides, year };
  const { detail, ...point } = compareWithRisingIncome(inputs);
  return { inputs, ...point };
}

// A break-even map: one scenario per (row, income) cell. `def` is an entry of HEATMAPS in
// scenarioBatches.js; each row is one value of the row variable, cells run across incomes.
export function runHeatmap(def, year) {
  return {
    ...def,
    rows: def.rows.map((row) => ({
      ...row,
      cells: def.incomes.map((income) => ({
        income,
        ...runScenarioPoint(def.base, def.overridesFor(income, row), year),
      })),
    })),
  };
}

export function runScenarioBatch(batch, year) {
  const runPoint = batch.engine === 'risingIncome' ? runRisingIncomePoint : runScenarioPoint;
  return {
    ...batch,
    series: batch.series.map((series) => ({
      ...series,
      points: series.points.map(({ x, overrides }) => ({
        x,
        ...runPoint(batch.base, overrides, year),
      })),
    })),
  };
}

export function runAllBatches(batches, year) {
  return batches.map((batch) => runScenarioBatch(batch, year));
}

// Every point across every batch, flattened for the combined "does the gap
// predict the winner" scatter.
export function flattenForScatter(runBatches) {
  const points = [];
  for (const batch of runBatches) {
    for (const series of batch.series) {
      for (const point of series.points) {
        points.push({ batchKey: batch.key, batchTitle: batch.title, seriesLabel: series.label, ...point });
      }
    }
  }
  return points;
}
