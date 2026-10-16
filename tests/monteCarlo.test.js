import { describe, it, expect } from 'vitest';
import { logSigma, normalDraws, pathReturn, returnShocks, seededRandom } from '../src/lib/monteCarlo.js';
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
