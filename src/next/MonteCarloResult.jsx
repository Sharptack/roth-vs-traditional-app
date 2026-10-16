// The Monte Carlo page's results (phase 8 step c): the volatility and the Run button, the chance of
// success, the portfolio's fan over the years, its spread at an age, the spending the paths sustain,
// and when the failing paths run out. Renders a run from useMonteCarlo.js (lib/monteCarlo.js's
// summary); no math of its own. Decided with Michael 2026-10-16: 1,000 paths around the plan's
// returns (their median), a Run button, results kept and marked out of date after an input changes.
import { useState } from 'react';
import LineChart from '../components/charts/LineChart.jsx';
import Histogram from '../components/charts/Histogram.jsx';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import { balancesAt, histogram, monteCarloOptions, percentile } from '../lib/monteCarlo.js';
import Blocks from './Blocks.jsx';

const short = (v) => (Math.abs(v) >= 1e6 ? `$${Math.round(v / 1e5) / 10}M` : Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : $(v));
const pct0 = (x) => formatPercent(x, 0);
const COLOR = 'var(--series-1)';

// run: useMonteCarlo's (null before the first); stale: the inputs changed since it ran.
// household / need: the plan now (null need: error says why). volatility: the input as a number;
// onVolatility(text) sets it (absent when locked). onRun / onCancel.
export default function MonteCarloResult({ run, stale, household, need, error, volatility, onVolatility, onRun, onCancel }) {
  const [ageIndex, setAgeIndex] = useState(null); // the fan's year for "Portfolio at an age" (null: the end)
  const s = run?.summary;
  const couple = household?.people.length === 2;
  const yourAge = couple ? 'Your age' : 'Age';
  const returns = household
    ? [household.assumptions.returnRate, household.assumptions.retirementReturnRate ?? household.assumptions.returnRate]
    : [0, 0];
  const legacy = Boolean(household && monteCarloOptions(household).legacy);
  const progress = run ? (run.pathsDone + run.incomeDone) / (run.paths + run.incomePaths) : 0;

  const controls = (
    <div className="mc-controls">
      <label className="mc-slider">
        <span>
          Volatility (the yearly swing of returns): <strong>{pct0(volatility)}</strong>
        </span>
        <input
          type="range"
          min="0"
          max="0.35"
          step="0.01"
          value={volatility}
          disabled={!onVolatility}
          onChange={(e) => onVolatility?.(e.target.value)}
          aria-valuetext={pct0(volatility)}
        />
      </label>
      <div className="button-row">
        {run?.running ? (
          <button type="button" className="button secondary" onClick={onCancel}>
            Stop
          </button>
        ) : (
          <button type="button" className="button" onClick={onRun} disabled={need === null}>
            {run ? 'Run again' : 'Run the simulation'}
          </button>
        )}
        {run?.running && (
          <span className="mc-progress">
            <progress value={progress} max="1" />{' '}
            {run.pathsDone < run.paths ? `${run.pathsDone.toLocaleString('en-US')} of ${run.paths.toLocaleString('en-US')} paths` : `Spending each path sustains: ${run.incomeDone} of ${run.incomePaths}`}
          </span>
        )}
      </div>
      {stale && s && <p className="note">The inputs have changed since this run. Run again to update it.</p>}
      {run?.error && <p className="note">{run.error}</p>}
      {run?.cancelled && !s && <p className="hint">Stopped before the paths were in.</p>}
    </div>
  );

  const chanceBlock = {
    id: 'chance',
    title: 'Chance of success',
    className: 'key-card',
    summary: s ? `${pct0(s.chance)} of paths meet the spending need` : 'Not run yet',
    content: (
      <>
        {need === null ? (
          <p>{error ?? 'Fill in the household to work out the spending need.'}</p>
        ) : s ? (
          <div className="hero">
            <div className="hero-value">{pct0(s.chance)}</div>
            <div className="hero-sub">
              {s.successes.toLocaleString('en-US')} of {s.paths.toLocaleString('en-US')} random return paths meet the spending need of {$(run.need)} a year (after
              tax, today&rsquo;s dollars) every year of the plan{legacy ? ' and leave the legacy goal' : ''}, at {pct0(run.volatility)} volatility.
            </div>
          </div>
        ) : (
          <p>
            {run?.running ? 'Working out the paths…' : `Runs the plan ${(1000).toLocaleString('en-US')} times, each with its own random returns, at the spending need of ${$(need)} a year. It takes a few seconds.`}
          </p>
        )}
        {controls}
        <p className="hint">
          Each year&rsquo;s return is drawn at random around the plan&rsquo;s ({pct0(returns[0])} while anyone works, {pct0(returns[1])} once everyone has retired, after
          inflation), which is the middle path: half the years do better, half worse. Volatility is how far a year strays (its standard deviation); the S&amp;P 500&rsquo;s
          after inflation is about 20%, a stock-and-bond mix&rsquo;s less. At 0% every path is the year-by-year projection. Everything else is the plan as it stands,
          the planner&rsquo;s changes included.
        </p>
      </>
    ),
  };
  if (!s) return <Blocks key="waiting" blocks={[chanceBlock]} />;

  const ages = s.fan.map((f) => f.age);
  const at = ageIndex ?? s.fan.length - 1;
  const fanBlock = {
    id: 'fan',
    title: 'The portfolio over time',
    summary: `Middle path ${short(s.fan.at(-1).p50)} at ${s.fan.at(-1).age}; 1 in 10 paths below ${short(s.fan.at(-1).p10)}`,
    content: (
      <>
        <LineChart
          series={[{ key: 'p50', label: 'Middle path (median)', color: COLOR, points: s.fan.map((f) => ({ x: f.age, y: f.p50 })) }]}
          bands={[
            { key: 'p80', label: 'Middle 80% of paths', color: COLOR, strength: 14, lower: s.fan.map((f) => ({ x: f.age, y: f.p10 })), upper: s.fan.map((f) => ({ x: f.age, y: f.p90 })) },
            { key: 'p50band', label: 'Middle 50% of paths', color: COLOR, strength: 30, lower: s.fan.map((f) => ({ x: f.age, y: f.p25 })), upper: s.fan.map((f) => ({ x: f.age, y: f.p75 })) },
          ]}
          xTicks={ages}
          formatX={(a) => `${yourAge} ${a}`}
          formatXTick={(a) => `${a}`}
          formatY={(y) => $(y)}
          formatYTick={short}
          xLabel={yourAge}
          yLabel="Portfolio at the end of the year"
          markers={false}
          yFloor={0}
        />
        <p className="hint">
          Every account together at the end of each year, today&rsquo;s dollars. The bands hold the middle 80% and 50% of paths in each year (not the same paths
          from year to year); 1 path in 10 ends a year below the bottom edge.
        </p>
      </>
    ),
  };

  const atValues = balancesAt(run.outcomes, at);
  const atSorted = [...atValues].sort((a, b) => a - b);
  // (to the 90th percentile: a portfolio's spread is lopsided, a few paths far above the rest)
  const atBins = histogram(atValues, { clip: 0.9 });
  const binText = (fmt) => (b) => (b.open ? `${fmt(b.from)} or more` : `${fmt(b.from)} to ${fmt(b.to)}`);
  const atBlock = {
    id: 'at-age',
    title: 'The portfolio at an age',
    summary: `At ${ages[at]}: middle path ${short(percentile(atSorted, 0.5))}; middle 80% ${short(percentile(atSorted, 0.1))} to ${short(percentile(atSorted, 0.9))}`,
    content: (
      <>
        <label className="mc-age">
          {yourAge}{' '}
          <select value={at} onChange={(e) => setAgeIndex(Number(e.target.value))}>
            {ages.map((a, t) => (
              <option key={a} value={t}>
                {a}
                {t === ages.length - 1 ? ' (the end)' : ''}
              </option>
            ))}
          </select>
        </label>
        <Histogram
          bins={atBins}
          total={atValues.length}
          formatValue={short}
          formatBin={binText($)}
          band={{ from: percentile(atSorted, 0.25), to: percentile(atSorted, 0.75), label: 'Middle 50%' }}
          marks={[{ x: percentile(atSorted, 0.5), label: `Median ${short(percentile(atSorted, 0.5))}` }]}
          xLabel={`Portfolio at the end of the year at ${ages[at]} (today’s dollars)`}
        />
        <div className="calc">
          <div className="calc-row"><span>1 path in 10 below</span><span>{$(percentile(atSorted, 0.1))}</span></div>
          <div className="calc-row"><span>Middle path (median)</span><span>{$(percentile(atSorted, 0.5))}</span></div>
          <div className="calc-row"><span>1 path in 10 above</span><span>{$(percentile(atSorted, 0.9))}</span></div>
          <div className="calc-row"><span>Paths with nothing left</span><span>{pct0(atValues.filter((v) => v <= 0.5).length / atValues.length)}</span></div>
        </div>
        <p className="hint">The highest 10% of paths share the last bar, so the rest stay readable.</p>
      </>
    ),
  };

  const inc = s.income;
  const incomeBlock = {
    id: 'income',
    title: 'Spending the paths sustain',
    summary: inc ? `Half the paths sustain ${$(inc.p50)} a year or more; 9 in 10 sustain ${$(inc.p10)}` : 'Working out…',
    content: inc ? (
      <>
        <Histogram
          bins={histogram(inc.values)}
          total={inc.values.length}
          formatValue={short}
          formatBin={binText($)}
          band={{ from: inc.p25, to: inc.p75, label: 'Middle 50%' }}
          marks={[
            { x: run.need, label: `The need ${short(run.need)}` },
            { x: inc.p50, label: `Median ${short(inc.p50)}` },
          ]}
          xLabel="Steady spending a year after tax (today’s dollars)"
        />
        <div className="calc">
          <div className="calc-row"><span>Succeeds in 9 paths in 10</span><span>{$(inc.p10)} a year</span></div>
          <div className="calc-row"><span>Succeeds in 3 paths in 4</span><span>{$(inc.p25)} a year</span></div>
          <div className="calc-row total"><span>Succeeds in half the paths (the median)</span><span>{$(inc.p50)} a year</span></div>
          <div className="calc-row"><span>The spending need</span><span>{$(run.need)} a year</span></div>
        </div>
        <p className="hint">
          The highest steady spending after tax each path supports to the end of the plan{legacy ? ', leaving the legacy goal' : ''}, as Retirement spending works it
          out, from the first {inc.values.length} of the paths (each a search of its own), to within half a percent.
        </p>
      </>
    ) : (
      <p className="hint">
        Searching each of the first {run.incomePaths} paths for the spending it sustains: {run.incomeDone} done.
      </p>
    ),
  };

  const failing = run.outcomes.filter((o) => o.runOutAge !== null).map((o) => o.runOutAge);
  const runOutBlock = {
    id: 'run-out',
    title: 'When the failing paths run out',
    summary: failing.length ? `${failing.length.toLocaleString('en-US')} paths fall short, at ${yourAge.toLowerCase()} ${Math.round(s.runOut.p50)} in the middle one` : 'No path falls short',
    content: failing.length ? (
      <>
        <Histogram
          bins={histogram(failing, { width: 1 })}
          total={failing.length}
          formatValue={(a) => `${a}`}
          formatBin={(b) => `${yourAge} ${b.from}`}
          marks={[{ x: s.runOut.p50 + 0.5, label: `Median ${Math.round(s.runOut.p50)}` }]}
          xLabel={`${yourAge} in the first year short of the need`}
        />
        <p>
          {failing.length.toLocaleString('en-US')} of {s.paths.toLocaleString('en-US')} paths ({pct0(failing.length / s.paths)}) can&rsquo;t pay the full need in some year.
          Of those, 1 in 10 falls short by {Math.round(s.runOut.p10)}, half by {Math.round(s.runOut.p50)}.
        </p>
        <p className="hint">
          {couple ? 'Your age in the first year a path pays less than the need.' : 'The age in the first year a path pays less than the need.'} Paths that pay every year but miss the legacy goal are failures too, not counted here.
        </p>
      </>
    ) : (
      <p>Every path pays the need in every year of the plan.</p>
    ),
  };

  // (a key of its own, so the blocks open when the results first arrive)
  return (
    <Blocks
      key="results"
      blocks={[chanceBlock, fanBlock, atBlock, incomeBlock, runOutBlock]}
      disclaimer="Estimates only — not tax or financial advice. Random returns around the plan’s, one volatility for every account and year, each year independent of the last; today’s dollars; everything else as the year-by-year projection."
    />
  );
}
