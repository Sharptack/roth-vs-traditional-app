import { describe, it, expect } from 'vitest';
import { breakEvenRateShift, compareLifetime } from '../src/lib/lifetimeComparison.js';
import { runProjection } from '../src/lib/projection.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';

const Y = 2026;
// Today's rules (no inflation, no age deductions, marginal-rate saving) and a 0% return, so every
// dollar can be followed by hand.
const setUp = (over) => {
  const h = toHousehold(
    { ...PREVIEW_DEFAULT_VALUES, inflationRate: '0', ageDeductions: 'no', taxSavedBasis: 'marginal', returnRate: '0.05', knowsSocialSecurity: 'yes', socialSecurityBenefit: '0', ...over },
    Y,
  );
  h.assumptions.returnRate = 0;
  return { h, r: compareRothVsTraditional(householdToCompareInputs(h)) };
};

describe('compareLifetime (2026, HAND CALC)', () => {
  it('one saving year, then retirement: Roth leads in wealth for heirs, Pre-tax in sustainable spending', () => {
    // 64, $100,000 wages, $10,000 Pre-tax at 22% -> take-home cost 7,800: Roth 7,800 or Pre-tax 10,000.
    // Need 0 (so nothing is spent): ending after tax for heirs at 24%: Roth 7,800, Pre-tax 7,600 -> Roth +200.
    // Sustainable over the one retirement year (65): Roth 7,800 tax-free; Pre-tax 10,000, all under the
    // 16,100 standard deduction -> 10,000. Pre-tax +2,200: 22% saved now, 0% paid later.
    const { h, r } = setUp({ currentAge: '64', retirementAge: '65', projEndAge: '65', accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: '0', basisShare: '0.5' }] });
    expect(r.contributionSplit.takeHomeCost).toBeCloseTo(7800, 6);
    const c = compareLifetime(h, { ...r, retirementNeed: { ...r.retirementNeed, target: 0 } }, { endAge: 65 });
    expect(c.roth.summary.endingAfterTax).toBeCloseTo(7800, 6);
    expect(c.pretax.summary.endingAfterTax).toBeCloseTo(7600, 6);
    expect(c.difference.endingAfterTax).toBeCloseTo(200, 6);
    expect(c.roth.sustainable).toBeGreaterThan(7799);
    expect(c.roth.sustainable).toBeLessThanOrEqual(7800);
    expect(c.pretax.sustainable).toBeGreaterThan(9999);
    expect(c.pretax.sustainable).toBeLessThanOrEqual(10000);
    expect(c.winner).toBe('pretax');
    expect(c.wealthGap.map((g) => Math.round(g.value))).toEqual([200, 200]);
    expect(c.crossoverYear).toBeNull();
  });

  it('symmetry: 22% now and 22% on every withdrawal later, heirs at 22% -> a tie', () => {
    // One saving year at 22% (taxable 73,900-83,900, inside 50,400-105,700). Retired 65-70 on a
    // $1,000,000 Pre-tax balance, need $70,000: W = 78,423 a year (0.78 W = 61,170), ordinary
    // income always inside the 22% bracket, no Social Security, no RMDs (born 1962: 75), 0% return.
    const { h, r } = setUp({ currentAge: '64', retirementAge: '65', projEndAge: '70', accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: '1000000', basisShare: '0.5' }] });
    const c = compareLifetime(h, { ...r, retirementNeed: { ...r.retirementNeed, target: 70000 } }, { endAge: 70, heirTaxRate: 0.22 });
    for (const row of [...c.roth.rows, ...c.pretax.rows].filter((x) => !x.working[0])) {
      expect(row.ordinaryBracketRate).toBe(0.22);
    }
    expect(Math.abs(c.difference.endingAfterTax)).toBeLessThan(0.01);
  });

  it('the same take-home cost over the limit: Pre-tax invests the tax it saved', () => {
    // take-home cost 25,000 at 22%, limit 24,500 (age 45): Roth 24,500 + 500 taxable;
    // Pre-tax 24,500 (costing 19,110) + 25,000 - 19,110 = 5,890 taxable
    const { h } = setUp({ currentAge: '45' });
    const row = (type) => runProjection(h, { need: 0, endAge: 45, contributions: [{ owner: 'p1', takeHomeCost: 25000, rate: 0.22, type }] }).rows[0].contributions;
    expect(row('roth')).toMatchObject({ roth: 24500, taxable: 500 });
    expect(row('pretax').pretax).toBe(24500);
    expect(row('pretax').taxable).toBeCloseTo(5890, 6);
  });

  it('break-even: at the returned rate change the two sustainable-spending figures meet', () => {
    const { h, r } = setUp({ currentAge: '55', retirementAge: '65', projEndAge: '85', accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: '300000', basisShare: '0.5' }] });
    const shift = breakEvenRateShift(h, r, { endAge: 85, steps: 12 });
    expect(shift).not.toBeNull();
    const at = compareLifetime(h, r, { endAge: 85, retirementRateShift: shift });
    expect(Math.abs(at.difference.sustainable)).toBeLessThan(25);
  });
});
