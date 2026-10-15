// "With Roth conversions in the lower years" (roadmap phase 7, decided 2026-10-15), on the Roth page
// below "Over a lifetime": the bracket each year against a chosen rate, then the lifetime answer again
// with conversions in the years taxed below it, beside the answer without them, and the conversions
// year by year. Renders lib/lowerYearConversions.js; no math of its own.
import { useMemo, useState } from 'react';
import Collapsible from '../components/Collapsible.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import { lowerYearsHeadline, lowerYearsSentence } from '../lib/blockHeadlines.js';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import { lifetimeOptions } from '../lib/lifetimeComparison.js';
import { compareWithConversions } from '../lib/lowerYearConversions.js';

const ROTH_COLOR = 'var(--series-1)';
const PRETAX_COLOR = 'var(--series-2)';
const VERDICT = { roth: 'Roth', pretax: 'Pre-tax' };
const RATES = [0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const pct = (r) => formatPercent(r, 0);
const signed = (v) => `${v >= 0 ? '+' : '−'}${$(Math.abs(v))}`;

// lifetime: the page's comparison without conversions (run with the same options).
export default function LowerYearConversions({ lifetime, household, result, open = true }) {
  const [ownOpen, setOwnOpen] = useState(true);
  const [choice, setChoice] = useState('today');
  const [irmaaCap, setIrmaaCap] = useState(false);
  const [yearsFor, setYearsFor] = useState('pretax');
  const shown = open && ownOpen;
  const c = useMemo(
    () =>
      compareWithConversions(household, result, {
        ...lifetimeOptions(household),
        rate: choice === 'today' ? undefined : Number(choice),
        irmaaCap,
        without: lifetime,
      }),
    [household, result, lifetime, choice, irmaaCap],
  );
  const today = result.rates.contributionRate ?? result.rates.marginalNow;
  const years = c.without.roth.rows.map((r) => r.year);
  const bracketLine = (rows) => rows.map((r) => ({ x: r.year, y: r.ordinaryBracketRate }));
  const figures = (l) => [
    ['Sustainable spending, after tax, per year', l.roth.sustainable, l.pretax.sustainable, l.difference.sustainable, true],
    ['Lifetime tax (income and payroll)', l.roth.summary.totalTax, l.pretax.summary.totalTax, l.difference.totalTax],
    ['Ending balance after tax for heirs', l.roth.summary.endingAfterTax, l.pretax.summary.endingAfterTax, l.difference.endingAfterTax],
  ];
  const list = c[yearsFor];
  const irmaaOn = Boolean(household.assumptions?.medicareIrmaa);
  return (
    <Collapsible
      headingId="lower-years"
      className="lifetime-card"
      title="With Roth conversions in the lower years"
      summary={lowerYearsHeadline(c)}
      open={shown}
      onToggle={() => setOwnOpen(!shown)}
    >
      <div className="planner-form">
        <label>
          Convert in the years taxed below{' '}
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="today">today&rsquo;s rate on contributions ({pct(today)})</option>
            {RATES.map((r) => (
              <option key={r} value={String(r)}>
                {pct(r)}
              </option>
            ))}
          </select>
        </label>
        {irmaaOn && (
          <label>
            <input type="checkbox" checked={irmaaCap} onChange={(e) => setIrmaaCap(e.target.checked)} /> Also stop each year at the next IRMAA tier
          </label>
        )}
      </div>

      <p className="lead-verdict">
        <strong>{lowerYearsSentence(c)}</strong>
      </p>
      <p className="hint">
        {c.fill
          ? `Each retired year taxed below ${pct(c.rate)} converts Pre-tax money to Roth until its taxable income reaches the top of the ${pct(c.fill.rate)} bracket, so every converted dollar is taxed below ${pct(c.rate)}`
          : `No bracket is below ${pct(c.rate)}, so nothing converts`}
        {c.fill && irmaaCap ? ', or until the next IRMAA tier, whichever comes first' : ''}. RMD years convert too, on top of the RMD. Both
        scenarios convert, the Roth one its existing Pre-tax money. The conversions come on top of any the plan already
        makes (its withdrawal strategy or the year-by-year planner), and their tax is paid as every conversion&rsquo;s is:
        from a taxable account, else held back from the conversion.
        {c.with.difference.sustainable === c.without.difference.sustainable && (c.converted.roth > 0 || c.converted.pretax > 0)
          ? ' Sustainable spending is unchanged: at the most each scenario can spend, its withdrawals already fill the lower brackets, so the rule finds no room; the other figures and the conversions below are at the plan’s spending need.'
          : ' Sustainable spending runs each scenario at the most it can spend, which can fill the lower brackets by itself; the other figures and the conversions below are at the plan’s spending need.'}
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
        {[
          ['Without conversions', c.without, null],
          [`Converting in the years below ${pct(c.rate)}`, c.with, c.converted],
        ].map(([heading, l, converted]) => (
          <tbody key={heading}>
            <tr className="group-row">
              <th scope="colgroup" colSpan={4}>
                {heading}
              </th>
            </tr>
            {figures(l).map(([label, a, b, diff, bold]) => (
              <tr key={label} className={bold ? 'total-row' : undefined}>
                <th scope="row">{label}</th>
                <td>{$(a)}</td>
                <td>{$(b)}</td>
                <td>{signed(diff)}</td>
              </tr>
            ))}
            {converted && (
              <tr>
                <th scope="row">Converted in all</th>
                <td>{$(converted.roth)}</td>
                <td>{$(converted.pretax)}</td>
                <td />
              </tr>
            )}
          </tbody>
        ))}
      </table>

      <h3 className="subhead">Your tax bracket over time</h3>
      <LineChart
        series={[
          { key: 'rate', label: `Converting below ${pct(c.rate)}`, color: 'var(--text)', points: years.map((x) => ({ x, y: c.rate })) },
          { key: 'roth', label: 'Bracket, Roth scenario', color: ROTH_COLOR, points: bracketLine(c.without.roth.rows) },
          { key: 'pretax', label: 'Bracket, Pre-tax scenario', color: PRETAX_COLOR, points: bracketLine(c.without.pretax.rows) },
        ]}
        xTicks={years}
        formatX={(v) => `${v}`}
        formatY={(v) => pct(v)}
        markers={false}
        yFloor={0}
        xLabel="Year"
        yLabel="Marginal rate (the bracket)"
      />
      <p className="hint">
        Each year&rsquo;s bracket without conversions. The years below the line are the lower years, typically between
        retirement and the start of Social Security and RMDs.
      </p>

      <h3 className="subhead">The conversions, year by year</h3>
      <div className="segmented" role="group" aria-label="Scenario for the conversions">
        {['roth', 'pretax'].map((k) => (
          <button key={k} type="button" className={yearsFor === k ? 'segment active' : 'segment'} aria-pressed={yearsFor === k} onClick={() => setYearsFor(k)}>
            {VERDICT[k]} scenario
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="hint">No year converts in the {VERDICT[yearsFor]} scenario.</p>
      ) : (
        <div className="table-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Age</th>
                <th scope="col">Bracket without</th>
                <th scope="col">Converted</th>
                {irmaaOn && <th scope="col">IRMAA room left</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((y) => (
                <tr key={y.year}>
                  <th scope="row">{y.year}</th>
                  <td>{y.ages.join(' / ')}</td>
                  <td>{y.bracketBefore === null ? '—' : pct(y.bracketBefore)}</td>
                  <td>{$(y.converted)}</td>
                  {irmaaOn && <td>{y.irmaaRoom === null ? '—' : $(y.irmaaRoom)}</td>}
                </tr>
              ))}
              <tr className="total-row">
                <th scope="row">Total</th>
                <td />
                <td />
                <td>{$(c.converted[yearsFor])}</td>
                {irmaaOn && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {irmaaOn && (
        <p className="hint">
          IRMAA room left: how much more MAGI the year could have, conversion included, before the next Medicare IRMAA tier
          for the premium two years on (— when no one is on Medicare by then, or at the top tier).
        </p>
      )}
    </Collapsible>
  );
}
