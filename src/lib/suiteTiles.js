// The homepage tiles (roadmap phase 2, the suite shell): one per calculator, with its headline
// number. Pure: each takes the calculator's own result.
import { formatCurrency, formatPercent } from './format.js';

// Roth calculator: who comes out ahead on Future Contributions, and by how much a year.
export function rothTile(result) {
  if (!result.valid) return { headline: 'Needs inputs', detail: result.errors[0] };
  const { winner, afterTaxIncomeDifference } = result.comparison;
  const headline =
    winner === 'even'
      ? 'About even'
      : `${winner === 'roth' ? 'Roth' : 'Pre-tax'} +${formatCurrency(afterTaxIncomeDifference)}/yr`;
  return {
    headline,
    detail: `Tax saved now ${formatPercent(result.rates.taxSavedNow)} vs. ${formatPercent(result.rates.effectiveRetirement)} on the withdrawal later`,
  };
}

// Tax calculator: the marginal rate on the next dollar of the leading source, and the effective rate.
export function taxTile(t) {
  return {
    headline: `${formatPercent(t.marginal.incomeTax)} marginal · ${formatPercent(t.result.effectiveRate)} effective`,
    detail: `${formatCurrency(t.result.incomeTax)} federal income tax this year`,
  };
}

// Projection: funded status, and how long the money lasts.
export function projectionTile(view) {
  if (!view) return { headline: 'Needs inputs', detail: 'Fill in the household to project it.' };
  const pct = Math.round(view.funded * 100);
  return {
    headline: view.summary.runsOut ? `Runs out at ${view.summary.moneyLastsTo + 1}` : `${pct}% funded`,
    detail: `Supports ${formatCurrency(view.sustainable)}/yr after tax to age ${view.endAge}; the retirement income number is ${formatCurrency(view.need)}`,
  };
}
