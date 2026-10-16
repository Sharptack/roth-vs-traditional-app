import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MonteCarloResult from '../src/next/MonteCarloResult.jsx';
import { previewResult } from '../src/next/NextApp.jsx';
import { DEFAULT_HOUSEHOLD_VALUES } from '../src/lib/householdValues.js';
import { simulatePaths, summarizeMonteCarlo, sustainableOnPaths } from '../src/lib/monteCarlo.js';
import { monteCarloTile } from '../src/lib/suiteTiles.js';

// Phase 8 step c: the Monte Carlo page renders before a run and after one (a small run here: 40
// paths, 6 spending searches), and its tile.
const r = previewResult(DEFAULT_HOUSEHOLD_VALUES, 2026);
const h = r.household;
const need = r.spending.need;
const outcomes = simulatePaths(h, need, { to: 40 });
const incomes = sustainableOnPaths(h, { to: 6 });
const run = { values: DEFAULT_HOUSEHOLD_VALUES, need, volatility: 0.2, running: false, pathsDone: 40, incomeDone: 6, paths: 40, incomePaths: 6, summary: summarizeMonteCarlo(outcomes, incomes), outcomes };
const render = (props) =>
  renderToStaticMarkup(<MonteCarloResult household={h} need={need} volatility={0.2} onVolatility={() => {}} onRun={() => {}} onCancel={() => {}} {...props} />);

describe('the Monte Carlo page', () => {
  it('before a run: the Run button and the volatility, no results', () => {
    const html = render({ run: null, stale: false });
    expect(html).toContain('Run the simulation');
    expect(html).toContain('Volatility');
    expect(html).not.toContain('The portfolio over time');
  });
  it('after a run: the chance, the fan, the portfolio at an age, the spending, the run-out ages', () => {
    const html = render({ run, stale: false });
    const pct = `${Math.round(run.summary.chance * 100)}%`;
    expect(html).toContain(pct);
    for (const title of ['The portfolio over time', 'The portfolio at an age', 'Spending the paths sustain', 'When the failing paths run out']) expect(html).toContain(title);
    expect(html).toContain('Run again');
    expect(html).not.toContain('The inputs have changed');
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it('out of date after an input changes', () => {
    expect(render({ run, stale: true })).toContain('The inputs have changed since this run');
  });
  it('no spending need: says why, and Run is off', () => {
    const html = render({ run: null, stale: false, need: null, household: null, error: 'Enter an income.' });
    expect(html).toContain('Enter an income.');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Run the simulation/);
  });
});

describe('monteCarloTile', () => {
  it('not run, running, run (and out of date)', () => {
    expect(monteCarloTile(null).headline).toBe('Not run yet');
    expect(monteCarloTile({ running: true, summary: null }).headline).toBe('Running…');
    const t = monteCarloTile(run, true);
    expect(t.headline).toBe(`${Math.round(run.summary.chance * 100)}% chance of success`);
    expect(t.detail).toContain('of 40 paths');
    expect(t.detail).toContain('inputs changed since this run');
  });
});
