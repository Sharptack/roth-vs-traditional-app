import { useEffect, useMemo } from 'react';
import Heatmap from './charts/Heatmap.jsx';
import LineChart from './charts/LineChart.jsx';
import ScatterChart from './charts/ScatterChart.jsx';
import { flattenForScatter, runAllBatches, runHeatmap } from '../lib/scenarios.js';
import { linearRegression } from '../lib/regression.js';
import { HEATMAP, SCENARIO_BATCHES } from '../data/scenarioBatches.js';
import { CALCULATOR_HASH } from '../lib/route.js';

const CURRENT_YEAR = new Date().getFullYear();

const sign = (v) => (v >= 0 ? '+' : '−');
const formatGapPoints = (v) => `${sign(v)}${Math.abs(v * 100).toFixed(1)} pts`;
const formatAdvantagePct = (v) => `${sign(v)}${Math.abs(v).toFixed(1)}%`;
// Axis ticks drop the unit (the axis title carries it): +15.0 pts -> +15
const formatGapTick = (v) => (v === 0 ? '0' : `${sign(v)}${Number(Math.abs(v * 100).toFixed(1))}`);
const formatAdvantageTick = (v) => (v === 0 ? '0%' : `${sign(v)}${Number(Math.abs(v).toFixed(1))}%`);
const formatRate = (v) => `${(v * 100).toFixed(1)}%`;
const formatRateTick = (v) => `${Number((v * 100).toFixed(1))}%`;
const formatCompactCurrency = (v) => `$${(v / 1000).toFixed(0)}k`;
const formatMultiplierX = (v) => `${v.toFixed(1)}×`;
const formatHeatCell = (cell) => `${sign(cell.advantagePct)}${Math.round(Math.abs(cell.advantagePct))}%`;
const formatHeatDetail = (cell) =>
  `Roth advantage ${formatAdvantagePct(cell.advantagePct)}, rate gap ${formatGapPoints(cell.gap)}`;

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

// The rule the charts are testing, highlighted so it is easy to find while reading them.
function RuleOfThumb({ short }) {
  return (
    <p className="rule-callout">
      <strong>The rule of thumb: the higher that gap, the more Pre-tax should come out ahead</strong>
      {short ? ' (the lower, the more Roth).' : '; the lower (more negative) the gap, the more Roth should come out ahead.'}
    </p>
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

function BatchChart({ batch }) {
  const xTicks = batch.series[0].points.map((p) => p.x);
  const seriesOf = (valueOf) =>
    batch.series.map((s) => ({
      key: s.key,
      label: s.label,
      points: s.points.map((p) => ({ x: p.x, y: valueOf(p) })),
    }));
  const fx = (x) => formatX(batch, x);

  return (
    <div className="card">
      <h2>{batch.title}</h2>
      <p className="hint">{batch.description}</p>

      <h3 className="subhead">The rate gap</h3>
      <p className="hint">
        Rate gap = marginal rate while working &minus; effective rate on withdrawals from your Future
        Contributions in retirement.
      </p>
      <RuleOfThumb short />
      <LineChart
        series={seriesOf((p) => p.gap)}
        xTicks={xTicks}
        formatX={fx}
        formatY={formatGapPoints}
        formatYTick={formatGapTick}
        xLabel={batch.xLabel}
        yLabel="Rate gap (percentage points)"
      />

      <h3 className="subhead">Who actually comes out ahead?</h3>
      <p className="hint">
        The same scenarios, but showing the result instead of the predictor: how much more (or less) total
        after-tax income Roth produces than Pre-tax, as a % of the Pre-tax amount. <strong>Above the zero line
        Roth comes out ahead; below it Pre-tax does.</strong> Compare with the gap chart above: where the gap is
        high, this line should sit below zero.
      </p>
      <LineChart
        series={seriesOf((p) => p.advantagePct)}
        xTicks={xTicks}
        formatX={fx}
        formatY={formatAdvantagePct}
        formatYTick={formatAdvantageTick}
        xLabel={batch.xLabel}
        yLabel="Roth advantage (% of Pre-tax income)"
      />

      <details className="details">
        <summary>Show the numbers</summary>
        <div className="details-body">
          <ValueTable
            batch={batch}
            xTicks={xTicks}
            valueOf={(p) => p.gap}
            format={formatGapPoints}
            caption="Rate gap"
          />
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
        Same scenarios as &ldquo;{batch.title}&rdquo;, but with the two rates drawn as separate lines instead of
        their difference. <strong>The rate gap is the vertical distance between the two lines.</strong> Where
        the working-years line is far above the retirement line, the gap is large and Pre-tax tends to win; where
        they cross, the gap is zero and the two are about even.
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
  const heatmap = useMemo(() => runHeatmap(HEATMAP, CURRENT_YEAR), []);
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
          marginal tax rate while working, minus the effective rate you&rsquo;d actually pay on withdrawals
          from your Future Contributions in retirement.
        </p>
        <RuleOfThumb />
        <p>
          Below, that gap is charted across a series of hand-picked scenarios &mdash; sweeping income, savings
          rate, Existing Account balances, retirement lifestyle, and retirement age one at a time &mdash; to
          see how it actually behaves. Each scenario batch shows the gap and then the result (who actually
          comes out ahead), so the two can be compared directly. After the batches, a map shows where each
          side wins across income and savings rate, and a final chart combines every scenario. Every scenario
          runs through the same comparison the calculator uses (single filer, W-2 income, estimated Social
          Security, 7% return, no state tax &mdash; see <a href="#/how-it-works">How this works</a> for the
          full model). Hover or focus any point for exact numbers; each chart also has a table underneath.
        </p>
      </div>

      <div className="scenario-batches">
        {runBatches.map((batch) => (
          <div className="scenario-group" key={batch.key}>
            <BatchChart batch={batch} />
            {batch.key === 'incomeSweep' && <GapComponents batch={batch} />}
          </div>
        ))}

        <div className="card">
          <h2>{heatmap.title}</h2>
          <p className="hint">{heatmap.description}</p>
          <p className="hint">
            Each cell shows Roth&rsquo;s advantage over Pre-tax as a % of the Pre-tax amount. Orange cells are
            where Pre-tax comes out ahead, blue cells where Roth does, and the boundary between them is the
            break-even line.
          </p>
          <Heatmap
            rows={heatmap.rows}
            formatIncome={formatCompactCurrency}
            formatCell={formatHeatCell}
            formatDetail={formatHeatDetail}
          />
        </div>

        <div className="card">
          <h2>Does the gap predict the winner?</h2>
          <p className="hint">
            Every point above, combined: X axis is the rate gap; Y axis is how much more (or less) total after-tax
            annual income Roth produces than Pre-tax, as a percentage of the Pre-tax amount (both include a
            taxable account when savings exceed the IRS limit). If the rule of
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
