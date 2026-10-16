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

import { pathReturns, DEFAULT_SEED, DEFAULT_VOLATILITY, INCOME_TOLERANCE, monteCarloOptions } from './monteCarlo.js';
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

// Whether one path lasts from year start: the plan's spending (before) until then, spending from
// then, the balances times scale at its start, the path's returns from its start.
function lastsFrom(household, { spending, before, scale, start, options, yearReturn }) {
  const { legacy, ...rest } = options;
  const { rows } = runProjection(household, {
    ...rest,
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
// finer than $1. 0 when not even none lasts.
function sustainedSpending(lasts) {
  let lo = 0;
  let hi = 50000;
  while (lasts(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 1e9) return hi;
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
  return returns.map((yearReturn) => requiredScale((scale) => lastsFrom(household, { spending, before: spending, scale, start, options, yearReturn })));
}

// The spending each path sustains from year start with the balances there times scale (the plan's
// spending, before, until then), paths from to to (exclusive).
export function spendingCloud(household, scale, { start = 0, before = 0, ...paths } = {}) {
  const { options, returns } = setup(household, paths);
  return returns.map((yearReturn) => sustainedSpending((spending) => lastsFrom(household, { spending, before, scale, start, options, yearReturn })));
}

// The share of paths that sustain the spending from year start with the balances times scale (a
// direct rerun, for checking a guardrail).
export function chanceAt(household, spending, scale, { start = 0, before = spending, ...paths } = {}) {
  const { options, returns } = setup(household, paths);
  return returns.filter((yearReturn) => lastsFrom(household, { spending, before, scale, start, options, yearReturn })).length / returns.length;
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
