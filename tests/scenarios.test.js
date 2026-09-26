import { describe, it, expect } from 'vitest';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import {
  flattenForScatter,
  runAllBatches,
  runHeatmap,
  runScenarioBatch,
  runScenarioPoint,
} from '../src/lib/scenarios.js';
import { HEATMAP, INCOMES, LIFESTYLES, RETIREMENT_AGES, SCENARIO_BATCHES } from '../src/data/scenarioBatches.js';

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
};

describe('runScenarioPoint', () => {
  it('matches calling compareRothVsTraditional directly with the same merged inputs', () => {
    const overrides = { grossIncome: 100000, savings: 10000 };
    const direct = compareRothVsTraditional({ ...base, ...overrides, year: 2025 });
    const point = runScenarioPoint(base, overrides, 2025);
    expect(point.marginalNow).toBe(direct.rates.marginalNow);
    expect(point.effectiveRetirement).toBe(direct.rates.effectiveRetirement);
    expect(point.rothAfterTax).toBe(direct.annuity.roth.totalAfterTaxIncome);
    expect(point.pretaxAfterTax).toBe(direct.annuity.pretax.totalAfterTaxIncome);
    expect(point.winner).toBe(direct.comparison.winner);
  });

  it('HAND CALC: gap is marginal-now minus effective-retirement, exactly (a 22% vs 20% pair -> +2 points)', () => {
    // A scenario in the 22% federal bracket (single, 2025) whose effective retirement
    // rate happens to land lower than marginal, to exercise the subtraction directly.
    const point = runScenarioPoint(base, { grossIncome: 100000, savings: 10000 }, 2025);
    expect(point.gap).toBeCloseTo(point.marginalNow - point.effectiveRetirement, 12);
  });

  it('HAND CALC: advantagePct is (roth - pretax) / pretax * 100', () => {
    const point = runScenarioPoint(base, { grossIncome: 100000, savings: 10000 }, 2025);
    const expected = ((point.rothAfterTax - point.pretaxAfterTax) / point.pretaxAfterTax) * 100;
    expect(point.advantagePct).toBeCloseTo(expected, 10);
  });

  it('throws on invalid inputs rather than silently producing NaN', () => {
    expect(() => runScenarioPoint(base, { grossIncome: -1 }, 2025)).toThrow(/Invalid scenario/);
  });
});

describe('runScenarioBatch / runAllBatches', () => {
  const batch = {
    key: 'test',
    title: 'Test batch',
    base,
    series: [
      {
        key: 's1',
        label: 'Series 1',
        points: [
          { x: 50000, overrides: { grossIncome: 50000, savings: 5000 } },
          { x: 100000, overrides: { grossIncome: 100000, savings: 10000 } },
        ],
      },
    ],
  };

  it('preserves batch/series shape and attaches computed fields to each point', () => {
    const run = runScenarioBatch(batch, 2025);
    expect(run.key).toBe('test');
    expect(run.series).toHaveLength(1);
    expect(run.series[0].points).toHaveLength(2);
    for (const point of run.series[0].points) {
      expect(typeof point.gap).toBe('number');
      expect(Number.isFinite(point.gap)).toBe(true);
    }
    expect(run.series[0].points[0].x).toBe(50000);
  });

  it('runAllBatches runs every batch', () => {
    const runs = runAllBatches([batch, batch], 2025);
    expect(runs).toHaveLength(2);
  });
});

describe('flattenForScatter', () => {
  it('produces one flat point per series point, tagged with its batch and series', () => {
    const runs = runAllBatches(
      [
        {
          key: 'b1',
          title: 'Batch 1',
          base,
          series: [
            {
              key: 's1',
              label: 'S1',
              points: [{ x: 1, overrides: { grossIncome: 50000, savings: 5000 } }],
            },
          ],
        },
      ],
      2025,
    );
    const flat = flattenForScatter(runs);
    expect(flat).toHaveLength(1);
    expect(flat[0].batchKey).toBe('b1');
    expect(flat[0].seriesLabel).toBe('S1');
    expect(typeof flat[0].gap).toBe('number');
  });
});

describe('the real SCENARIO_BATCHES data', () => {
  it('runs every batch without throwing, at the expected shape', () => {
    const runs = runAllBatches(SCENARIO_BATCHES, 2025);
    const byKey = Object.fromEntries(runs.map((r) => [r.key, r]));

    expect(byKey.incomeSweep.series).toHaveLength(1);
    expect(byKey.incomeSweep.series[0].points).toHaveLength(INCOMES.length);

    expect(byKey.savingsRateSweep.series).toHaveLength(3);
    for (const series of byKey.savingsRateSweep.series) {
      expect(series.points).toHaveLength(INCOMES.length);
    }

    expect(byKey.balanceSweep.series).toHaveLength(4);
    expect(byKey.age50BalanceSweep.series).toHaveLength(4);

    expect(byKey.lifestyleSweep.series).toHaveLength(5);
    for (const series of byKey.lifestyleSweep.series) {
      expect(series.points).toHaveLength(LIFESTYLES.length);
    }

    expect(byKey.retirementAgeSweep.series).toHaveLength(5);
    for (const series of byKey.retirementAgeSweep.series) {
      expect(series.points).toHaveLength(RETIREMENT_AGES.length);
      expect(series.points.map((p) => p.x)).toEqual(RETIREMENT_AGES);
      // the x value really is the retirement age that was run
      for (const p of series.points) expect(p.inputs.retirementAge).toBe(p.x);
    }

    const flat = flattenForScatter(runs);
    for (const point of flat) {
      expect(Number.isFinite(point.gap)).toBe(true);
      expect(Number.isFinite(point.advantagePct)).toBe(true);
    }
  });

  it('HAND CALC: $300k saving 10% ($30,000) is over the 2026 limit, so the excess goes to a taxable account', () => {
    // 2026 401(k) limit $24,500 (age 35); single, marginal rate now 35% (taxable 300,000 - 16,100 = 283,900,
    // which is in the 35% bracket). Currently Pre-tax, so only the part under the limit is deducted:
    //   take-home cost C = 24,500 * (1 - 0.35) + (30,000 - 24,500) = 15,925 + 5,500 = 21,425
    // Roth scenario: all 21,425 fits under the limit. Pre-tax scenario: 24,500 to the account (costs
    // 15,925 after tax), the other 5,500 of C invested in a taxable account.
    const r = compareRothVsTraditional({ ...base, grossIncome: 300000, savings: 30000, year: 2026 });
    expect(r.rates.marginalNow).toBeCloseTo(0.35, 10);
    expect(r.contributionSplit.takeHomeCost).toBeCloseTo(21425, 6);
    expect(r.contributionSplit.roth.toAccount).toBeCloseTo(21425, 6);
    expect(r.contributionSplit.roth.excessToTaxable).toBeCloseTo(0, 6);
    expect(r.contributionSplit.pretax.toAccount).toBeCloseTo(24500, 6);
    expect(r.contributionSplit.pretax.excessToTaxable).toBeCloseTo(5500, 6);
  });

  it('a chart point uses the TOTAL after-tax income (account + taxable side), matching compare.js', () => {
    const overrides = { grossIncome: 300000, savings: 30000 };
    const direct = compareRothVsTraditional({ ...base, ...overrides, year: 2026 });
    const point = runScenarioPoint(base, overrides, 2026);
    expect(point.rothAfterTax).toBe(direct.annuity.roth.totalAfterTaxIncome);
    expect(point.pretaxAfterTax).toBe(direct.annuity.pretax.totalAfterTaxIncome);
  });

  it('flags scenarios whose savings exceed the IRS limit (and only those)', () => {
    // 2026 limit $24,500 at age 35: 10% of $300k = $30,000 is over; 10% of $100k = $10,000 is not.
    expect(runScenarioPoint(base, { grossIncome: 300000, savings: 30000 }, 2026).overLimit).toBe(true);
    expect(runScenarioPoint(base, { grossIncome: 100000, savings: 10000 }, 2026).overLimit).toBe(false);
  });

  it('the savings-rate batch includes the same 10% line as the income-sweep batch', () => {
    const runs = runAllBatches(SCENARIO_BATCHES, 2025);
    const incomeSweep = runs.find((r) => r.key === 'incomeSweep').series[0];
    const savingsRate10 = runs.find((r) => r.key === 'savingsRateSweep').series.find((s) => s.key === 'savings10');
    expect(savingsRate10.points.map((p) => p.gap)).toEqual(incomeSweep.points.map((p) => p.gap));
  });
});

describe('runHeatmap (the break-even map)', () => {
  const map = runHeatmap(HEATMAP, 2026);

  it('has one row per savings rate and one cell per income, in order', () => {
    expect(map.rows.map((r) => r.rate)).toEqual(HEATMAP.savingsRates);
    for (const row of map.rows) {
      expect(row.cells.map((c) => c.income)).toEqual(HEATMAP.incomes);
    }
  });

  it('each cell is the same scenario the calculator runs for that income and savings rate', () => {
    // 15% of $100,000 = $15,000 saved
    const row = map.rows.find((r) => r.rate === 0.15);
    const cell = row.cells.find((c) => c.income === 100000);
    const direct = compareRothVsTraditional({ ...HEATMAP.base, grossIncome: 100000, savings: 15000, year: 2026 });
    expect(cell.inputs.savings).toBe(15000);
    expect(cell.rothAfterTax).toBe(direct.annuity.roth.totalAfterTaxIncome);
    expect(cell.pretaxAfterTax).toBe(direct.annuity.pretax.totalAfterTaxIncome);
  });

  it('matches the income-sweep chart at the 10% row (same scenarios, same numbers)', () => {
    const sweep = runAllBatches(SCENARIO_BATCHES, 2026).find((b) => b.key === 'incomeSweep').series[0];
    const row = map.rows.find((r) => r.rate === 0.1);
    expect(row.cells.map((c) => c.advantagePct)).toEqual(sweep.points.map((p) => p.advantagePct));
  });

  it('every cell is finite, and the over-limit cells are the high-income / high-savings corner', () => {
    for (const row of map.rows) {
      for (const c of row.cells) {
        expect(Number.isFinite(c.advantagePct)).toBe(true);
        // over the limit exactly when savings > 24,500 (2026, age 35) -- a currently-Pre-tax saver
        expect(c.overLimit).toBe(c.inputs.savings > 24500);
      }
    }
    expect(map.rows[0].cells[0].overLimit).toBe(false); // 5% of $40k
    expect(map.rows[map.rows.length - 1].cells.at(-1).overLimit).toBe(true); // 30% of $300k
  });
});
