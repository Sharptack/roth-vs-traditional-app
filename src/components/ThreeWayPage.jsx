// The three-scenario Visualization page (#/scenarios/three-way; decided 2026-10-16, roadmap
// "Three-scenario visualization"): all Roth, all Pre-tax, and all Pre-tax with conversions in the
// lower years, over a grid of sample households (src/data/threeWayGrid.js, src/lib/threeWay.js).
// The grid runs in background workers on request; the last run is kept while the site stays open.
import { useCallback, useEffect, useRef, useState } from 'react';
import LineChart from './charts/LineChart.jsx';
import WinnerGrid from './charts/WinnerGrid.jsx';
import { SCENARIOS, threeWayRanking } from '../lib/threeWay.js';
import {
  THREE_WAY_AGES,
  THREE_WAY_BALANCES,
  THREE_WAY_HEIR_RATES,
  THREE_WAY_INCOMES,
  THREE_WAY_POINTS,
  THREE_WAY_SAMPLE,
  THREE_WAY_SAVINGS_STEPS,
} from '../data/threeWayGrid.js';
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

const pct0 = (v) => `${Math.round(v * 100)}%`;

// What the maps and the closer look rank by: wealth at 95 at an heirs' rate, or lifetime tax.
const BY = {
  wealth: { label: 'After-tax wealth at 95', short: 'wealth at 95' },
  tax: { label: 'Lifetime tax (federal income tax + IRMAA)', short: 'lifetime tax' },
};
const wealthLabel = (heirRate) => `After-tax wealth at 95 (heirs at ${pct0(heirRate)})`;

// A point with its winner for the view chosen.
const rankedFor = (r, view) => (r ? { ...r, ...threeWayRanking(r, view) } : undefined);

function describe(r, heirRate) {
  const { age, income, balance } = r.point;
  const s = r.scenarios;
  const three = (pick) => `Roth ${formatCurrency(pick(s.roth))}, Pre-tax ${formatCurrency(pick(s.pretax))}, with conversions ${formatCurrency(pick(s.converting))}`;
  const parts = [
    `Age ${age}, ${compactMoney(income)} pay, ${compactMoney(balance)} Pre-tax, saving ${pct0(r.savingsRate)} of pay${r.raised ? ' (raised from 10% so the money lasts)' : ''}`,
    `Wealth at 95, heirs at ${pct0(heirRate)}: ${three((x) => x.endingAt[heirRate])}`,
    `Lifetime tax: ${three((x) => x.totalTax)}`,
    r.noConversions ? 'No room to convert (below today’s rate)' : `Converted ${formatCurrency(s.converting.converted)} in all`,
  ];
  if (r.allRunOut) parts.push(`Runs out in all three even saving ${pct0(THREE_WAY_SAVINGS_STEPS.at(-1))}; sustainable spending: ${three((x) => x.sustainable)}`);
  if (r.winner === 'even') parts.push(`About even: ${r.tied.map((k) => INFO[k].short).join(', ')}`);
  return parts.join('\n');
}

// The cells' marks: savings raised; no room to convert; the money runs out in all three.
const MARKS = [
  {
    symbol: '↑',
    note: `savings raised from 10% (in steps up to ${pct0(THREE_WAY_SAVINGS_STEPS.at(-1))}) until the money lasts to 95 in all three; the rate is in the hover and the table`,
    test: (r) => r.raised,
  },
  {
    symbol: '°',
    note: "no room to convert: at the spending need nothing in retirement is taxed below today's rate, so the conversions scenario is Pre-tax itself",
    test: (r) => r.noConversions && !r.allRunOut,
  },
  {
    symbol: '†',
    note: `the money runs out before 95 in all three even saving ${pct0(THREE_WAY_SAVINGS_STEPS.at(-1))} (shown at 10%), so each leaves $0: ranked by sustainable spending instead`,
    test: (r) => r.allRunOut,
  },
];

// Wealth or spending: how much more the winner has; tax: how much less it pays.
const formatLead = (r) => {
  if (r.winner === 'even') return '';
  const v = (r.lead * 100).toFixed(r.lead < 0.1 ? 1 : 0);
  return r.measure === 'tax' ? `−${v}% tax` : `+${v}%`;
};

function ViewControls({ view, setView }) {
  return (
    <div className="three-way-controls">
      <Select
        label="Rank by"
        value={view.by}
        onChange={(by) => setView({ ...view, by })}
        options={Object.entries(BY).map(([k, b]) => ({ value: k, label: b.label }))}
      />
      <Select
        label="Heirs' tax rate on Pre-tax left"
        value={view.heirRate}
        onChange={(v) => setView({ ...view, heirRate: Number(v) })}
        options={THREE_WAY_HEIR_RATES.map((h) => ({ value: h, label: pct0(h) }))}
      />
    </div>
  );
}

function WinnerMaps({ results, view }) {
  const what =
    view.by === 'tax'
      ? 'pays the least lifetime tax, and how much less than the next best'
      : `leaves the most after-tax wealth at 95 (leftover Pre-tax taxed at the heirs' ${pct0(view.heirRate)}), and by how much it beats the next best`;
  return (
    <div className="card">
      <h2>Who comes out ahead: {BY[view.by].short}</h2>
      <p className="hint">
        One map per starting age: pay across, the existing Pre-tax balance down. Each cell names the scenario that {what}
        {view.by === 'tax' ? ' (the heirs’ rate doesn’t change it)' : ''}. Hover a cell for all three.
      </p>
      <div className="three-way-maps">
        {THREE_WAY_AGES.map((age) => (
          <div key={age}>
            <h3>Starting at {age}</h3>
            <WinnerGrid
              caption={`Starting at ${age}: the scenario that comes out ahead on ${BY[view.by].short}, by pay (across) and existing Pre-tax balance (down)`}
              rows={THREE_WAY_BALANCES.map((b) => ({ key: b, label: compactMoney(b) }))}
              columns={THREE_WAY_INCOMES.map((i) => ({ key: i, label: compactMoney(i) }))}
              rowHeading="Balance"
              columnHeading="Pay"
              cellAt={(balance, income) => rankedFor(results[keyOf({ age, income, balance })], view)}
              scenarios={INFO}
              describe={(r) => describe(r, view.heirRate)}
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

function CloserLook({ results, view }) {
  const [across, setAcross] = useState('income');
  const [held, setHeld] = useState({ income: 100000, age: 35, balance: 100000 });
  const axis = AXES[across];
  const slice = axis.values.map((x) => rankedFor(results[keyOf({ ...held, [across]: x })], view));
  const ready = slice.every(Boolean);
  // On the view's measure (sustainable spending where all three run out), vs. all Pre-tax.
  const valueOf = (r, k) =>
    ({ wealth: r.scenarios[k].endingAt[view.heirRate], tax: r.scenarios[k].totalTax, sustainable: r.scenarios[k].sustainable })[r.measure];
  const versus = (r, k) => ((valueOf(r, k) - valueOf(r, 'pretax')) / valueOf(r, 'pretax')) * 100;
  const series = ready
    ? SCENARIOS.map((k) => ({ key: k, label: INFO[k].label, color: INFO[k].color, points: slice.map((r, i) => ({ x: axis.values[i], y: versus(r, k) })) }))
    : [];
  const heldText = Object.keys(AXES)
    .filter((k) => k !== across)
    .map((k) => `${AXES[k].label.toLowerCase()} ${AXES[k].format(held[k])}`)
    .join(', ');
  const measureText = view.by === 'tax' ? 'lifetime tax (lower is better)' : `after-tax wealth at 95, heirs at ${pct0(view.heirRate)}`;

  return (
    <div className="card">
      <h2>A closer look</h2>
      <p className="hint">
        One variable across, the other two held. Each line is a scenario&rsquo;s {measureText}, compared with all Pre-tax
        (the zero line); where the money runs out in all three (marked † in the table), their sustainable spending.
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
            yLabel={view.by === 'tax' ? 'Lifetime tax vs. all Pre-tax' : 'Wealth at 95 vs. all Pre-tax'}
          />
          <details className="details">
            <summary>Show the numbers ({heldText})</summary>
            <div className="details-body">
              <SliceTable axis={axis} slice={slice} heirRate={view.heirRate} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function SliceTable({ axis, slice, heirRate }) {
  const groups = [
    { key: 'wealth', label: wealthLabel(heirRate), pick: (s) => s.endingAt[heirRate] },
    { key: 'tax', label: 'Lifetime tax', pick: (s) => s.totalTax },
    { key: 'sustainable', label: 'Sustainable spending', pick: (s) => s.sustainable },
  ];
  return (
    <div className="table-wrap">
      <table className="three-way-table">
        <thead>
          <tr>
            <th rowSpan={2} className="row-head">
              {axis.label}
            </th>
            <th rowSpan={2}>Savings rate</th>
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
              <td>
                {pct0(r.savingsRate)}
                {r.raised && ' ↑'}
              </td>
              <td>{formatCurrency(r.need)}</td>
              {groups.flatMap((g) =>
                SCENARIOS.map((k) => (
                  <td key={`${g.key}-${k}`} className={g.key === r.measure && r.tied.includes(k) ? 'three-way-best' : undefined}>
                    {formatCurrency(g.pick(r.scenarios[k]))}
                    {g.key === 'wealth' && r.scenarios[k].runsOut && '*'}
                  </td>
                )),
              )}
              <td>{r.noConversions ? '—' : formatCurrency(r.scenarios.converting.converted)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Bold = the winner on the measure chosen (or within 0.5% of it); at † (the money runs out in all three), the most
        sustainable spending. ↑ = savings raised so the money lasts; a higher savings rate also lowers the spending need
        (the need is take-home pay after savings). * = the money runs out before 95 at the spending need. Lifetime tax =
        federal income tax + IRMAA.
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
  const [view, setView] = useState({ by: 'wealth', heirRate: THREE_WAY_SAMPLE.heirRate });
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
          <strong>Ranked by the after-tax wealth left at 95, spending the plan&rsquo;s need</strong> (leftover Pre-tax
          taxed at the heirs&rsquo; rate you choose), <strong>or by lifetime tax.</strong> Sustainable spending can&rsquo;t
          show conversions: at the highest steady spending the low brackets are already full, so the rule never converts.
          Within 0.5% is about even.
        </p>
        <p className="hint">
          Every sample household: single, W-2 pay, {pct0(THREE_WAY_SAMPLE.savingsRate)} of pay saved to a 401(k) (raised in
          steps up to {pct0(THREE_WAY_SAVINGS_STEPS.at(-1))} where the money would run out before 95), the existing balance
          all Pre-tax, retiring at {THREE_WAY_SAMPLE.retirementAge}, planning to {THREE_WAY_SAMPLE.planToAge}, no debt
          payments, and the app&rsquo;s default assumptions (7% return, 2.5% inflation, IRMAA on, surplus income saved in
          retirement).
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
          {!run && <span className="hint">About two minutes; the maps fill in as it goes.</span>}
        </div>
        {run?.error && <p className="note">{run.error}</p>}
        {run?.cancelled && run.done < run.total && (
          <p className="hint">
            Stopped at {run.done} of {run.total}.
          </p>
        )}
        {run && <ViewControls view={view} setView={setView} />}
      </div>

      {run && (
        <div className="scenario-batches">
          <WinnerMaps results={results} view={view} />
          <CloserLook results={results} view={view} />
        </div>
      )}

      <a className="back-link" href={SCENARIOS_HASH}>
        &larr; Back to the Visualization page
      </a>
    </article>
  );
}
