// Monte Carlo (round 2 phase 8): random return paths for the projection. Pure. Decided with Michael
// 2026-10-16: the plan's two return inputs are the long-run compound growth (the median path), the
// volatility is the yearly swing of returns (the S&P 500's, about 20%, to start), 1,000 paths, and a
// seed so the same inputs always give the same answer.
//
// Each year's return is lognormal: 1 + R = (1 + g) × e^(σ z), z standard normal, g the plan's return
// for that year (before or after retirement). Its median is 1 + g, so with no volatility (σ = 0) every
// path is the projection. σ is set so the yearly returns' standard deviation is the volatility s:
// with x = e^(σ²), the mean of 1 + R is (1 + g)√x and its variance (1 + g)² x (x − 1) = s², so
// x = (1 + √(1 + 4 s² / (1 + g)²)) / 2.

import { runProjection } from './projection.js';
import { legacyOption, legacyValue, sustainableSpending } from './projectionSummary.js';
import { strategyById } from './strategies.js';

export const DEFAULT_VOLATILITY = 0.2;
export const DEFAULT_PATHS = 1000;
export const INCOME_PATHS = 200; // the paths the spending search runs on (decided 2026-10-16)
export const DEFAULT_SEED = 1;
export const INCOME_TOLERANCE = 0.005; // each path's spending search stops within half a percent
const MAX_YEARS = 120; // draws per path: more than any plan's years

// mulberry32: a small seeded generator, uniform on [0, 1). The same seed gives the same sequence.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal draws from a uniform generator (Box-Muller, both values of each pair used).
export function normalDraws(random, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = 1 - random(); // (0, 1]: no log of 0
    const v = random();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return out;
}

// σ of the log return for a compound growth g and a yearly standard deviation s (see the header).
export function logSigma(g, s) {
  if (!(s > 0)) return 0;
  const x = (1 + Math.sqrt(1 + (4 * s * s) / ((1 + g) * (1 + g)))) / 2;
  return Math.sqrt(Math.log(x));
}

// The yearly draws for every path: paths × years standard normals from the seed, path by path (so
// path k is the same whatever the number of paths after it).
export function returnShocks({ seed = 1, paths, years }) {
  const random = seededRandom(seed);
  return Array.from({ length: paths }, () => normalDraws(random, years));
}

// The projection's yearReturn for one path: the plan's return for the year, moved by that year's draw.
export function pathReturn(shocks, volatility) {
  const sigmas = new Map();
  const sigmaOf = (g) => {
    if (!sigmas.has(g)) sigmas.set(g, logSigma(g, volatility));
    return sigmas.get(g);
  };
  // No volatility: the plan's return itself ((1 + g) × 1 − 1 can differ from g in the last digit).
  return (rate, t) => {
    const shift = sigmaOf(rate) * (shocks[t] ?? 0);
    return shift === 0 ? rate : (1 + rate) * Math.exp(shift) - 1;
  };
}

// The options every path runs with, as the projection page: its end age and withdrawal strategy,
// and the legacy goal (if any) for success and the spending search.
export function monteCarloOptions(household) {
  const own = household.calculators?.projection ?? {};
  return { endAge: own.endAge, strategy: strategyById(own.strategy), legacy: legacyOption(household) };
}

// One path at the spending need: success (no shortfall in any year and the legacy goal, if any, left,
// as meetsPlan), the total portfolio at the end of each year, and person 1's age in the first year
// short of the need (null when none).
// -> { success, balances, endTotal, runOutAge, years, ages }
export function pathOutcome(household, need, { legacy, ...options }, yearReturn) {
  const { rows } = runProjection(household, { ...options, need, yearReturn });
  const short = rows.find((r) => r.shortfall > 0);
  const last = rows[rows.length - 1];
  const legacyMet = !(legacy?.target > 0) || legacyValue(last.endBalances, legacy) >= legacy.target;
  return {
    success: !short && legacyMet,
    balances: rows.map((r) => r.endBalances.total),
    endTotal: last.endBalances.total,
    runOutAge: short ? short.ages[0] : null,
    years: rows.map((r) => r.year),
    ages: rows.map((r) => r.ages[0]),
  };
}

// Each path's yearReturn, paths from to to (exclusive): from the seed and the volatility, or, with
// returnPaths (tests), each path's returns year by year as given.
export function pathReturns({ from, to, volatility, seed, returnPaths }) {
  if (returnPaths) return returnPaths.slice(from, to).map((path) => (_, t) => path[t]);
  const shocks = returnShocks({ seed, paths: to, years: MAX_YEARS });
  return shocks.slice(from, to).map((z) => pathReturn(z, volatility));
}

// Paths from to to (exclusive) at the spending need, in chunks so a worker can report progress.
export function simulatePaths(household, need, { from = 0, to = DEFAULT_PATHS, volatility = DEFAULT_VOLATILITY, seed = DEFAULT_SEED, returnPaths } = {}) {
  const options = monteCarloOptions(household);
  return pathReturns({ from, to, volatility, seed, returnPaths }).map((yearReturn) => pathOutcome(household, need, options, yearReturn));
}

// The spending each path sustains (sustainableSpending on that path's returns: no shortfall, the
// legacy goal left), paths from to to (exclusive), each within INCOME_TOLERANCE below the answer.
export function sustainableOnPaths(household, { from = 0, to = INCOME_PATHS, volatility = DEFAULT_VOLATILITY, seed = DEFAULT_SEED, returnPaths } = {}) {
  const options = monteCarloOptions(household);
  return pathReturns({ from, to, volatility, seed, returnPaths }).map((yearReturn) => sustainableSpending(household, { ...options, yearReturn, tolerance: INCOME_TOLERANCE }));
}

// The p-th percentile (0 to 1) of sorted values, linear between neighbors: position (n − 1) × p.
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

const BANDS = [0.1, 0.25, 0.5, 0.75, 0.9];
const bands = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const [p10, p25, p50, p75, p90] = BANDS.map((p) => percentile(sorted, p));
  return { p10, p25, p50, p75, p90, sorted };
};
// The percentiles with the sorted values (for the distribution charts).
const spread = (values) => {
  const { sorted, ...b } = bands(values);
  return { values: sorted, ...b };
};
const bandsOnly = (values) => {
  const { sorted, ...b } = bands(values);
  return b;
};

// The page's figures from the paths' outcomes (and the spending each of the first paths sustains):
//   chance: the share of paths that succeed; fan: the portfolio's percentiles each year (person 1's
//   age); end: the portfolio at the end; runOut: person 1's age when the failing paths first fall
//   short; income: the spending the paths sustain (its median succeeds in half of them).
export function summarizeMonteCarlo(outcomes, incomes = []) {
  const n = outcomes.length;
  const { years = [], ages = [] } = outcomes[0] ?? {};
  const fan = years.map((year, t) => ({ year, age: ages[t], ...bandsOnly(outcomes.map((o) => o.balances[t])) }));
  const runOutAges = outcomes.filter((o) => o.runOutAge !== null).map((o) => o.runOutAge);
  return {
    paths: n,
    successes: outcomes.filter((o) => o.success).length,
    chance: n ? outcomes.filter((o) => o.success).length / n : null,
    fan,
    end: spread(outcomes.map((o) => o.endTotal)),
    runOut: { count: runOutAges.length, ...spread(runOutAges) },
    income: incomes.length ? spread(incomes) : null,
  };
}

// Each path's portfolio at the end of year t (person 1's age = the fan's age at t).
export const balancesAt = (outcomes, t) => outcomes.map((o) => o.balances[t]);

// Bins for a distribution chart: equal widths from the smallest value to the clip percentile (a few
// very large paths would otherwise squash the rest into one bar), the last bin open, holding
// everything above; or, with width, bins of that width from the smallest value rounded down to it
// (ages: width 1), none open.
// -> [{ from, to, count, open }]
export function histogram(values, { bins = 20, clip = 0.98, width } = {}) {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  if (width) {
    const lo = Math.floor(min / width) * width;
    const n = Math.floor((sorted.at(-1) - lo) / width) + 1;
    const out = Array.from({ length: n }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0, open: false }));
    for (const v of sorted) out[Math.min(n - 1, Math.floor((v - lo) / width))].count += 1;
    return out;
  }
  const hi = percentile(sorted, clip);
  if (!(hi > min)) return [{ from: min, to: sorted.at(-1), count: sorted.length, open: false }];
  const w = (hi - min) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({ from: min + i * w, to: min + (i + 1) * w, count: 0, open: false }));
  for (const v of sorted) out[Math.min(bins - 1, Math.floor((v - min) / w))].count += 1;
  out[bins - 1].open = sorted.at(-1) > hi;
  return out;
}
