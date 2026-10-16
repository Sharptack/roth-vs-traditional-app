import { describe, it, expect } from 'vitest';
import { histogram, logSigma, normalDraws, pathReturn, percentile, returnShocks, seededRandom, simulatePaths, summarizeMonteCarlo, sustainableOnPaths } from '../src/lib/monteCarlo.js';
import { meetsPlan } from '../src/lib/projectionSummary.js';
import { runProjection } from '../src/lib/projection.js';
import { PREVIEW_DEFAULT_VALUES, toHousehold } from '../src/lib/household.js';

// Phase 8 step a (decided 2026-10-16): the projection takes a return for each year, and the random
// paths are lognormal around the plan's return (its median), seeded.

// A one-person retired household with only a Roth account (no tax, no RMD), as in projection.test.js.
const Y = 2026;
const rothOnly = (balance) => ({
  version: 1,
  year: Y,
  filingStatus: 'single',
  people: [{ id: 'p1', birthYear: Y - 70, retirementAge: 69, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
  accounts: [{ id: 'a1', owner: 'p1', type: 'roth', balance }],
  futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
  spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
  calculators: {},
  assumptions: { returnRate: 0.05, inflationRate: 0, ageDeductions: false },
});

describe('runProjection with a return for each year', () => {
  // HAND CALC: 100,000 in Roth, nothing spent: +10% → 110,000; −20% → 88,000; +5% → 92,400.
  it('a hand-made three-year path: 110,000, 88,000, 92,400', () => {
    const path = [0.1, -0.2, 0.05];
    const { rows } = runProjection(rothOnly(100000), { need: 0, endAge: 72, yearReturn: (_, t) => path[t] });
    expect(rows.map((r) => r.endBalances.roth)).toEqual([expect.closeTo(110000, 6), expect.closeTo(88000, 6), expect.closeTo(92400, 6)]);
  });
  it('the plan’s return passed through: today’s results exactly (the default household)', () => {
    const h = toHousehold(PREVIEW_DEFAULT_VALUES, Y);
    expect(runProjection(h, { need: 60000, yearReturn: (rate) => rate })).toEqual(runProjection(h, { need: 60000 }));
  });
  it('no volatility: every path is the projection exactly', () => {
    const h = toHousehold(PREVIEW_DEFAULT_VALUES, Y);
    const [shocks] = returnShocks({ seed: 7, paths: 1, years: 80 });
    expect(runProjection(h, { need: 60000, yearReturn: pathReturn(shocks, 0) })).toEqual(runProjection(h, { need: 60000 }));
  });
});

describe('the random draws', () => {
  it('a seed repeats exactly; another seed differs; uniform on [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    expect(seededRandom(43)()).not.toBe(xs[0]);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('a path is the same whatever the number of paths', () => {
    expect(returnShocks({ seed: 3, paths: 5, years: 30 })[2]).toEqual(returnShocks({ seed: 3, paths: 2000, years: 30 })[2]);
  });
  it('normal draws: mean 0 and standard deviation 1 (within sampling error over 200,000)', () => {
    const z = normalDraws(seededRandom(1), 200000);
    const mean = z.reduce((s, x) => s + x, 0) / z.length;
    const sd = Math.sqrt(z.reduce((s, x) => s + (x - mean) ** 2, 0) / z.length);
    expect(Math.abs(mean)).toBeLessThan(0.01); // standard error 1/√200,000 = 0.0022
    expect(Math.abs(sd - 1)).toBeLessThan(0.01);
  });
});

describe('logSigma and a year’s return (HAND CALC)', () => {
  // g = 7%, s = 20%: s/(1+g) = 0.1869159, squared 0.0349376, ×4 = 0.1397503; √1.1397503 = 1.0675909;
  // x = (1 + 1.0675909)/2 = 1.0337955; σ² = ln 1.0337955 = y − y²/2 + y³/3 − y⁴/4 (y = 0.0337955)
  // = 0.0337955 − 0.0005711 + 0.0000129 − 0.0000003 = 0.0332369; σ = 0.182310.
  // Check: the mean of 1 + R = 1.07 × √x = 1.07 × 1.016757 = 1.087930 (an 8.79% average year);
  // variance 1.087930² × 0.0337955 = 1.183592 × 0.0337955 = 0.040000 = 20%².
  it('g 7%, volatility 20%: σ = 0.182310', () => {
    expect(logSigma(0.07, 0.2)).toBeCloseTo(0.18231, 5);
    expect(logSigma(0.07, 0)).toBe(0);
  });
  // z = 1: 1.07 × e^0.18231 = 1.07 × 1.199986 = 1.283985 → 28.399%. z = 0: 7% (the median).
  it('a draw of one standard deviation: 28.399%; a draw of 0: the plan’s 7%', () => {
    const r = pathReturn([1, 0], 0.2);
    expect(r(0.07, 0)).toBeCloseTo(0.283986, 5);
    expect(r(0.07, 1)).toBe(0.07);
  });
  it('the drawn returns: median the plan’s 7%, average 8.79%, spread 20% (within sampling error)', () => {
    const shocks = returnShocks({ seed: 11, paths: 1000, years: 100 }).flat();
    const r = pathReturn(shocks, 0.2);
    const R = shocks.map((_, t) => r(0.07, t));
    const mean = R.reduce((s, x) => s + x, 0) / R.length;
    const sd = Math.sqrt(R.reduce((s, x) => s + (x - mean) ** 2, 0) / R.length);
    const median = [...R].sort((a, b) => a - b)[R.length / 2];
    expect(mean).toBeCloseTo(0.08793, 2); // standard error 0.2/√100,000 = 0.0006
    expect(sd).toBeCloseTo(0.2, 2);
    expect(median).toBeCloseTo(0.07, 2);
  });
});

// Phase 8 step b: the simulation.
describe('percentile', () => {
  // [1..5]: the 10th at position 4 × 0.1 = 0.4 → 1 + 0.4 × (2 − 1) = 1.4; the median 3; the 90th 4.6.
  it('linear between neighbors: 1.4, 3, 4.6', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.1)).toBeCloseTo(1.4, 10);
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0.9)).toBeCloseTo(4.6, 10);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe('simulatePaths and summarizeMonteCarlo (HAND CALC, three given paths)', () => {
  // 100,000 in Roth at 70, three years (to 72), $40,000 a year spent (no tax on Roth); each year the
  // withdrawal comes out, then the return:
  //   A, 10% a year: (100,000 − 40,000) × 1.1 = 66,000; (66,000 − 40,000) × 1.1 = 28,600; year 3
  //     has 28,600 for a 40,000 need: short 11,400 at 72, ends at 0. Fails.
  //   B, 50% a year: 60,000 × 1.5 = 90,000; 50,000 × 1.5 = 75,000; 35,000 × 1.5 = 52,500. Succeeds.
  //   C, 0%: 60,000; 20,000; short 20,000 at 72, ends at 0. Fails.
  // Chance 1/3. Year 1 sorted 60,000, 66,000, 90,000: the 10th = 60,000 + 0.2 × 6,000 = 61,200, the
  // median 66,000, the 90th = 66,000 + 0.8 × 24,000 = 85,200. End: 0, 0, 52,500 (median 0).
  const returnPaths = [[0.1, 0.1, 0.1], [0.5, 0.5, 0.5], [0, 0, 0]];
  const h = { ...rothOnly(100000), calculators: { projection: { endAge: 72 } } };
  const outcomes = simulatePaths(h, 40000, { to: 3, returnPaths });
  const m = summarizeMonteCarlo(outcomes);
  it('each path: success, balances, the age it falls short', () => {
    expect(outcomes.map((o) => o.success)).toEqual([false, true, false]);
    expect(outcomes[0].balances).toEqual([expect.closeTo(66000, 6), expect.closeTo(28600, 6), 0]);
    expect(outcomes[1].balances).toEqual([expect.closeTo(90000, 6), expect.closeTo(75000, 6), expect.closeTo(52500, 6)]);
    expect(outcomes.map((o) => o.runOutAge)).toEqual([72, null, 72]);
  });
  it('the summary: a 1-in-3 chance, the fan, the end, when the failures run out', () => {
    expect(m.chance).toBeCloseTo(1 / 3, 10);
    expect(m.fan[0]).toMatchObject({ year: 2026, age: 70, p10: expect.closeTo(61200, 6), p50: expect.closeTo(66000, 6), p90: expect.closeTo(85200, 6) });
    expect(m.end.values).toEqual([0, 0, expect.closeTo(52500, 6)]);
    expect(m.end.p50).toBe(0);
    expect(m.runOut).toMatchObject({ count: 2, p50: 72 });
    expect(m.income).toBeNull();
  });
  // The spending each path sustains, W:
  //   A: ((100,000 − W) × 1.1 − W) × 1.1 = W → 121,000 = 3.31 W → W = 36,555.89
  //   B: ((100,000 − W) × 1.5 − W) × 1.5 = W → 225,000 = 4.75 W → W = 47,368.42
  //   C: 100,000 = 3 W → 33,333.33. The search stops within half a percent below each.
  it('the spending each path sustains: 36,555.89, 47,368.42, 33,333.33 (within half a percent below)', () => {
    const w = sustainableOnPaths(h, { to: 3, returnPaths });
    [36555.89, 47368.42, 33333.33].forEach((x, i) => {
      expect(w[i]).toBeLessThanOrEqual(x);
      expect(w[i]).toBeGreaterThan(x * 0.995);
    });
    expect(summarizeMonteCarlo(outcomes, w).income.p50).toBe(w[0]);
  });
});

describe('the simulation with no volatility (the default household)', () => {
  const h = toHousehold(PREVIEW_DEFAULT_VALUES, Y);
  const need = 60000;
  const plan = runProjection(h, { need }).rows;
  const m = summarizeMonteCarlo(simulatePaths(h, need, { to: 5, volatility: 0 }));
  it('every path is the projection: the fan collapses onto it, the chance is the plan’s 0 or 1', () => {
    expect(m.chance).toBe(meetsPlan(h, need) ? 1 : 0);
    m.fan.forEach((f, t) => {
      expect(f.p10).toBe(plan[t].endBalances.total);
      expect(f.p90).toBe(plan[t].endBalances.total);
    });
  });
  it('a seed repeats exactly; chunks join to the whole', () => {
    const all = simulatePaths(h, need, { to: 6, seed: 5 });
    expect(simulatePaths(h, need, { to: 6, seed: 5 })).toEqual(all);
    expect([...simulatePaths(h, need, { from: 0, to: 3, seed: 5 }), ...simulatePaths(h, need, { from: 3, to: 6, seed: 5 })]).toEqual(all);
  });
});

describe('histogram (HAND CALC)', () => {
  // 0..8 and 100, 4 bins to the 90th percentile: position 9 × 0.9 = 8.1 → 8 + 0.1 × 92 = 17.2;
  // width 4.3: [0, 4.3) holds 0-4 (5), [4.3, 8.6) 5-8 (4), [8.6, 12.9) none, the last, open, 100.
  it('equal bins to the clip percentile, the last open', () => {
    const h = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 100], { bins: 4, clip: 0.9 });
    expect(h.map((b) => b.count)).toEqual([5, 4, 0, 1]);
    expect(h[1].from).toBeCloseTo(4.3, 10);
    expect(h.map((b) => b.open)).toEqual([false, false, false, true]);
  });
  // Ages 72, 72, 74.5, 75 at width 1: from 72, bins 72, 73, 74, 75 holding 2, 0, 1, 1.
  it('a fixed width (ages)', () => {
    const h = histogram([72, 75, 72, 74.5], { width: 1 });
    expect(h.map((b) => [b.from, b.count])).toEqual([[72, 2], [73, 0], [74, 1], [75, 1]]);
  });
  it('every value the same: one bin; none: no bins', () => {
    expect(histogram([5, 5, 5])).toEqual([{ from: 5, to: 5, count: 3, open: false }]);
    expect(histogram([])).toEqual([]);
  });
});
