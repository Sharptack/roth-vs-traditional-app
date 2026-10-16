// The three-scenario Visualization page (#/scenarios/three-way; decided 2026-10-16, roadmap
// "Three-scenario visualization"): all Roth, all Pre-tax, and all Pre-tax with conversions in the
// lower years, over a grid of sample households (src/data/threeWayGrid.js, src/lib/threeWay.js).
// The grid runs in background workers on request; the last run is kept while the site stays open.
import { useCallback, useEffect, useRef, useState } from 'react';
import LineChart from './charts/LineChart.jsx';
import WinnerGrid from './charts/WinnerGrid.jsx';
import { SCENARIOS } from '../lib/threeWay.js';
import { THREE_WAY_AGES, THREE_WAY_BALANCES, THREE_WAY_INCOMES, THREE_WAY_POINTS, THREE_WAY_SAMPLE } from '../data/threeWayGrid.js';
import { formatCurrency } from '../lib/format.js';
import { SCENARIOS_HASH } from '../lib/route.js';

const CURRENT_YEAR = new Date().getFullYear();

// Roth = blue and Pre-tax = orange, as on the Visualization page; conversions = green.
const INFO = {
  roth: { label: 'All Roth', short: 'Roth', color: 'var(--series-1)' },
  pretax: { label: 'All Pre-tax', short: 'Pre-tax', color: 'var(--series-2)' },
  converting: { label: 'All Pre-tax, with conversions in the lower years', short: 'Convert', color: 'var(--series-3)' },
};

const keyOf = ({ age, income, balance }) => `${age}-${income}-${balance}`;
const compactMoney = (v) => {
  if (v === 0) return '$0';
  return Math.abs(v) >= 1000000 ? `$${Number((v / 1000000).toFixed(2))}M` : `$${Math.round(v / 1000)}k`;
};
const sign = (v) => (v >= 0 ? '+' : '−');
const pctSigned = (v) => `${sign(v)}${Math.abs(v).toFixed(1)}%`;
const pctTick = (v) => (v === 0 ? '0%' : `${sign(v)}${Number(Math.abs(v).toFixed(1))}%`);

// The variables a closer look can run across.
const AXES = {
  income: { label: 'Pay', values: THREE_WAY_INCOMES, format: compactMoney },
  age: { label: 'Starting age', values: THREE_WAY_AGES, format: String },
  balance: { label: 'Existing Pre-tax balance', values: THREE_WAY_BALANCES, format: compactMoney },
};

// Up to 4 workers, leaving a core for the page.
const poolSize = () => Math.max(1, Math.min(4, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2) - 1));

// The last run, kept while the site is open (leaving the page stops a run where it is).
let kept = null;

// run: null before the first; then { results: { [key]: threeWayPoint }, done, total, running, error }.
function useThreeWayRun() {
  const [run, setRunState] = useState(kept);
  const pool = useRef([]);
  const setRun = useCallback((update) => {
    setRunState((r) => {
      kept = typeof update === 'function' ? update(r) : update;
      return kept;
    });
  }, []);
  const stop = useCallback(() => {
    pool.current.forEach((w) => w.terminate());
    pool.current = [];
  }, []);
  useEffect(
    () => () => {
      stop();
      if (kept?.running) kept = { ...kept, running: false, cancelled: true };
    },
    [stop],
  );

  const start = useCallback(() => {
    stop();
    const total = THREE_WAY_POINTS.length;
    const results = {};
    let next = 0;
    let done = 0;
    setRun({ results: {}, done: 0, total, running: true, error: null });
    const give = (worker) => {
      const id = next++;
      if (id < total) worker.postMessage({ id, point: THREE_WAY_POINTS[id], year: CURRENT_YEAR });
    };
    const workers = Array.from({ length: poolSize() }, () => new Worker(new URL('./threeWay.worker.js', import.meta.url), { type: 'module' }));
    pool.current = workers;
    workers.forEach((worker) => {
      worker.onmessage = ({ data }) => {
        results[keyOf(THREE_WAY_POINTS[data.id])] = data.out;
        done += 1;
        const finished = done === total;
        setRun((r) => ({ ...r, results: { ...results }, done, running: !finished }));
        if (finished) stop();
        else give(worker);
      };
      worker.onerror = (e) => {
        stop();
        setRun((r) => ({ ...r, running: false, error: e.message || 'The run stopped with an error.' }));
      };
      give(worker);
    });
  }, [stop, setRun]);

  const cancel = useCallback(() => {
    stop();
    setRun((r) => (r ? { ...r, running: false, cancelled: true } : r));
  }, [stop, setRun]);

  return { run, start, cancel };
}

function describe(r) {
  const { age, income, balance } = r.point;
  const s = r.scenarios;
  const parts = [
    `Age ${age}, ${compactMoney(income)} pay, ${compactMoney(balance)} Pre-tax`,
    `After-tax wealth at 95: Roth ${formatCurrency(s.roth.endingAfterTax)}, Pre-tax ${formatCurrency(s.pretax.endingAfterTax)}, with conversions ${formatCurrency(s.converting.endingAfterTax)}`,
    r.noConversions ? 'No room to convert (below today’s rate)' : `Converted ${formatCurrency(s.converting.converted)} in all`,
  ];
  if (r.allRunOut) parts.push(`Runs out in all three; sustainable spending: Roth ${formatCurrency(s.roth.sustainable)}, Pre-tax ${formatCurrency(s.pretax.sustainable)}, with conversions ${formatCurrency(s.converting.sustainable)}`);
  if (r.winner === 'even') parts.push(`About even: ${r.tied.map((k) => INFO[k].short).join(', ')}`);
  return parts.join('\n');
}

// The cells' marks: no room to convert; the money runs out in all three.
const MARKS = [
  {
    symbol: '°',
    note: "no room to convert: at the spending need nothing in retirement is taxed below today's rate, so the conversions scenario is Pre-tax itself",
    test: (r) => r.noConversions && !r.allRunOut,
  },
  {
    symbol: '†',
    note: 'the money runs out before 95 in all three, so each leaves $0: ranked by sustainable spending instead',
    test: (r) => r.allRunOut,
  },
];

const formatLead = (r) => (r.winner === 'even' ? '' : `+${(r.lead * 100).toFixed(r.lead < 0.1 ? 1 : 0)}%`);

function WinnerMaps({ results }) {
  return (
    <div className="card">
      <h2>Who comes out ahead</h2>
      <p className="hint">
        One map per starting age: pay across, the existing Pre-tax balance down. Each cell names the scenario that leaves
        the most after-tax wealth at 95 (or, marked †, the most sustainable spending), and by how much it beats the next best. Hover a cell for all three.
      </p>
      <div className="three-way-maps">
        {THREE_WAY_AGES.map((age) => (
          <div key={age}>
            <h3>Starting at {age}</h3>
            <WinnerGrid
              caption={`Starting at ${age}: the scenario that comes out ahead, by pay (across) and existing Pre-tax balance (down)`}
              rows={THREE_WAY_BALANCES.map((b) => ({ key: b, label: compactMoney(b) }))}
              columns={THREE_WAY_INCOMES.map((i) => ({ key: i, label: compactMoney(i) }))}
              rowHeading="Balance"
              columnHeading="Pay"
              cellAt={(balance, income) => results[keyOf({ age, income, balance })]}
              scenarios={INFO}
              describe={describe}
              formatLead={formatLead}
              marks={MARKS}
              legend={age === THREE_WAY_AGES[THREE_WAY_AGES.length - 1]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="three-way-select">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CloserLook({ results }) {
  const [across, setAcross] = useState('income');
  const [held, setHeld] = useState({ income: 100000, age: 35, balance: 100000 });
  const axis = AXES[across];
  const slice = axis.values.map((x) => results[keyOf({ ...held, [across]: x })]);
  const ready = slice.every(Boolean);
  // On the point's own measure: wealth at 95, or sustainable spending where all three run out.
  const versus = (r, k) => ((r.scenarios[k][r.measure] - r.scenarios.pretax[r.measure]) / r.scenarios.pretax[r.measure]) * 100;
  const series = ready
    ? SCENARIOS.map((k) => ({ key: k, label: INFO[k].label, color: INFO[k].color, points: slice.map((r, i) => ({ x: axis.values[i], y: versus(r, k) })) }))
    : [];
  const heldText = Object.keys(AXES)
    .filter((k) => k !== across)
    .map((k) => `${AXES[k].label.toLowerCase()} ${AXES[k].format(held[k])}`)
    .join(', ');

  return (
    <div className="card">
      <h2>A closer look</h2>
      <p className="hint">
        One variable across, the other two held. Each line is a scenario&rsquo;s after-tax wealth at 95 compared with
        all Pre-tax (the zero line); where the money runs out in all three (marked † in the table), their sustainable spending.
      </p>
      <div className="three-way-controls">
        <Select
          label="Across"
          value={across}
          onChange={setAcross}
          options={Object.entries(AXES).map(([k, a]) => ({ value: k, label: a.label }))}
        />
        {Object.entries(AXES)
          .filter(([k]) => k !== across)
          .map(([k, a]) => (
            <Select
              key={k}
              label={a.label}
              value={held[k]}
              onChange={(v) => setHeld({ ...held, [k]: Number(v) })}
              options={a.values.map((v) => ({ value: v, label: a.format(v) }))}
            />
          ))}
      </div>
      {!ready ? (
        <p className="hint">This slice fills in when its points have run.</p>
      ) : (
        <>
          <LineChart
            series={series}
            xTicks={axis.values}
            formatX={axis.format}
            formatY={pctSigned}
            formatYTick={pctTick}
            xLabel={axis.label}
            yLabel="After-tax wealth at 95 vs. all Pre-tax"
          />
          <details className="details">
            <summary>Show the numbers ({heldText})</summary>
            <div className="details-body">
              <SliceTable axis={axis} slice={slice} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function SliceTable({ axis, slice }) {
  const groups = [
    { key: 'endingAfterTax', label: 'After-tax wealth at 95' },
    { key: 'totalTax', label: 'Lifetime tax' },
    { key: 'sustainable', label: 'Sustainable spending' },
  ];
  return (
    <div className="table-wrap">
      <table className="three-way-table">
        <thead>
          <tr>
            <th rowSpan={2} className="row-head">
              {axis.label}
            </th>
            <th rowSpan={2}>Spending need</th>
            {groups.map((g) => (
              <th key={g.key} colSpan={3}>
                {g.label}
              </th>
            ))}
            <th rowSpan={2}>Converted</th>
          </tr>
          <tr>
            {groups.flatMap((g) => SCENARIOS.map((k) => <th key={`${g.key}-${k}`}>{INFO[k].short}</th>))}
          </tr>
        </thead>
        <tbody>
          {slice.map((r, i) => (
            <tr key={axis.values[i]}>
              <th className="row-head">
                {axis.format(axis.values[i])}
                {r.allRunOut && ' †'}
              </th>
              <td>{formatCurrency(r.need)}</td>
              {groups.flatMap((g) =>
                SCENARIOS.map((k) => (
                  <td key={`${g.key}-${k}`} className={g.key === r.measure && r.tied.includes(k) ? 'three-way-best' : undefined}>
                    {formatCurrency(r.scenarios[k][g.key])}
                    {g.key === 'endingAfterTax' && r.scenarios[k].runsOut && '*'}
                  </td>
                )),
              )}
              <td>{r.noConversions ? '—' : formatCurrency(r.scenarios.converting.converted)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Bold = the winner (or within 0.5% of it): the most after-tax wealth, or at † (the money runs out in all three) the most sustainable spending. * = the money runs out before 95 at the spending need.
        Lifetime tax = federal income tax + IRMAA.
      </p>
    </div>
  );
}

export default function ThreeWayPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Three scenarios — Retirement Tax Calculators';
    return () => {
      document.title = previous;
    };
  }, []);
  const { run, start, cancel } = useThreeWayRun();
  const results = run?.results ?? {};

  return (
    <article className="scenarios-page">
      <a className="back-link" href={SCENARIOS_HASH}>
        &larr; Back to the Visualization page
      </a>

      <div className="scenarios-intro">
        <h1>Roth, Pre-tax, or Pre-tax with conversions</h1>
        <p>
          Three ways to save the same take-home pay, run through the whole plan for {THREE_WAY_POINTS.length} sample
          households: <strong>all Roth</strong>, <strong>all Pre-tax</strong>, and{' '}
          <strong>all Pre-tax with Roth conversions in the lower years</strong> (each retired year taxed below today&rsquo;s
          rate on contributions is filled to the top of its bracket, RMD years included: the Roth page&rsquo;s
          conversions rule).
        </p>
        <p>
          <strong>The winner leaves the most after-tax wealth at 95, spending the plan&rsquo;s need.</strong> Sustainable
          spending can&rsquo;t show conversions: at the highest steady spending the low brackets are already full, so the
          rule never converts. Within 0.5% is about even.
        </p>
        <p className="hint">
          Every sample household: single, W-2 pay, {THREE_WAY_SAMPLE.savingsRate * 100}% of pay saved to a 401(k), the
          existing balance all Pre-tax, retiring at {THREE_WAY_SAMPLE.retirementAge}, planning to{' '}
          {THREE_WAY_SAMPLE.planToAge}, no debt payments, and the app&rsquo;s default assumptions (7% return, 2.5%
          inflation, IRMAA on, surplus income saved in retirement, heirs taxed at 24%).
        </p>
        <div className="button-row">
          {run?.running ? (
            <button type="button" className="button secondary" onClick={cancel}>
              Stop
            </button>
          ) : (
            <button type="button" className="button" onClick={start}>
              {run ? 'Run again' : 'Run the scenarios'}
            </button>
          )}
          {run?.running && (
            <span className="mc-progress">
              <progress value={run.done} max={run.total} /> {run.done} of {run.total} households
            </span>
          )}
          {!run && <span className="hint">About a minute or two; the maps fill in as it goes.</span>}
        </div>
        {run?.error && <p className="note">{run.error}</p>}
        {run?.cancelled && run.done < run.total && (
          <p className="hint">
            Stopped at {run.done} of {run.total}.
          </p>
        )}
      </div>

      {run && (
        <div className="scenario-batches">
          <WinnerMaps results={results} />
          <CloserLook results={results} />
        </div>
      )}

      <a className="back-link" href={SCENARIOS_HASH}>
        &larr; Back to the Visualization page
      </a>
    </article>
  );
}
