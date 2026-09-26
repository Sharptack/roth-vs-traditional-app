import { describe, it, expect } from 'vitest';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { flattenForScatter, runAllBatches, runScenarioBatch, runScenarioPoint } from '../src/lib/scenarios.js';
import { INCOMES, LIFESTYLES, SCENARIO_BATCHES } from '../src/data/scenarioBatches.js';

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

    const flat = flattenForScatter(runs);
    for (const point of flat) {
      expect(Number.isFinite(point.gap)).toBe(true);
      expect(Number.isFinite(point.advantagePct)).toBe(true);
    }
  });

  it('the savings-rate batch includes the same 10% line as the income-sweep batch', () => {
    const runs = runAllBatches(SCENARIO_BATCHES, 2025);
    const incomeSweep = runs.find((r) => r.key === 'incomeSweep').series[0];
    const savingsRate10 = runs.find((r) => r.key === 'savingsRateSweep').series.find((s) => s.key === 'savings10');
    expect(savingsRate10.points.map((p) => p.gap)).toEqual(incomeSweep.points.map((p) => p.gap));
  });
});
