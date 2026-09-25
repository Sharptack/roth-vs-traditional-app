import { useEffect, useMemo } from 'react';
import LineChart from './charts/LineChart.jsx';
import ScatterChart from './charts/ScatterChart.jsx';
import { flattenForScatter, runAllBatches } from '../lib/scenarios.js';
import { linearRegression } from '../lib/regression.js';
import { SCENARIO_BATCHES } from '../data/scenarioBatches.js';
import { CALCULATOR_HASH } from '../lib/route.js';

const CURRENT_YEAR = new Date().getFullYear();

const formatGapPoints = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)} pts`;
const formatAdvantagePct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
// Axis ticks drop the "pts" unit (the axis title carries it): +15.0 pts -> +15
const formatGapTick = (v) => `${v >= 0 ? '+' : '−'}${Number(Math.abs(v * 100).toFixed(1))}`;
const formatCompactCurrency = (v) => `$${(v / 1000).toFixed(0)}k`;
const formatMultiplierX = (v) => `${v.toFixed(1)}×`;

function formatX(batch, x) {
  return batch.xType === 'multiple' ? formatMultiplierX(x) : formatCompactCurrency(x);
}

function BackLink() {
  return (
    <a className="back-link" href={CALCULATOR_HASH}>
      &larr; Back to the calculator
    </a>
  );
}

function BatchChart({ batch }) {
  const xTicks = batch.series[0].points.map((p) => p.x);
  const series = batch.series.map((s) => ({
    key: s.key,
    label: s.label,
    points: s.points.map((p) => ({ x: p.x, y: p.gap })),
  }));

  return (
    <div className="card">
      <h2>{batch.title}</h2>
      <p className="hint">{batch.description}</p>
      <p className="hint">
        Rate gap = marginal rate while working &minus; effective rate on these withdrawals in retirement.
        A positive gap tends to favor Pre-tax; a negative gap tends to favor Roth.
      </p>
      <LineChart
        series={series}
        xTicks={xTicks}
        formatX={(x) => formatX(batch, x)}
        formatY={formatGapPoints}
        formatYTick={formatGapTick}
        xLabel={batch.xLabel}
        yLabel="Rate gap (percentage points)"
      />
      <details className="details">
        <summary>Show the numbers</summary>
        <div className="details-body">
          <div className="table-wrap">
            <table>
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
                      <td key={s.key}>{formatGapPoints(s.points[i].gap)}</td>
                    ))}
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
  const scatterPoints = useMemo(
    () => flattenForScatter(runBatches).map((p) => ({ ...p, x: p.gap, y: p.advantagePct })),
    [runBatches],
  );
  const regression = useMemo(() => linearRegression(scatterPoints.map((p) => ({ x: p.x, y: p.y }))), [scatterPoints]);
  const batchLegend = runBatches.map((b) => ({ key: b.key, title: b.title }));

  return (
    <article className="scenarios-page">
      <BackLink />

      <div className="scenarios-intro">
        <h1>Visualization: does the rate gap predict the winner?</h1>
        <p>
          The calculator&rsquo;s comparison boils down to one number: the <strong>rate gap</strong> &mdash; your
          marginal tax rate while working, minus the effective rate you&rsquo;d actually pay on this
          account&rsquo;s withdrawals in retirement. The rule of thumb: the higher that gap, the more Pre-tax should
          come out ahead; the lower (more negative) the gap, the more Roth should come out ahead.
        </p>
        <p>
          Below, that gap is charted across a series of hand-picked scenarios &mdash; sweeping income, savings
          rate, existing account balances, age at retirement, and retirement lifestyle one at a time &mdash; to
          see how it actually behaves. Every scenario also runs through the same comparison the calculator
          uses (single filer, W-2 income, estimated Social Security, 7% return, no state tax &mdash; see{' '}
          <a href="#/how-it-works">How this works</a> for the full model). Hover or focus any point for exact
          numbers; each chart also has a table underneath.
        </p>
      </div>

      <div className="scenario-batches">
        {runBatches.map((batch) => (
          <BatchChart key={batch.key} batch={batch} />
        ))}

        <div className="card">
          <h2>Does the gap predict the winner?</h2>
          <p className="hint">
            Every point above, combined: X axis is the rate gap; Y axis is how much more (or less) after-tax
            annual income Roth produces than Pre-tax, as a percentage of the Pre-tax amount. If the rule of
            thumb holds, points should trend down and to the right &mdash; a bigger gap (Pre-tax favored) paired with
            a bigger Roth shortfall, and vice versa.
          </p>
          <ScatterChart
            points={scatterPoints}
            batches={batchLegend}
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
