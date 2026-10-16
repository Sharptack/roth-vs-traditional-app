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
//   - the portfolio each path needs to sustain the plan's spending: today's balances, every account
//     scaled by one factor, searched path by path. The chance at a portfolio value is the share of
//     paths needing no more. The cut value is the m-th smallest, m = ⌊cut × n⌋ (the chance there is
//     m / n, at most the cut level); the raise value the m-th smallest, m = ⌈raise × n⌉ (at least the
//     raise level).
// At a guardrail, spending moves to the target spending at that portfolio value (a third cloud).

import { pathOutcome, pathReturns, DEFAULT_SEED, DEFAULT_VOLATILITY, INCOME_TOLERANCE, monteCarloOptions } from './monteCarlo.js';
import { sustainableSpending } from './projectionSummary.js';

export const DEFAULT_GUARDRAILS = { target: 0.8, cut: 0.5, raise: 0.95, minChange: 0.05 };
export const GUARDRAIL_PATHS = 200;
export const SCALE_TOLERANCE = 0.005; // each path's portfolio search stops within half a percent
const MAX_SCALE = 1024; // a path that needs more than 1,024 times today's portfolio: never (Infinity)

// Today's portfolio: every Existing Account.
export const portfolioTotal = (household) => household.accounts.reduce((s, a) => s + (a.balance || 0), 0);

// The household with every account's balance times scale (a taxable account's basis follows its
// basis share). The legacy goal is not rescaled: callers take it from the household as it is.
export function scaledHousehold(household, scale) {
  return { ...household, accounts: household.accounts.map((a) => ({ ...a, balance: (a.balance || 0) * scale })) };
}

// The smallest scale of today's balances at which one path sustains the spending (no shortfall, the
// legacy goal left), within SCALE_TOLERANCE above; 0 when it lasts with nothing; Infinity when it
// never does. Bisection: more money can only last as long and leave as much.
function requiredScale(household, spending, options, yearReturn) {
  const lasts = (k) => pathOutcome(scaledHousehold(household, k), spending, options, yearReturn).success;
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

// Each path's needed scale of today's balances at the spending, paths from to to (exclusive), on
// Monte Carlo's paths (the same seed: path k is the Monte Carlo page's path k).
export function requiredScales(household, spending, { from = 0, to = GUARDRAIL_PATHS, volatility = DEFAULT_VOLATILITY, seed = DEFAULT_SEED, returnPaths } = {}) {
  const options = monteCarloOptions(household);
  return pathReturns({ from, to, volatility, seed, returnPaths }).map((yearReturn) => requiredScale(household, spending, options, yearReturn));
}

// The spending each path sustains with today's balances times scale, paths from to to (exclusive),
// each within INCOME_TOLERANCE below the answer (the legacy goal from the household unscaled).
export function spendingCloud(household, scale, { from = 0, to = GUARDRAIL_PATHS, volatility = DEFAULT_VOLATILITY, seed = DEFAULT_SEED, returnPaths } = {}) {
  const options = monteCarloOptions(household);
  const scaled = scaledHousehold(household, scale);
  return pathReturns({ from, to, volatility, seed, returnPaths }).map((yearReturn) => sustainableSpending(scaled, { ...options, yearReturn, tolerance: INCOME_TOLERANCE }));
}

// The share of paths that sustain the spending with today's balances times scale (a direct rerun,
// for checking a guardrail).
export function chanceAt(household, spending, scale, { from = 0, to = GUARDRAIL_PATHS, volatility = DEFAULT_VOLATILITY, seed = DEFAULT_SEED, returnPaths } = {}) {
  const options = monteCarloOptions(household);
  const scaled = scaledHousehold(household, scale);
  const ok = pathReturns({ from, to, volatility, seed, returnPaths }).filter((yearReturn) => pathOutcome(scaled, spending, options, yearReturn).success);
  return ok.length / (to - from);
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

// Today's guardrails from the clouds:
//   spending: the plan's (the need); portfolio: today's; scales: each path's needed scale at the
//   spending; today / atCut / atRaise: the spending each path sustains today, at the cut value and at
//   the raise value (null until run).
// -> { paths, spending, portfolio, chance, target, now, cut, raise }
//   chance: the share of paths sustaining the spending today; target: the target spending today;
//   now: 'cut' | 'raise' | null, today's chance already past a guardrail, with the move to the target;
//   cut / raise: { portfolio, scale, chance (at the value), spending, change, applies }.
export function summarizeGuardrails({ spending, portfolio, scales, today, atCut = null, atRaise = null, settings = DEFAULT_GUARDRAILS }) {
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

// The whole calculation in one thread (tests and small runs; the page splits it across workers):
// the needed scales and today's cloud, then the clouds at the two guardrails.
export function guardrails(household, spending, { settings = DEFAULT_GUARDRAILS, ...paths } = {}) {
  const portfolio = portfolioTotal(household);
  const scales = requiredScales(household, spending, paths);
  const today = spendingCloud(household, 1, paths);
  const g = guardrailScales(scales, settings);
  const cloudAt = (k) => (Number.isFinite(k) ? spendingCloud(household, k, paths) : null);
  return summarizeGuardrails({ spending, portfolio, scales, today, atCut: cloudAt(g.cut), atRaise: cloudAt(g.raise), settings });
}
