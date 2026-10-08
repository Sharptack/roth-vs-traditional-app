// Each preview calculator's result blocks, and the one-line headline each block shows in its
// header, so a closed block still says what is in it (round 2 phase 0, step c; the Roth page's
// are sectionSummaries.js's). Pure: each takes the calculator's own result.
import { formatCurrency as $, formatPercent } from './format.js';
import { conversionTile, pensionTile, projectionTile, taxTile } from './suiteTiles.js';

const pct = (r) => formatPercent(r, 1);

// "12.0% to 22.0%", or one rate when they are all the same.
function rateRange(rates) {
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);
  return Math.abs(hi - lo) < 1e-9 ? pct(lo) : `${pct(lo)} to ${pct(hi)}`;
}

const bracketLine = (bar) => `the ${pct(bar.currentRate)} bracket, ${$(bar.room)} of room`;

// The tax calculator (taxCalculatorResult).
export function taxHeadlines(t) {
  const i = t.irmaa;
  return {
    rates: taxTile(t).headline,
    others: t.others.length > 0 ? `${rateRange(t.others.map((o) => o.incomeTax))} on the next ${t.params?.children > 0 || t.params?.otherDependents > 0 ? '$1,000' : '$100'}` : '',
    buckets: `${formatPercent(t.result.bracketRoom.ordinary.rate, 0)} bracket, ${$(t.result.bracketRoom.ordinary.room)} of room`,
    irmaa: !i || i.enrolled === 0 ? '' : i.tier === 0 ? `No surcharge in ${i.premiumYear}` : `Tier ${i.tier} of 5: ${$(i.total)} in ${i.premiumYear}`,
    calculation: `${$(t.result.incomeTax)} federal income tax`,
  };
}

// The Roth conversion calculator (conversionResult).
export function conversionHeadlines(c) {
  const first = c.fills[0];
  return {
    cost: conversionTile(c).headline,
    fills: first ? `To the top of ${formatPercent(first.rate, 0)}: convert ${$(first.amount)}` : '',
    bar: `Reaches ${bracketLine(c.bar)}`,
  };
}

// The pension calculator (pensionResult); nominalReturn: the household's return with inflation.
export function pensionHeadlines(p, inputs, nominalReturn) {
  const first = p.byEndAge[0];
  const last = p.byEndAge[p.byEndAge.length - 1];
  const irr = (x) => (x.irr === null ? 'none' : pct(x.irr));
  return {
    irr: `${pensionTile(p, inputs).headline} vs. ${pct(nominalReturn)} assumed`,
    ages: first ? `${irr(first)} to age ${first.endAge}, ${irr(last)} to age ${last.endAge}` : '',
  };
}

// The projection page (projectionView).
export function projectionHeadlines(view) {
  const { rows, summary: s, strategies, endAge } = view;
  const most = strategies.reduce((a, b) => (b.endingAfterTax > a.endingAfterTax ? b : a), strategies[0]);
  const peak = rows.reduce((a, b) => (b.endBalances.total > a.endBalances.total ? b : a), rows[0]);
  const retired = rows.filter((r) => r.working.some((w) => !w));
  return {
    funded: projectionTile(view).headline,
    strategies: most ? `Most left for heirs: ${most.label.toLowerCase()}` : '',
    summary: `${$(s.totalTax)} lifetime tax · ${$(s.endingBalance.total)} left at ${endAge}`,
    income: retired.length > 0 ? `${retired[0].year} to ${retired[retired.length - 1].year}` : '',
    balances: `Peak ${$(peak.endBalances.total)} in ${peak.year}`,
    table: `${rows.length} years, ${rows[0].year} to ${rows[rows.length - 1].year}`,
  };
}

// The lifetime Roth vs. Pre-tax comparison (compareLifetime).
export function lifetimeHeadline(lifetime) {
  if (lifetime.winner === 'even') return 'About even';
  return `${lifetime.winner === 'roth' ? 'Roth' : 'Pre-tax'} supports ${$(Math.abs(lifetime.difference.sustainable))} a year more`;
}
