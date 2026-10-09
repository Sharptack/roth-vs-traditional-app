import { describe, it, expect } from 'vitest';
import { employerContribution } from '../src/lib/employerContributions.js';

// 2026: 401(k) deferral limit $24,500 (+ $8,000 catch-up from 50); overall limit (415(c)) $72,000.
const Y = 2026;
const match = (matchRate, matchUpTo) => ({ type: 'match', matchRate, matchUpTo });
const flat = (amount) => ({ type: 'flat', amount });

describe('employerContribution (2026, HAND CALC)', () => {
  it('a match: a share of the deferral, up to a share of pay', () => {
    // 100% of the first 4%: wages 100,000 -> up to 4,000; deferral 10,000 -> 4,000
    expect(employerContribution({ rows: [{ amount: 10000, employer: match(1, 0.04) }], wages: 100000, year: Y, age: 40 })).toBe(4000);
    // 50% of the first 6%: deferral 3,000, under 6% of pay (6,000) -> 1,500
    expect(employerContribution({ rows: [{ amount: 3000, employer: match(0.5, 0.06) }], wages: 100000, year: Y, age: 40 })).toBe(1500);
    // the deferral counted is capped at the IRS limit: 40,000 entered -> 24,500; 100% up to 10% of
    // 400,000 (40,000) -> 24,500
    expect(employerContribution({ rows: [{ amount: 40000, employer: match(1, 0.1) }], wages: 400000, year: Y, age: 40 })).toBe(24500);
  });

  it('a flat amount, whatever the deferral', () => {
    expect(employerContribution({ rows: [{ amount: 0, employer: flat(5000) }], wages: 100000, year: Y, age: 40 })).toBe(5000);
  });

  it('none, or no employer settings: 0', () => {
    expect(employerContribution({ rows: [{ amount: 10000, employer: { type: 'none' } }], wages: 100000, year: Y, age: 40 })).toBe(0);
    expect(employerContribution({ rows: [{ amount: 10000 }], wages: 100000, year: Y, age: 40 })).toBe(0);
    expect(employerContribution({ rows: [], wages: 100000, year: Y, age: 40 })).toBe(0);
  });

  it('held to the overall limit, with the catch-up left out of it', () => {
    // 40: deferral 24,500 + flat 50,000 = 74,500 > 72,000 -> employer 72,000 - 24,500 = 47,500
    expect(employerContribution({ rows: [{ amount: 24500, employer: flat(50000) }], wages: 400000, year: Y, age: 40 })).toBe(47500);
    // 55: deferral 32,500 (limit 24,500 + 8,000 catch-up); only the 24,500 counts -> again 47,500
    expect(employerContribution({ rows: [{ amount: 32500, employer: flat(50000) }], wages: 400000, year: Y, age: 55 })).toBe(47500);
  });

  it('two rows: the deferrals share one limit, in order', () => {
    // 20,000 + 10,000 entered, limit 24,500: the second counts 4,500. 100% up to 50% of 100,000 on each:
    // 20,000 + 4,500 = 24,500
    const rows = [
      { amount: 20000, employer: match(1, 0.5) },
      { amount: 10000, employer: match(1, 0.5) },
    ];
    expect(employerContribution({ rows, wages: 100000, year: Y, age: 40 })).toBe(24500);
  });
});
