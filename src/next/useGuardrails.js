// Runs the guardrails in background workers (phase 9 step d), as useMonteCarlo does Monte Carlo: a
// Run button, a small pool of workers, the run kept across pages. The work comes in three stages,
// each needing the last:
//   1. the spending each of the paths sustains today (its ⌈0.8n⌉-th largest: the target spending);
//   2. each path's needed portfolio at the target spending, and the rule's table for each retired year
//      (along the plan at the target spending);
//   3. the spending the paths sustain at the cut and the raise values, and the paths under the rule
//      (once every table is in).
// The report (lib/guardrails.js guardrailsReport) is worked out as each stage finishes; today's
// guardrails go ahead of the year tables, so they show first.
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PATHS } from '../lib/monteCarlo.js';
import { GUARDRAIL_PATHS, TABLE_PATHS, guardrailScales, guardrailsReport, ruleYears, spendingCloud, tableYears, targetSpending } from '../lib/guardrails.js';

const CLOUD_CHUNK = 10;
const SCALE_CHUNK = 20;
const RULE_CHUNK = 100;
// Rough work per task, for the progress bar: a path's spending search is about 1, a needed
// portfolio about 0.7, a year's table three searches on each of its paths (resumed, so cheaper), a
// path under the rule one projection.
const WORK = { cloud: 1, scales: 0.7, table: 1.5 * TABLE_PATHS, rule: 0.08 };
const poolSize = () => Math.max(1, Math.min(4, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2) - 1));
const chunks = (kind, total, size, extra = {}) =>
  Array.from({ length: Math.ceil(total / size) }, (_, i) => ({ kind, from: i * size, to: Math.min(total, (i + 1) * size), ...extra }));
const workOf = (t) => WORK[t.kind] * (t.kind === 'table' ? 1 : t.to - t.from);

// run: null before the first; then { values, need, volatility, settings, running, stage, done, total,
// report (null until stage 1 and the needed portfolios are in), error, cancelled }.
export default function useGuardrails() {
  const [run, setRun] = useState(null);
  const pool = useRef([]);
  const stop = useCallback(() => {
    pool.current.forEach((w) => w.terminate());
    pool.current = [];
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(
    ({ household, need, values, volatility, settings }) => {
      stop();
      const n = GUARDRAIL_PATHS;
      const parts = { today: new Array(n), scales: new Array(n), atCut: new Array(n), atRaise: new Array(n), rule: new Array(DEFAULT_PATHS), tables: null };
      const left = { cloud: 0, scales: 0, atCut: 0, atRaise: 0, table: 0, rule: 0 };
      const tasks = [];
      const queue = [];
      const idle = [];
      let target = null;
      let cut = null;
      let raise = null;
      let years = [];
      let done = 0;
      let ruleAdded = false;
      // The total, estimated at the start (the retired years at the need) and corrected once known.
      const estimateYears = tableYears(ruleYears(household, need)).length;
      let total =
        n * (WORK.cloud * 3 + WORK.scales) + estimateYears * WORK.table + DEFAULT_PATHS * WORK.rule;

      const report = () =>
        guardrailsReport({
          household,
          need,
          settings,
          today: parts.today,
          scales: parts.scales,
          atCut: cut !== null && left.atCut === 0 && Number.isFinite(cut) ? parts.atCut : null,
          atRaise: raise !== null && left.atRaise === 0 && Number.isFinite(raise) ? parts.atRaise : null,
          tables: parts.tables && left.table === 0 ? parts.tables : null,
          rule: ruleAdded && left.rule === 0 ? parts.rule : null,
        });
      const stageOf = () =>
        target === null ? 'today' : left.scales > 0 || left.table > 0 ? 'tables' : left.atCut + left.atRaise > 0 || left.rule > 0 ? 'rule' : 'done';

      const workers = Array.from({ length: poolSize() }, () => new Worker(new URL('./guardrails.worker.js', import.meta.url), { type: 'module' }));
      pool.current = workers;
      const feed = () => {
        while (idle.length && queue.length) {
          const t = queue.shift();
          idle.pop().postMessage({ ...t, household, volatility, settings });
        }
      };
      // first: ahead of the queue (today's guardrails before the year tables)
      const add = (list, key, first = false) => {
        for (const t of list) {
          t.id = tasks.length;
          t.key = key;
          tasks.push(t);
          left[key] += 1;
        }
        if (first) queue.unshift(...list);
        else queue.push(...list);
        feed();
      };

      setRun({ values, need, volatility, settings, running: true, stage: 'today', done: 0, total, report: null, error: null });
      workers.forEach((worker) => {
        worker.onmessage = ({ data }) => {
          const t = tasks[data.id];
          if (t.kind === 'table') parts.tables[t.index] = data.out;
          else data.out.forEach((o, k) => (parts[t.key === 'cloud' ? 'today' : t.key][t.from + k] = o));
          left[t.key] -= 1;
          done += workOf(t);
          let changed = false;
          // Stage 1 done: the target, then the needed portfolios at it and the year tables.
          if (t.key === 'cloud' && left.cloud === 0) {
            target = targetSpending(parts.today, settings.target);
            years = tableYears(ruleYears(household, target));
            parts.tables = new Array(years.length).fill(null);
            total += (years.length - estimateYears) * WORK.table;
            // (each path's needed scale about the target over what it sustains today)
            add(chunks('scales', n, SCALE_CHUNK, { spending: target }).map((c) => ({ ...c, guesses: parts.today.slice(c.from, c.to).map((w) => (w > 0 ? target / w : undefined)) })), 'scales');
          }
          // (no retired year, no spending from the portfolio: no rule to run)
          // The needed portfolios in: the clouds at the two guardrails (each search starting near the
          // path's spending today in proportion).
          if (t.key === 'scales' && left.scales === 0) {
            ({ cut, raise } = guardrailScales(parts.scales, settings));
            changed = true;
            for (const [key, k] of [['atCut', cut], ['atRaise', raise]]) {
              if (!Number.isFinite(k)) continue;
              add(chunks('cloud', n, CLOUD_CHUNK, { scale: k }).map((c) => ({ ...c, guesses: parts.today.slice(c.from, c.to).map((w) => w * k) })), key, true);
            }
            // then the year tables, behind them
            add(years.map((y, index) => ({ kind: 'table', t: y, index, spending: target, from: 0, to: 1 })), 'table');
          }
          // Every table in: the paths under the rule.
          if (t.key === 'table' && left.table === 0) {
            ruleAdded = true;
            add(chunks('rule', DEFAULT_PATHS, RULE_CHUNK, { spending: target, tables: parts.tables }), 'rule');
            changed = true;
          }
          if (t.key === 'atCut' || t.key === 'atRaise' || t.key === 'rule') changed = changed || left[t.key] === 0;
          const finished = target !== null && Object.values(left).every((x) => x === 0);
          const ready = target !== null && cut !== null;
          setRun((r) => ({ ...r, done, total, stage: stageOf(), running: !finished, ...(ready && (changed || finished) ? { report: report() } : {}) }));
          if (finished) stop();
          else {
            idle.push(worker);
            feed();
          }
        };
        worker.onerror = (e) => {
          stop();
          setRun((r) => ({ ...r, running: false, error: e.message || 'The guardrails stopped with an error.' }));
        };
        idle.push(worker);
      });
      // Today's searches start near the plan's own sustainable spending (its path at no volatility).
      const plan = spendingCloud(household, 1, { to: 1, volatility: 0 })[0];
      add(chunks('cloud', n, CLOUD_CHUNK, { scale: 1 }).map((c) => ({ ...c, guesses: Array(c.to - c.from).fill(plan) })), 'cloud');
    },
    [stop],
  );

  const cancel = useCallback(() => {
    stop();
    setRun((r) => (r ? { ...r, running: false, cancelled: true } : r));
  }, [stop]);

  return { run, start, cancel };
}
