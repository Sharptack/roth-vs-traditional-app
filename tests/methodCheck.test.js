// TEMPORARY (2026-09-29): tests for the "Old vs. new calculation" page's wiring (methodCheck.js).
// Delete with `result.old`.
import { describe, it, expect } from 'vitest';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { toCompareInputs } from '../src/lib/formInputs.js';
import {
  differenceCauses,
  flattenPoints,
  runMethodBatch,
  runMethodHeatmap,
  runMethodPoint,
  summarize,
  toFormValues,
} from '../src/lib/methodCheck.js';
import { HEATMAPS, SCENARIO_BATCHES } from '../src/data/scenarioBatches.js';

const base = {
  filingStatus: 'single',
  selfEmploymentIncome: 0,
  currentAge: 35,
  retirementAge: 65,
  debtPayments: 0,
  otherExpenses: 0,
  currentType: 'pretax',
  accountType: '401k',
  knowsSocialSecurity: false,
  socialSecurityBenefit: 0,
  returnRate: 0.07,
  retirementLifestyle: 1,
  otherPretaxBalance: 0,
  otherRothBalance: 0,
  otherTaxableBalance: 0,
  otherTaxableBasis: 0.5,
};

describe('runMethodPoint', () => {
  it('reads both calculations straight off compareRothVsTraditional', () => {
    const overrides = { grossIncome: 100000, savings: 10000, otherPretaxBalance: 100000 };
    const r = compareRothVsTraditional({ ...base, ...overrides, year: 2026 });
    const p = runMethodPoint(base, overrides, 2026);
    expect(p.new.effective).toBe(r.rates.effectiveRetirement);
    expect(p.new.rateNow).toBe(r.rates.taxSavedNow);
    expect(p.new.winner).toBe(r.comparison.winner);
    expect(p.old.effective).toBe(r.old.rates.effectiveRetirement);
    expect(p.old.rateNow).toBe(r.old.rates.marginalNow);
    expect(p.old.winner).toBe(r.old.comparison.winner);
    expect(p.old.measuredOn).toBe(r.old.grossUp.grossWithdrawal);
    expect(p.new.measuredOn).toBe(r.annuity.pretax.annualWithdrawal);
    expect(p.exact.difference).toBeCloseTo(
      r.portfolio.pretax.atBaseline.afterTaxIncome - r.portfolio.roth.atBaseline.afterTaxIncome,
      9,
    );
  });

  it('the new difference equals the independent 4% benchmark at every scenario (the identity)', () => {
    const batches = SCENARIO_BATCHES.filter((b) => !b.engine).map((b) => runMethodBatch(b, 2026));
    const heatmaps = HEATMAPS.map((h) => runMethodHeatmap(h, 2026));
    const points = flattenPoints(batches, heatmaps);
    expect(points.length).toBeGreaterThan(400);
    for (const p of points) expect(Math.abs(p.new.difference - p.exact.difference)).toBeLessThan(0.01);
    expect(summarize(points).newContradicts).toBe(0);
  });
});

describe('flattenPoints', () => {
  it('keeps a scenario that appears in two places once', () => {
    const p = { inputs: { a: 1 } };
    const batches = [{ title: 'B', xType: 'currency', series: [{ label: 'S', points: [{ ...p, x: 1 }] }] }];
    const heatmaps = [{ title: 'H', rows: [{ label: 'R', cells: [{ ...p, income: 1 }] }] }];
    const out = flattenPoints(batches, heatmaps);
    expect(out).toHaveLength(1);
    expect(out[0].source.title).toBe('B');
  });
});

describe('summarize', () => {
  const pt = (exact, nw, old, errNew, errOld) => ({
    exact: { winner: exact, difference: 100 },
    new: { winner: nw, lean: nw, difference: 100 + errNew },
    old: { winner: old, lean: old === 'pretax' ? 'roth' : old, difference: 100 + errOld },
  });

  it('counts contradictions only where the benchmark picks a clear winner', () => {
    const s = summarize([
      pt('pretax', 'pretax', 'roth', 0, -250), // old contradicts
      pt('roth', 'roth', 'even', 0, 40), // old "even": not a contradiction
      pt('even', 'even', 'pretax', 0, 900), // benchmark even: not counted
    ]);
    expect(s.count).toBe(3);
    expect(s.clearCount).toBe(2);
    expect(s.winnersDiffer).toBe(3);
    expect(s.oldContradicts).toBe(1);
    expect(s.newContradicts).toBe(0);
    expect(s.oldMaxError).toBe(900); // |1000 - 100|
    expect(s.newMaxError).toBe(0);
    // old lean vs. its own winner: roth=roth, even=even, pretax vs. lean roth differs
    expect(s.oldLeanVsOwnWinner).toBe(1);
  });
});

describe('differenceCauses', () => {
  it('names a withdrawal-size mismatch, the IRS limit and a lifestyle change', () => {
    const p = {
      overLimit: true,
      inputs: { retirementLifestyle: 1.5 },
      new: { measuredOn: 10000 },
      old: { measuredOn: 60000 },
    };
    expect(differenceCauses(p)).toEqual([
      'Old measured a bigger withdrawal',
      'Over the IRS limit (taxable side account)',
      'Retirement lifestyle ≠ 1×',
    ]);
    expect(differenceCauses({ ...p, overLimit: false, inputs: { retirementLifestyle: 1 }, old: { measuredOn: 11000 } })).toEqual([]);
  });
});

describe('toFormValues', () => {
  it('round-trips through toCompareInputs to the same calculator result', () => {
    const inputs = { ...base, grossIncome: 150000, savings: 30000, otherTaxableBalance: 50000, year: 2026 };
    const back = toCompareInputs(toFormValues(inputs), 2026);
    expect(compareRothVsTraditional(back).comparison).toEqual(compareRothVsTraditional(inputs).comparison);
    expect(back.otherTaxableBasis).toBe(0.5);
  });
});
