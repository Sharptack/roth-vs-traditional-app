// One-line headlines for the Roth vs. Pre-tax page's results cards: each card's header shows its
// headline number, so the results can be read with every card closed. Pure: a compare.js result in,
// strings out. No new financial logic. (The single calculator's input-section summaries went with
// it at the switchover; the household inputs' are lib/householdInputs.js.)
import { formatCurrency, formatPercent } from './format.js';

const LEAN_SHORT = { pretax: 'tends to favor Pre-tax', roth: 'tends to favor Roth', even: 'about even' };
const WINNER_NAME = { roth: 'Roth', pretax: 'Pre-tax' };

// "Best mix: 56% Roth, $440/yr more than either pure strategy" (or, when a pure strategy
// already wins, "Best mix: all Pre-tax") — the blend explorer's closed-card headline.
function blendHeadline(blend) {
  if (!blend.available) return 'Nothing saved to split';
  const { best, points } = blend;
  const betterPure = Math.max(points[0].totalAfterTaxIncome, points[points.length - 1].totalAfterTaxIncome);
  const gain = best.totalAfterTaxIncome - betterPure;
  const pct = Math.round(best.rothShare * 100);
  if (gain <= 0.5) return `Best mix: all ${pct === 0 ? 'Pre-tax' : 'Roth'}`;
  return `Best mix: ${pct}% Roth, ${formatCurrency(gain)}/yr more than either pure strategy`;
}

// The headline shown on each results card's header, keyed by card id.
export function resultHeadlines(result) {
  const { retirementNeed, rates, comparison, portfolio } = result;
  return {
    need: `${formatCurrency(retirementNeed.target)} per year after tax`,
    buildup: `${formatCurrency(portfolio.roth.totalValue)} Roth vs. ${formatCurrency(portfolio.pretax.totalValue)} Pre-tax at retirement`,
    rates: `${formatPercent(rates.marginalNow)} now vs. ${formatPercent(rates.effectiveRetirement)} in retirement · ${LEAN_SHORT[rates.lean]}`,
    tradeoff:
      comparison.winner === 'even'
        ? 'About even'
        : `${WINNER_NAME[comparison.winner]} ahead by ${formatCurrency(comparison.afterTaxIncomeDifference)} per year after tax`,
    blend: blendHeadline(result.blend),
    portfolio: `Withdrawal rate needed: All-Roth ${formatPercent(portfolio.roth.impliedWithdrawalRate, 2)} vs. All-Pre-tax ${formatPercent(portfolio.pretax.impliedWithdrawalRate, 2)}`,
  };
}
