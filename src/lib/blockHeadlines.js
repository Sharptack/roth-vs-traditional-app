// Each preview calculator's result blocks, and the one-line headline each block shows in its
// header, so a closed block still says what is in it (round 2 phase 0, step c; the Roth page's
// are sectionSummaries.js's). Pure: each takes the calculator's own result.
import { formatCurrency as $, formatPercent } from './format.js';
import { pensionTile, projectionTile, taxTile } from './suiteTiles.js';

const pct = (r) => formatPercent(r, 1);

const bracketLine = (bar) => `the ${pct(bar.currentRate)} bracket, ${$(bar.room)} of room`;

// The tax calculator (taxCalculatorResult).
export function taxHeadlines(t) {
  const i = t.irmaa;
  return {
    rates: taxTile(t).headline,
    next: `${$(t.steps.extraTax, 2)} more tax on the next ${$(t.steps.probe)}: ${pct(t.steps.rate)}`,
    buckets: `${formatPercent(t.result.bracketRoom.ordinary.rate, 0)} bracket, ${$(t.result.bracketRoom.ordinary.room)} of room`,
    irmaa: !i || i.enrolled === 0 ? '' : i.tier === 0 ? `No surcharge in ${i.premiumYear}` : `Tier ${i.tier} of 5: ${$(i.total)} in ${i.premiumYear}`,
    calculation: `${$(t.result.incomeTax)} federal income tax`,
  };
}

// The Roth conversion calculator (conversionResult; lifetime: conversionLifetime.js, when worked out).
//   lifetime: "Lifetime tax +$2,727 · legacy after heirs' tax +$2,727"
export function conversionHeadlines(c, lifetime) {
  const signed = (v) => (Math.abs(v) < 0.5 ? '$0' : `${v >= 0 ? '+' : '−'}${$(Math.abs(v))}`);
  return {
    lifetime: lifetime ? `Lifetime tax ${signed(lifetime.difference.lifetimeTax)} · legacy after heirs' tax ${signed(lifetime.difference.legacyAfterTax)}` : '',
    cost: `${$(c.cost)} tax, an effective rate of ${pct(c.rate)}`,
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
  const { rows, summary: s, strategies } = view;
  const most = strategies.reduce((a, b) => (b.endingAfterTax > a.endingAfterTax ? b : a), strategies[0]);
  const peak = rows.reduce((a, b) => (b.endBalances.total > a.endBalances.total ? b : a), rows[0]);
  const retired = rows.filter((r) => r.working.some((w) => !w));
  return {
    funded: projectionTile(view).headline,
    strategies: most ? `Most left for heirs: ${most.label.toLowerCase()}` : '',
    summary: `${$(s.totalTax)} lifetime tax · ${$(s.endingBalance.total)} left at ${s.endLabel}`,
    income: retired.length > 0 ? `${retired[0].year} to ${retired[retired.length - 1].year}` : '',
    balances: `Peak ${$(peak.endBalances.total)} in ${peak.year}`,
    table: `${rows.length} years, ${rows[0].year} to ${rows[rows.length - 1].year}`,
  };
}

// The lifetime Roth vs. Pre-tax comparison (compareLifetime).
export function lifetimeHeadline(lifetime) {
  if (lifetime.winner === 'even') return 'About even';
  return `${lifetime.winner === 'roth' ? 'Roth' : 'Pre-tax'} supports ${$(Math.abs(lifetime.difference.sustainable))} per year more`;
}
