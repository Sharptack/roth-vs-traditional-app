import { describe, it, expect } from 'vitest';
import { evaluateBlend, findOptimalBlend, splitBlended } from '../src/lib/blend.js';
import { splitAtTakeHome } from '../src/lib/compare.js';

describe('splitBlended (HAND CALC)', () => {
  it('uncapped: C=7,800, t=22%, limit=23,500, r=0.5 splits the account 50/50', () => {
    // keepFactor = 1 - (1-0.5)*0.22 = 0.89; A = 7800/0.89 = 8,764.044943820225
    // rothToAccount = pretaxToAccount = A/2 = 4,382.022471910112
    // costOfAccount = A*0.89 = 7800 exactly -> excess = 0
    const r = splitBlended(7800, 0.22, 23500, 0.5);
    expect(r.rothToAccount).toBeCloseTo(4382.02, 1);
    expect(r.pretaxToAccount).toBeCloseTo(4382.02, 1);
    expect(r.excessToTaxable).toBeCloseTo(0, 6);
  });

  it('capped: C=30,000, t=24%, limit=23,500, r=0.6 caps the account and spills the rest', () => {
    // A_uncapped = 30000 / (1 - 0.4*0.24) = 30000/0.904 = 33,185.8407... > limit -> capped at 23,500
    // rothToAccount = 0.6*23500 = 14,100; pretaxToAccount = 0.4*23500 = 9,400 (both exact)
    // costOfAccount = 14100 + 9400*0.76 = 14100 + 7144 = 21,244 (exact)
    // excessToTaxable = 30000 - 21244 = 8,756 (exact)
    const r = splitBlended(30000, 0.24, 23500, 0.6);
    expect(r.rothToAccount).toBe(14100);
    expect(r.pretaxToAccount).toBe(9400);
    expect(r.excessToTaxable).toBeCloseTo(8756, 6);
  });

  it('PROPERTY: r=0 and r=1 exactly reproduce splitAtTakeHome\'s pretax/roth branches', () => {
    // Proven algebraically (see blend.js's comment): at r=0, A_uncapped = C/(1-t), the same
    // formula splitAtTakeHome uses for the Pre-tax-equivalent; at r=1, A_uncapped = C, the same
    // formula it uses for the Roth-equivalent. True for any C/t/limit, capped or not.
    for (const takeHomeCost of [0, 5000, 7800, 17860, 24360, 100000]) {
      for (const marginalRate of [0, 0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]) {
        for (const limit of [7000, 23500, 34750]) {
          // Reconstruct the ORIGINAL savings/currentType splitAtTakeHome expects, working
          // backwards from a Pre-tax-currently saver whose cost is exactly `takeHomeCost` at
          // this rate (when under the limit) — simplest way to get a directly comparable call.
          const savings = takeHomeCost / (1 - marginalRate);
          const viaPretax = splitAtTakeHome(savings, 'pretax', marginalRate, limit);
          const viaRoth = splitAtTakeHome(viaPretax.takeHomeCost, 'roth', marginalRate, limit);
          const blendAtZero = splitBlended(viaPretax.takeHomeCost, marginalRate, limit, 0);
          const blendAtOne = splitBlended(viaPretax.takeHomeCost, marginalRate, limit, 1);
          const label = JSON.stringify({ takeHomeCost, marginalRate, limit });
          expect(blendAtZero.pretaxToAccount, label).toBeCloseTo(viaPretax.pretax.toAccount, 6);
          expect(blendAtZero.rothToAccount, label).toBeCloseTo(0, 6);
          expect(blendAtZero.excessToTaxable, label).toBeCloseTo(viaPretax.pretax.excessToTaxable, 6);
          expect(blendAtOne.rothToAccount, label).toBeCloseTo(viaRoth.roth.toAccount, 6);
          expect(blendAtOne.pretaxToAccount, label).toBeCloseTo(0, 6);
          expect(blendAtOne.excessToTaxable, label).toBeCloseTo(viaRoth.roth.excessToTaxable, 6);
        }
      }
    }
  });
});

describe('evaluateBlend — end-to-end HAND CALC (no SS, no Existing Accounts)', () => {
  // Single, 2025, 35 -> 65 (30y, 7%; annuity factor 94.4607862), marginal rate 22%, take-home
  // budget C = 7,800 (the exact cost of the $100,000/$10,000-Pre-tax baseline used throughout
  // compare.test.js). No Social Security, no Existing Accounts, so existingTax = 0.
  const params = {
    takeHomeCost: 7800,
    marginalRate: 0.22,
    limit: 23500,
    returnRate: 0.07,
    years: 30,
    other: { pretaxGross: 0, taxableGross: 0, taxableGains: 0 },
    existingTax: 0,
    ssBenefit: 0,
    filingStatus: 'single',
    year: 2025,
  };

  it('r=0 (all Pre-tax) exactly matches the already-verified baseline: $35,378.69', () => {
    // Matches compare.test.js's baseInputs pretax scenario exactly: W = 37,784.31, tax =
    // 2,405.62, afterTax = 35,378.69 (no side account, since C=7,800 is well under the limit).
    const p = evaluateBlend({ ...params, rothShare: 0 });
    expect(p.pretaxToAccount).toBeCloseTo(10000, 1); // C/(1-t) = 7800/0.78 = 10,000
    expect(p.rothToAccount).toBeCloseTo(0, 6);
    expect(p.pretaxWithdrawal).toBeCloseTo(37784.31, 1);
    expect(p.extraTax).toBeCloseTo(2405.62, 1);
    expect(p.totalAfterTaxIncome).toBeCloseTo(35378.69, 1);
  });

  it('r=1 (all Roth) exactly matches the already-verified baseline: $29,471.77', () => {
    const p = evaluateBlend({ ...params, rothShare: 1 });
    expect(p.rothToAccount).toBeCloseTo(7800, 6); // = C exactly
    expect(p.pretaxToAccount).toBeCloseTo(0, 6);
    expect(p.rothWithdrawal).toBeCloseTo(29471.77, 1);
    expect(p.extraTax).toBe(0);
    expect(p.totalAfterTaxIncome).toBeCloseTo(29471.77, 1);
  });

  it('r=0.5 (even account split): $33,033.63', () => {
    // A = 7800/0.89 = 8,764.044943820225; roth = pretax = A/2 = 4,382.022471910112
    // FV(4,382.022471910112) = 4,382.022471910112 x 94.4607862 = 413,929.29
    // withdrawal each = 4% x 413,929.29 = 16,557.17
    // taxable = 16,557.17 - 15,750 (std deduction) = 807.17, all in the 10% bracket -> tax 80.72
    // total = 16,557.17 (Roth, tax-free) + 16,557.17 (Pre-tax gross) - 80.72 = 33,033.63
    const p = evaluateBlend({ ...params, rothShare: 0.5 });
    expect(p.rothToAccount).toBeCloseTo(4382.02, 1);
    expect(p.pretaxToAccount).toBeCloseTo(4382.02, 1);
    expect(p.rothWithdrawal).toBeCloseTo(16557.17, 1);
    expect(p.pretaxWithdrawal).toBeCloseTo(16557.17, 1);
    expect(p.extraTax).toBeCloseTo(80.72, 1);
    expect(p.totalAfterTaxIncome).toBeCloseTo(33033.63, 1);
  });

  it('is monotonically decreasing from r=0 to r=1 in this low-withdrawal case — no interior optimum', () => {
    // Consistent with the app's established finding that Pre-tax wins outright at this income:
    // the effective rate stays well under marginal-now (22%) across the whole account here, so
    // there is nothing for a blend to find — the pure Pre-tax strategy already is optimal.
    const values = [0, 0.25, 0.5, 0.75, 1].map(
      (rothShare) => evaluateBlend({ ...params, rothShare }).totalAfterTaxIncome,
    );
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
  });
});

describe('evaluateBlend — a genuine interior optimum (HAND CALC)', () => {
  // Single, 2025, $60,000 income (12% marginal), $10,000 saved, a KNOWN $24,000... no, $20,000
  // Social Security benefit, no Existing Accounts. Take-home cost C = 8,800 (the equivalent
  // cost of the $10,000 Pre-tax contribution at this 12% marginal rate: 10,000 x 0.88 = 8,800).
  // This is exactly the phenomenon blend.js exists for: Social Security's phase-in makes the
  // effective rate on the Pre-tax slice CLIMB as that slice grows, so a mix beats either pure
  // strategy.
  const params = {
    takeHomeCost: 8800,
    marginalRate: 0.12,
    limit: 23500,
    returnRate: 0.07,
    years: 30,
    other: { pretaxGross: 0, taxableGross: 0, taxableGains: 0 },
    existingTax: 0,
    ssBenefit: 20000,
    filingStatus: 'single',
    year: 2025,
  };

  it('r=0.5 beats BOTH pure endpoints', () => {
    // keepFactor = 1 - 0.5*0.12 = 0.94; A = 8800/0.94 = 9,361.702127659574
    // roth = pretax = A/2 = 4,680.851063829787; note A/2 x 94 = 440,000 exactly (94/0.94 = 100)
    // FV each = 440,000 + 4,680.851063829787 x 0.4607862 = 442,156.87
    // withdrawal each = 4% x 442,156.87 = 17,686.27
    // combined income for the SS test = 17,686.27 + 0.5 x 20,000 = 27,686.27, in the 50% tier
    //   (between $25,000 and $34,000): taxableSS = min(0.5 x 2,686.27, 0.5 x 20,000) = 1,343.14
    // ordinary taxable = 17,686.27 + 1,343.14 - 15,750 = 3,279.41 -> tax (10% bracket) = 327.94
    // total = 17,686.27 (Roth) + 17,686.27 (Pre-tax) - 327.94 = 35,044.61
    const half = evaluateBlend({ ...params, rothShare: 0.5 });
    expect(half.rothToAccount).toBeCloseTo(4680.85, 1);
    expect(half.rothWithdrawal).toBeCloseTo(17686.27, 1);
    expect(half.extraTax).toBeCloseTo(327.94, 1);
    expect(half.totalAfterTaxIncome).toBeCloseTo(35044.61, 1);

    const pure0 = evaluateBlend({ ...params, rothShare: 0 });
    const pure1 = evaluateBlend({ ...params, rothShare: 1 });
    expect(half.totalAfterTaxIncome).toBeGreaterThan(pure0.totalAfterTaxIncome);
    expect(half.totalAfterTaxIncome).toBeGreaterThan(pure1.totalAfterTaxIncome);
  });

  it('findOptimalBlend locates the interior optimum, not either end', () => {
    const { best } = findOptimalBlend(params);
    expect(best.rothShare).toBeGreaterThan(0.3);
    expect(best.rothShare).toBeLessThan(0.8);
    // beats both pure strategies by a real amount, not a rounding artifact
    const pure0 = evaluateBlend({ ...params, rothShare: 0 });
    const pure1 = evaluateBlend({ ...params, rothShare: 1 });
    expect(best.totalAfterTaxIncome).toBeGreaterThan(pure0.totalAfterTaxIncome + 1000);
    expect(best.totalAfterTaxIncome).toBeGreaterThan(pure1.totalAfterTaxIncome + 1000);
  });
});

describe('findOptimalBlend', () => {
  const params = {
    takeHomeCost: 7800,
    marginalRate: 0.22,
    limit: 23500,
    returnRate: 0.07,
    years: 30,
    other: { pretaxGross: 0, taxableGross: 0, taxableGains: 0 },
    existingTax: 0,
    ssBenefit: 0,
    filingStatus: 'single',
    year: 2025,
  };

  it('returns steps points from 0 to 1 inclusive, and the best one by totalAfterTaxIncome', () => {
    const { points, best } = findOptimalBlend(params, 11);
    expect(points).toHaveLength(11);
    expect(points[0].rothShare).toBe(0);
    expect(points[10].rothShare).toBe(1);
    expect(best.totalAfterTaxIncome).toBe(Math.max(...points.map((p) => p.totalAfterTaxIncome)));
  });

  it('finds r=0 as optimal in the monotonically-decreasing baseline case', () => {
    const { best } = findOptimalBlend(params);
    expect(best.rothShare).toBe(0);
    expect(best.totalAfterTaxIncome).toBeCloseTo(35378.69, 1);
  });

  it('defaults to 101 steps (1% resolution)', () => {
    const { points } = findOptimalBlend(params);
    expect(points).toHaveLength(101);
  });
});
