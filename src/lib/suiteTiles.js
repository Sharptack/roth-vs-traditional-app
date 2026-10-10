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

// Tax calculator, in the preview's terms (decided 2026-10-08): the marginal rate is the bracket; the
// effective marginal rate (EMTR) the real tax on the next dollar of the leading source; the average
// tax rate total income tax ÷ total income.
export function taxTile(t) {
  return {
    headline: `${formatPercent(t.result.bracketRoom.ordinary.rate, 0)} marginal · ${formatPercent(t.marginal.incomeTax)} EMTR`,
    detail: `${formatPercent(t.result.effectiveRate)} average tax rate: ${formatCurrency(t.result.incomeTax)} federal income tax this year`,
  };
}

// Roth conversion: this year's tax cost of the conversion, and its rate.
export function conversionTile(c) {
  return {
    headline: `${formatCurrency(c.cost)} tax (${formatPercent(c.rate)})`,
    detail: `on converting ${formatCurrency(c.amount)} to Roth this year`,
  };
}

// Pension: the return the lump sum would have to earn to match the monthly benefit, on life
// expectancy (each payment counted by the chance of being alive to receive it).
export function pensionTile(p, inputs) {
  if (!p || !inputs) return { headline: 'No pension yet', detail: 'Add a pension (an income row) to weigh it against a lump sum.' };
  const r = p.expected?.irr ?? null;
  return {
    headline: r === null ? 'No return' : `${formatPercent(r)} per year`,
    detail: `what ${formatCurrency(inputs.lumpSum)} must earn to match ${formatCurrency(inputs.monthly)} per month for life`,
  };
}

// Projection: funded status, and how long the money lasts.
// Retirement spending (phase 3): what the resources allow, against the spending need.
export function spendingTile(view) {
  if (!view) return { headline: 'Needs inputs', detail: 'Fill in the household to work it out.' };
  if (!view.reachable) return { headline: 'Legacy goal out of reach', detail: `Even spending nothing leaves less than ${formatCurrency(view.legacy.target)}` };
  const d = view.difference;
  const gap = Math.abs(d) < 1 ? 'Exactly' : `${formatCurrency(Math.abs(d))} ${d > 0 ? 'above' : 'below'}`;
  return {
    headline: `${formatCurrency(view.sustainable)}/yr after tax`,
    detail: `${gap} the ${formatCurrency(view.need)} spending need${view.legacy.target > 0 ? `, leaving ${formatCurrency(view.legacy.target)}` : ''}`,
  };
}

export function projectionTile(view) {
  if (!view) return { headline: 'Needs inputs', detail: 'Fill in the household to project it.' };
  const pct = Math.round(view.funded * 100);
  return {
    // (the labels: "age 71", or for a couple "2047 (you 71, your spouse 69)")
    headline: view.summary.runsOut ? `Runs out at ${view.summary.runsOutLabel}` : `${pct}% funded`,
    detail: `Supports ${formatCurrency(view.sustainable)}/yr after tax to ${view.summary.endLabel}; the retirement income number is ${formatCurrency(view.need)}`,
  };
}
