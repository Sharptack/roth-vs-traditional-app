import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GUARDRAILS,
  chanceAt,
  guardrailScales,
  guardrailSettings,
  guardrails,
  portfolioTotal,
  requiredScales,
  scaledHousehold,
  spendingCloud,
  summarizeGuardrails,
  targetSpending,
} from '../src/lib/guardrails.js';

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

describe('scaling today’s balances', () => {
  it('every account times the scale; the basis follows its share', () => {
    const h = { ...rothOnly(100000), accounts: [{ id: 'a', owner: 'p1', type: 'taxable', balance: 50000, basisShare: 0.4 }, { id: 'b', owner: 'p1', type: 'roth', balance: 10000 }] };
    const s = scaledHousehold(h, 1.5);
    expect(s.accounts.map((a) => a.balance)).toEqual([75000, 15000]);
    expect(s.accounts[0].basisShare).toBe(0.4);
    expect(portfolioTotal(s)).toBe(90000);
    expect(h.accounts[0].balance).toBe(50000);
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
