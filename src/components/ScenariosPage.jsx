import { useEffect, useMemo } from 'react';
import Heatmap from './charts/Heatmap.jsx';
import LineChart from './charts/LineChart.jsx';
import ScatterChart from './charts/ScatterChart.jsx';
import { flattenForScatter, runAllBatches, runHeatmap } from '../lib/scenarios.js';
import { linearRegression } from '../lib/regression.js';
import { HEATMAPS, SCENARIO_BATCHES } from '../data/scenarioBatches.js';
import { CALCULATOR_HASH } from '../lib/route.js';

const CURRENT_YEAR = new Date().getFullYear();

const sign = (v) => (v >= 0 ? '+' : '−');
const formatGapPoints = (v) => `${sign(v)}${Math.abs(v * 100).toFixed(1)} pts`;
const formatAdvantagePct = (v) => `${sign(v)}${Math.abs(v).toFixed(1)}%`;
// Axis ticks drop the unit (the axis title carries it): +15.0 pts -> +15
const formatGapTick = (v) => (v === 0 ? '0' : `${sign(v)}${Number(Math.abs(v * 100).toFixed(1))}`);
const formatAdvantageTick = (v) => (v === 0 ? '0%' : `${sign(v)}${Number(Math.abs(v).toFixed(1))}%`);
// Rates that round to zero print as 0.0%, never "-0.0%".
const formatRate = (v) => (Math.abs(v * 100) < 0.05 ? '0.0%' : `${(v * 100).toFixed(1)}%`);
const formatRateTick = (v) => `${Number((v * 100).toFixed(1))}%`;
const formatCompactCurrency = (v) => {
  if (v === 0) return '$0';
  return v >= 1000000 ? `$${Number((v / 1000000).toFixed(1))}M` : `$${(v / 1000).toFixed(0)}k`;
};
const formatMultiplierX = (v) => `${v.toFixed(1)}×`;
const formatHeatCell = (cell) => {
  const rounded = Math.round(Math.abs(cell.advantagePct));
  return rounded === 0 ? '0%' : `${sign(cell.advantagePct)}${rounded}%`;
};
const formatHeatDetail = (cell) =>
  `Roth advantage ${formatAdvantagePct(cell.advantagePct)}, rate gap ${formatGapPoints(cell.gap)}`;

// Roth = blue, Pre-tax = orange everywhere the winner is shown (line-chart zones, heatmaps, scatter).
const ROTH_COLOR = 'var(--series-1)';
const PRETAX_COLOR = 'var(--series-2)';
const WINNER_ZONES = {
  above: { label: '▲ Roth comes out ahead', color: ROTH_COLOR },
  below: { label: '▼ Pre-tax comes out ahead', color: PRETAX_COLOR },
};
const WINNER_GROUPS = [
  { key: 'roth', label: 'Roth comes out ahead', color: ROTH_COLOR },
  { key: 'pretax', label: 'Pre-tax comes out ahead', color: PRETAX_COLOR },
  { key: 'even', label: 'About even', color: 'var(--dim)' },
];

function formatX(batch, x) {
  if (batch.xType === 'multiple') return formatMultiplierX(x);
  if (batch.xType === 'age') return String(x);
  return formatCompactCurrency(x);
}

function BackLink() {
  return (
    <a className="back-link" href={CALCULATOR_HASH}>
      &larr; Back to the calculator
    </a>
  );
}

function ValueTable({ batch, xTicks, valueOf, format, caption }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="table-caption-left">{caption}</caption>
        <thead>
          <tr>
            <th className="row-head">{batch.xLabel}</th>
            {batch.series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {xTicks.map((x, i) => (
            <tr key={x}>
              <th className="row-head">{formatX(batch, x)}</th>
              {batch.series.map((s) => (
                <td key={s.key}>{format(valueOf(s.points[i]))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One chart per scenario batch: who comes out ahead (Roth's advantage), with the zero line
// splitting Roth-ahead from Pre-tax-ahead.
function BatchChart({ batch }) {
  const xTicks = batch.series[0].points.map((p) => p.x);
  const series = batch.series.map((s) => ({
    key: s.key,
    label: s.label,
    points: s.points.map((p) => ({ x: p.x, y: p.advantagePct })),
  }));

  return (
    <div className="card">
      <h2>{batch.title}</h2>
      <p className="hint">{batch.description}</p>
      <LineChart
        series={series}
        xTicks={xTicks}
        formatX={(x) => formatX(batch, x)}
        formatY={formatAdvantagePct}
        formatYTick={formatAdvantageTick}
        xLabel={batch.xLabel}
        yLabel="Roth advantage (% of Pre-tax income)"
        zones={WINNER_ZONES}
      />

      <details className="details">
        <summary>Show the numbers</summary>
        <div className="details-body">
          <ValueTable
            batch={batch}
            xTicks={xTicks}
            valueOf={(p) => p.advantagePct}
            format={formatAdvantagePct}
            caption="Roth advantage (% of Pre-tax income)"
          />
        </div>
      </details>
    </div>
  );
}

// The two rates the gap is made of, as separate lines, for the plain income sweep.
function GapComponents({ batch }) {
  const points = batch.series[0].points;
  const xTicks = points.map((p) => p.x);
  const series = [
    { key: 'now', label: 'Marginal rate while working', points: points.map((p) => ({ x: p.x, y: p.marginalNow })) },
    {
      key: 'later',
      label: 'Effective rate on withdrawals in retirement',
      points: points.map((p) => ({ x: p.x, y: p.effectiveRetirement })),
    },
  ];

  return (
    <div className="card">
      <h2>What the rate gap is made of</h2>
      <p className="hint">
        Same scenarios as &ldquo;{batch.title}&rdquo;, with the two rates drawn as separate lines.{' '}
        <strong>The rate gap is the vertical distance between them.</strong>
      </p>
      <LineChart
        series={series}
        xTicks={xTicks}
        formatX={(x) => formatX(batch, x)}
        formatY={formatRate}
        formatYTick={formatRateTick}
        xLabel={batch.xLabel}
        yLabel="Tax rate"
      />
      <details className="details">
        <summary>Show the numbers</summary>
        <div className="details-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="row-head">{batch.xLabel}</th>
                  <th>Marginal rate while working</th>
                  <th>Effective rate in retirement</th>
                  <th>Rate gap</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.x}>
                    <th className="row-head">{formatX(batch, p.x)}</th>
                    <td>{formatRate(p.marginalNow)}</td>
                    <td>{formatRate(p.effectiveRetirement)}</td>
                    <td>{formatGapPoints(p.gap)}</td>
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

export default function ScenariosPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Visualization — Roth vs. Pre-Tax Calculator';
    return () => {
      document.title = previous;
    };
  }, []);

  const runBatches = useMemo(() => runAllBatches(SCENARIO_BATCHES, CURRENT_YEAR), []);
  const heatmaps = useMemo(() => HEATMAPS.map((def) => runHeatmap(def, CURRENT_YEAR)), []);
  const scatterPoints = useMemo(
    () => flattenForScatter(runBatches).map((p) => ({ ...p, x: p.gap, y: p.advantagePct, group: p.winner })),
    [runBatches],
  );
  const regression = useMemo(() => linearRegression(scatterPoints.map((p) => ({ x: p.x, y: p.y }))), [scatterPoints]);

  return (
    <article className="scenarios-page">
      <BackLink />

      <div className="scenarios-intro">
        <h1>Visualization: does the rate gap predict the winner?</h1>
        <p>
          The calculator&rsquo;s comparison boils down to one number: the <strong>rate gap</strong> &mdash; your
          marginal tax rate while working, minus the effective rate you&rsquo;d actually pay on withdrawals
          from your Future Contributions in retirement.
        </p>
        <p className="rule-callout">
          <strong>The rule of thumb: the higher that gap, the more Pre-tax should come out ahead</strong>; the
          lower (more negative) the gap, the more Roth should come out ahead.
        </p>
        <p>
          Every chart below shows who actually comes out ahead: above the zero line Roth does, below it Pre-tax
          does. Each is a set of hand-picked scenarios run through the same comparison the calculator uses
          (single filer, W-2 income, estimated Social Security, 7% return, no state tax &mdash; see{' '}
          <a href="#/how-it-works">How this works</a>). The rate gap itself is unpacked once, then two maps show
          where each side wins, and the last chart tests the rule of thumb against every scenario. Hover or focus
          any point for exact numbers; each chart has a table underneath.
        </p>
      </div>

      <div className="scenario-batches">
        {runBatches.map((batch) => (
          <div className="scenario-group" key={batch.key}>
            <BatchChart batch={batch} />
            {batch.key === 'incomeSweep' && <GapComponents batch={batch} />}
          </div>
        ))}

        {heatmaps.map((heatmap) => (
          <div className="card" key={heatmap.key}>
            <h2>{heatmap.title}</h2>
            <p className="hint">{heatmap.description}</p>
            <Heatmap
              rows={heatmap.rows}
              rowHeading={heatmap.rowHeading}
              formatIncome={formatCompactCurrency}
              formatCell={formatHeatCell}
              formatDetail={formatHeatDetail}
            />
          </div>
        ))}

        <div className="card">
          <h2>Does the gap predict the winner?</h2>
          <p className="hint">
            Every scenario above, one point each: rate gap across, Roth&rsquo;s advantage up. If the rule of thumb
            holds, the points run from upper left to lower right.
          </p>
          <ScatterChart
            points={scatterPoints}
            groups={WINNER_GROUPS}
            regression={regression}
            formatX={formatGapPoints}
            formatY={formatAdvantagePct}
            formatXTick={formatGapTick}
            xLabel="Rate gap (percentage points)"
            yLabel="Roth advantage (% of Pre-tax income)"
          />
          {regression && (
            <p className="scenario-summary hint">
              Trend line: each additional percentage point of rate gap is associated with a{' '}
              <strong>{formatAdvantagePct(regression.slope * 0.01)}</strong> change in Roth&rsquo;s after-tax
              advantage, across these {scatterPoints.length} scenarios (r&sup2; = {regression.r2.toFixed(2)}).
            </p>
          )}
        </div>
      </div>

      <BackLink />
    </article>
  );
}
