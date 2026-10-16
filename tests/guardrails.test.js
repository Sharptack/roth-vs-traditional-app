import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GUARDRAILS,
  chanceAt,
  guardrailScales,
  guardrailSettings,
  guardrails,
  portfolioTotal,
  planPortfolios,
  requiredScales,
  spendingCloud,
  summarizeGuardrails,
  targetSpending,
} from '../src/lib/guardrails.js';
import { runProjection } from '../src/lib/projection.js';
import { PREVIEW_DEFAULT_VALUES, toHousehold } from '../src/lib/household.js';

// Phase 9 step a (decided 2026-10-16): risk-based guardrails; target 80%, cut at 50%, raise at 95%,
// back to the target, changes under 5% skipped.

const Y = 2026;
// A one-person retired household with only a Roth account (no tax, no RMD), as in monteCarlo.test.js.
const rothOnly = (balance, endAge = 72) => ({
  version: 1,
  year: Y,
  filingStatus: 'single',
  people: [{ id: 'p1', birthYear: Y - 70, retirementAge: 69, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
  accounts: [{ id: 'a1', owner: 'p1', type: 'roth', balance }],
  futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
  spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
  calculators: { projection: { endAge } },
  assumptions: { returnRate: 0.05, inflationRate: 0, ageDeductions: false },
});

describe('the order statistics (HAND CALC)', () => {
  // [10, 20, 30, 40, 50] at 80%: m = ⌈4⌉ = 4, the 4th largest = 20 (4 of 5 sustain it).
  it('target spending: the m-th largest, m = ⌈target × n⌉', () => {
    expect(targetSpending([30, 10, 50, 20, 40], 0.8)).toBe(20);
    expect(targetSpending([30, 10, 50, 20, 40], 1)).toBe(10);
  });
  // Scales [5, 1, 4, 2, 3]: cut at 50%: m = ⌊2.5⌋ = 2 → 2; raise at 95%: m = ⌈4.75⌉ = 5 → 5.
  // 200 paths: cut m = 100, raise m = 190.
  it('cut: the ⌊cut × n⌋-th smallest; raise: the ⌈raise × n⌉-th', () => {
    expect(guardrailScales([5, 1, 4, 2, 3])).toEqual({ cut: 2, raise: 5 });
    const scales = Array.from({ length: 200 }, (_, i) => 200 - i);
    expect(guardrailScales(scales)).toEqual({ cut: 100, raise: 190 });
    expect(guardrailScales([3, 1], { cut: 0.4, raise: 0.95 })).toEqual({ cut: 0, raise: 3 }); // ⌊0.8⌋ = 0: none
  });
  it('settings: shares, the target between the guardrails, else the defaults', () => {
    expect(guardrailSettings()).toEqual(DEFAULT_GUARDRAILS);
    expect(guardrailSettings({ target: 0.7, cut: 0.25, raise: 0.99, minChange: 0 })).toEqual({ target: 0.7, cut: 0.25, raise: 0.99, minChange: 0 });
    expect(guardrailSettings({ target: 0.5, cut: 0.6 })).toEqual(DEFAULT_GUARDRAILS);
    expect(guardrailSettings({ raise: 2 })).toEqual(DEFAULT_GUARDRAILS);
  });
});

describe('the projection: spending by year and the balances rescaled (phase 9 step b)', () => {
  const h = toHousehold(PREVIEW_DEFAULT_VALUES, Y);
  it('the same need every year, and a rescale by 1: today’s results exactly', () => {
    const plain = runProjection(h, { need: 60000 });
    expect(runProjection(h, { needIn: () => 60000 })).toEqual(plain);
    expect(runProjection(h, { need: 60000, rescale: { t: 3, scale: 1 } })).toEqual(plain);
  });
  // HAND CALC: $100,000 Roth at 5%, $20,000 a year: year 0 (100,000 − 20,000) × 1.05 = 84,000; doubled
  // at the start of year 1: 168,000 → (168,000 − 20,000) × 1.05 = 155,400. Spending 30,000 in year 1
  // instead (no rescale): (84,000 − 30,000) × 1.05 = 56,700.
  it('a rescale at the start of a year, and a different need that year', () => {
    const rows = runProjection(rothOnly(100000), { need: 20000, endAge: 71, rescale: { t: 1, scale: 2 } }).rows;
    expect(rows.map((r) => r.endBalances.total)).toEqual([expect.closeTo(84000, 6), expect.closeTo(155400, 6)]);
    expect(rows[1].startBalances.total).toBeCloseTo(168000, 6);
    const other = runProjection(rothOnly(100000), { needIn: (t) => (t === 1 ? 30000 : 20000), endAge: 71 }).rows;
    expect(other[1].endBalances.total).toBeCloseTo(56700, 6);
    expect(other[1].detail.spending.baseNeed).toBe(30000);
  });
});

describe('four hand-made paths (HAND CALC)', () => {
  // $100,000 Roth, 70 to 72, no tax; the withdrawal comes out, then the return. A path at a constant
  // return r sustains W = 100,000 × g² / (g² + g + 1), g = 1 + r, and W is proportional to the portfolio:
  //   A 10%: 121,000 / 3.31 = 36,555.89      B 50%: 225,000 / 4.75 = 47,368.42
  //   C 0%: 100,000 / 3 = 33,333.33           D 20%: 144,000 / 3.64 = 39,560.44
  // At a $40,000 need each path's needed scale is 40,000 / W:
  //   A 132,400 / 121,000 = 1.094215   B 190,000 / 225,000 = 0.844444   C 1.2   D 145,600 / 144,000 = 1.011111
  // Today (scale 1) only B lasts: chance 1/4 ≤ 50%, so cut now, to the target: ⌈0.8 × 4⌉ = 4th largest
  // of today's cloud = C's 33,333.33 (−16.7%).
  // Cut: ⌊0.5 × 4⌋ = 2nd smallest scale = D's 1.011111 → $101,111.11, chance 2/4; spending there:
  //   C's W times the scale = 33,333.33 × 1.011111 = 33,703.70 (−15.7%).
  // Raise: ⌈0.95 × 4⌉ = 4th = C's 1.2 → $120,000, chance 4/4; spending there 33,333.33 × 1.2 = 40,000:
  //   no change (0% < 5%).
  // Each search stops within half a percent: scales at most 0.5% above, spending at most 0.5% below.
  const returnPaths = [[0.1, 0.1, 0.1], [0.5, 0.5, 0.5], [0, 0, 0], [0.2, 0.2, 0.2]];
  const h = rothOnly(100000);
  const opts = { to: 4, returnPaths };
  const within = (got, want, above) => {
    if (above) expect(got).toBeGreaterThanOrEqual(want * (1 - 1e-9));
    else expect(got).toBeLessThanOrEqual(want * (1 + 1e-9));
    expect(Math.abs(got / want - 1)).toBeLessThan(0.006);
  };
  it('each path’s needed scale: 1.0942, 0.8444, 1.2, 1.0111', () => {
    const k = requiredScales(h, 40000, opts);
    [132400 / 121000, 190000 / 225000, 1.2, 145600 / 144000].forEach((x, i) => within(k[i], x, true));
  });
  it('the cloud is proportional to the portfolio', () => {
    const c = spendingCloud(h, 2, opts);
    [2 * (121000 / 3.31), 2 * (225000 / 4.75), 200000 / 3, 2 * (144000 / 3.64)].forEach((x, i) => within(c[i], x, false));
  });
  const g = guardrails(h, 40000, opts);
  it('today: a 1-in-4 chance, past the cut, so cut now to $33,333 (−16.7%)', () => {
    expect(g).toMatchObject({ paths: 4, spending: 40000, portfolio: 100000, chance: 0.25 });
    within(g.target, 100000 / 3, false);
    expect(g.now).toMatchObject({ kind: 'cut', applies: true });
    expect(g.now.change).toBeCloseTo(-1 / 6, 2);
  });
  it('the cut: at $101,111 the chance is 2 in 4; spending to $33,704 (−15.7%)', () => {
    within(g.cut.portfolio, 101111.11, true);
    expect(g.cut.chance).toBe(0.5);
    within(g.cut.spending, (100000 / 3) * g.cut.scale, false); // C's W at the scale found (33,703.70 at 1.011111)
    expect(Math.abs(g.cut.spending / 33703.7 - 1)).toBeLessThan(0.011);
    expect(g.cut.change).toBeCloseTo(-0.1574, 2);
    expect(g.cut.applies).toBe(true);
  });
  it('the raise: at $120,000 every path lasts; the target there is the plan’s $40,000, under 5%: no change', () => {
    within(g.raise.portfolio, 120000, true);
    expect(g.raise.chance).toBe(1);
    within(g.raise.spending, (100000 / 3) * g.raise.scale, false); // 40,000 at 1.2; the scale may be 0.5% above
    expect(Math.abs(g.raise.spending / 40000 - 1)).toBeLessThan(0.011);
    expect(g.raise.applies).toBe(false);
  });
});

describe('summarizeGuardrails', () => {
  it('today between the guardrails: no move now', () => {
    const s = summarizeGuardrails({ spending: 100, portfolio: 1000, scales: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4], today: [100, 110, 120, 130, 140, 150, 160, 170, 180, 190], settings: DEFAULT_GUARDRAILS });
    // chance 6/10; target = ⌈8⌉ = 8th largest = 120; cut ⌊5⌋ = 5th = 0.9 → 900; raise ⌈9.5⌉ = 10th = 1.4 → 1,400
    expect(s).toMatchObject({ chance: 0.6, target: 120, now: null });
    expect(s.cut).toMatchObject({ scale: 0.9, portfolio: 900, chance: 0.5, spending: null });
    expect(s.raise).toMatchObject({ scale: 1.4, portfolio: 1400, chance: 1 });
  });
  it('today at or above the raise: raise now', () => {
    const s = summarizeGuardrails({ spending: 100, portfolio: 1000, scales: Array(20).fill(0.5), today: Array(20).fill(150), settings: DEFAULT_GUARDRAILS });
    expect(s.now).toMatchObject({ kind: 'raise', spending: 150, change: 0.5, applies: true });
  });
});

// A household with tax and RMDs (Pre-tax and Roth, 70 to 85), on 40 random paths: each guardrail,
// rerun, lands on its target. Cut: the chance at the cut value is at least 50%, and 2% below it under
// 50% (each path's scale is at most 0.5% above its true value, so a path lasting at 98% of the cut
// value has a scale under the cut's, one of the ⌊0.5 × 40⌋ − 1 = 19 below it). The same for the raise
// (at least 95%, below 95% just under it) and for the new spending at each (at least 80%, under 80%
// at 2% more).
describe('each guardrail, rerun, lands on its target (random paths)', () => {
  const h = {
    ...rothOnly(0, 85),
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: 600000 },
      { id: 'a2', owner: 'p1', type: 'roth', balance: 200000 },
    ],
  };
  const spending = 55000;
  const opts = { to: 40, volatility: 0.2, seed: 3 };
  const g = guardrails(h, spending, opts);
  const rerun = (s, k) => chanceAt(h, s, k, opts);
  it('the cut value: the chance falls to 50%', () => {
    expect(g.cut.chance).toBe(0.5);
    expect(rerun(spending, g.cut.scale)).toBeGreaterThanOrEqual(0.5);
    expect(rerun(spending, g.cut.scale * 0.98)).toBeLessThan(0.5);
  });
  it('the raise value: the chance reaches 95%', () => {
    expect(rerun(spending, g.raise.scale)).toBeGreaterThanOrEqual(0.95);
    expect(rerun(spending, g.raise.scale * 0.98)).toBeLessThan(0.95);
  });
  it('the new spending at each guardrail: back to 80%', () => {
    for (const level of [g.cut, g.raise]) {
      expect(rerun(level.spending, level.scale)).toBeGreaterThanOrEqual(0.8);
      expect(rerun(level.spending * 1.02, level.scale)).toBeLessThan(0.8);
    }
    expect(g.cut.spending).toBeLessThan(spending);
    expect(g.raise.spending).toBeGreaterThan(spending);
  });
  it('today’s chance is the rerun’s', () => {
    expect(g.chance).toBe(rerun(spending, 1));
  });
});

describe('no volatility', () => {
  // Every path is the projection: all paths need the same scale, so the chance is 0 or 1 and the cut,
  // the raise and today's target are the same point: the portfolio that just sustains the spending.
  it('the chance is 0 or 1; both guardrails sit at the one needed value', () => {
    const h = { ...rothOnly(0, 85), accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: 800000 }] };
    const g = guardrails(h, 55000, { to: 5, volatility: 0 });
    expect([0, 1]).toContain(g.chance);
    expect(g.cut.scale).toBe(g.raise.scale);
  });
});

describe('from a later year (HAND CALC)', () => {
  // $100,000 Roth, 70 to 73, $20,000 a year. Year 0 at the plan's 5%: (100,000 − 20,000) × 1.05 = 84,000
  // at the start of year 1. Then three years on each path's returns (its draws from its first):
  //   A 10%: W = 84,000 × 1.21 / 3.31 = 30,707.0; C 0%: 84,000 / 3 = 28,000.
  // Needed scale at $20,000: A 66,200 / 101,640 = 0.651318 (54,710.74 = 20,000 × 3.31 / 1.21);
  //   C 60,000 / 84,000 = 0.714286 (3 × 20,000).
  // Both last at scale 1: chance 2/2 ≥ 95%: raise now to the target, ⌈0.8 × 2⌉ = 2nd largest = 28,000 (+40%).
  // Cut: ⌊0.5 × 2⌋ = 1st = A's → $54,710.74; spending there: C's 28,000 × 0.651318 = 18,236.9 (−8.8%).
  // Raise: ⌈0.95 × 2⌉ = 2nd = C's → $60,000; spending there 20,000: no change.
  const h = rothOnly(100000, 73);
  const opts = { to: 2, returnPaths: [[0.1, 0.1, 0.1], [0, 0, 0]], start: 1 };
  it('the plan’s portfolio at the start of each year', () => {
    expect(planPortfolios(h, 20000).slice(0, 2)).toEqual([100000, expect.closeTo(84000, 6)]);
    expect(portfolioTotal({ accounts: [{ balance: 100000 }, { balance: 25000 }, {}] })).toBe(125000);
  });
  it('each path’s needed scale and the spending it sustains, from year 1', () => {
    const k = requiredScales(h, 20000, opts);
    expect(k[0]).toBeGreaterThanOrEqual(66200 / 101640 - 1e-12);
    expect(k[0] / (66200 / 101640)).toBeLessThan(1.006);
    expect(k[1] / (60000 / 84000)).toBeLessThan(1.006);
    const c = spendingCloud(h, 1, { ...opts, before: 20000 });
    expect(c[0] / ((84000 * 1.21) / 3.31)).toBeGreaterThan(0.994);
    expect(c[1] / 28000).toBeGreaterThan(0.994);
    expect(c[1]).toBeLessThanOrEqual(28000 + 1e-6);
  });
  const g = guardrails(h, 20000, opts);
  it('raise now; cut at $54,711 to about $18,237; raise at $60,000 with no change', () => {
    expect(g).toMatchObject({ portfolio: expect.closeTo(84000, 6), chance: 1, now: { kind: 'raise', applies: true } });
    expect(g.target / 28000).toBeGreaterThan(0.994);
    expect(g.cut.portfolio / 54710.74).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(g.cut.portfolio / 54710.74).toBeLessThan(1.006);
    expect(g.cut.spending / 18236.9).toBeGreaterThan(0.99);
    expect(g.cut.spending / 18236.9).toBeLessThan(1.01);
    expect(g.raise.portfolio / 60000).toBeLessThan(1.006);
    expect(g.raise.applies).toBe(false);
  });
});

describe('from a later year, rerun (random paths)', () => {
  const h = {
    ...rothOnly(0, 85),
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: 600000 },
      { id: 'a2', owner: 'p1', type: 'roth', balance: 200000 },
    ],
  };
  const spending = 55000;
  const opts = { to: 20, volatility: 0.2, seed: 5, start: 3 };
  const g = guardrails(h, spending, opts);
  const rerun = (s, k) => chanceAt(h, s, k, { ...opts, before: spending });
  it('year 3’s cut and raise land on 50% and 95%; the new spending on 80%', () => {
    expect(rerun(spending, g.cut.scale)).toBeGreaterThanOrEqual(0.5);
    expect(rerun(spending, g.cut.scale * 0.98)).toBeLessThan(0.5);
    expect(rerun(spending, g.raise.scale)).toBeGreaterThanOrEqual(0.95);
    expect(rerun(g.cut.spending, g.cut.scale)).toBeGreaterThanOrEqual(0.8);
    expect(rerun(g.cut.spending * 1.02, g.cut.scale)).toBeLessThan(0.8);
    expect(g.portfolio).toBe(planPortfolios(h, spending)[3]);
  });
});
