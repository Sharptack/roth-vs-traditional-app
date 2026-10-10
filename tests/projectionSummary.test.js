import { describe, it, expect } from 'vitest';
import { runProjection } from '../src/lib/projection.js';
import { afterTaxEnding, meetsPlan, legacyTarget, summarizeProjection, sustainableSpending } from '../src/lib/projectionSummary.js';

const Y = 2026;
function retiree({ age, pretax = 0, roth = 0, taxable = 0, basisShare = 0, returnRate = 0 }) {
  return {
    version: 1, year: Y, filingStatus: 'single',
    people: [{ id: 'p1', birthYear: Y - age, retirementAge: age - 1, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: pretax },
      { id: 'a2', owner: 'p1', type: 'roth', balance: roth },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: taxable, basisShare },
    ],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: {},
    assumptions: { returnRate, inflationRate: 0, ageDeductions: false },
  };
}

describe('summarizeProjection (HAND CALC)', () => {
  it('the three-year toy case', () => {
    // each year: withdrawal 31,613.64, tax 1,613.64, after-tax 30,000 (see projection.test.js)
    // ending Pre-tax 550,394.75 (10% return) -> after heirs' 24%: 418,300.01
    const rows = runProjection(retiree({ age: 66, pretax: 500000, returnRate: 0.1 }), { need: 30000, endAge: 68 }).rows;
    const s = summarizeProjection(rows);
    expect(s.totalTax).toBeCloseTo(3 * 1613.6364, 2);
    expect(s.retirementAfterTaxIncome).toBeCloseTo(90000, 3);
    expect(s.endingBalance.pretax).toBeCloseTo(550394.75, 2);
    expect(s.endingAfterTax).toBeCloseTo(550394.75 * 0.76, 2);
    expect(s.averageEffectiveRate).toBeCloseTo(1613.6364 / 31613.6364, 8);
    expect(s.moneyLastsTo).toBe(68);
    expect(s.runsOut).toBe(false);
    expect(s.firstRetirementYear).toBe(Y);
  });

  it('when the money runs out: the last age with no shortfall', () => {
    // $50,000, need 30,000, return 0: short in the second year (age 67) -> lasts to 66
    const s = summarizeProjection(runProjection(retiree({ age: 66, pretax: 50000 }), { need: 30000, endAge: 68 }).rows);
    expect(s.runsOut).toBe(true);
    expect(s.moneyLastsTo).toBe(66);
  });

  it('Roth and taxable count in full for heirs (step-up in basis)', () => {
    const rows = runProjection(retiree({ age: 66, roth: 100000, taxable: 100000, basisShare: 0.2 }), { need: 0, endAge: 66 }).rows;
    expect(summarizeProjection(rows).endingAfterTax).toBeCloseTo(200000, 6);
  });
});

describe('sustainableSpending (HAND CALC)', () => {
  it('$500,000 Pre-tax over three years at 0%: 166,666.67 per year withdrawn, 137,932.67 after tax', () => {
    // W = 500,000 / 3 = 166,666.67; taxable 150,566.67:
    //   1,240 + 4,560 + 22% x 55,300 (12,166) + 24% x 44,866.67 (10,768) = 28,734 -> 137,932.67
    const s = sustainableSpending(retiree({ age: 66, pretax: 500000 }), { endAge: 68 });
    expect(s).toBeGreaterThan(137932.67 - 1.01);
    expect(s).toBeLessThanOrEqual(137932.67 + 0.01);
  });
});

describe('sustainable spending with a legacy goal (phase 3 step b, HAND CALC)', () => {
  // Roth only, $1,000,000 at 5%, ages 66-68 (3 years), no tax, no Social Security. Withdrawals at the
  // start of each year, the rest grows (an annuity due):
  //   B3 = B·1.05³ − W·1.05·(1.05³ − 1)/0.05, so W = (B·1.05³ − L)·0.05 / (1.05·0.157625)
  //   1.05³ = 1.157625; 1.05 × 0.157625 = 0.16550625
  //   L = 500,000: (1,157,625 − 500,000)·0.05 = 32,881.25 → W = 198,670.73
  //     forward: 801,329.27·1.05 = 841,395.73; 642,725.00·1.05 = 674,861.25; 476,190.52·1.05 = 500,000.05
  //   no goal:   1,157,625·0.05 = 57,881.25 → W = 349,722.44 (first worked as 349,724.42: an arithmetic
  //     slip, found when the code disagreed; 0.16550625 × 350,000 = 57,927.19, 45.94 over, 277.56 less)
  //     forward: 650,277.56·1.05 = 682,791.44; 333,069.00·1.05 = 349,722.45; 0.01 left
  //   each $100,000 for heirs: 100,000 × 0.05/0.16550625 = 100,000 × 0.3021036 = 30,210.36 a year
  const roth = () => retiree({ age: 66, roth: 1000000, returnRate: 0.05 });
  const within = (s, expected) => {
    expect(s).toBeGreaterThan(expected - 1.01);
    expect(s).toBeLessThanOrEqual(expected + 0.01);
  };

  it('spends down to exactly the goal: the annuity formula with a final balance', () => {
    const s = sustainableSpending(roth(), { endAge: 68, legacy: { target: 500000 } });
    within(s, 198670.73);
    const end = runProjection(roth(), { need: s, endAge: 68 }).rows.at(-1).endBalances.total;
    expect(end).toBeGreaterThanOrEqual(500000);
    expect(end).toBeLessThan(500000 + 2); // $1 of spending more is ~$3.31 less at the end
  });

  it('no goal: everything spent; each $100,000 for heirs costs $30,210.36 a year', () => {
    within(sustainableSpending(roth(), { endAge: 68 }), 349722.44);
    within(sustainableSpending(roth(), { endAge: 68, legacy: { target: 0 } }), 349722.44);
    const at = (target) => sustainableSpending(roth(), { endAge: 68, legacy: { target } });
    expect(at(400000) - at(500000)).toBeCloseTo(30210.36, -1);
  });

  it('the after-tax measure: Pre-tax at the heirs\' rate', () => {
    // Pre-tax $98,000 at 0%, 3 years, heirs at 24%, goal $38,000 after tax → $50,000 must be left
    // (38,000 / 0.76); W = (98,000 − 50,000) / 3 = 16,000, under the $16,100 standard deduction: no tax.
    const h = retiree({ age: 66, pretax: 98000 });
    within(sustainableSpending(h, { endAge: 68, legacy: { target: 38000, measure: 'afterTax', heirTaxRate: 0.24 } }), 16000);
    // measured as the balance, only $38,000 must be left: W = 60,000 / 3 = 20,000, now taxed, so less after tax
    const asBalance = sustainableSpending(h, { endAge: 68, legacy: { target: 38000 } });
    expect(asBalance).toBeGreaterThan(16000);
    expect(asBalance).toBeLessThan(20000);
  });

  it('a goal out of reach: 0, and meetsPlan says even no spending fails', () => {
    // 1,000,000 · 1.157625 = 1,157,625 at most by 68
    expect(sustainableSpending(roth(), { endAge: 68, legacy: { target: 1200000 } })).toBe(0);
    expect(meetsPlan(roth(), 0, { endAge: 68, legacy: { target: 1200000 } })).toBe(false);
    expect(meetsPlan(roth(), 0, { endAge: 68, legacy: { target: 1157000 } })).toBe(true);
  });

  it('legacyTarget: a dollar amount, a share of today\'s portfolio, or none', () => {
    const h = retiree({ age: 66, pretax: 300000, roth: 100000, taxable: 100000 });
    expect(legacyTarget(h, { type: 'amount', amount: 250000 })).toBe(250000);
    expect(legacyTarget(h, { type: 'share', share: 0.5 })).toBe(250000); // 50% of 500,000
    expect(legacyTarget(h, { type: 'none', amount: 250000 })).toBe(0);
    expect(legacyTarget(h)).toBe(0);
  });
});

describe('afterTaxEnding: a charitable legacy, Pre-tax first (phase 3 step e, HAND CALC)', () => {
  // $600,000 Pre-tax, $300,000 Roth, $100,000 taxable = $1,000,000; heirs at 24%.
  const end = { pretax: 600000, roth: 300000, taxable: 100000, total: 1000000 };
  it('no charity: Pre-tax at the heirs\' rate, as before', () => {
    // 1,000,000 − 0.24 × 600,000 = 856,000
    expect(afterTaxEnding(end, { heirTaxRate: 0.24 })).toBeCloseTo(856000, 6);
  });
  it('25% to charity: its $250,000 comes from Pre-tax, untaxed', () => {
    // taxed Pre-tax 600,000 − 250,000 = 350,000; 1,000,000 − 84,000 = 916,000
    // (heirs 750,000 − 84,000 = 666,000; charity 250,000)
    expect(afterTaxEnding(end, { heirTaxRate: 0.24, charityShare: 0.25 })).toBeCloseTo(916000, 6);
  });
  it('75% to charity: $750,000 covers all the Pre-tax money, so no tax at all', () => {
    expect(afterTaxEnding(end, { heirTaxRate: 0.24, charityShare: 0.75 })).toBeCloseTo(1000000, 6);
  });
  it('the legacy goal measured after tax counts the charity\'s part in full', async () => {
    const { legacyValue } = await import('../src/lib/projectionSummary.js');
    expect(legacyValue(end, { measure: 'afterTax', heirTaxRate: 0.24, charityShare: 0.25 })).toBeCloseTo(916000, 6);
    expect(legacyValue(end, { measure: 'balance', heirTaxRate: 0.24, charityShare: 0.25 })).toBe(1000000);
  });
  it('the summary and the conversion\'s legacy use it', async () => {
    const { conversionTotals } = await import('../src/lib/conversionLifetime.js');
    // 66, $500,000 Pre-tax at 10%, 3 years: ending Pre-tax 550,394.75 (above); all of it to charity → untaxed
    const rows = runProjection(retiree({ age: 66, pretax: 500000, returnRate: 0.1 }), { need: 30000, endAge: 68 }).rows;
    expect(summarizeProjection(rows, { heirTaxRate: 0.24, charityShare: 1 }).endingAfterTax).toBeCloseTo(550394.75, 2);
    expect(conversionTotals(rows, 0.24, 1).legacyAfterTax).toBeCloseTo(550394.75, 2);
    expect(conversionTotals(rows, 0.24).legacyAfterTax).toBeCloseTo(550394.75 * 0.76, 2);
  });
});

describe('projectionView and its tile', () => {
  it('funded status agrees with whether the money lasts at the actual need', async () => {
    const { PREVIEW_DEFAULT_VALUES, toHousehold } = await import('../src/lib/household.js');
    const { projectionView } = await import('../src/lib/projectionSummary.js');
    const { projectionTile } = await import('../src/lib/suiteTiles.js');
    for (const [values, need] of [
      [{}, 60000],
      [{}, 200000],
      [{ projEndAge: '100', projHeirTaxRate: '0.32' }, 80000],
    ]) {
      const h = toHousehold({ ...PREVIEW_DEFAULT_VALUES, ...values }, Y);
      const v = projectionView(h, need);
      expect(v.funded).toBeCloseTo(v.sustainable / need, 12);
      expect(v.summary.runsOut).toBe(v.sustainable < need);
      expect(v.rows[v.rows.length - 1].ages[0]).toBe(Number(values.projEndAge ?? 95));
      expect(v.summary.heirTaxRate).toBe(Number(values.projHeirTaxRate ?? 0.24));
      const tile = projectionTile(v);
      expect(tile.headline).toMatch(v.summary.runsOut ? /^Runs out at (age \d+|\d{4} \(.+\))$/ : /^\d+% funded$/);
    }
  });
});

describe('whenLabel: when per year falls, in words', () => {
  it('one person: their age; a couple: the year and the ages of those living', async () => {
    const { whenLabel } = await import('../src/lib/projectionSummary.js');
    expect(whenLabel({ year: 2061, ages: [95] })).toBe('age 95');
    expect(whenLabel({ year: 2061, ages: [95, 85], alive: [true, true] })).toBe('2061 (you 95, your spouse 85)');
    expect(whenLabel({ year: 2071, ages: [105, 95], alive: [false, true] })).toBe('2071 (your spouse 95)');
    expect(whenLabel({ year: 2071, ages: [95, 105], alive: [true, false] })).toBe('2071 (you 95)');
  });
});
