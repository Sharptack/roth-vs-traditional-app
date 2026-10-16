// Risk-based guardrails (round 2 phase 9). Pure. Decided with Michael 2026-10-16: risk-based only
// (Income Lab's approach, no Guyton-Klinger); the target is an 80% chance of success; spending is cut
// when the chance falls to 50% and raised when it reaches 95%; a change goes back to the target and
// is skipped when under 5%. All four are settings.
//
// The chance of success at a spending is the share of the Monte Carlo paths that sustain it, every
// path with the whole plan (Social Security, pensions, other income, the years left). Two clouds, one
// value per path, give everything as an order statistic, so a rerun lands on its target exactly:
//   - the spending each path sustains (phase 8's) at a portfolio value: the target spending is the
//     m-th largest, m = ⌈target × n⌉, so at least that share of paths sustain it;
//   - the portfolio each path needs to sustain the plan's spending: the balances, every account
//     scaled by one factor, searched path by path. The chance at a portfolio value is the share of
//     paths needing no more. The cut value is the m-th smallest, m = ⌊cut × n⌋ (the chance there is
//     m / n, at most the cut level); the raise value the m-th smallest, m = ⌈raise × n⌉ (at least the
//     raise level).
// At a guardrail, spending moves to the target spending at that portfolio value (a third cloud).
//
// From a later year (step b): start = the year's index t. The plan runs to year t at its own returns
// (the median path) and the plan's spending; at the start of year t the balances are scaled (the
// portfolio "if it is $X then"), and from then on each path's random returns (its draws from its
// first) and the spending searched. Success counts the years from t (and the legacy goal at the end).

import { pathReturns, percentile, DEFAULT_SEED, DEFAULT_VOLATILITY, INCOME_TOLERANCE, monteCarloOptions } from './monteCarlo.js';
import { runProjection } from './projection.js';
import { legacyValue } from './projectionSummary.js';

export const DEFAULT_GUARDRAILS = { target: 0.8, cut: 0.5, raise: 0.95, minChange: 0.05 };
export const GUARDRAIL_PATHS = 200;
export const SCALE_TOLERANCE = 0.005; // each path's portfolio search stops within half a percent
const MAX_SCALE = 1024; // a path that needs more than 1,024 times the portfolio: never (Infinity)

// Today's portfolio: every Existing Account.
export const portfolioTotal = (household) => household.accounts.reduce((s, a) => s + (a.balance || 0), 0);

// The plan at its own returns and spending: the portfolio at the start of each year (index t), for
// the guardrails from a later year.
export function planPortfolios(household, spending) {
  const { legacy: _legacy, ...options } = monteCarloOptions(household);
  const { rows } = runProjection(household, { ...options, need: spending });
  return rows.map((r, t) => (t === 0 ? portfolioTotal(household) : rows[t - 1].endBalances.total));
}

// The plan's state at the start of year start, at its own returns and the spending before (null for
// today): every run from that year resumes from it instead of replaying the years before.
function snapshotAt(household, options, before, start) {
  if (!(start > 0)) return undefined;
  const { legacy: _legacy, ...rest } = options;
  return runProjection(household, { ...rest, need: before, snapshotAt: start }).snapshot ?? undefined;
}

// Whether one path lasts from year start: the plan's spending (before) until then, spending from
// then, the balances times scale at its start, the path's returns from its start (resumed from the
// plan's snapshot that year, when given).
function lastsFrom(household, { spending, before, scale, start, options, yearReturn, resume }) {
  const { legacy, ...rest } = options;
  const { rows } = runProjection(household, {
    ...rest,
    resume,
    needIn: (t) => (t < start ? before : spending),
    rescale: { t: start, scale },
    yearReturn: (rate, t) => (t < start ? rate : yearReturn(rate, t - start)),
  });
  if (!rows.slice(start).every((r) => r.shortfall === 0)) return false;
  return !(legacy?.target > 0) || legacyValue(rows[rows.length - 1].endBalances, legacy) >= legacy.target;
}

// The smallest scale at which a path sustains the spending, within SCALE_TOLERANCE above; 0 when it
// lasts with nothing; Infinity when it never does. Bisection: more money only lasts as long.
function requiredScale(lasts) {
  if (lasts(0)) return 0;
  let lo = 0;
  let hi = 1;
  while (!lasts(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > MAX_SCALE) return Infinity;
  }
  while (hi - lo > SCALE_TOLERANCE * hi) {
    const mid = (lo + hi) / 2;
    if (lasts(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// The highest spending a path sustains, within INCOME_TOLERANCE below (as sustainableSpending), never
// finer than $1. 0 when not even none lasts. guess (optional): a likely answer, to start the bracket
// near it (the answer is the same up to the tolerance).
function sustainedSpending(lasts, guess) {
  let lo = 0;
  let hi = 50000;
  if (guess > 1) {
    // A bracket around the guess, widened by a quarter at a time.
    lo = guess / 1.1;
    hi = guess * 1.1;
    if (lasts(lo)) {
      while (lasts(hi)) {
        lo = hi;
        hi *= 1.25;
        if (hi > 1e9) return hi;
      }
    } else {
      hi = lo;
      lo /= 1.25;
      while (lo >= 1 && !lasts(lo)) {
        hi = lo;
        lo /= 1.25;
      }
      if (lo < 1) lo = 0;
    }
  } else {
    while (lasts(hi)) {
      lo = hi;
      hi *= 2;
      if (hi > 1e9) return hi;
    }
  }
  while (hi - lo > Math.max(1, INCOME_TOLERANCE * lo)) {
    const mid = (lo + hi) / 2;
    if (lasts(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Each path's yearReturn (Monte Carlo's paths: the same seed, so path k is the Monte Carlo page's
// path k), with the options every path runs with.
function setup(household, { from = 0, to = GUARDRAIL_PATHS, volatility = DEFAULT_VOLATILITY, seed = DEFAULT_SEED, returnPaths } = {}) {
  return { options: monteCarloOptions(household), returns: pathReturns({ from, to, volatility, seed, returnPaths }) };
}

// Each path's needed scale of the balances at the start of year start (default today) to sustain the
// spending, paths from to to (exclusive).
export function requiredScales(household, spending, { start = 0, ...paths } = {}) {
  const { options, returns } = setup(household, paths);
  const resume = snapshotAt(household, options, spending, start);
  return returns.map((yearReturn) => requiredScale((scale) => lastsFrom(household, { spending, before: spending, scale, start, options, yearReturn, resume })));
}

// The spending each path sustains from year start with the balances there times scale (the plan's
// spending, before, until then), paths from to to (exclusive).
export function spendingCloud(household, scale, { start = 0, before = 0, ...paths } = {}) {
  const { options, returns } = setup(household, paths);
  const resume = snapshotAt(household, options, before, start);
  return returns.map((yearReturn) => sustainedSpending((spending) => lastsFrom(household, { spending, before, scale, start, options, yearReturn, resume })));
}

// The share of paths that sustain the spending from year start with the balances times scale (a
// direct rerun, for checking a guardrail).
export function chanceAt(household, spending, scale, { start = 0, before = spending, ...paths } = {}) {
  const { options, returns } = setup(household, paths);
  const resume = snapshotAt(household, options, before, start);
  return returns.filter((yearReturn) => lastsFrom(household, { spending, before, scale, start, options, yearReturn, resume })).length / returns.length;
}

// The m-th smallest of values (1-based), m clamped to 1..n.
const mthSmallest = (values, m) => [...values].sort((a, b) => a - b)[Math.min(values.length, Math.max(1, m)) - 1];
// The target spending from a cloud: the m-th largest, m = ⌈target × n⌉ (at least that share sustain it).
export const targetSpending = (cloud, target) => -mthSmallest(cloud.map((w) => -w), Math.ceil(target * cloud.length - 1e-9));
// The cut and raise scales from the needed scales (see the header).
export function guardrailScales(scales, { cut, raise } = DEFAULT_GUARDRAILS) {
  const n = scales.length;
  const m = Math.floor(cut * n + 1e-9);
  return { cut: m >= 1 ? mthSmallest(scales, m) : 0, raise: mthSmallest(scales, Math.ceil(raise * n - 1e-9)) };
}

// Settings from saved values: each a share, target strictly between cut and raise; else the default.
export function guardrailSettings(saved = {}) {
  const pick = (k) => (Number.isFinite(saved[k]) && saved[k] >= 0 && saved[k] <= 1 ? saved[k] : DEFAULT_GUARDRAILS[k]);
  const s = { target: pick('target'), cut: pick('cut'), raise: pick('raise'), minChange: pick('minChange') };
  return s.cut < s.target && s.target < s.raise ? s : { ...DEFAULT_GUARDRAILS, minChange: s.minChange };
}

// A move to new spending from the plan's: its change as a share, and whether it is big enough to make.
function move(spending, to, minChange) {
  const change = spending > 0 ? (to - spending) / spending : null;
  return { spending: to, change, applies: change === null ? to > 0 : Math.abs(change) >= minChange };
}

// The guardrails at one point from the clouds:
//   spending: the plan's (the need); portfolio: the portfolio then (today's, or the plan's at a later
//   year); scales: each path's needed scale at the spending; today / atCut / atRaise: the spending
//   each path sustains there, at the cut value and at the raise value (null until run).
// -> { paths, spending, portfolio, settings, chance, target, now, cut, raise }
//   chance: the share of paths sustaining the spending; target: the target spending (null without
//   today); now: { kind: 'cut' | 'raise', ...the move to the target } when the chance is already past
//   a guardrail; cut / raise: { scale, portfolio, chance (at the value), spending, change, applies }.
export function summarizeGuardrails({ spending, portfolio, scales, today = null, atCut = null, atRaise = null, settings = DEFAULT_GUARDRAILS }) {
  const n = scales.length;
  const chanceAtScale = (k) => scales.filter((s) => s <= k).length / n;
  const chance = chanceAtScale(1);
  const target = today ? targetSpending(today, settings.target) : null;
  const g = guardrailScales(scales, settings);
  const level = (scale, cloud) => ({
    scale,
    portfolio: scale * portfolio,
    chance: chanceAtScale(scale),
    ...(cloud ? move(spending, targetSpending(cloud, settings.target), settings.minChange) : { spending: null, change: null, applies: null }),
  });
  const past = chance <= settings.cut ? 'cut' : chance >= settings.raise ? 'raise' : null;
  return {
    paths: n,
    spending,
    portfolio,
    settings,
    chance,
    target,
    now: past && target !== null ? { kind: past, ...move(spending, target, settings.minChange) } : null,
    cut: level(g.cut, atCut),
    raise: level(g.raise, atRaise),
  };
}

// The whole calculation for one year in one thread (tests and small runs; the page splits it across
// workers): the needed scales and the cloud there, then the clouds at the two guardrails. start: the
// year's index (0 = today; later = the plan's portfolio that year, on its own returns).
export function guardrails(household, spending, { settings = DEFAULT_GUARDRAILS, start = 0, ...paths } = {}) {
  const portfolio = start === 0 ? portfolioTotal(household) : planPortfolios(household, spending)[start];
  const at = { start, before: spending, ...paths };
  const scales = requiredScales(household, spending, at);
  const today = spendingCloud(household, 1, at);
  const g = guardrailScales(scales, settings);
  const cloudAt = (k) => (Number.isFinite(k) ? spendingCloud(household, k, at) : null);
  return summarizeGuardrails({ spending, portfolio, scales, today, atCut: cloudAt(g.cut), atRaise: cloudAt(g.raise), settings });
}

// ---- The rule inside each path (step c) ----
// Each path checks its spending once a year, at the start of each year anyone is retired: the chance
// that this spending lasts from here, with this portfolio; at or past a guardrail it moves to the
// target spending here (if that changes it by at least the minimum). Rerunning the guardrails at
// every year of every path would take millions of projections, so a table stands in for them, built
// once per year along the plan at the target spending (where the paths settle; at a spending the
// plan can't sustain, its portfolio would run dry and leave the late years without a table): for each
// of TABLE_PATHS inner paths (their own seed, apart from the outer ones), the spending it sustains from
// that year at 0.5, 1 and 1.5 times the plan's portfolio then, joined by straight lines (the end
// segments carried on beyond them), at least 0. A path's chance at spending S and portfolio P is the
// share of inner paths with W(P) ≥ S; the target there the m-th largest W(P). Simplifications: the
// inner paths start from the plan's state that year (its account mix, its IRMAA history), and
// sustainable spending is straight between the three points and beyond them.

export const TABLE_PATHS = 50;
export const TABLE_SEED = 2;
export const TABLE_SCALES = [0.5, 1, 1.5];

// The years the rule checks: those with spending from the portfolio (anyone retired), by index t.
export function ruleYears(household, spending) {
  const { legacy: _legacy, ...options } = monteCarloOptions(household);
  return runProjection(household, { ...options, need: spending }).rows.flatMap((r, t) => (r.need > 0 ? [t] : []));
}

// The table for year t along the plan at the spending: { t, portfolio (the plan's then), points:
// [[[P, W] at each scale] per inner path] }; null when the plan's portfolio that year is empty.
export function ruleTableYear(household, spending, t, { to = TABLE_PATHS, volatility = DEFAULT_VOLATILITY, seed = TABLE_SEED, returnPaths } = {}) {
  const portfolio = planPortfolios(household, spending)[t];
  if (!(portfolio > 0)) return null;
  const { options, returns } = setup(household, { to, volatility, seed, returnPaths });
  const resume = snapshotAt(household, options, spending, t);
  const points = returns.map((yearReturn) => {
    const lastsAt = (scale) => (w) => lastsFrom(household, { spending: w, before: spending, scale, start: t, options, yearReturn, resume });
    // At 1 first, from the plan's spending (the median path about sustains it); the others from it.
    const w1 = sustainedSpending(lastsAt(1), spending);
    return TABLE_SCALES.map((k) => [k * portfolio, k === 1 ? w1 : sustainedSpending(lastsAt(k), k * w1)]);
  });
  return { t, portfolio, points };
}

// W at P from one inner path's points (sorted by P): straight between them, the end segments beyond.
function along(points, P) {
  let i = 0;
  while (i < points.length - 2 && P > points[i + 1][0]) i++;
  const [[p1, w1], [p2, w2]] = [points[i], points[i + 1]];
  return Math.max(0, w1 + ((w2 - w1) * (P - p1)) / (p2 - p1));
}

// The chance and the target at spending S and portfolio P from a year's table.
export function tableLookup(table, spending, portfolio, settings = DEFAULT_GUARDRAILS) {
  const w = table.points.map((pts) => along(pts, portfolio));
  return { chance: w.filter((x) => x >= spending).length / w.length, target: targetSpending(w, settings.target) };
}

// The portfolio at which one inner path's W(P) reaches the spending (W rises with P): bisection on
// P, to a dollar; 0 when W(0) already does; Infinity when even 1,024 times the plan's never does.
function portfolioFor(points, spending, portfolio) {
  if (along(points, 0) >= spending) return 0;
  let lo = 0;
  let hi = portfolio;
  while (along(points, hi) < spending) {
    lo = hi;
    hi *= 2;
    if (hi > MAX_SCALE * portfolio) return Infinity;
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (along(points, mid) >= spending) hi = mid;
    else lo = mid;
  }
  return hi;
}

// A year's guardrails from its table, for the spending then: as today's (the order statistics of
// each inner path's needed portfolio), the spending at each the target there. The years after today
// on the page (cheaper than rerunning the guardrails; the same table the rule uses).
// -> { t, portfolio (the plan's then), chance (there), cut, raise: { portfolio, chance, spending, change, applies } }
export function tableGuardrails(table, spending, settings = DEFAULT_GUARDRAILS) {
  const needed = table.points.map((pts) => portfolioFor(pts, spending, table.portfolio));
  const g = guardrailScales(needed, settings);
  const n = needed.length;
  const level = (P) => ({
    portfolio: P,
    chance: needed.filter((x) => x <= P).length / n,
    ...(Number.isFinite(P) ? move(spending, tableLookup(table, spending, P, settings).target, settings.minChange) : { spending: null, change: null, applies: null }),
  });
  return { t: table.t, portfolio: table.portfolio, chance: needed.filter((x) => x <= table.portfolio).length / n, cut: level(g.cut), raise: level(g.raise) };
}

// One path under the rule: the projection with its spending set each year by the tables.
// -> { success, spending: [by year t], changes: [{ t, age, from, to, kind }], cuts, raises,
//      largestCut (the deepest single cut, as a share), lowest (the lowest spending in a rule year) }
export function rulePath(household, spending, tables, yearReturn, settings = DEFAULT_GUARDRAILS) {
  const { legacy, ...options } = monteCarloOptions(household);
  const byYear = new Map(tables.filter(Boolean).map((x) => [x.t, x]));
  let current = spending;
  const changes = [];
  const needIn = (t, portfolio) => {
    const table = byYear.get(t);
    if (table && portfolio > 0) {
      const { chance, target } = tableLookup(table, current, portfolio, settings);
      if (chance <= settings.cut || chance >= settings.raise) {
        const big = current > 0 ? Math.abs(target - current) / current >= settings.minChange : target > 0;
        if (big) {
          changes.push({ t, from: current, to: target, kind: target < current ? 'cut' : 'raise' });
          current = target;
        }
      }
    }
    return current;
  };
  const { rows } = runProjection(household, { ...options, needIn, yearReturn });
  const legacyMet = !(legacy?.target > 0) || legacyValue(rows[rows.length - 1].endBalances, legacy) >= legacy.target;
  const ruled = rows.filter((r) => r.need > 0);
  const cutsOnly = changes.filter((c) => c.kind === 'cut');
  return {
    success: rows.every((r) => r.shortfall === 0) && legacyMet,
    spending: rows.map((r) => r.detail.spending.baseNeed),
    changes: changes.map((c) => ({ ...c, age: rows[c.t].ages[0] })),
    cuts: cutsOnly.length,
    raises: changes.length - cutsOnly.length,
    largestCut: cutsOnly.reduce((m, c) => Math.max(m, (c.from - c.to) / c.from), 0),
    lowest: ruled.length ? Math.min(...ruled.map((r) => r.detail.spending.baseNeed)) : spending,
  };
}

// The outer paths under the rule, paths from to to (exclusive), on Monte Carlo's paths.
export function rulePaths(household, spending, tables, { from = 0, to = GUARDRAIL_PATHS, volatility = DEFAULT_VOLATILITY, seed = DEFAULT_SEED, returnPaths, settings = DEFAULT_GUARDRAILS } = {}) {
  return pathReturns({ from, to, volatility, seed, returnPaths }).map((yearReturn) => rulePath(household, spending, tables, yearReturn, settings));
}

// The rule's figures across the paths: spending's percentiles each rule year (person 1's age), the
// share of paths with a cut and with a raise, the cuts per path, the deepest cut on the paths that
// cut, each path's lowest spending, and the share that still succeed.
export function summarizeRule(outcomes, ages, years) {
  const n = outcomes.length;
  const sorted = (xs) => [...xs].sort((a, b) => a - b);
  const pick = (xs) => {
    const s = sorted(xs);
    return { p10: percentile(s, 0.1), p25: percentile(s, 0.25), p50: percentile(s, 0.5), p75: percentile(s, 0.75), p90: percentile(s, 0.9) };
  };
  const cutPaths = outcomes.filter((o) => o.cuts > 0);
  return {
    paths: n,
    chance: n ? outcomes.filter((o) => o.success).length / n : null,
    fan: years.map((t) => ({ t, age: ages[t], ...pick(outcomes.map((o) => o.spending[t])) })),
    withCut: n ? cutPaths.length / n : null,
    withRaise: n ? outcomes.filter((o) => o.raises > 0).length / n : null,
    cuts: pick(outcomes.map((o) => o.cuts)),
    largestCut: cutPaths.length ? pick(cutPaths.map((o) => o.largestCut)) : null,
    lowest: pick(outcomes.map((o) => o.lowest)),
  };
}
