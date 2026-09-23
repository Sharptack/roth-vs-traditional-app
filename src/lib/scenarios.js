// Runs the scenario batches (src/data/scenarioBatches.js) through the same
// compareRothVsTraditional engine the calculator uses, and extracts the numbers
// the "Test the theory" page charts. Pure and framework-free — no new financial
// logic lives here, just wiring and extraction on top of already-tested compare.js.
import { compareRothVsTraditional } from './compare.js';

// One scenario's inputs -> the point the charts need.
//   gap            = marginal rate now − effective rate on this account's
//                     withdrawals in retirement (the theory's predictor)
//   advantagePct   = how much more (or less) after-tax annual income Roth
//                     produces than Pre-tax, as a % of the Pre-tax figure
//                     (the "did Roth actually win" outcome, Section 2's lens)
export function runScenarioPoint(base, overrides, year) {
  const inputs = { ...base, ...overrides, year };
  const result = compareRothVsTraditional(inputs);
  if (!result.valid) {
    throw new Error(`Invalid scenario inputs: ${result.errors.join('; ')}`);
  }
  const { marginalNow, effectiveRetirement } = result.rates;
  const gap = marginalNow - effectiveRetirement;
  const rothAfterTax = result.annuity.roth.afterTaxWithdrawal;
  const pretaxAfterTax = result.annuity.pretax.afterTaxWithdrawal;
  const advantagePct = pretaxAfterTax !== 0 ? ((rothAfterTax - pretaxAfterTax) / pretaxAfterTax) * 100 : 0;

  return {
    inputs,
    marginalNow,
    effectiveRetirement,
    gap,
    rothAfterTax,
    pretaxAfterTax,
    advantagePct,
    winner: result.comparison.winner,
  };
}

export function runScenarioBatch(batch, year) {
  return {
    ...batch,
    series: batch.series.map((series) => ({
      ...series,
      points: series.points.map(({ x, overrides }) => ({
        x,
        ...runScenarioPoint(batch.base, overrides, year),
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
