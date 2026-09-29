import { describe, it, expect } from 'vitest';
import { explainWithdrawalRate, solveGrossWithdrawal } from '../src/lib/incomeNeed.js';

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

  it('other taxable-account income is taxed via the real capital-gains brackets and counts toward SS taxability', () => {
    // other taxable 40,000, SS 20,000. combined = 40,000 + 10,000 = 50,000
    //   taxable SS = min(17,000, 4,500 + 0.85 x 16,000 = 18,100) = 17,000
    //   ordinary T = 17,000 - 15,750 = 1,250 -> ordinary tax 125
    //   capital gains: grossOrdinaryIncome = 0 (pretax) + 17,000 (taxable SS) = 17,000
    //     total taxable income = 17,000 + 40,000 - 15,750 = 41,250, under the $48,350
    //     0% threshold (single, 2025) the WHOLE way, so CG tax = $0 (not a flat 15%).
    //   net(G=0) = 40,000 + 20,000 - 0 - 125 = 59,875
    const r = solveGrossWithdrawal({
      ...base,
      targetAfterTaxIncome: 59875,
      ssBenefit: 20000,
      otherTaxableWithdrawal: 40000,
    });
    expect(r.grossWithdrawal).toBe(0);
    expect(r.afterTaxFromOtherSources).toBeCloseTo(59875, 6);
    expect(r.baseStack.capitalGainsTax).toBe(0);
    expect(r.baseStack.ordinaryTax).toBeCloseTo(125, 6);
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

describe('solveGrossWithdrawal — capital gains stack on top of ordinary income (HAND CALC)', () => {
  // Capital gains brackets apply to TOTAL taxable income (ordinary + gains), with gains
  // stacked on top. That means withdrawing more from THIS account can push a fixed
  // taxable-account withdrawal from the 0% capital-gains bracket into the 15% bracket —
  // a real cost that a flat capital-gains rate would miss entirely.
  it('a withdrawal fully sheltered from ordinary tax can still cost 15% (+3.8% NIIT), by using up deduction room that would have sheltered gains (HAND CALC)', () => {
    // No SS, other taxable withdrawal $300,000 (single, 2025; standard deduction $15,750;
    // gains brackets 0% <= 48,350, 15% 48,350–533,400).
    //   G = 0: total taxable = 300,000 - 15,750 = 284,250. Gains stack [0, 284,250]:
    //     0% x 48,350 + 15% x (284,250 - 48,350 = 235,900) = 35,385
    //   G = 10,000: G alone is fully sheltered by the deduction (10,000 < 15,750), so it adds
    //     $0 of ORDINARY tax — but it uses up $10,000 of deduction room that used to shelter
    //     gains. total taxable = 310,000 - 15,750 = 294,250. Gains stack [0, 294,250]:
    //     15% x (294,250 - 48,350 = 245,900) = 36,885
    //   extra capital-gains tax caused by G = 36,885 - 35,385 = 1,500 (15% of G),
    //   even though G's own ordinary bracket is 0% (still under the standard deduction).
    // NIIT (3.8% x the smaller of gains and MAGI above 200,000): G also raises MAGI.
    //   G = 0:      MAGI 300,000 -> excess 100,000 (< 300,000 of gains) -> 3,800
    //   G = 10,000: MAGI 310,000 -> excess 110,000 -> 4,180   (extra 380 = 3.8% of G)
    //   total tax: G = 0 -> 35,385 + 3,800 = 39,185; G = 10,000 -> 36,885 + 4,180 = 41,065
    //   extra tax = 1,500 + 380 = 1,880  ->  effective rate = 1,880 / 10,000 = 18.8%
    //   net(G=10,000) = 10,000 + 300,000 - 41,065 = 268,935
    const r = solveGrossWithdrawal({
      filingStatus: 'single',
      year: 2025,
      targetAfterTaxIncome: 268935,
      otherTaxableWithdrawal: 300000,
    });
    expect(r.grossWithdrawal).toBeCloseTo(10000, 0);
    expect(r.baseStack.capitalGainsTax).toBeCloseTo(35385, 1);
    expect(r.baseStack.ordinaryTax).toBe(0);
    expect(r.solutionStack.capitalGainsTax).toBeCloseTo(36885, 1);
    expect(r.solutionStack.ordinaryTax).toBe(0);
    expect(r.baseStack.niit).toBeCloseTo(3800, 1);
    expect(r.solutionStack.niit).toBeCloseTo(4180, 1);
    expect(r.totalTaxPaid).toBeCloseTo(41065, 1);
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0.188, 3);
  });

  it('with no other taxable-account balance, this interaction disappears (baseline sanity check)', () => {
    const r = solveGrossWithdrawal({
      filingStatus: 'single',
      year: 2025,
      targetAfterTaxIncome: 20000,
    });
    expect(r.baseStack.capitalGainsTax).toBe(0);
    expect(r.solutionStack.capitalGainsTax).toBe(0);
  });
});

describe('solveGrossWithdrawal — probeSize (the reported rate when G = 0 should match the withdrawal it will be applied to)', () => {
  // Single, 2025, SS $40,000, no other pretax/taxable income, target $30,000 (well under
  // what SS alone delivers after tax, so G = 0 in every case below — only probeSize differs).
  const base = { targetAfterTaxIncome: 30000, ssBenefit: 40000, filingStatus: 'single', year: 2025 };

  it('a tiny $1,000 (default) probe reads 0%, because it never leaves the SS 0%-taxable zone (HAND CALC)', () => {
    // combined income at g=1,000: 1,000 + 0.5 x 40,000 = 21,000, under the $25,000 threshold
    // -> 0% of SS taxable -> ordinaryTaxableIncome 0 (well under the $15,750 deduction) -> $0 tax.
    const r = solveGrossWithdrawal(base); // probeSize defaults to 1,000
    expect(r.grossWithdrawal).toBe(0);
    expect(r.retirementEffectiveTaxRate).toBe(0);
  });

  it('a $10,000 probe ALSO reads 0%, even though it crosses into the 50% SS phase-in tier (HAND CALC)', () => {
    // combined at g=10,000: 10,000 + 20,000 = 30,000 (in the 50% tier, between 25k and 34k)
    // -> taxableSS = min(0.5 x (30,000-25,000)=2,500, 0.5 x 40,000) = 2,500
    // -> ordinaryTaxableIncome = max(0, 10,000 + 2,500 - 15,750) = 0 (still under the deduction) -> $0 tax
    const r = solveGrossWithdrawal({ ...base, probeSize: 10000 });
    expect(r.retirementEffectiveTaxRate).toBe(0);
  });

  it('a $20,000 probe — closer to a real account withdrawal — correctly reads 7.12%, NOT 0% (HAND CALC)', () => {
    // combined at g=20,000: 20,000 + 20,000 = 40,000 (past the $34,000 85% threshold)
    // -> taxableSS = min(0.85 x 40,000=34,000, 0.85 x (40,000-34,000=6,000) + 4,500 = 9,600) = 9,600
    // -> ordinaryTaxableIncome = 20,000 + 9,600 - 15,750 = 13,850 (now positive)
    // -> tax = 10% x 11,925 + 12% x (13,850-11,925=1,925) = 1,192.50 + 231 = 1,423.50
    // -> rate = 1,423.50 / 20,000... wait, rate = (probe - gained)/probe where gained = probe - tax
    //    i.e. rate = tax / probe = 1,423.50 / 20,000 = 0.071175 = 7.1175%
    const r = solveGrossWithdrawal({ ...base, probeSize: 20000 });
    expect(r.retirementEffectiveTaxRate).toBeCloseTo(0.071175, 6);
  });

  it('this demonstrates exactly the confusing case a $1,000 probe can hide: a small, arbitrary probe', () => {
    // can silently understate the true cost of the withdrawal size the rate actually gets applied
    // to elsewhere (compare.js applies it to the account's own 4% annual withdrawal).
    const tiny = solveGrossWithdrawal({ ...base, probeSize: 1000 });
    const realistic = solveGrossWithdrawal({ ...base, probeSize: 20000 });
    expect(tiny.retirementEffectiveTaxRate).toBe(0);
    expect(realistic.retirementEffectiveTaxRate).toBeGreaterThan(0.07);
  });

  it('exposes the actual probe arithmetic (probeStack/probeExtraTax), not just the rate (HAND CALC)', () => {
    // Same scenario as the $20,000-probe case above: tax on the probe = 1,423.50.
    const r = solveGrossWithdrawal({ ...base, probeSize: 20000 });
    expect(r.probeSize).toBe(20000);
    expect(r.baseStack.totalTax).toBe(0);
    expect(r.probeStack.totalTax).toBeCloseTo(1423.5, 1);
    expect(r.probeExtraTax).toBeCloseTo(1423.5, 1);
    expect(r.probeExtraTax / r.probeSize).toBeCloseTo(r.retirementEffectiveTaxRate, 10);
    // solutionStack correctly stays at $0 (literally nothing is withdrawn) — it must
    // never be confused with the probe, which is hypothetical.
    expect(r.solutionStack.totalTax).toBe(0);
    expect(r.totalTaxPaid).toBe(0);
  });

  it('a zero or negative probeSize falls back to the $1,000 default rather than dividing by zero', () => {
    expect(() => solveGrossWithdrawal({ ...base, probeSize: 0 })).not.toThrow();
    expect(solveGrossWithdrawal({ ...base, probeSize: 0 }).retirementEffectiveTaxRate).toBe(
      solveGrossWithdrawal(base).retirementEffectiveTaxRate,
    );
  });

  it('probeSize is irrelevant (has no effect) once G > 0 — only the G = 0 fallback uses it', () => {
    const bigTarget = { ...base, targetAfterTaxIncome: 90000 }; // forces G > 0
    const a = solveGrossWithdrawal({ ...bigTarget, probeSize: 1000 });
    const b = solveGrossWithdrawal({ ...bigTarget, probeSize: 50000 });
    expect(a.grossWithdrawal).toBeGreaterThan(0);
    expect(a.retirementEffectiveTaxRate).toBeCloseTo(b.retirementEffectiveTaxRate, 10);
  });
});

describe('explainWithdrawalRate — what sets the effective rate (2026 single, HAND CALC)', () => {
  // 2026 single: standard deduction 16,100; brackets 10% to 12,400, 12% to 50,400.
  // Capital gains 0% up to 49,450 of taxable income, then 15%.
  const explain = (args) => {
    const g = solveGrossWithdrawal({ filingStatus: 'single', year: 2026, ...args });
    return { g, d: explainWithdrawalRate(g, { otherPretaxWithdrawal: args.otherPretaxWithdrawal ?? 0, filingStatus: 'single', year: 2026 }) };
  };

  it('other Pre-tax income is taxed first, so the withdrawal starts in a higher bracket', () => {
    // Other Pre-tax 20,000, target 0 (G = 0) -> read on a 10,000 probe.
    //   before: 20,000 - 16,100 = 3,900 taxable -> tax 390; whole deduction used; next dollar 10%
    //   after:  30,000 - 16,100 = 13,900 -> 1,240 + 12% x 1,500 = 1,420; last dollar 12%
    //   extra tax 1,030 -> rate 10.3%
    const { g, d } = explain({ targetAfterTaxIncome: 0, otherPretaxWithdrawal: 20000, probeSize: 10000 });
    expect(d.hypothetical).toBe(true);
    expect(d.withdrawal).toBe(10000);
    expect(d.ordinaryIncomeBefore).toBe(20000);
    expect(d.deductionUsedBefore).toBe(16100);
    expect(d.startBracket).toBe(0.1);
    expect(d.endBracket).toBe(0.12);
    expect(d.extraOrdinaryTax).toBeCloseTo(1030, 6);
    expect(d.extraCapitalGainsTax).toBe(0);
    expect(d.extraTax).toBeCloseTo(1030, 6);
    expect(g.retirementEffectiveTaxRate).toBeCloseTo(0.103, 10);
  });

  it('with nothing taxed first, the withdrawal starts under the standard deduction (0%)', () => {
    // No other income, target 20,000 after tax. In the 10% bracket: net = T + 16,100 - 0.1 T = 20,000
    //   T = 3,900 / 0.9 = 4,333.33;  G = 20,433.33;  extra tax = 433.33
    const { d } = explain({ targetAfterTaxIncome: 20000 });
    expect(d.hypothetical).toBe(false);
    expect(d.withdrawal).toBeCloseTo(20433.33, 1);
    expect(d.ordinaryIncomeBefore).toBe(0);
    expect(d.deductionUsedBefore).toBe(0);
    expect(d.startBracket).toBe(0);
    expect(d.endBracket).toBe(0.1);
    expect(d.extraTax).toBeCloseTo(433.33, 1);
  });

  it('the withdrawal pushes taxable-account gains from 0% into 15%, and that tax counts', () => {
    // Other Pre-tax 16,100 (fills the deduction exactly), taxable-account withdrawal 45,000, probe 10,000.
    //   before: ordinary taxable 0; gains stack 0 -> 45,000, all under 49,450 -> 0 gains tax
    //   after:  ordinary taxable 10,000 -> tax 1,000; gains stack 10,000 -> 55,000:
    //           39,450 at 0%, 5,550 at 15% = 832.50
    //   extra tax 1,832.50 -> rate 18.325% on a withdrawal whose own bracket is 10%
    const { g, d } = explain({
      targetAfterTaxIncome: 0,
      otherPretaxWithdrawal: 16100,
      otherTaxableWithdrawal: 45000,
      probeSize: 10000,
    });
    expect(d.startBracket).toBe(0.1);
    expect(d.endBracket).toBe(0.1);
    expect(d.extraOrdinaryTax).toBeCloseTo(1000, 6);
    expect(d.extraCapitalGainsTax).toBeCloseTo(832.5, 6);
    expect(g.retirementEffectiveTaxRate).toBeCloseTo(0.18325, 10);
  });

  it('reports the Social Security the withdrawal pulls into taxable income', () => {
    // SS 20,000, no other income, probe 20,000. Before: combined 10,000 < 25,000 -> 0 taxable.
    //   After: combined 20,000 + 10,000 = 30,000 -> 50% x (30,000 - 25,000) = 2,500 taxable
    //   ordinary 22,500 - 16,100 = 6,400 -> tax 640
    const { d } = explain({ targetAfterTaxIncome: 0, ssBenefit: 20000, probeSize: 20000 });
    expect(d.taxableSSBefore).toBe(0);
    expect(d.extraTaxableSS).toBeCloseTo(2500, 6);
    expect(d.extraTax).toBeCloseTo(640, 6);
  });
});
