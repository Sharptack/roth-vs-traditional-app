// The projection page's results (roadmap phase 5): funded status, the lifetime summary, income by
// source per year, balances over time, and the year-by-year table. Renders
// lib/projectionSummary.js's projectionView; no math of its own.
import { useState } from 'react';
import LineChart from '../components/charts/LineChart.jsx';
import StackedBarChart from '../components/charts/StackedBarChart.jsx';
import { formatCurrency as $, formatPercent } from '../lib/format.js';

// One color per source, the same in every chart (color follows the entity, never the position).
const COLORS = { ss: 'var(--series-1)', pretax: 'var(--series-2)', taxable: 'var(--series-3)', roth: 'var(--series-4)' };

const short = (v) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`);

// The table's columns: key ones always, the rest behind "Show all columns".
const COLUMNS = [
  { key: 'year', label: 'Year', value: (r) => r.year, format: String, key1: true },
  { key: 'age', label: 'Age', value: (r) => r.ages.join(' / '), format: String, key1: true },
  { key: 'wages', label: 'Earnings', value: (r) => r.wages, key1: true },
  { key: 'ss', label: 'Social Security', value: (r) => r.socialSecurity, key1: true },
  { key: 'withdrawn', label: 'Withdrawn', value: (r) => r.withdrawals.total, key1: true },
  { key: 'rmd', label: 'RMD', value: (r) => r.rmd },
  { key: 'wPretax', label: 'From Pre-tax', value: (r) => r.withdrawals.pretax },
  { key: 'wTaxable', label: 'From taxable', value: (r) => r.withdrawals.taxable },
  { key: 'wRoth', label: 'From Roth', value: (r) => r.withdrawals.roth },
  { key: 'contributed', label: 'Contributed', value: (r) => r.contributions.total },
  { key: 'taxableSS', label: 'Taxable SS', value: (r) => r.taxableSocialSecurity },
  { key: 'incomeTax', label: 'Income tax', value: (r) => r.incomeTax, key1: true },
  { key: 'payroll', label: 'Payroll tax', value: (r) => r.payrollTax },
  { key: 'effective', label: 'Effective rate', value: (r) => r.effectiveRate, format: (v) => formatPercent(v) },
  { key: 'bracket', label: 'Bracket', value: (r) => r.ordinaryBracketRate, format: (v) => formatPercent(v, 0) },
  { key: 'marginal', label: 'Next Pre-tax $', value: (r) => r.marginalPretaxRate, format: (v) => formatPercent(v) },
  { key: 'room', label: 'Bracket room', value: (r) => r.bracketRoom },
  { key: 'afterTax', label: 'After-tax income', value: (r) => r.afterTaxIncome, key1: true },
  { key: 'surplus', label: 'Reinvested', value: (r) => r.surplus },
  { key: 'short', label: 'Shortfall', value: (r) => r.shortfall },
  { key: 'end', label: 'End balance', value: (r) => r.endBalances.total, key1: true },
  { key: 'endPretax', label: 'Pre-tax', value: (r) => r.endBalances.pretax },
  { key: 'endRoth', label: 'Roth', value: (r) => r.endBalances.roth },
  { key: 'endTaxable', label: 'Taxable', value: (r) => r.endBalances.taxable },
  { key: 'basis', label: 'Taxable basis', value: (r) => r.taxableBasis },
];

export function YearTable({ rows }) {
  const [all, setAll] = useState(false);
  const cols = COLUMNS.filter((c) => all || c.key1);
  return (
    <div>
      <button type="button" className="link-button" onClick={() => setAll(!all)}>
        {all ? 'Show key columns only' : 'Show all columns'}
      </button>
      <div className="table-scroll">
        <table className="compare-table projection-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className={r.shortfall > 0 ? 'short-row' : undefined}>
                {cols.map((c) => (
                  <td key={c.key}>{(c.format ?? $)(c.value(r))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProjectionResult({ view }) {
  if (!view) {
    return (
      <section className="card">
        <h2>Projection</h2>
        <p>Fill in the household inputs to project it.</p>
      </section>
    );
  }
  const { rows, summary: s, sustainable, need, funded, endAge } = view;
  const retired = rows.filter((r) => r.working.some((w) => !w));
  const over = funded >= 1;
  return (
    <div className="results">
      <section className="card key-card" aria-labelledby="proj-funded">
        <h2 id="proj-funded">Funded status</h2>
        <div className="hero">
          <div className="hero-value">{Math.round(funded * 100)}%</div>
          <div className="hero-sub">
            {over ? 'Funded' : 'Underfunded'}: the plan supports {$(sustainable)} a year after tax to age {endAge}; the
            retirement income number is {$(need)}.
          </div>
        </div>
        <p className="hint">
          {s.runsOut
            ? `At ${$(need)} a year the money runs out after age ${s.moneyLastsTo}.`
            : `At ${$(need)} a year the money lasts to ${endAge}, with ${$(s.endingBalance.total)} left.`}{' '}
          Sustainable spending is the highest steady after-tax income, in today&rsquo;s dollars, that lasts to the end age.
        </p>
      </section>

      <section className="card" aria-labelledby="proj-summary">
        <h2 id="proj-summary">Lifetime summary</h2>
        <div className="calc">
          <div className="calc-row"><span>Total tax paid (income and payroll)</span><span>{$(s.totalTax)}</span></div>
          <div className="calc-row sub"><span>of which federal income tax</span><span>{$(s.totalIncomeTax)}</span></div>
          <div className="calc-row"><span>After-tax income in retirement, all years</span><span>{$(s.retirementAfterTaxIncome)}</span></div>
          <div className="calc-row"><span>Average effective rate (income tax ÷ gross income)</span><span>{formatPercent(s.averageEffectiveRate)}</span></div>
          <div className="calc-row"><span>Highest-tax year</span><span>{s.highestTaxYear.year}: {$(s.highestTaxYear.amount)}</span></div>
          <div className="calc-row"><span>Money lasts to</span><span>{s.runsOut ? `age ${s.moneyLastsTo}` : `${endAge} (the end age)`}</span></div>
          <div className="calc-row total"><span>Ending balance at {endAge}</span><span>{$(s.endingBalance.total)}</span></div>
          <div className="calc-row sub"><span>Pre-tax / Roth / taxable</span><span>{$(s.endingBalance.pretax)} / {$(s.endingBalance.roth)} / {$(s.endingBalance.taxable)}</span></div>
          <div className="calc-row"><span>Ending balance after tax for heirs (Pre-tax at {formatPercent(s.heirTaxRate, 0)})</span><span>{$(s.endingAfterTax)}</span></div>
        </div>
        <p className="hint">
          All in today&rsquo;s dollars. Heirs pay no tax on Roth money, and inherited taxable accounts get a step-up in
          cost basis, so they count in full.
        </p>
      </section>

      {retired.length > 0 && (
        <section className="card" aria-labelledby="proj-income">
          <h2 id="proj-income">Income by source in retirement</h2>
          <StackedBarChart
            x={retired.map((r) => r.year)}
            stacks={[
              { key: 'ss', label: 'Social Security', color: COLORS.ss, values: retired.map((r) => r.socialSecurity) },
              { key: 'pretax', label: 'Pre-tax withdrawals', color: COLORS.pretax, values: retired.map((r) => r.withdrawals.pretax) },
              { key: 'taxable', label: 'Taxable withdrawals', color: COLORS.taxable, values: retired.map((r) => r.withdrawals.taxable) },
              { key: 'roth', label: 'Roth withdrawals', color: COLORS.roth, values: retired.map((r) => r.withdrawals.roth) },
            ]}
            line={{ key: 'tax', label: 'Total tax', values: retired.map((r) => r.totalTax) }}
            formatX={(v) => `${v}`}
            formatY={(v) => $(v)}
            formatYTick={short}
            xLabel="Year"
            yLabel="Dollars a year (today's)"
          />
        </section>
      )}

      <section className="card" aria-labelledby="proj-balances">
        <h2 id="proj-balances">Balances over time</h2>
        <LineChart
          series={[
            { key: 'pretax', label: 'Pre-tax', color: COLORS.pretax, points: rows.map((r) => ({ x: r.year, y: r.endBalances.pretax })) },
            { key: 'roth', label: 'Roth', color: COLORS.roth, points: rows.map((r) => ({ x: r.year, y: r.endBalances.roth })) },
            { key: 'taxable', label: 'Taxable', color: COLORS.taxable, points: rows.map((r) => ({ x: r.year, y: r.endBalances.taxable })) },
          ]}
          xTicks={rows.map((r) => r.year)}
          formatX={(v) => `${v}`}
          formatY={(v) => $(v)}
          formatYTick={short}
          markers={false}
          yFloor={0}
          xLabel="Year (end of year)"
          yLabel="Balance (today's dollars)"
        />
      </section>

      <section className="card" aria-labelledby="proj-table">
        <h2 id="proj-table">Year by year</h2>
        <YearTable rows={rows} />
      </section>

      <p className="disclaimer">
        Estimates only — not tax or financial advice. Today&rsquo;s dollars at a constant after-inflation return; spending
        flat; earnings flat while working; withdrawals in proportion from every account once anyone retires, with RMDs
        as a floor; no survivor years, state tax or IRMAA.
      </p>
    </div>
  );
}
