import { describe, it, expect } from 'vitest';
import { extraThroughTwoBrackets, rateProfile } from '../src/lib/rateProfile.js';

const at = (profile, income) => profile.rows.find((r) => Math.abs(r.income - income) < 1e-6);

describe('rateProfile: the two buckets (2026, HAND CALC)', () => {
  // single, 67, $30,000 of Social Security; ordinary income added on top (x), total income y = x + 30,000.
  // Deductions 16,100 + 2,050 (65+) + 6,000 (senior, below $75,000 MAGI) = 24,150.
  // Taxable SS: 50% band for provisional (x + 15,000) 25,000-34,000, then 85% (4,500 + 85% over 34,000)
  // until it reaches 85% × 30,000 = 25,500.
  const params = { filingStatus: 'single', year: 2026, people: [{ age: 67 }], income: { socialSecurity: 30000 } };
  const profile = rateProfile(params, { step: 500, irmaa: true, ages: [67], extra: 100000 }); // to $130,000

  it('the real rate on the next dollar: the torpedo, then the brackets, then the senior phase-out', () => {
    // y 55,000: x 25,000, provisional 40,000 -> taxable SS 4,500 + 85% × 6,000 = 9,600; ordinary 34,600,
    //   taxable 10,450 (10%) -> each dollar adds 1.85 taxable: 18.5%
    expect(at(profile, 55000).nextRate).toBeCloseTo(0.185, 9);
    expect(at(profile, 55000).bracket).toBe(0.1);
    // y 60,000: x 30,000 -> taxable SS 13,850; ordinary 43,850, taxable 19,700 (12%): 1.85 × 12% = 22.2%
    expect(at(profile, 60000).nextRate).toBeCloseTo(0.222, 9);
    // y 76,000: x 46,000 -> SS fully 85% taxable (25,500); ordinary 71,500, taxable 47,350 (12%), MAGI under 75,000: 12%
    expect(at(profile, 76000).nextRate).toBeCloseTo(0.12, 9);
    // y 90,000: x 60,000, MAGI 85,500 -> the senior deduction loses 6¢ a dollar: 22% × 1.06 = 23.32%
    expect(at(profile, 90000).nextRate).toBeCloseTo(0.2332, 9);
    expect(at(profile, 90000).bracket).toBe(0.22);
  });

  it('the sheltered bottom, today, and the room left', () => {
    // today: Social Security alone, provisional 15,000: nothing taxable, all sheltered
    expect(profile.today).toBe(30000);
    expect(at(profile, 0).sheltered).toBe(true);
    expect(at(profile, 0).nextRate).toBe(0);
    expect(profile.now.bracket).toBe(0);
    // the room under the deductions: 24,150 of deductions, nothing of them used yet
    expect(profile.now.room).toBe(24150);
  });

  it('runs through the next two brackets: from 0% (sheltered), through 10% and 12%', () => {
    // two brackets above the sheltered part: the top of 12% (taxable 50,400). Ordinary 50,400 + 24,150 =
    // 74,550 = x + 25,500 -> x 49,050 -> y 79,050.
    expect(extraThroughTwoBrackets(params)).toBe(49050);
    expect(rateProfile(params).top).toBe(79050);
  });

  it('IRMAA: one cliff up to $130,000, where MAGI (y − 4,500) passes $109,000, at y 113,500', () => {
    const jumps = profile.rows.filter((r) => r.irmaaJump > 0);
    expect(jumps).toHaveLength(1);
    expect([113000, 113500]).toContain(jumps[0].income);
    // without the option, no IRMAA
    expect(rateProfile(params, { step: 500, extra: 100000 }).rows.every((r) => r.irmaaJump === 0)).toBe(true);
  });

  it('a worker: the bucket below today is their own pay, built up from $0', () => {
    // single, $100,000 of wages: at y 50,000 (half the pay) taxable 33,900 (12%); at y 90,000 taxable 73,900 (22%)
    const w = rateProfile({ filingStatus: 'single', year: 2026, people: [{ wages: 100000 }] }, { step: 1000 });
    expect(at(w, 50000).bracket).toBe(0.12);
    expect(at(w, 50000).nextRate).toBeCloseTo(0.12, 9);
    expect(at(w, 90000).nextRate).toBeCloseTo(0.22, 9);
    // today taxable 83,900: 21,800 of room left in 22% (to 105,700); the next ordinary dollar 22%
    expect(w.now.room).toBe(21800);
    expect(w.now.nextRate).toBeCloseTo(0.22, 9);
    // through the two brackets above today's 22%: 24% and 32%, to taxable 256,225: 256,225 − 83,900 = 172,325 more
    expect(extraThroughTwoBrackets({ filingStatus: 'single', year: 2026, people: [{ wages: 100000 }] })).toBe(172325);
  });

  it('capital gains view: the 0% / 15% / 20% brackets on taxable income', () => {
    // single, $40,000 of pension (taxable 23,900): gains at 0% up to taxable 49,450, then 15%
    const g = rateProfile({ filingStatus: 'single', year: 2026, income: { ordinaryIncome: 40000 } }, { source: 'preferentialIncome', step: 1000 });
    // y 45,000: 5,000 of gains, taxable 28,900: 0%
    expect(at(g, 45000).nextRate).toBeCloseTo(0, 9);
    expect(at(g, 45000).bracket).toBe(0);
    // y 70,000: 30,000 of gains, taxable 53,900: 15%
    expect(at(g, 70000).nextRate).toBeCloseTo(0.15, 9);
    expect(at(g, 70000).bracket).toBe(0.15);
  });
});

describe('rateProfile: a Pre-tax 401(k) stays put as the pay is built up', () => {
  it('the sheltered part is the standard deduction plus the deferral: 16,100 + 10,000 = 26,100', () => {
    const w = rateProfile({ filingStatus: 'single', year: 2026, people: [{ wages: 100000 }], pretaxDeferrals: 10000 }, { step: 100 });
    // y 26,000: taxable 0 -> sheltered; y 26,200: taxable 100 -> 10%
    expect(w.rows.find((r) => r.income === 26000).sheltered).toBe(true);
    expect(w.rows.find((r) => r.income === 26200).nextRate).toBeCloseTo(0.1, 9);
    // y 8,000: the deferral can't be more than the pay (8,000), still sheltered
    expect(w.rows.find((r) => r.income === 8000).sheltered).toBe(true);
  });
});

describe('rateProfile: bracket edges to the dollar', () => {
  it('a $100,000 worker with a $10,000 Pre-tax 401(k): 26,100, 38,500, 76,500, 131,800, 227,875', () => {
    // sheltered to 16,100 + 10,000 = 26,100; then each bracket top + 26,100: 12,400, 50,400, 105,700, 201,775
    const w = rateProfile({ filingStatus: 'single', year: 2026, people: [{ wages: 100000 }], pretaxDeferrals: 10000 });
    expect(w.edges.map((e) => e.income)).toEqual([26100, 38500, 76500, 131800, 227875]);
    expect(w.edges.map((e) => e.to)).toEqual([0.1, 0.12, 0.22, 0.24, 0.32]);
  });
});
