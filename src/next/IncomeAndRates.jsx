// Income and tax rates year by year, over the whole projection (today to the end; decided 2026-10-09
// for the Roth page): income by source as stacked bars with the total tax as a line, then the three
// rates each year (the marginal rate = the bracket, the effective marginal rate on the next Pre-tax
// dollar, the average tax rate). Renders projection rows (lib/projection.js); no math of its own.
import LineChart from '../components/charts/LineChart.jsx';
import StackedBarChart from '../components/charts/StackedBarChart.jsx';
import { formatCurrency as $, formatPercent } from '../lib/format.js';

const short = (v) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`);
const COLORS = {
  earnings: 'var(--series-6)',
  ss: 'var(--series-1)',
  pension: 'var(--series-5)',
  other: 'var(--series-3)',
  pretax: 'var(--series-2)',
  taxable: 'var(--series-4)',
  roth: 'var(--series-7)',
};

export default function IncomeAndRates({ rows }) {
  const x = rows.map((r) => r.year);
  const has = (f) => rows.some((r) => f(r) > 0.5);
  const sources = [
    { key: 'earnings', label: 'Earnings', get: (r) => r.wages },
    { key: 'ss', label: 'Social Security', get: (r) => r.socialSecurity },
    { key: 'pension', label: 'Pensions', get: (r) => r.pension },
    { key: 'other', label: 'Other income', get: (r) => r.otherIncome ?? 0 },
    { key: 'pretax', label: 'Pre-tax withdrawals', get: (r) => r.withdrawals.pretax },
    { key: 'taxable', label: 'Taxable withdrawals', get: (r) => r.withdrawals.taxable },
    { key: 'roth', label: 'Roth withdrawals', get: (r) => r.withdrawals.roth },
  ].filter((s) => has(s.get));
  return (
    <>
      <StackedBarChart
        x={x}
        stacks={sources.map((s) => ({ key: s.key, label: s.label, color: COLORS[s.key], values: rows.map(s.get) }))}
        line={{ key: 'tax', label: 'Total tax', values: rows.map((r) => r.totalTax) }}
        formatX={(v) => `${v}`}
        formatY={(v) => $(v)}
        formatYTick={short}
        xLabel="Year"
        yLabel="Income per year (today's dollars)"
      />
      <LineChart
        series={[
          { key: 'marginal', label: 'Marginal rate (the bracket)', color: 'var(--series-1)', points: rows.map((r) => ({ x: r.year, y: r.ordinaryBracketRate })) },
          { key: 'emtr', label: 'Effective marginal rate (next Pre-tax dollar)', color: 'var(--series-2)', points: rows.map((r) => ({ x: r.year, y: r.marginalPretaxRate })) },
          { key: 'average', label: 'Average tax rate', color: 'var(--text)', points: rows.map((r) => ({ x: r.year, y: r.effectiveRate })) },
        ]}
        xTicks={x}
        formatX={(v) => `${v}`}
        formatY={(v) => formatPercent(v, 1)}
        formatYTick={(v) => formatPercent(v, 0)}
        markers={false}
        yFloor={0}
        xLabel="Year"
        yLabel="Federal income tax rate"
      />
    </>
  );
}
