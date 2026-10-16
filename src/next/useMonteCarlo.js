// Runs Monte Carlo in background workers (phase 8 step c; a Run button, decided 2026-10-16). The work
// is split into chunks, the paths first and then the spending searches, handed to a small pool of
// workers; the run reports its progress and its summary as each part finishes. Held by NextApp, so
// a run survives moving between pages; `values` is what it ran on, so the page can say when the
// inputs have changed since.
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PATHS, DEFAULT_SEED, INCOME_PATHS, summarizeMonteCarlo } from '../lib/monteCarlo.js';

const PATH_CHUNK = 50;
const INCOME_CHUNK = 5;
// Up to 4 workers, leaving a core for the page.
const poolSize = () => Math.max(1, Math.min(4, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2) - 1));

const chunks = (kind, total, size) => Array.from({ length: Math.ceil(total / size) }, (_, i) => ({ kind, from: i * size, to: Math.min(total, (i + 1) * size) }));

// run: null before the first; then { values, need, volatility, running, pathsDone, incomeDone, paths,
// incomePaths, summary (null until the paths are all in), outcomes, error }.
export default function useMonteCarlo() {
  const [run, setRun] = useState(null);
  const pool = useRef([]);
  const stop = useCallback(() => {
    pool.current.forEach((w) => w.terminate());
    pool.current = [];
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(
    ({ household, need, values, volatility }) => {
      stop();
      const tasks = [...chunks('paths', DEFAULT_PATHS, PATH_CHUNK), ...chunks('income', INCOME_PATHS, INCOME_CHUNK)].map((t, id) => ({ ...t, id }));
      const outcomes = new Array(DEFAULT_PATHS);
      const incomes = new Array(INCOME_PATHS);
      let next = 0;
      let pathsDone = 0;
      let incomeDone = 0;
      setRun({ values, need, volatility, running: true, pathsDone: 0, incomeDone: 0, paths: DEFAULT_PATHS, incomePaths: INCOME_PATHS, summary: null, outcomes: null, error: null });
      const give = (worker) => {
        const t = tasks[next++];
        if (t) worker.postMessage({ id: t.id, kind: t.kind, household, need, from: t.from, to: t.to, volatility, seed: DEFAULT_SEED });
      };
      const workers = Array.from({ length: poolSize() }, () => new Worker(new URL('./monteCarlo.worker.js', import.meta.url), { type: 'module' }));
      pool.current = workers;
      workers.forEach((worker) => {
        worker.onmessage = ({ data }) => {
          const t = tasks[data.id];
          const target = t.kind === 'paths' ? outcomes : incomes;
          data.out.forEach((o, k) => (target[t.from + k] = o));
          if (t.kind === 'paths') pathsDone += t.to - t.from;
          else incomeDone += t.to - t.from;
          const pathsIn = pathsDone === DEFAULT_PATHS;
          const finished = pathsIn && incomeDone === INCOME_PATHS;
          setRun((r) => ({
            ...r,
            pathsDone,
            incomeDone,
            running: !finished,
            // the summary once the paths are in; again with the spending once every search is
            ...(pathsIn && (t.kind === 'paths' || finished) ? { summary: summarizeMonteCarlo(outcomes, finished ? incomes : []), outcomes } : {}),
          }));
          if (finished) stop();
          else give(worker);
        };
        worker.onerror = (e) => {
          stop();
          setRun((r) => ({ ...r, running: false, error: e.message || 'The simulation stopped with an error.' }));
        };
        give(worker);
      });
    },
    [stop],
  );

  const cancel = useCallback(() => {
    stop();
    setRun((r) => (r ? { ...r, running: false, cancelled: true } : r));
  }, [stop]);

  return { run, start, cancel };
}
