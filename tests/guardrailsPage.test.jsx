import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GuardrailsResult from '../src/next/GuardrailsResult.jsx';
import { previewResult } from '../src/next/NextApp.jsx';
import { DEFAULT_HOUSEHOLD_VALUES } from '../src/lib/householdValues.js';
import { DEFAULT_GUARDRAILS, guardrailScales, guardrailsReport, requiredScales, rulePaths, ruleTableYear, ruleYears, spendingCloud, targetSpending } from '../src/lib/guardrails.js';
import { guardrailsTile } from '../src/lib/suiteTiles.js';

// Phase 9 step d: the guardrails page renders before a run and after one (a small run here: 6 paths,
// tables for two retired years, 20 paths under the rule), and its tile. The default household with
// its person 62 (a shorter plan, for the test's speed).
const values = { ...DEFAULT_HOUSEHOLD_VALUES, people: DEFAULT_HOUSEHOLD_VALUES.people.map((p, i) => (i === 0 ? { ...p, age: '62' } : p)) };
const r = previewResult(values, 2026);
const h = r.household;
const need = r.spending.need;
const settings = h.calculators.guardrails;
const paths = { to: 6 };
const today = spendingCloud(h, 1, paths);
const target = targetSpending(today, settings.target);
const scales = requiredScales(h, target, paths);
const g = guardrailScales(scales, settings);
const years = ruleYears(h, target).slice(0, 2);
const tables = years.map((t) => ruleTableYear(h, target, t, { to: 3 }));
const report = guardrailsReport({
  household: h,
  need,
  settings,
  today,
  scales,
  atCut: spendingCloud(h, g.cut, paths),
  atRaise: Number.isFinite(g.raise) ? spendingCloud(h, g.raise, paths) : null,
  tables,
  rule: rulePaths(h, target, tables, { to: 20, settings }),
});
const run = { values, need, volatility: 0.2, settings, running: false, stage: 'done', done: 1, total: 1, report };
const render = (props) =>
  renderToStaticMarkup(
    <GuardrailsResult household={h} need={need} volatility={0.2} onVolatility={() => {}} settings={settings} onSetting={() => {}} onRun={() => {}} onCancel={() => {}} {...props} />,
  );

describe('the guardrails page', () => {
  it('the household’s settings: the defaults (80%, 50%, 95%, 5%)', () => {
    expect(settings).toEqual(DEFAULT_GUARDRAILS);
  });
  it('before a run: the Run button and the four settings, no results', () => {
    const html = render({ run: null, stale: false });
    expect(html).toContain('Work out the guardrails');
    for (const label of ['Target chance of success', 'Cut when the chance falls to', 'Raise when the chance reaches', 'Smallest change made']) expect(html).toContain(label);
    expect(html).toContain('value="80"');
    expect(html).not.toContain('Today’s guardrails');
  });
  it('after a run: the recommended spending, today’s guardrails, the years, spending under the rule', () => {
    const html = render({ run, stale: false });
    expect(html).toContain(`$${Math.round(report.target).toLocaleString('en-US')}`);
    for (const title of ['Recommended spending', 'Today’s guardrails', 'The guardrails year by year', 'Spending under the guardrails']) expect(html).toContain(title);
    expect(html).toContain('Run again');
    expect(html).not.toMatch(/NaN|undefined/);
    expect(report.schedule).toHaveLength(2);
    expect(report.rule.paths).toBe(20);
  });
  it('out of date after an input changes; no need says why and Run is off', () => {
    expect(render({ run, stale: true })).toContain('The inputs have changed since this run');
    const html = render({ run: null, stale: false, need: null, household: null, error: 'Enter an income.' });
    expect(html).toContain('Enter an income.');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Work out the guardrails/);
  });
});

describe('guardrailsTile', () => {
  it('not run, running, run (and out of date)', () => {
    expect(guardrailsTile(null).headline).toBe('Not run yet');
    expect(guardrailsTile({ running: true, report: null }).headline).toBe('Running…');
    const t = guardrailsTile(run, true);
    expect(t.headline).toBe(`$${Math.round(report.target).toLocaleString('en-US')} a year`);
    expect(t.detail).toContain('80% of paths sustain it; cut below');
    expect(t.detail).toContain('inputs changed since this run');
  });
});
