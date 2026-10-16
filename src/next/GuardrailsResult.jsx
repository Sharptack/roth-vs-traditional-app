// The guardrails page's results (phase 9 step d): the recommended spending (the target chance of
// success), today's guardrails, the guardrails year by year, and spending under the rule across the
// paths. Renders a run from useGuardrails.js (lib/guardrails.js's report); no math of its own.
// Decided with Michael 2026-10-16: risk-based only; target 80%, cut at 50%, raise at 95%, back to the
// target, changes under 5% skipped; all four settings saved with the household.
import LineChart from '../components/charts/LineChart.jsx';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import { monteCarloOptions } from '../lib/monteCarlo.js';
import Blocks from './Blocks.jsx';

const short = (v) => (Math.abs(v) >= 1e6 ? `$${Math.round(v / 1e5) / 10}M` : Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : $(v));
const pct0 = (x) => formatPercent(x, 0);
const signed = (x) => `${x >= 0 ? '+' : '−'}${formatPercent(Math.abs(x), 0)}`;
const COLOR = 'var(--series-1)';
const SETTINGS = [
  { key: 'target', label: 'Target chance of success', hint: 'The spending recommended, and where a change goes back to' },
  { key: 'cut', label: 'Cut when the chance falls to', hint: 'The lower guardrail' },
  { key: 'raise', label: 'Raise when the chance reaches', hint: 'The upper guardrail' },
  { key: 'minChange', label: 'Smallest change made', hint: 'A smaller one is skipped' },
];

// What a guardrail does: "cut spending to $Y (−b%)", or why it changes nothing.
function action(level, minChange) {
  if (level.spending === null) return 'working out…';
  if (!level.applies) return `the spending there is within ${pct0(minChange)} of today’s: no change`;
  return `${level.change < 0 ? 'cut' : 'raise'} spending to ${$(level.spending)} a year (${signed(level.change)})`;
}

// run: useGuardrails's (null before the first); stale: the inputs changed since it ran. household /
// need: the plan now (null need: error says why). volatility: Monte Carlo's, as a number;
// onVolatility(text) sets it. settings: the household's (shares); onSetting(key, text) sets one
// (absent when locked). onRun / onCancel.
export default function GuardrailsResult({ run, stale, household, need, error, volatility, onVolatility, settings, onSetting, onRun, onCancel }) {
  const rep = run?.report;
  const couple = household?.people.length === 2;
  const yourAge = couple ? 'Your age' : 'Age';
  const legacy = Boolean(household && monteCarloOptions(household).legacy);
  const progress = run && run.total > 0 ? Math.min(1, run.done / run.total) : 0;
  const stageText = {
    today: 'The spending each path sustains today',
    tables: 'The guardrails today, and a table for each retired year',
    rule: 'The spending at each guardrail, and the paths under the rule',
  };

  const controls = (
    <div className="mc-controls">
      <div className="gr-settings">
        {SETTINGS.map((s) => (
          <label key={s.key} className="gr-setting">
            <span>{s.label}</span>
            <span className="gr-input">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={Math.round(settings[s.key] * 100)}
                disabled={!onSetting}
                onChange={(e) => onSetting?.(s.key, e.target.value === '' ? '' : String(Number(e.target.value) / 100))}
              />
              %
            </span>
            <span className="hint">{s.hint}</span>
          </label>
        ))}
      </div>
      <label className="mc-slider">
        <span>
          Volatility (the yearly swing of returns, as on the Monte Carlo page): <strong>{pct0(volatility)}</strong>
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
            {run ? 'Run again' : 'Work out the guardrails'}
          </button>
        )}
        {run?.running && (
          <span className="mc-progress">
            <progress value={progress} max="1" /> {stageText[run.stage] ?? 'Working…'}
          </span>
        )}
      </div>
      {stale && rep && <p className="note">The inputs have changed since this run. Run again to update it.</p>}
      {run?.error && <p className="note">{run.error}</p>}
      {run?.cancelled && !rep && <p className="hint">Stopped before the guardrails were in.</p>}
    </div>
  );

  const g = rep?.today;
  const targetBlock = {
    id: 'target',
    title: 'Recommended spending',
    className: 'key-card',
    summary: rep ? `${$(rep.target)} a year: ${pct0(rep.settings.target)} of paths sustain it` : 'Not run yet',
    content: (
      <>
        {need === null ? (
          <p>{error ?? 'Fill in the household to work out the spending need.'}</p>
        ) : rep ? (
          <div className="hero">
            <div className="hero-value">{$(rep.target)}</div>
            <div className="hero-sub">
              a year after tax (today&rsquo;s dollars): the spending {pct0(rep.settings.target)} of {g.paths} random return paths sustain to the end of the plan
              {legacy ? ', leaving the legacy goal' : ''}. The plan&rsquo;s spending need, {$(rep.need)}, is sustained by {pct0(rep.needChance)} of them.
            </div>
          </div>
        ) : (
          <p>
            {run?.running
              ? 'Working out the guardrails…'
              : `Works out the spending ${pct0(settings.target)} of random return paths sustain, the portfolio values at which to cut or raise it, and how spending moves under that rule. It takes a minute or two.`}
          </p>
        )}
        {controls}
        <p className="hint">
          Risk-based guardrails, as Income Lab uses them: the spending is set by the chance the plan succeeds, worked out with the whole plan (Social Security,
          pensions, other income, the years left) on the Monte Carlo page&rsquo;s random paths. When the portfolio moves far enough that the chance falls to the
          lower guardrail or reaches the upper one, spending is reset to the amount with the target chance again.
        </p>
      </>
    ),
  };
  if (!rep) return <Blocks key="waiting" blocks={[targetBlock]} />;

  const pctFromToday = (P) => (g.portfolio > 0 ? signed(P / g.portfolio - 1) : '');
  const todayBlock = {
    id: 'today',
    title: 'Today’s guardrails',
    summary: `${g.cut.portfolio > 0 ? `Cut below ${short(g.cut.portfolio)}` : 'No cut today'}; ${Number.isFinite(g.raise.portfolio) ? `raise above ${short(g.raise.portfolio)}` : 'no raise'}`,
    content: (
      <>
        <p>
          Spending {$(rep.target)} a year from today&rsquo;s portfolio of {$(g.portfolio)}:
        </p>
        <ul>
          <li>
            {g.cut.portfolio > 0 ? (
              <>
                If the portfolio falls to <strong>{$(g.cut.portfolio)}</strong> ({pctFromToday(g.cut.portfolio)}), the chance falls to {pct0(rep.settings.cut)}:{' '}
                {action(g.cut, rep.settings.minChange)}.
              </>
            ) : (
              <>
                Even with nothing in the portfolio today, more than {pct0(rep.settings.cut)} of paths sustain this spending (the savings still to come and the income
                in retirement carry it): no cut today, whatever the portfolio does.
              </>
            )}
          </li>
          <li>
            {Number.isFinite(g.raise.portfolio) ? (
              <>
                If it rises to <strong>{$(g.raise.portfolio)}</strong> ({pctFromToday(g.raise.portfolio)}), the chance reaches {pct0(rep.settings.raise)}:{' '}
                {action(g.raise, rep.settings.minChange)}.
              </>
            ) : (
              <>Not even a portfolio many times today&rsquo;s brings the chance to {pct0(rep.settings.raise)}: no raise.</>
            )}
          </li>
        </ul>
        <div className="calc">
          <div className="calc-row"><span>Chance of success today, at {$(rep.target)}</span><span>{pct0(g.chance)}</span></div>
          <div className="calc-row"><span>Portfolio today (every account)</span><span>{$(g.portfolio)}</span></div>
          <div className="calc-row"><span>Lower guardrail (cut)</span><span>{g.cut.portfolio > 0 ? $(g.cut.portfolio) : 'none'}</span></div>
          <div className="calc-row"><span>Upper guardrail (raise)</span><span>{Number.isFinite(g.raise.portfolio) ? $(g.raise.portfolio) : 'none'}</span></div>
        </div>
        <p className="hint">
          Every account rises or falls together. Each value is from {g.paths} paths: the portfolio at which {pct0(rep.settings.cut)} of them (the lower guardrail)
          or {pct0(rep.settings.raise)} (the upper) sustain today&rsquo;s spending; the new spending is again the amount {pct0(rep.settings.target)} of paths sustain at that value.
        </p>
      </>
    ),
  };

  const sched = rep.schedule;
  const finite = sched?.every((y) => Number.isFinite(y.cut.portfolio) && Number.isFinite(y.raise.portfolio));
  const scheduleBlock = {
    id: 'schedule',
    title: 'The guardrails year by year',
    summary: sched ? (sched.length ? `Every other retired year from ${sched[0].age}, still spending ${$(rep.target)}` : 'No year draws on the portfolio') : 'Working out…',
    content: !sched ? (
      <p className="hint">Building a table for each retired year.</p>
    ) : sched.length === 0 ? (
      <p>No year of the plan draws on the portfolio for spending, so there is nothing to guard.</p>
    ) : (
      <>
        {finite && (
          <LineChart
            series={[
              { key: 'raise', label: 'Raise above', color: 'var(--series-2)', points: sched.map((y) => ({ x: y.age, y: y.raise.portfolio })) },
              { key: 'plan', label: 'The plan’s portfolio (middle path)', color: COLOR, points: sched.map((y) => ({ x: y.age, y: y.portfolio })) },
              { key: 'cut', label: 'Cut below', color: 'var(--series-3)', points: sched.map((y) => ({ x: y.age, y: y.cut.portfolio })) },
            ]}
            xTicks={sched.map((y) => y.age)}
            formatX={(a) => `${yourAge} ${a}`}
            formatXTick={(a) => `${a}`}
            formatY={(y) => $(y)}
            formatYTick={short}
            xLabel={yourAge}
            yLabel="Portfolio at the start of the year"
            markers={false}
            yFloor={0}
          />
        )}
        <div className="table-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">{yourAge}</th>
                <th scope="col">The plan&rsquo;s portfolio</th>
                <th scope="col">Cut below</th>
                <th scope="col">Spending after a cut</th>
                <th scope="col">Raise above</th>
                <th scope="col">Spending after a raise</th>
              </tr>
            </thead>
            <tbody>
              {sched.map((y) => (
                <tr key={y.t}>
                  <th scope="row">{y.age}</th>
                  <td>{$(y.portfolio)}</td>
                  <td>{$(y.cut.portfolio)}</td>
                  <td>{y.cut.applies ? `${$(y.cut.spending)} (${signed(y.cut.change)})` : 'no change'}</td>
                  <td>{Number.isFinite(y.raise.portfolio) ? $(y.raise.portfolio) : 'none'}</td>
                  <td>{Number.isFinite(y.raise.portfolio) && y.raise.applies ? `${$(y.raise.spending)} (${signed(y.raise.change)})` : 'no change'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          The portfolio at the start of every other retired year (and the last), if spending is still {$(rep.target)}: the plan&rsquo;s at its own returns (the
          middle path), and the values that would cut or raise it. From a table of {rep.tablePaths} paths for each of those years rather than a full rerun, so a
          little rougher than today&rsquo;s; the rule reads the years between from the tables either side.
        </p>
      </>
    ),
  };

  const rule = rep.rule;
  const ruleBlock = {
    id: 'rule',
    title: 'Spending under the guardrails',
    summary: rule ? `${pct0(rule.withCut)} of paths cut at some point; ${pct0(rule.withRaise)} raise` : 'Working out…',
    content: !rule ? (
      <p className="hint">Running the paths under the rule once every year&rsquo;s table is in.</p>
    ) : (
      <>
        <LineChart
          series={[{ key: 'p50', label: 'Middle path (median)', color: COLOR, points: rule.fan.map((f) => ({ x: f.age, y: f.p50 })) }]}
          bands={[
            { key: 'p80', label: 'Middle 80% of paths', color: COLOR, strength: 14, lower: rule.fan.map((f) => ({ x: f.age, y: f.p10 })), upper: rule.fan.map((f) => ({ x: f.age, y: f.p90 })) },
            { key: 'p50band', label: 'Middle 50% of paths', color: COLOR, strength: 30, lower: rule.fan.map((f) => ({ x: f.age, y: f.p25 })), upper: rule.fan.map((f) => ({ x: f.age, y: f.p75 })) },
          ]}
          xTicks={rule.fan.map((f) => f.age)}
          formatX={(a) => `${yourAge} ${a}`}
          formatXTick={(a) => `${a}`}
          formatY={(y) => $(y)}
          formatYTick={short}
          xLabel={yourAge}
          yLabel="Spending a year after tax"
          markers={false}
          yFloor={0}
        />
        <div className="calc">
          <div className="calc-row"><span>Paths with at least one cut</span><span>{pct0(rule.withCut)}</span></div>
          <div className="calc-row"><span>Paths with at least one raise</span><span>{pct0(rule.withRaise)}</span></div>
          {rule.largestCut && (
            <>
              <div className="calc-row"><span>The deepest single cut, on the middle path that cuts</span><span>{pct0(rule.largestCut.p50)}</span></div>
              <div className="calc-row"><span>… on 1 cutting path in 10, at least</span><span>{pct0(rule.largestCut.p90)}</span></div>
            </>
          )}
          <div className="calc-row"><span>The lowest spending, 1 path in 10 below</span><span>{$(rule.lowest.p10)} a year</span></div>
          <div className="calc-row"><span>The lowest spending, the middle path</span><span>{$(rule.lowest.p50)} a year</span></div>
          <div className="calc-row total"><span>Paths that pay their spending every year before the last{legacy ? ' and leave the legacy goal' : ''}</span><span>{pct0(rule.chance)}</span></div>
          <div className="calc-row"><span>In the plan&rsquo;s last year, paths that pay less than planned</span><span>{pct0(rule.endShort.share)}</span></div>
          {rule.endShort.share > 0 && (
            <div className="calc-row sub"><span>… short by, on the middle one of them</span><span>{pct0(rule.endShort.p50)}</span></div>
          )}
        </div>
        <p className="hint">
          {rule.paths.toLocaleString('en-US')} paths (the Monte Carlo page&rsquo;s), each starting at {$(rep.target)} and checking once a year, at the start of each
          retired year, whether its chance has fallen to {pct0(rep.settings.cut)} or reached {pct0(rep.settings.raise)}; if so it moves to the spending with a{' '}
          {pct0(rep.settings.target)} chance there (a change under {pct0(rep.settings.minChange)} is skipped). The bands hold the middle 80% and 50% of paths each year,
          of the spending each actually paid. In the plan&rsquo;s last year the rule spends what is left, so paying less than planned then is the portfolio spent down,
          not a failure; the yearly tables, built from the middle path, can overstate what a path that has spent a lot can pay at the end (its taxes and IRMAA differ).
        </p>
      </>
    ),
  };

  return (
    <Blocks
      key="results"
      blocks={[targetBlock, todayBlock, scheduleBlock, ruleBlock]}
      disclaimer="Estimates only — not tax or financial advice. Random returns around the plan’s, as on the Monte Carlo page; today’s dollars; every account moves together; the yearly tables start each year from the plan’s middle path and treat sustainable spending as straight between four portfolio values (none, a quarter, the same, four times)."
    />
  );
}
