import { describe, it, expect } from 'vitest';
import { lifetimeBenefits, breakEvenAge, claimingGrid, strategyRows, cumulativeCurve, benefitCrossings } from '../src/lib/socialSecurityLifetime.js';

// Hand-worked (round 2 phase 5, step b), worked out before running the code. Year 2026.

describe('lifetime benefits, one grid cell rebuilt from its three streams (HAND CALC)', () => {
  // A born 1960 (66 now), PIA 2,000, plan-to 80, claims at 67 (full retirement age): 2,000 a month.
  // B born 1962 (64 now), PIA 600, plan-to 90, claims at 64: 36 months early -> 80% -> 480 a month.
  const people = [
    { birthYear: 1960, pia: 2000, planToAge: 80 },
    { birthYear: 1962, pia: 600, planToAge: 90 },
  ];
  const r = lifetimeBenefits({ year: 2026, people, claimAges: [67, 64] });

  it('A own: 24,000 a year at ages 67 to 80 (14 years) = 336,000', () => {
    expect(r.people[0].own).toBeCloseTo(336000, 6);
    expect(r.people[0].spousal).toBe(0);
    expect(r.people[0].survivor).toBe(0);
  });
  it('B own: 5,760 a year at ages 64 to 90 (27 years) = 155,520', () => {
    expect(r.people[1].own).toBeCloseTo(155520, 6);
  });
  it('B spousal: (1,000 - 600) x 83.333% (from 65, when A files; 24 months early) = 4,000 a year, ages 65 to 78 = 56,000', () => {
    // A dies in 2040 (age 80), when B is 78: the spousal part ends with that year.
    expect(r.people[1].spousal).toBeCloseTo(56000, 6);
  });
  it('B survivor: A claimed at full retirement age -> 2,000 a month from B at 79 (past survivor FRA); excess over 480 = 18,240 a year, ages 79 to 90 = 218,880', () => {
    expect(r.people[1].survivor).toBeCloseTo(218880, 6);
  });
  it('household total 766,400; with no discount the discounted total is the same', () => {
    expect(r.total).toBeCloseTo(766400, 6);
    expect(r.discountedTotal).toBeCloseTo(766400, 6);
  });
  it('the year-by-year rows add up to the total', () => {
    expect(r.years.reduce((s, y) => s + y.total, 0)).toBeCloseTo(766400, 6);
    expect(r.years[0].year).toBe(2026);
    expect(r.years.at(-1).ages).toEqual([92, 90]); // the last year: B at 90 (2052); A's age counted on
    expect(r.years.at(-1).year).toBe(2052);
  });
});

describe('discounting (HAND CALC)', () => {
  it('one person, PIA 1,000, born 1960 (66 now), claims at 67, plan-to 68, 10%', () => {
    // t = 1 (age 67): 12,000 / 1.1 = 10,909.09;  t = 2 (age 68): 12,000 / 1.21 = 9,917.36  -> 20,826.45
    const r = lifetimeBenefits({ year: 2026, people: [{ birthYear: 1960, pia: 1000, planToAge: 68 }], claimAges: [67], discountRate: 0.1 });
    expect(r.total).toBeCloseTo(24000, 6);
    expect(r.discountedTotal).toBeCloseTo(20826.446, 2);
  });
});

describe('both die in the same year: no survivor benefit', () => {
  it('A plan-to 80 (2040), B plan-to 78 (2040)', () => {
    const r = lifetimeBenefits({
      year: 2026,
      people: [{ birthYear: 1960, pia: 2000, planToAge: 80 }, { birthYear: 1962, pia: 600, planToAge: 78 }],
      claimAges: [67, 64],
    });
    expect(r.people[1].survivor).toBe(0);
    expect(r.years.at(-1).year).toBe(2040);
  });
});

describe('a person already receiving: the check as is, from now, no PIA', () => {
  it('A receives 1,500 a month (no spousal top-up for B from an unknown PIA); B survivor = 1,500 at B 79', () => {
    // A: 18,000 a year at ages 66 to 80 (15 years) = 270,000.
    // B own 5,760 x 27 = 155,520; spousal 0.
    // Survivor: A's check 1,500 as the original benefit (no limit), B at 79 is past survivor FRA:
    // 1,500 - 480 = 1,020 a month = 12,240 a year x 12 years = 146,880.
    const r = lifetimeBenefits({
      year: 2026,
      people: [{ birthYear: 1960, receiving: 1500, planToAge: 80 }, { birthYear: 1962, pia: 600, planToAge: 90 }],
      claimAges: [null, 64],
    });
    expect(r.people[0].own).toBeCloseTo(270000, 6);
    expect(r.people[1].spousal).toBe(0);
    expect(r.people[1].survivor).toBeCloseTo(146880, 6);
  });
});

describe('break-even ages on the own benefit (HAND CALC)', () => {
  // PIA 2,000, born 1960: 62 -> 16,800 a year; 67 -> 24,000; 70 -> 29,760. No discount.
  it('62 vs 70: by exact age 80 (through 79): 302,400 vs 297,600; by 81: 319,200 vs 327,360', () => {
    // Crossed in that year: 80 + 4,800 / (4,800 + 8,160) = 80 + 4,800 / 12,960 = 80.3704
    expect(breakEvenAge({ pia: 2000, birthYear: 1960, earlyAge: 62, lateAge: 70 })).toBeCloseTo(80.3704, 3);
  });
  it('62 vs 67: 16,800 (x - 62) = 24,000 (x - 67) -> x = 566,400 / 7,200 = 78.667', () => {
    expect(breakEvenAge({ pia: 2000, birthYear: 1960, earlyAge: 62, lateAge: 67 })).toBeCloseTo(78.6667, 3);
  });
  it('a high discount rate can push it past the table: none', () => {
    expect(breakEvenAge({ pia: 2000, birthYear: 1960, earlyAge: 62, lateAge: 70, discountRate: 0.2 })).toBeNull();
  });
});

describe('the couple grid', () => {
  it('a cell equals lifetimeBenefits for that pair; the best cell is the largest', () => {
    const people = [
      { birthYear: 1960, pia: 2000, planToAge: 80 },
      { birthYear: 1962, pia: 600, planToAge: 90 },
    ];
    const g = claimingGrid({ year: 2026, people });
    // A is 66: claiming ages 66 to 70 are still open; B is 64: 64 to 70.
    expect(g.ages[0]).toEqual([66, 67, 68, 69, 70]);
    expect(g.ages[1]).toEqual([64, 65, 66, 67, 68, 69, 70]);
    const cell = g.cells.find((c) => c.claimAges[0] === 67 && c.claimAges[1] === 64);
    expect(cell.discountedTotal).toBeCloseTo(766400, 6);
    const max = Math.max(...g.cells.map((c) => c.discountedTotal));
    expect(g.best.discountedTotal).toBe(max);
  });
});

// Before phase 6 (asked 2026-10-12), step (a): a strategy's year-by-year rows, its cumulative curve,
// and where two strategies' cumulative totals cross. Worked out by hand before running the code.
describe('a strategy year by year (HAND CALC)', () => {
  // The couple above, S1 = A 67, B 64 (766,400 in all).
  // 2026 (A 66, B 64): B own only = 5,760.
  // 2027 (A 67, B 65): A own 24,000 + B own 5,760 + B spousal 4,000 = 33,760.
  // Future dollars at 2.5%: 2027 = 33,760 x 1.025 = 34,604; running total 5,760 + 34,604 = 40,364.
  const people = [
    { birthYear: 1960, pia: 2000, planToAge: 80 },
    { birthYear: 1962, pia: 600, planToAge: 90 },
  ];
  const s1 = lifetimeBenefits({ year: 2026, people, claimAges: [67, 64] });

  it("today's dollars: each year's total and the running total", () => {
    const rows = strategyRows(s1, { year: 2026 });
    expect(rows[0]).toMatchObject({ year: 2026, ages: [66, 64], total: 5760, cumulative: 5760 });
    expect(rows[1].total).toBeCloseTo(33760, 6);
    expect(rows[1].cumulative).toBeCloseTo(39520, 6);
    expect(rows[1].streams[1]).toEqual({ own: 5760, spousal: 4000, survivor: 0 });
    expect(rows.at(-1).cumulative).toBeCloseTo(766400, 6);
  });
  it('future dollars at 2.5%: 2027 = 34,604, running total 40,364; each stream grown too', () => {
    const rows = strategyRows(s1, { year: 2026, inflationRate: 0.025, futureDollars: true });
    expect(rows[0].total).toBeCloseTo(5760, 6);
    expect(rows[1].total).toBeCloseTo(34604, 6);
    expect(rows[1].cumulative).toBeCloseTo(40364, 6);
    expect(rows[1].streams[0].own).toBeCloseTo(24600, 6); // 24,000 x 1.025
  });
  it("the cumulative curve by A's age: 0 at 66 (now), 5,760 by 67, 39,520 by 68", () => {
    const pts = cumulativeCurve(s1);
    expect(pts[0]).toEqual({ x: 66, y: 0 });
    expect(pts[1].x).toBe(67);
    expect(pts[1].y).toBeCloseTo(5760, 6);
    expect(pts[2]).toMatchObject({ x: 68 });
    expect(pts[2].y).toBeCloseTo(39520, 6);
  });
});

describe('where two strategies cross (HAND CALC)', () => {
  it('one person, PIA 2,000, born 1960, from 62 (2022): 70 passes 62 at 80.3704, as breakEvenAge', () => {
    const p = [{ birthYear: 1960, pia: 2000, planToAge: 95 }];
    const a = lifetimeBenefits({ year: 2022, people: p, claimAges: [62] });
    const b = lifetimeBenefits({ year: 2022, people: p, claimAges: [70] });
    const x = benefitCrossings(a, b);
    expect(x).toHaveLength(1);
    expect(x[0].age).toBeCloseTo(80.3704, 3);
    expect(x[0].leader).toBe('b'); // b leads after the crossing
  });
  it('the couple: S2 = A 70, B 64 passes S1 = A 67, B 64 at A 83.0556', () => {
    // S2: A own 2,000 x 1.24 = 2,480 a month = 29,760 a year at A 70 to 80. B spousal: A files at
    // 70 when B is 68 (past B's FRA of 67): 400 a month = 4,800 a year, B 68 to 78 (A 70 to 80).
    // B survivor: A's 2,480 (credits kept) - 480 = 2,000 a month = 24,000 a year, B 79 to 90.
    // B own is the same in both. S2 - S1 by A's age:
    //   A 67, 68, 69: 0 - (24,000 + 4,000) = -28,000 each -> -84,000 by A 70
    //   A 70 to 80 (11 years): 34,560 - 28,000 = +6,560 -> -84,000 + 72,160 = -11,840 by A 81
    //   A 81 to 92 (B 79 to 90): 24,000 - 18,240 = +5,760; by A 83: -11,840 + 11,520 = -320
    //   crossed during A 83: 83 + 320 / 5,760 = 83.0556
    // S2 total: 327,360 + 155,520 + 52,800 + 288,000 = 823,680 (S1 + 57,280).
    const people = [
      { birthYear: 1960, pia: 2000, planToAge: 80 },
      { birthYear: 1962, pia: 600, planToAge: 90 },
    ];
    const s1 = lifetimeBenefits({ year: 2026, people, claimAges: [67, 64] });
    const s2 = lifetimeBenefits({ year: 2026, people, claimAges: [70, 64] });
    expect(s2.total).toBeCloseTo(823680, 6);
    const x = benefitCrossings(s1, s2);
    expect(x).toHaveLength(1);
    expect(x[0].age).toBeCloseTo(83.0556, 3);
    expect(x[0].leader).toBe('b');
    expect(benefitCrossings(s2, s1)[0].leader).toBe('a');
  });
  it('the same strategy twice: no crossing', () => {
    const p = [{ birthYear: 1960, pia: 2000, planToAge: 95 }];
    const a = lifetimeBenefits({ year: 2022, people: p, claimAges: [62] });
    expect(benefitCrossings(a, a)).toEqual([]);
  });
});
