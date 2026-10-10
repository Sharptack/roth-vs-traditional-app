// The projection page's results (roadmap phase 5), as blocks: funded status, the withdrawal strategies, the lifetime summary, income by
// source per year, balances over time, and the year-by-year table. Renders
// lib/projectionSummary.js's projectionView; no math of its own.
import { useState } from 'react';
import LineChart from '../components/charts/LineChart.jsx';
import StackedBarChart from '../components/charts/StackedBarChart.jsx';
import { projectionHeadlines } from '../lib/blockHeadlines.js';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import Blocks from './Blocks.jsx';

// One color per source, the same in every chart (color follows the entity, never the position).
const COLORS = { ss: 'var(--series-1)', pretax: 'var(--series-2)', taxable: 'var(--series-3)', roth: 'var(--series-4)', pension: 'var(--series-5)' };

const WHO = ['You', 'Your spouse'];
// Survivor years (phase 2): the year of the first death and who died, or null.
export function firstDeath(rows) {
  const i = rows.findIndex((r) => r.alive?.includes(false));
  if (i < 1) return null;
  const who = rows[i].alive.indexOf(false);
  return { year: rows[i - 1].year, firstSurvivorYear: rows[i].year, who, age: rows[i - 1].ages[who] };
}
const deathNote = (d) => `${WHO[d.who]} at ${d.age}, in ${d.year}`;

const short = (v) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`);

// The table's columns: key ones always, the rest behind "Show all columns".
const COLUMNS = [
  { key: 'year', label: 'Year', value: (r) => r.year, format: String, key1: true },
  // a person who has died shows a dash
  { key: 'age', label: 'Age', value: (r) => r.ages.map((a, i) => (r.alive?.[i] === false ? '—' : a)).join(' / '), format: String, key1: true },
  { key: 'filing', label: 'Filing status', value: (r) => (r.filingStatus === 'single' ? 'Single' : 'Joint'), format: String },
  { key: 'wages', label: 'Earnings', value: (r) => r.wages, key1: true },
  { key: 'ss', label: 'Social Security', value: (r) => r.socialSecurity, key1: true },
  { key: 'pension', label: 'Pension', value: (r) => r.pension ?? 0 },
  { key: 'other', label: 'Other income', value: (r) => r.otherIncome ?? 0 },
  { key: 'withdrawn', label: 'Withdrawn', value: (r) => r.withdrawals.total, key1: true },
  { key: 'rmd', label: 'RMD', value: (r) => r.rmd },
  { key: 'wPretax', label: 'From Pre-tax', value: (r) => r.withdrawals.pretax },
  { key: 'wTaxable', label: 'From taxable', value: (r) => r.withdrawals.taxable },
  { key: 'wRoth', label: 'From Roth', value: (r) => r.withdrawals.roth },
  { key: 'contributed', label: 'Contributed', value: (r) => r.contributions.total },
  { key: 'employer', label: 'Employer (to Pre-tax)', value: (r) => r.employerContributions ?? 0 },
  { key: 'converted', label: 'Converted to Roth', value: (r) => r.conversions },
  { key: 'dividends', label: 'Dividends (taxable accounts)', value: (r) => r.dividends ?? 0 },
  { key: 'taxableSS', label: 'Taxable SS', value: (r) => r.taxableSocialSecurity },
  { key: 'incomeTax', label: 'Income tax', value: (r) => r.incomeTax, key1: true },
  { key: 'payroll', label: 'Payroll tax', value: (r) => r.payrollTax },
  { key: 'magi', label: 'MAGI', value: (r) => r.magi },
  { key: 'irmaa', label: 'Medicare IRMAA', value: (r) => r.irmaa },
  { key: 'bracket', label: 'Marginal rate (bracket)', value: (r) => r.ordinaryBracketRate, format: (v) => formatPercent(v, 0) },
  { key: 'marginal', label: 'Effective marginal rate (EMTR, next Pre-tax $)', value: (r) => r.marginalPretaxRate, format: (v) => formatPercent(v) },
  { key: 'effective', label: 'Average tax rate', value: (r) => r.effectiveRate, format: (v) => formatPercent(v) },
  { key: 'room', label: 'Bracket room', value: (r) => r.bracketRoom },
  { key: 'afterTax', label: 'After-tax income', value: (r) => r.afterTaxIncome, key1: true },
  { key: 'surplus', label: 'Reinvested', value: (r) => r.reinvested ?? r.surplus },
  { key: 'spent', label: 'Spent above the need', value: (r) => r.extraSpending ?? 0 },
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
  const death = firstDeath(rows);
  return (
    <div>
      {death && (
        <p className="hint">
          Shaded: survivor years, filing single, after the first death ({deathNote(death)}, by the life expectancies).
        </p>
      )}
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
              <tr
                key={r.year}
                className={[r.alive?.includes(false) && 'survivor-row', r.shortfall > 0 && 'short-row'].filter(Boolean).join(' ') || undefined}
              >
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

// error: why there is no projection (the spending need's reason, spendingNeed.js), when there is none.
export default function ProjectionResult({ view, error }) {
  if (!view) {
    return (
      <section className="card">
        <h2>Projection</h2>
        <p>{error ?? 'Fill in the household inputs to project it.'}</p>
      </section>
    );
  }
  const { rows, summary: s, sustainable, need, funded } = view;
  const end = s.endLabel; // "age 95", or for a couple "2071 (your spouse 95)"
  const retired = rows.filter((r) => r.working.some((w) => !w));
  const showIrmaa = view.strategies.some((st) => st.totalIrmaa > 0);
  const over = funded >= 1;
  const h = projectionHeadlines(view);
  const death = firstDeath(rows);
  const anyPension = retired.some((r) => r.pension > 0);
  const fundedBlock = (
      <>
        <div className="hero">
          <div className="hero-value">{Math.round(funded * 100)}%</div>
          <div className="hero-sub">
            {over ? 'Funded' : 'Underfunded'}: the plan supports {$(sustainable)} per year after tax to {end}
            {view.legacy && <>, leaving the {$(view.legacy.target)} legacy goal{view.legacy.measure === 'afterTax' ? ' after tax' : ''}</>}; the retirement
            income number is {$(need)}.
          </div>
        </div>
        <p className="hint">
          {s.runsOut
            ? `At ${$(need)} per year the money runs out after ${s.lastsLabel}.`
            : `At ${$(need)} per year the money lasts to ${end}, with ${$(s.endingBalance.total)} left.`}{' '}
          Sustainable spending is the highest steady after-tax income, in today&rsquo;s dollars, that lasts to the end age
          {view.legacy ? ' and leaves the legacy goal (Retirement spending weighs it).' : '.'}
        </p>
      </>
  );
  const strategies = (
      <>
        <p className="hint">
          Each strategy run at the retirement income number ({$(need)} per year), all else the same. The chosen one is marked.
        </p>
        <table className="compare-table strategy-table">
          <thead>
            <tr>
              <th scope="col">Strategy</th>
              <th scope="col">Lifetime income tax</th>
              {showIrmaa && <th scope="col">Medicare IRMAA</th>}
              <th scope="col">After tax for heirs at the end</th>
              <th scope="col">Money lasts to</th>
            </tr>
          </thead>
          <tbody>
            {view.strategies.map((st) => {
              const best = st.endingAfterTax === Math.max(...view.strategies.map((x) => x.endingAfterTax));
              return (
                <tr key={st.id} className={st.id === view.strategy ? 'chosen-row' : undefined}>
                  <th scope="row">
                    {st.label}
                    {st.id === view.strategy && <span className="dim"> (chosen)</span>}
                  </th>
                  <td>{$(st.totalIncomeTax)}</td>
                  {showIrmaa && <td>{$(st.totalIrmaa)}</td>}
                  <td>
                    {$(st.endingAfterTax)}
                    {best && <span className="pill"> most left</span>}
                  </td>
                  <td>{st.runsOut ? st.lastsLabel : 'the end'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">
          Medicare IRMAA: the Part B and Part D surcharges from 65, set by income two years earlier (when included in
          Assumptions). The strategies don&rsquo;t aim around its thresholds; they only pay it. Not modeled yet: the 10-year
          rule for heirs of Pre-tax accounts.
        </p>
      </>
  );
  const lifetime = (
      <>
        <div className="calc">
          <div className="calc-row"><span>Total tax paid (income and payroll)</span><span>{$(s.totalTax)}</span></div>
          <div className="calc-row sub"><span>of which federal income tax</span><span>{$(s.totalIncomeTax)}</span></div>
          {s.totalIrmaa > 0 && (
            <div className="calc-row">
              <span>Medicare IRMAA surcharges ({s.irmaaYears} {s.irmaaYears === 1 ? 'year' : 'years'})</span>
              <span>{$(s.totalIrmaa)}</span>
            </div>
          )}
          <div className="calc-row"><span>After-tax income in retirement, all years</span><span>{$(s.retirementAfterTaxIncome)}</span></div>
          <div className="calc-row"><span>Average tax rate (income tax ÷ gross income)</span><span>{formatPercent(s.averageEffectiveRate)}</span></div>
          <div className="calc-row"><span>Highest-tax year</span><span>{s.highestTaxYear.year}: {$(s.highestTaxYear.amount)}</span></div>
          <div className="calc-row"><span>Money lasts to</span><span>{s.runsOut ? s.lastsLabel : `${end} (the end)`}</span></div>
          <div className="calc-row total"><span>Ending balance at {end}</span><span>{$(s.endingBalance.total)}</span></div>
          <div className="calc-row sub"><span>Pre-tax / Roth / taxable</span><span>{$(s.endingBalance.pretax)} / {$(s.endingBalance.roth)} / {$(s.endingBalance.taxable)}</span></div>
          <div className="calc-row"><span>Ending balance after tax for heirs (Pre-tax at {formatPercent(s.heirTaxRate, 0)}{s.charityShare > 0 ? `; ${formatPercent(s.charityShare, 0)} to charity, Pre-tax first` : ''})</span><span>{$(s.endingAfterTax)}</span></div>
        </div>
        <p className="hint">
          All in today&rsquo;s dollars. Heirs pay no tax on Roth money, and inherited taxable accounts get a step-up in
          cost basis, so they count in full.
        </p>
      </>
  );
  const income = retired.length > 0 && (
          <StackedBarChart
            x={retired.map((r) => r.year)}
            stacks={[
              { key: 'ss', label: 'Social Security', color: COLORS.ss, values: retired.map((r) => r.socialSecurity) },
              ...(anyPension ? [{ key: 'pension', label: 'Pensions', color: COLORS.pension, values: retired.map((r) => r.pension) }] : []),
              { key: 'pretax', label: 'Pre-tax withdrawals', color: COLORS.pretax, values: retired.map((r) => r.withdrawals.pretax) },
              { key: 'taxable', label: 'Taxable withdrawals', color: COLORS.taxable, values: retired.map((r) => r.withdrawals.taxable) },
              { key: 'roth', label: 'Roth withdrawals', color: COLORS.roth, values: retired.map((r) => r.withdrawals.roth) },
            ]}
            line={{ key: 'tax', label: 'Total tax', values: retired.map((r) => r.totalTax) }}
            shadeFrom={death ? { x: death.firstSurvivorYear, label: 'Survivor years' } : undefined}
            formatX={(v) => `${v}`}
            formatY={(v) => $(v)}
            formatYTick={short}
            xLabel="Year"
            yLabel="Dollars per year (today's)"
          />
  );
  const balances = (
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
          shadeFrom={death ? { x: death.year, label: 'Survivor years' } : undefined}
          xLabel="Year (end of year)"
          yLabel="Balance (today's dollars)"
        />
  );
  return (
    <Blocks
      blocks={[
        { id: 'funded', title: 'Funded status', summary: h.funded, className: 'key-card', content: fundedBlock },
        { id: 'strategies', title: 'Compare withdrawal strategies', summary: h.strategies, content: strategies },
        { id: 'summary', title: 'Lifetime summary', summary: h.summary, content: lifetime },
        income && { id: 'income', title: 'Income by source in retirement', summary: h.income, content: income },
        { id: 'balances', title: 'Balances over time', summary: h.balances, content: balances },
        { id: 'table', title: 'Year by year', summary: h.table, content: <YearTable rows={rows} /> },
      ]}
      disclaimer="Estimates only — not tax or financial advice. Today’s dollars at constant after-inflation returns (before and in retirement); spending flat; income rows by their ages, earnings flat in today’s dollars; withdrawals by the chosen strategy once anyone retires, with RMDs as a floor; survivor years from the first life expectancy; no state tax. IRMAA tiers in today’s dollars, at this year’s amounts."
    />
  );
}
