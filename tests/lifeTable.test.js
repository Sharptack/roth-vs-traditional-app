import { describe, it, expect } from 'vitest';
import { deathRates, lifeExpectancy, survival, survivalCurve } from '../src/lib/lifeTable.js';
import { irr, pensionOnLifeTable, pensionPayments, pensionResult } from '../src/lib/pensionCalculator.js';

// Hand-made tables (the plan: "the pension's survival-weighted value on a short hand-made table").
// diesAt(n): no deaths before age n, certain death at n (survival falls to 0 in n's first month).
const diesAt = (n) => Array.from({ length: n + 1 }, (_, a) => (a < n ? 0 : 1));

describe('life tables (HAND CALC)', () => {
  it('survival within per year falls as (1 − q)^(months/12)', () => {
    const qs = [0, 0, 0.5, 1]; // ages 0-3
    expect(survival(qs, 2, 12)).toBeCloseTo(0.5, 12);
    expect(survival(qs, 2, 6)).toBeCloseTo(Math.SQRT1_2, 12); // 0.5^(1/2)
    expect(survival(qs, 0, 30)).toBeCloseTo(Math.SQRT1_2, 12); // two safe years, then half per year at q 0.5
    expect(survival(qs, 3, 1)).toBe(0);
    expect(survival(qs, 4, 1)).toBe(0); // past the table
  });

  it('life expectancy: certain death in the first month at 70, from 65: 5 years and half per month', () => {
    // 60 whole months, then the month the death falls in counts half (deaths spread through it)
    expect(lifeExpectancy(diesAt(70), 65)).toBeCloseTo(5 + 1 / 24, 12);
    expect(survivalCurve(diesAt(70), 65)).toHaveLength(1 + 6 * 12);
  });

  it('no sex entered: the average of the two tables', () => {
    expect(deathRates({ male: [0.2, 1], female: [0.1, 1] }, '')).toEqual([0.15000000000000002, 1]);
    expect(deathRates({ male: [0.2, 1], female: [0.1, 1] }, 'female')).toEqual([0.1, 1]);
  });
});

describe('the pension on life expectancy (HAND CALC)', () => {
  const offer = { lumpSum: 100000, monthly: 1000, startAge: 65, cola: 0.02 };

  it('a certain death at 70 gives exactly the fixed-end-age answer to 70', () => {
    const fixed = pensionResult({ ...offer, endAge: 70 });
    const table = pensionOnLifeTable(offer, diesAt(70));
    expect(table.irr).toBeCloseTo(fixed.irr, 10);
    expect(table.expectedPayments).toBeCloseTo(fixed.totalPayments, 6);
    expect(table.lifeExpectancy).toBeCloseTo(5 + 1 / 24, 12);
  });

  it('with a spouse: the survivor share runs while the spouse lives on after the owner', () => {
    // owner dies at 70 (5 years), spouse 63 at the start dies at 75: 7 more years after the owner, at 50%
    const withSpouse = { ...offer, survivorShare: 0.5, spouseAgeAtStart: 63 };
    const fixed = pensionPayments({ ...withSpouse, endAge: 70, spouseEndAge: 75 });
    const table = pensionOnLifeTable(withSpouse, diesAt(70), diesAt(75));
    expect(table.expectedPayments).toBeCloseTo(fixed.payments.reduce((a, p) => a + p, 0), 6);
    expect(table.irr).toBeCloseTo(((1 + irr([-100000, ...fixed.payments])) ** 12) - 1, 10);
  });

  it('an uncertain year: each payment times the chance of being alive for it', () => {
    // q 0.5 at 65, certain death at 66: month m pays 1,000 × 0.5^(m/12), m = 1..12
    //   sum = 1,000 × Σ 2^(−m/12) = 1,000 × (2^(−1/12) × (1 − 2^(−1))) / (1 − 2^(−1/12)) = 8,422.16...
    const qs = [...diesAt(66).slice(0, 65), 0.5, 1];
    const r = pensionOnLifeTable({ lumpSum: 5000, monthly: 1000, startAge: 65 }, qs);
    const hand = (1000 * (2 ** (-1 / 12) * (1 - 0.5))) / (1 - 2 ** (-1 / 12));
    expect(r.expectedPayments).toBeCloseTo(hand, 6);
    expect(r.flows[0]).toBeCloseTo(1000 * 0.5 ** (1 / 12), 9);
    expect(r.flows).toHaveLength(24); // to the end of the table (age 66's year: nothing paid)
    expect(r.flows[12]).toBe(0);
  });
});

describe('the SSA table as copied', () => {
  it("rebuilds SSA's number of lives and comes within a week of its life expectancy to 90", async () => {
    const { LIFE_TABLE, SSA_LIFE_EXPECTANCY } = await import('../src/data/lifeTable.js');
    expect(LIFE_TABLE.male).toHaveLength(120);
    expect(LIFE_TABLE.female).toHaveLength(120);
    // lives from 100,000 at birth: SSA prints 79,084 men and 87,399 women at 65, 50,785 / 64,606 at 80
    const lives = (qs, age) => qs.slice(0, age).reduce((l, q) => l * (1 - q), 100000);
    expect(Math.round(lives(LIFE_TABLE.male, 65))).toBe(79084);
    expect(Math.round(lives(LIFE_TABLE.male, 80))).toBe(50785);
    expect(Math.abs(lives(LIFE_TABLE.female, 65) - 87399)).toBeLessThan(1);
    expect(Math.round(lives(LIFE_TABLE.female, 80))).toBe(64606);
    for (const sex of ['male', 'female']) {
      for (const [age, e] of Object.entries(SSA_LIFE_EXPECTANCY[sex])) {
        const ours = lifeExpectancy(LIFE_TABLE[sex], Number(age));
        expect(Math.abs(ours - e), `${sex} ${age}`).toBeLessThan(Number(age) <= 90 ? 0.025 : 0.05);
      }
    }
  });
});
