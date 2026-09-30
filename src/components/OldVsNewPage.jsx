// TEMPORARY (2026-09-29): "Old vs. new calculation" test page (#/old-vs-new). Charts the
// current rate calculation (sideAwareRates.js) against the restored pre-2026-09-28 one
// (`result.old`) across the Visualization page's scenarios, and checks both against an
// independent benchmark. Delete with `result.old` (see CLAUDE.md's removal checklist).
import { useEffect, useMemo, useState } from 'react';
import LineChart from './charts/LineChart.jsx';
import {
  differenceCauses,
  flattenPoints,
  runMethodBatch,
  runMethodHeatmap,
  summarize,
  toFormValues,
} from '../lib/methodCheck.js';
import { valuesToSearch } from '../lib/shareInputs.js';
import { HEATMAPS, SCENARIO_BATCHES } from '../data/scenarioBatches.js';
import { CALCULATOR_HASH } from '../lib/route.js';

const CURRENT_YEAR = new Date().getFullYear();

// Line identities on this page (Roth blue / Pre-tax orange keep their meaning for winners).
const NEW_COLOR = 'var(--series-3)';
const OLD_COLOR = 'var(--series-5)';
const NOW_COLOR = 'var(--series-4)';
const MARGINAL_COLOR = 'var(--dim)';
const ROTH_COLOR = 'var(--series-1)';
const PRETAX_COLOR = 'var(--series-2)';
const WINNER_ZONES = {
  above: { label: '▲ Roth comes out ahead', color: ROTH_COLOR },
  below: { label: '▼ Pre-tax comes out ahead', color: PRETAX_COLOR },
};
// The lifestyle values the calculator's dropdown offers (a link with any other value would
// compute correctly but show the wrong choice in the form).
const LINKABLE_LIFESTYLES = new Set([0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2]);

const sign = (v) => (v >= 0 ? '+' : '−');
const fmtRate = (v) => (Math.abs(v * 100) < 0.05 ? '0.0%' : `${(v * 100).toFixed(1)}%`);
const fmtRateTick = (v) => `${Number((v * 100).toFixed(1))}%`;
const fmtPts = (v) => `${sign(v)}${Math.abs(v * 100).toFixed(1)} pts`;
const fmtPct = (v) => `${sign(v)}${Math.abs(v).toFixed(1)}%`;
const fmtPctTick = (v) => (v === 0 ? '0%' : `${sign(v)}${Number(Math.abs(v).toFixed(1))}%`);
const fmtMoney = (v) => `$${Math.round(v).toLocaleString('en-US')}`;
const fmtSignedMoney = (v) => (Math.round(v) === 0 ? '$0' : `${sign(v)}${fmtMoney(Math.abs(v))}`);
const fmtCompact = (v) => {
  if (v === 0) return '$0';
  return v >= 1000000 ? `$${Number((v / 1000000).toFixed(1))}M` : `$${(v / 1000).toFixed(0)}k`;
};
const fmtX = (xType, x) => {
  if (xType === 'multiple') return `${x.toFixed(1)}×`;
  if (xType === 'age') return String(x);
  return fmtCompact(x);
};
const WINNER_LABEL = { roth: 'Roth', pretax: 'Pre-tax', even: 'Even' };

function Winner({ winner }) {
  const color = winner === 'roth' ? ROTH_COLOR : winner === 'pretax' ? PRETAX_COLOR : 'var(--dim)';
  return (
    <span className="ovn-winner">
      <span className="ovn-dot" style={{ background: color }} aria-hidden="true" />
      {WINNER_LABEL[winner]}
    </span>
  );
}

function calculatorLink(inputs) {
  if (!LINKABLE_LIFESTYLES.has(inputs.retirementLifestyle)) return null;
  return `${valuesToSearch(toFormValues(inputs))}${CALCULATOR_HASH}`;
}

function BackLink() {
  return (
    <a className="back-link" href={CALCULATOR_HASH}>
      &larr; Back to the calculator
    </a>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const SORTS = {
  rate: {
    label: 'Biggest difference in the effective rate',
    key: (p) => Math.abs(p.new.effective - p.old.effective),
  },
  dollars: {
    label: 'Biggest dollar miss by the old calculation',
    key: (p) => Math.abs(p.old.difference - p.exact.difference),
  },
  flips: {
    label: 'Winner differs (sorted by the old calculation’s dollar miss)',
    key: (p) => Math.abs(p.old.difference - p.exact.difference),
    filter: (p) => p.new.winner !== p.old.winner,
  },
};

function DifferTable({ points }) {
  const [sortKey, setSortKey] = useState('flips');
  const [limit, setLimit] = useState(25);
  const sort = SORTS[sortKey];
  const rows = useMemo(
    () => points.filter(sort.filter ?? (() => true)).sort((a, b) => sort.key(b) - sort.key(a)),
    [points, sort],
  );

  return (
    <div className="card">
      <h2>Where they differ most</h2>
      <div className="ovn-controls">
        <label>
          Show{' '}
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className="hint">
          {Math.min(limit, rows.length)} of {rows.length} scenarios
        </span>
      </div>
      <div className="table-wrap">
        <table className="ovn-table">
          <thead>
            <tr>
              <th className="row-head">Scenario</th>
              <th>Rate now</th>
              <th>Effective rate, new</th>
              <th>Effective rate, old</th>
              <th>Withdrawal measured, new</th>
              <th>Withdrawal measured, old</th>
              <th>Winner, new</th>
              <th>Winner, old</th>
              <th>Exact at 4%: Pre-tax − Roth</th>
              <th>Old misses by</th>
              <th>Why they differ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((p) => {
              const link = calculatorLink(p.inputs);
              const miss = p.old.difference - p.exact.difference;
              return (
                <tr key={p.id} className={p.new.winner !== p.old.winner ? 'ovn-flip' : undefined}>
                  <th className="row-head">
                    <div>{p.source.title}</div>
                    <div className="ovn-sub">
                      {p.source.series} · {fmtX(p.source.xType, p.source.x)}
                    </div>
                  </th>
                  <td>
                    {fmtRate(p.new.rateNow)}
                    {Math.abs(p.new.rateNow - p.old.rateNow) > 0.0005 && (
                      <div className="ovn-sub">old: {fmtRate(p.old.rateNow)} marginal</div>
                    )}
                  </td>
                  <td>{fmtRate(p.new.effective)}</td>
                  <td>{fmtRate(p.old.effective)}</td>
                  <td>{fmtMoney(p.new.measuredOn)}</td>
                  <td>
                    {fmtMoney(p.old.measuredOn)}
                    {p.old.measuredOn === 0 && <div className="ovn-sub">probe of {fmtMoney(p.new.measuredOn)}</div>}
                  </td>
                  <td>
                    <Winner winner={p.new.winner} />
                  </td>
                  <td>
                    <Winner winner={p.old.winner} />
                  </td>
                  <td>
                    {fmtSignedMoney(p.exact.difference)}/yr
                    <div className="ovn-sub">
                      <Winner winner={p.exact.winner} />
                    </div>
                  </td>
                  <td>{fmtSignedMoney(miss)}/yr</td>
                  <td className="ovn-causes">{differenceCauses(p).join('; ') || '—'}</td>
                  <td>
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button type="button" className="link-button" onClick={() => setLimit((n) => n + 50)}>
          Show 50 more
        </button>
      )}
    </div>
  );
}

// A break-even map with both answers per cell: tinted by the benchmark's winner, outlined
// where the old calculation names a different winner than the new one.
function AgreementMap({ heatmap }) {
  const incomes = heatmap.rows[0].cells.map((c) => c.income);
  const tint = (cell) => {
    if (cell.exact.winner === 'even') return undefined;
    const color = cell.exact.winner === 'roth' ? ROTH_COLOR : PRETAX_COLOR;
    const strength = Math.min(Math.abs(cell.exact.advantagePct) / 20, 1);
    return { background: `color-mix(in srgb, ${color} ${Math.round(8 + strength * 47)}%, transparent)` };
  };
  const initial = (w) => (w === 'roth' ? 'R' : w === 'pretax' ? 'P' : '=');
  const differ = heatmap.rows.reduce((n, row) => n + row.cells.filter((c) => c.new.winner !== c.old.winner).length, 0);
  const total = heatmap.rows.length * incomes.length;

  return (
    <div className="card">
      <h2>{heatmap.title}</h2>
      <p className="hint">
        Each cell shows the winner as <strong>new / old</strong> (R = Roth, P = Pre-tax, = = about even). The tint is
        the exact 4% answer. <strong>Outlined cells</strong> are where the two calculations pick different winners:{' '}
        {differ} of {total} here.
      </p>
      <div className="table-wrap">
        <table className="heatmap ovn-map">
          <thead>
            <tr>
              <th scope="col" className="heatmap-corner">
                {heatmap.rowHeading} &darr; &nbsp; Income &rarr;
              </th>
              {incomes.map((i) => (
                <th scope="col" key={i}>
                  {fmtCompact(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((row) => (
              <tr key={row.key ?? row.label}>
                <th scope="row">{row.label}</th>
                {row.cells.map((c) => {
                  const flip = c.new.winner !== c.old.winner;
                  return (
                    <td
                      key={c.income}
                      className={flip ? 'ovn-map-flip' : undefined}
                      style={tint(c)}
                      title={`New: ${WINNER_LABEL[c.new.winner]} (${fmtPct(c.new.advantagePct)} Roth advantage, effective ${fmtRate(
                        c.new.effective,
                      )}). Old: ${WINNER_LABEL[c.old.winner]} (${fmtPct(c.old.advantagePct)}, effective ${fmtRate(
                        c.old.effective,
                      )}). Exact at 4%: ${fmtPct(c.exact.advantagePct)}.`}
                    >
                      {initial(c.new.winner)} / {initial(c.old.winner)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchCompare({ batch }) {
  const [seriesIndex, setSeriesIndex] = useState(0);
  const s = batch.series[Math.min(seriesIndex, batch.series.length - 1)];
  const xTicks = s.points.map((p) => p.x);
  const anyOverLimit = s.points.some((p) => p.overLimit);
  const line = (key, label, color, y) => ({ key, label, color, points: s.points.map((p) => ({ x: p.x, y: y(p) })) });

  const rateSeries = [
    line('marginal', 'Marginal rate now (old compares against this)', MARGINAL_COLOR, (p) => p.old.rateNow),
    ...(anyOverLimit ? [line('now', 'Tax saved now (new compares against this)', NOW_COLOR, (p) => p.new.rateNow)] : []),
    line('new', 'Effective rate, new', NEW_COLOR, (p) => p.new.effective),
    line('old', 'Effective rate, old', OLD_COLOR, (p) => p.old.effective),
  ];
  const advantageSeries = [
    line('new', 'New (= exact at 4%)', NEW_COLOR, (p) => p.new.advantagePct),
    line('old', 'Old', OLD_COLOR, (p) => p.old.advantagePct),
  ];
  const flips = s.points.filter((p) => p.new.winner !== p.old.winner).length;

  return (
    <div className="card">
      <h2>{batch.title}</h2>
      <div className="ovn-controls">
        {batch.series.length > 1 && (
          <label>
            Line{' '}
            <select value={seriesIndex} onChange={(e) => setSeriesIndex(Number(e.target.value))}>
              {batch.series.map((ser, i) => (
                <option key={ser.key} value={i}>
                  {ser.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="hint">
          Winners differ at {flips} of {s.points.length} points{anyOverLimit ? '; some points are over the IRS limit' : ''}.
        </span>
      </div>
      <div className="ovn-pair">
        <div>
          <h3 className="ovn-chart-title">Tax rates</h3>
          <LineChart
            series={rateSeries}
            xTicks={xTicks}
            formatX={(x) => fmtX(batch.xType, x)}
            formatY={fmtRate}
            formatYTick={fmtRateTick}
            xLabel={batch.xLabel}
            yLabel="Tax rate"
          />
        </div>
        <div>
          <h3 className="ovn-chart-title">Who comes out ahead</h3>
          <LineChart
            series={advantageSeries}
            xTicks={xTicks}
            formatX={(x) => fmtX(batch.xType, x)}
            formatY={fmtPct}
            formatYTick={fmtPctTick}
            xLabel={batch.xLabel}
            yLabel="Roth advantage (% of Pre-tax income)"
            zones={WINNER_ZONES}
          />
        </div>
      </div>
      <details className="details">
        <summary>Show the numbers</summary>
        <div className="details-body">
          <div className="table-wrap">
            <table className="ovn-table">
              <thead>
                <tr>
                  <th className="row-head">{batch.xLabel}</th>
                  <th>Marginal now</th>
                  <th>Tax saved now (new)</th>
                  <th>Effective, new</th>
                  <th>Effective, old</th>
                  <th>Gap, new</th>
                  <th>Gap, old</th>
                  <th>Measured on, new</th>
                  <th>Measured on, old</th>
                  <th>Winner, new</th>
                  <th>Winner, old</th>
                  <th>Exact: Pre-tax − Roth</th>
                  <th>Old: Pre-tax − Roth</th>
                </tr>
              </thead>
              <tbody>
                {s.points.map((p) => (
                  <tr key={p.x} className={p.new.winner !== p.old.winner ? 'ovn-flip' : undefined}>
                    <th className="row-head">{fmtX(batch.xType, p.x)}</th>
                    <td>{fmtRate(p.old.rateNow)}</td>
                    <td>{fmtRate(p.new.rateNow)}</td>
                    <td>{fmtRate(p.new.effective)}</td>
                    <td>{fmtRate(p.old.effective)}</td>
                    <td>{fmtPts(p.new.rateNow - p.new.effective)}</td>
                    <td>{fmtPts(p.old.rateNow - p.old.effective)}</td>
                    <td>{fmtMoney(p.new.measuredOn)}</td>
                    <td>{fmtMoney(p.old.measuredOn)}</td>
                    <td>
                      <Winner winner={p.new.winner} />
                    </td>
                    <td>
                      <Winner winner={p.old.winner} />
                    </td>
                    <td>{fmtSignedMoney(p.exact.difference)}</td>
                    <td>{fmtSignedMoney(p.old.difference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}

export default function OldVsNewPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Old vs. new calculation — Roth vs. Pre-Tax Calculator';
    return () => {
      document.title = previous;
    };
  }, []);

  // The "earning more later" batches use risingIncome.js, which has no old calculation.
  const batches = useMemo(
    () => SCENARIO_BATCHES.filter((b) => !b.engine).map((b) => runMethodBatch(b, CURRENT_YEAR)),
    [],
  );
  const heatmaps = useMemo(() => HEATMAPS.map((h) => runMethodHeatmap(h, CURRENT_YEAR)), []);
  const points = useMemo(() => flattenPoints(batches, heatmaps), [batches, heatmaps]);
  const summary = useMemo(() => summarize(points), [points]);

  return (
    <article className="scenarios-page ovn-page">
      <BackLink />
      <div className="scenarios-intro">
        <h1>Old vs. new calculation (test page)</h1>
        <p className="hint">Temporary, for checking the two calculations against each other. Not linked from the site.</p>
        <p>
          <strong>New</strong> (the calculator today): the effective rate is the extra tax caused by Future
          Contributions&rsquo; own 4% withdrawal, stacked on Social Security, Existing Accounts and the Pre-tax
          scenario&rsquo;s taxable side account. It is compared with the tax saved now, net of any tax on investing it.
        </p>
        <p>
          <strong>Old</strong> (before 2026-09-28): the effective rate is measured on the withdrawal needed to reach the
          retirement income number on top of Social Security and Existing Accounts (or on a probe when they already
          cover it), then applied to the account&rsquo;s own 4% withdrawal. It is compared with the plain marginal
          rate, and the side account is taxed after the account&rsquo;s withdrawal.
        </p>
        <p className="rule-callout">
          <strong>The benchmark</strong> is the exact after-tax income each whole portfolio delivers at a plain 4%
          withdrawal from every account, solved separately in the total-portfolio code. The new calculation was built to
          equal it, so a match is expected and confirms the code. The benchmark shares the new method&rsquo;s key
          assumption: that the account pays out 4% whatever the retirement income number is.
        </p>
      </div>

      <div className="stats ovn-stats">
        <Stat label="Scenarios run" value={summary.count} sub={`${summary.clearCount} with a clear winner at 4%`} />
        <Stat
          label="Winners differ"
          value={summary.winnersDiffer}
          sub={`${((summary.winnersDiffer / summary.count) * 100).toFixed(0)}% of scenarios`}
        />
        <Stat
          label="Contradicts the benchmark"
          value={`${summary.newContradicts} new / ${summary.oldContradicts} old`}
          sub="names the other side as the winner"
        />
        <Stat
          label="Largest dollar miss"
          value={`${fmtMoney(summary.newMaxError)} / ${fmtMoney(summary.oldMaxError)}`}
          sub="new / old, per year, vs. the benchmark"
        />
        <Stat
          label="Old rate lean vs. old verdict"
          value={summary.oldLeanVsOwnWinner}
          sub="scenarios where the old calculation disagreed with itself"
        />
      </div>

      <DifferTable points={points} />
      {heatmaps.map((h) => (
        <AgreementMap key={h.key} heatmap={h} />
      ))}
      {batches.map((b) => (
        <BatchCompare key={b.key} batch={b} />
      ))}
      <BackLink />
    </article>
  );
}
