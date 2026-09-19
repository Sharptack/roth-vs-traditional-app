import { describe, it, expect } from 'vitest';
import { solveGrossWithdrawal } from '../src/lib/incomeNeed.js';

const base = { filingStatus: 'single', year: 2025 };

// All expected values below were derived by hand from the 2025 single brackets
// (10% to 11,925 / 12% to 48,475 / 22% to 103,350), the $15,750 standard
// deduction, and the IRS Social Security formula (thresholds 25,000 / 34,000).

describe('solveGrossWithdrawal — no Social Security, one account (HAND CALC)', () => {
  it('target $50,000 after tax', () => {
    // G = withdrawal, taxable T = G - 15,750, assume T lands in the 12% bracket:
    //   tax = 1,192.50 + 0.12 (T - 11,925) = 0.12 T - 238.50
    //   net = G - tax = (T + 15,750) - 0.12 T + 238.50 = 0.88 T + 15,988.50
    //   0.88 T + 15,988.50 = 50,000  ->  T = 34,011.50 / 0.88 = 38,649.43   (in 12%: OK)
    //   G = 38,649.43 + 15,750 = 54,399.43;  tax = 4,399.43
    //   effective rate = 4,399.43 / 54,399.43 = 0.08087
    const r = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: 50000 });
    expect(r.grossWithdrawal).toBeCloseTo(54399.43, 1);
    expect(r.totalTaxPaid).toBeCloseTo(4399.43, 1);
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0.08087, 4);
    expect(r.taxableSS).toBe(0);
    expect(r.afterTaxFromOtherSources).toBe(0);
    expect(r.remainingAfterTaxNeed).toBe(50000);
  });

  it('a withdrawal under the standard deduction is tax-free (effective rate 0)', () => {
    const r = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: 12000 });
    expect(r.grossWithdrawal).toBeCloseTo(12000, 2);
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0, 6);
  });

  it('a target of zero needs no withdrawal', () => {
    const r = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: 0 });
    expect(r.grossWithdrawal).toBe(0);
  });
});

describe('solveGrossWithdrawal — with Social Security (HAND CALC)', () => {
  it('SS $20,000, target $40,000: solution lies in the 50% phase-in tier', () => {
    // Other income = G; combined = G + 10,000. Try 25,000 < combined <= 34,000
    //   taxable SS = 0.5 (G - 15,000);  T = G + taxable SS - 15,750 = 1.5 G - 23,250
    //   T stays below 11,925 -> 10% bracket: tax = 0.10 T = 0.15 G - 2,325
    //   Net = G + 20,000 - tax = 40,000  ->  tax = G - 20,000
    //   0.15 G - 2,325 = G - 20,000  ->  G = 17,675 / 0.85 = 20,794.12
    //   Checks: combined = 30,794 (in tier), T = 7,941 (10% bracket).
    //   tax = 794.12; taxable SS = 0.5 (20,794.12 - 15,000) = 2,897.06
    //   base (G = 0): combined 10,000 -> nothing taxable -> net 20,000, so
    //   remaining need = 20,000; effective rate = 794.12 / 20,794.12 = 0.03819
    const r = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: 40000, ssBenefit: 20000 });
    expect(r.grossWithdrawal).toBeCloseTo(20794.12, 1);
    expect(r.taxableSS).toBeCloseTo(2897.06, 1);
    expect(r.totalTaxPaid).toBeCloseTo(794.12, 1);
    expect(r.afterTaxFromOtherSources).toBeCloseTo(20000, 6);
    expect(r.remainingAfterTaxNeed).toBeCloseTo(20000, 6);
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0.03819, 4);
    // the stacks the UI uses to show its work: before = SS untaxed, no tax;
    // after = the hand-derived taxable SS and tax above
    expect(r.baseStack.taxableSS).toBe(0);
    expect(r.baseStack.totalTax).toBe(0);
    expect(r.solutionStack.taxableSS).toBeCloseTo(2897.06, 1);
    expect(r.solutionStack.totalTax).toBeCloseTo(794.12, 1);
    expect(r.solutionStack.ordinaryTaxableIncome).toBeCloseTo(7941.18, 1); // 1.5 x 20,794.12 - 23,250
  });

  it('SS $20,000, target $55,000: solution lies where 85% of SS is taxable', () => {
    // Bigger draw -> taxable SS hits its 85% cap of 17,000.
    //   T = G + 17,000 - 15,750 = G + 1,250   (12% bracket)
    //   tax = 1,192.50 + 0.12 (G + 1,250 - 11,925) = 0.12 G - 88.50
    //   Net = G + 20,000 - tax = 55,000 -> tax = G - 35,000
    //   0.12 G - 88.50 = G - 35,000 -> G = 34,911.50 / 0.88 = 39,672.16
    //   tax = 4,672.16; remaining need = 55,000 - 20,000 = 35,000
    //   effective rate = 4,672.16 / 39,672.16 = 0.11777  (below the 12% bracket
    //   rate: the SS inclusion lifts the blended rate, the $15,750 deduction lowers it)
    const r = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: 55000, ssBenefit: 20000 });
    expect(r.grossWithdrawal).toBeCloseTo(39672.16, 1);
    expect(r.taxableSS).toBeCloseTo(17000, 6);
    expect(r.totalTaxPaid).toBeCloseTo(4672.16, 1);
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0.11777, 4);
  });

  it('phase-in raises the blended rate above what the bracket alone would give', () => {
    // Same withdrawal-sized draw with and without SS: with SS the effective rate is higher.
    const noSS = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: 25000 });
    const withSS = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: 45000, ssBenefit: 20000 });
    expect(withSS.retirementEffectiveTaxRate).toBeGreaterThan(noSS.retirementEffectiveTaxRate);
  });
});

describe('solveGrossWithdrawal — stacked on other retirement income (HAND CALC)', () => {
  it('other pre-tax $30,000 + other Roth $10,000, target $60,000: all in the 12% bracket', () => {
    // net(G) = (30,000 + G) + 10,000 - tax(T = 14,250 + G), T in 12%:
    //   tax = 0.12 T - 238.50
    //   net = 40,000 + G - 0.12 (14,250 + G) + 238.50 = 38,528.50 + 0.88 G
    //   38,528.50 + 0.88 G = 60,000  ->  G = 21,471.50 / 0.88 = 24,399.43
    //   T = 38,649 (< 48,475: still 12%).  base (G=0) = 40,000 - tax(14,250) = 38,528.50
    //   remaining = 21,471.50;  rate = (24,399.43 - 21,471.50) / 24,399.43 = 0.12 exactly
    const r = solveGrossWithdrawal({
      ...base,
      targetAfterTaxIncome: 60000,
      otherPretaxWithdrawal: 30000,
      otherRothWithdrawal: 10000,
    });
    expect(r.grossWithdrawal).toBeCloseTo(24399.43, 1);
    expect(r.afterTaxFromOtherSources).toBeCloseTo(38528.5, 6);
    expect(r.remainingAfterTaxNeed).toBeCloseTo(21471.5, 1);
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0.12, 5);
  });

  it('a withdrawal that crosses a bracket boundary has a BLENDED rate between the two rates (HAND CALC)', () => {
    // other pre-tax 30,000 (T starts at 14,250). Draw G = 44,225 -> T = 58,475.
    //   tax(58,475) = 5,578.50 (through 48,475) + 22% x 10,000 = 7,778.50
    //   net = 30,000 + 44,225 - 7,778.50 = 66,446.50   <- use as the target
    //   tax before G: tax(14,250) = 1,471.50  ->  extra tax = 6,307
    //   check: 34,225 x 12% = 4,107 + 10,000 x 22% = 2,200 = 6,307
    //   blended rate = 6,307 / 44,225 = 0.14261  (between 12% and 22%)
    const r = solveGrossWithdrawal({
      ...base,
      targetAfterTaxIncome: 66446.5,
      otherPretaxWithdrawal: 30000,
    });
    expect(r.grossWithdrawal).toBeCloseTo(44225, 1);
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0.14261, 4);
    expect(r.retirementEffectiveTaxRate).toBeGreaterThan(0.12);
    expect(r.retirementEffectiveTaxRate).toBeLessThan(0.22);
  });

  it('other taxable-account income is taxed at the flat LTCG rate and counts toward SS taxability', () => {
    // other taxable 40,000: CG tax = 6,000. SS 20,000, combined = 40,000 + 10,000 = 50,000
    //   taxable SS = min(17,000, 4,500 + 0.85 x 16,000 = 18,100) = 17,000
    //   ordinary T = 17,000 - 15,750 = 1,250 -> tax 125
    //   net(G=0) = 40,000 + 20,000 - 6,000 - 125 = 53,875
    const r = solveGrossWithdrawal({
      ...base,
      targetAfterTaxIncome: 53875,
      ssBenefit: 20000,
      otherTaxableWithdrawal: 40000,
    });
    expect(r.grossWithdrawal).toBe(0);
    expect(r.afterTaxFromOtherSources).toBeCloseTo(53875, 6);
  });

  it('Roth withdrawals from other accounts never change the tax stack', () => {
    // Adding $10,000 of Roth income and lowering the target by $10,000 leaves G unchanged.
    const a = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: 50000, ssBenefit: 20000 });
    const b = solveGrossWithdrawal({
      ...base,
      targetAfterTaxIncome: 60000,
      ssBenefit: 20000,
      otherRothWithdrawal: 10000,
    });
    expect(b.grossWithdrawal).toBeCloseTo(a.grossWithdrawal, 4);
    expect(b.retirementEffectiveTaxRate).toBeCloseTo(a.retirementEffectiveTaxRate, 6);
  });
});

describe('solveGrossWithdrawal — other sources already cover the target (HAND CALC)', () => {
  it('needs no withdrawal, and reports the rate an incremental draw would face', () => {
    // SS 50,000 + other pre-tax 30,000: combined 55,000, taxable SS = 4,500 + 0.85 x 21,000 = 22,350
    //   ordinary T = 30,000 + 22,350 - 15,750 = 36,600; tax = 1,192.50 + 0.12 x 24,675 = 4,153.50
    //   net(0) = 80,000 - 4,153.50 = 75,846.50, far above a 20,000 target -> G = 0.
    // Probe a $1,000 draw: combined 56,000 -> taxable SS = 4,500 + 0.85 x 22,000 = 23,200
    //   T = 38,450; tax = 1,192.50 + 0.12 x 26,525 = 4,375.50 -> extra tax 222 -> rate 22.2%
    //   (= 12% bracket x 1.85: the Social Security phase-in "bump")
    const r = solveGrossWithdrawal({
      ...base,
      targetAfterTaxIncome: 20000,
      ssBenefit: 50000,
      otherPretaxWithdrawal: 30000,
    });
    expect(r.grossWithdrawal).toBe(0);
    expect(r.afterTaxFromOtherSources).toBeCloseTo(75846.5, 6);
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0.222, 4);
  });
});

describe('solveGrossWithdrawal — solver properties', () => {
  it('achieved after-tax income matches the target across many inputs', () => {
    const cases = [
      { targetAfterTaxIncome: 30000, ssBenefit: 0 },
      { targetAfterTaxIncome: 80000, ssBenefit: 25000, otherPretaxWithdrawal: 15000 },
      { targetAfterTaxIncome: 120000, ssBenefit: 35000, otherPretaxWithdrawal: 20000, otherTaxableWithdrawal: 8000, otherRothWithdrawal: 5000 },
      { targetAfterTaxIncome: 300000, ssBenefit: 40000 },
    ];
    for (const status of ['single', 'mfj']) {
      for (const c of cases) {
        const r = solveGrossWithdrawal({ filingStatus: status, year: 2025, ...c });
        expect(r.achievedAfterTaxIncome).toBeCloseTo(c.targetAfterTaxIncome, 2);
      }
    }
  });

  it('required gross withdrawal never falls as the target rises (and is 0 while SS alone covers it)', () => {
    let previous = 0;
    for (let target = 20000; target <= 200000; target += 10000) {
      const g = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: target, ssBenefit: 30000 }).grossWithdrawal;
      if (target <= 30000) expect(g).toBe(0); // combined income 15,000: SS untaxed, fully covers target
      else expect(g).toBeGreaterThan(previous);
      previous = g;
    }
  });

  it('the blended rate is always between 0 and the steepest possible marginal rate', () => {
    for (let target = 10000; target <= 400000; target += 15000) {
      const r = solveGrossWithdrawal({ ...base, targetAfterTaxIncome: target, ssBenefit: 30000, otherPretaxWithdrawal: 10000 });
      expect(r.retirementEffectiveTaxRate).toBeGreaterThanOrEqual(0);
      expect(r.retirementEffectiveTaxRate).toBeLessThan(0.37 * 1.85);
    }
  });
});
