// "Over a lifetime" (roadmap phase 6), two blocks on the Roth page below the first-year results:
// Roth vs. Pre-tax Future Contributions, each projected year by year to the end age, side by side;
// then "Show full table", every year of either scenario. Renders lib/lifetimeComparison.js; no math
// of its own.
import { useState } from 'react';
import Collapsible from '../components/Collapsible.jsx';
import GroupedBarChart from '../components/charts/GroupedBarChart.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import { lifetimeHeadline } from '../lib/blockHeadlines.js';
import { formatCurrency as $ } from '../lib/format.js';
import { breakEvenRateShift } from '../lib/lifetimeComparison.js';
import { STRATEGIES, strategyById } from '../lib/strategies.js';
import { YearTable } from './ProjectionResult.jsx';

// Roth = blue, Pre-tax = orange, as everywhere the app shows a winner.
const ROTH_COLOR = 'var(--series-1)';
const PRETAX_COLOR = 'var(--series-2)';
const short = (v) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`);
const signed = (v) => `${v >= 0 ? '+' : '−'}${$(Math.abs(v))}`;
const VERDICT = { roth: 'Roth', pretax: 'Pre-tax' };

function BreakEven({ household, result, endAge, winner }) {
  const [state, setState] = useState({ status: 'idle' });
  const run = () => {
    setState({ status: 'working' });
    // Let the "Working" note paint before the long search runs.
    const strategy = strategyById(household.calculators?.projection?.strategy);
    setTimeout(() => setState({ status: 'done', shift: breakEvenRateShift(household, result, { endAge, strategy }) }), 30);
  };
  if (state.status === 'idle') {
    return (
      <button type="button" className="button secondary" onClick={run}>
        Find the break-even tax change
      </button>
    );
  }
  if (state.status === 'working') return <p className="hint">Working&hellip; (a few seconds: dozens of whole projections)</p>;
  const pts = state.shift === null ? null : Math.round(state.shift * 1000) / 10;
  return (
    <p>
      {pts === null
        ? 'The leader does not change even if ordinary rates in retirement move anywhere between −10 and +30 points.'
        : `${VERDICT[winner]} stays ahead unless ordinary tax rates in retirement ${pts > 0 ? 'rise' : 'fall'} by more than ${Math.abs(pts)} points.`}
    </p>
  );
}

export default function LifetimeComparison({ lifetime, household, result }) {
  const [tableFor, setTableFor] = useState('roth');
  const [open, setOpen] = useState(true);
  const [tableOpen, setTableOpen] = useState(false);
  if (!lifetime) return null;
  const { roth, pretax, winner, difference: d, wealthGap, crossoverYear } = lifetime;
  const endAge = roth.endAge;
  const firstYearWinner = result.comparison.winner;
  const retiredYears = roth.rows.filter((r) => r.working.some((w) => !w)).map((r) => r.year);
  const taxEachYear = (rows) => rows.filter((r) => retiredYears.includes(r.year)).map((r) => r.totalTax);
  const rows = [
    ['Sustainable spending, after tax, a year', roth.sustainable, pretax.sustainable, d.sustainable, true],
    ['Lifetime tax (income and payroll)', roth.summary.totalTax, pretax.summary.totalTax, d.totalTax],
    [`Ending balance at ${endAge}`, roth.summary.endingBalance.total, pretax.summary.endingBalance.total, roth.summary.endingBalance.total - pretax.summary.endingBalance.total],
    [`Ending balance after tax for heirs`, roth.summary.endingAfterTax, pretax.summary.endingAfterTax, d.endingAfterTax],
  ];
  return (
    <>
    <Collapsible
      headingId="lifetime"
      className="lifetime-card"
      title="Over a lifetime, year by year"
      summary={lifetimeHeadline(lifetime)}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <p className="lead-verdict">
        <strong>
          {winner === 'even'
            ? 'About even'
            : `${VERDICT[winner]} supports ${$(Math.abs(d.sustainable))} a year more`}
        </strong>{' '}
        of steady after-tax spending to age {endAge}.
      </p>
      <p className="hint">
        Both scenarios cost the same take-home pay every working year and spend the same in retirement (the retirement
        income number, {$(lifetime.need)}). Each runs the year-by-year projection: Future Contributions all Roth, or all
        Pre-tax, with RMDs, Social Security timing and the inflation-shrunk thresholds. Withdrawals:{' '}
        {(STRATEGIES.find((s) => s.id === household.calculators?.projection?.strategy) ?? STRATEGIES[0]).label.toLowerCase()} (set on
        the projection page).
        {firstYearWinner !== 'even' && winner !== 'even' && firstYearWinner !== winner && (
          <>
            {' '}
            The first-year comparison above favors {VERDICT[firstYearWinner]}; over a lifetime, later years (RMDs pushing
            withdrawals into higher brackets, or lower ones) change the answer.
          </>
        )}
      </p>
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Roth</th>
            <th scope="col">Pre-tax</th>
            <th scope="col">Roth − Pre-tax</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, diff, bold]) => (
            <tr key={label} className={bold ? 'total-row' : undefined}>
              <th scope="row">{label}</th>
              <td>{$(a)}</td>
              <td>{$(b)}</td>
              <td>{signed(diff)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Money lasts to</th>
            <td>{roth.summary.runsOut ? `age ${roth.summary.moneyLastsTo}` : endAge}</td>
            <td>{pretax.summary.runsOut ? `age ${pretax.summary.moneyLastsTo}` : endAge}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <h3 className="subhead">Who is ahead, year by year</h3>
      <LineChart
        series={[{ key: 'gap', label: 'Roth − Pre-tax, after-tax wealth', color: 'var(--text)', points: wealthGap.map((g) => ({ x: g.year, y: g.value })) }]}
        xTicks={wealthGap.map((g) => g.year)}
        formatX={(v) => `${v}`}
        formatY={(v) => signed(v)}
        formatYTick={short}
        markers={false}
        zones={{
          above: { label: '▲ Roth ahead', color: ROTH_COLOR },
          below: { label: '▼ Pre-tax ahead', color: PRETAX_COLOR },
        }}
        xLabel="Year"
        yLabel="After-tax wealth gap"
      />
      <p className="hint">
        After-tax wealth: balances with Pre-tax money at the heirs&rsquo; {Math.round(roth.summary.heirTaxRate * 100)}%
        rate.{' '}
        {crossoverYear ? `The leader changes in ${crossoverYear}.` : 'The leader never changes.'}
      </p>

      <h3 className="subhead">Tax each year in retirement</h3>
      <GroupedBarChart
        x={retiredYears}
        series={[
          { key: 'roth', label: 'Roth scenario', color: ROTH_COLOR, values: taxEachYear(roth.rows) },
          { key: 'pretax', label: 'Pre-tax scenario', color: PRETAX_COLOR, values: taxEachYear(pretax.rows) },
        ]}
        formatX={(v) => `${v}`}
        formatY={(v) => $(v)}
        formatYTick={short}
        xLabel="Year"
        yLabel="Total tax (today's dollars)"
      />

      <h3 className="subhead">If tax rates change</h3>
      {winner === 'even' ? (
        <p className="hint">The two are about even today, so there is no break-even to find.</p>
      ) : (
        <BreakEven household={household} result={result} endAge={endAge} winner={winner} />
      )}
    </Collapsible>
    <Collapsible
      headingId="lifetime-table"
      className="lifetime-table-card"
      title="Show full table"
      summary={`Every year to age ${endAge}, Roth or Pre-tax scenario`}
      open={tableOpen}
      onToggle={() => setTableOpen(!tableOpen)}
    >
      <div className="segmented" role="group" aria-label="Scenario">
        {['roth', 'pretax'].map((k) => (
          <button key={k} type="button" className={tableFor === k ? 'segment active' : 'segment'} aria-pressed={tableFor === k} onClick={() => setTableFor(k)}>
            {VERDICT[k]} scenario
          </button>
        ))}
      </div>
      {tableOpen && <YearTable rows={(tableFor === 'roth' ? roth : pretax).rows} />}
    </Collapsible>
    </>
  );
}
