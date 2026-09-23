import { describe, it, expect } from 'vitest';
import { checkContributionLimit, splitAtContributionLimit } from '../src/lib/contributionLimits.js';

describe('checkContributionLimit (2025: 401(k) $23,500, IRA $7,000)', () => {
  it('flags at exactly 90% of the 401(k) limit ($21,150)', () => {
    const r = checkContributionLimit(21150, '401k', 2025);
    expect(r.atLimit).toBe(true);
    expect(r.overLimit).toBe(false);
    expect(r.limit).toBe(23500);
  });
  it('does not flag just below 90% ($21,149)', () => {
    const r = checkContributionLimit(21149, '401k', 2025);
    expect(r.atLimit).toBe(false);
    expect(r.message).toBe('');
  });
  it('uses the IRA limit for IRAs: 90% = $6,300', () => {
    expect(checkContributionLimit(6300, 'ira', 2025).atLimit).toBe(true);
    expect(checkContributionLimit(6299, 'ira', 2025).atLimit).toBe(false);
    // $10,000 is fine for a 401(k) but far over an IRA
    expect(checkContributionLimit(10000, '401k', 2025).atLimit).toBe(false);
    expect(checkContributionLimit(10000, 'ira', 2025).overLimit).toBe(true);
  });
  it('flags exactly at the limit and above it', () => {
    expect(checkContributionLimit(23500, '401k', 2025)).toMatchObject({ atLimit: true, overLimit: false });
    expect(checkContributionLimit(30000, '401k', 2025)).toMatchObject({ atLimit: true, overLimit: true });
  });
  it('the message names the year, account type and limit', () => {
    const { message } = checkContributionLimit(23000, '401k', 2025);
    expect(message).toContain("You're at/near the 2025 401(k) contribution limit of $23,500.");
    expect(message).toContain('Roth contributions shelter more real after-tax wealth than Traditional');
    expect(checkContributionLimit(7000, 'ira', 2025).message).toContain('2025 IRA contribution limit of $7,000');
  });
  it('an over-the-limit message says so, names the exact excess, and explains it goes to taxable', () => {
    // 30,000 - 23,500 = 6,500 excess
    const { message } = checkContributionLimit(30000, '401k', 2025);
    expect(message).toContain('above the 2025 401(k)');
    expect(message).toContain('extra $6,500/year');
    expect(message).toContain("can't legally go into a 401(k)");
    expect(message).toContain('taxable investment account');
  });
  it('uses the newest data on file for a later year, and says which year that was', () => {
    // 2030 is beyond the data, so the 2026 limits apply and the message says 2026
    const r = checkContributionLimit(23000, '401k', 2030);
    expect(r.year).toBe(2026);
    expect(r.limit).toBe(24500);
    expect(r.message).toContain('2026');
  });
  it('rejects an unknown account type', () => {
    expect(() => checkContributionLimit(1000, '403b', 2025)).toThrow(/account type/i);
  });
});

describe('checkContributionLimit (2026: 401(k) $24,500, IRA $7,500)', () => {
  it('401(k): flags at exactly 90% = $22,050, not below', () => {
    expect(checkContributionLimit(22050, '401k', 2026)).toMatchObject({ atLimit: true, limit: 24500, year: 2026 });
    expect(checkContributionLimit(22049, '401k', 2026).atLimit).toBe(false);
  });
  it('IRA: 90% of $7,500 = $6,750', () => {
    expect(checkContributionLimit(6750, 'ira', 2026)).toMatchObject({ atLimit: true, limit: 7500 });
    expect(checkContributionLimit(6749, 'ira', 2026).atLimit).toBe(false);
  });
  it('the message shows the 2026 figures', () => {
    expect(checkContributionLimit(24000, '401k', 2026).message).toContain(
      "You're at/near the 2026 401(k) contribution limit of $24,500.",
    );
  });
  it('2025 limits are still available for 2025', () => {
    expect(checkContributionLimit(1000, '401k', 2025).limit).toBe(23500);
  });
});

describe('splitAtContributionLimit (2025: 401(k) $23,500, IRA $7,000)', () => {
  it('under the limit: everything goes to the account, no excess', () => {
    const r = splitAtContributionLimit(10000, '401k', 2025);
    expect(r.toAccount).toBe(10000);
    expect(r.excessToTaxable).toBe(0);
    expect(r.limit).toBe(23500);
  });
  it('exactly at the limit: everything fits, no excess', () => {
    const r = splitAtContributionLimit(23500, '401k', 2025);
    expect(r.toAccount).toBe(23500);
    expect(r.excessToTaxable).toBe(0);
  });
  it('over the limit: caps at the limit, the rest is the excess (HAND CALC)', () => {
    // 30,000 - 23,500 = 6,500
    const r = splitAtContributionLimit(30000, '401k', 2025);
    expect(r.toAccount).toBe(23500);
    expect(r.excessToTaxable).toBe(6500);
    expect(r.toAccount + r.excessToTaxable).toBe(30000);
  });
  it('uses the IRA limit for IRAs (HAND CALC)', () => {
    // 10,000 - 7,000 = 3,000
    const r = splitAtContributionLimit(10000, 'ira', 2025);
    expect(r.toAccount).toBe(7000);
    expect(r.excessToTaxable).toBe(3000);
  });
  it('a zero or negative amount has nothing to split', () => {
    expect(splitAtContributionLimit(0, '401k', 2025)).toMatchObject({ toAccount: 0, excessToTaxable: 0 });
    expect(splitAtContributionLimit(-500, '401k', 2025)).toMatchObject({ toAccount: 0, excessToTaxable: 0 });
  });
  it('uses the 2026 limits ($24,500 / $7,500) for 2026 (HAND CALC)', () => {
    // 25,000 - 24,500 = 500
    const r = splitAtContributionLimit(25000, '401k', 2026);
    expect(r.toAccount).toBe(24500);
    expect(r.excessToTaxable).toBe(500);
    expect(r.year).toBe(2026);
  });
  it('agrees with checkContributionLimit on the limit itself', () => {
    for (const [accountType, year] of [['401k', 2025], ['ira', 2025], ['401k', 2026], ['ira', 2026]]) {
      expect(splitAtContributionLimit(1, accountType, year).limit).toBe(
        checkContributionLimit(1, accountType, year).limit,
      );
    }
  });
  it('rejects an unknown account type', () => {
    expect(() => splitAtContributionLimit(1000, '403b', 2025)).toThrow(/account type/i);
  });
});

describe('checkContributionLimit / splitAtContributionLimit — catch-up contributions (age 50+)', () => {
  // 2025: 401(k) base $23,500, +$7,500 catch-up (50-59, 64+), +$11,250 catch-up (60-63).
  //       IRA base $7,000, +$1,000 catch-up (50+, all ages, no enhanced tier).
  it('under 50: limit is just the base, same as before', () => {
    expect(checkContributionLimit(20000, '401k', 2025, 45).limit).toBe(23500);
    expect(checkContributionLimit(20000, '401k', 2025, 45).catchUp).toBe(0);
  });

  it('50-59: 401(k) limit is base + $7,500 = $31,000 (HAND CALC)', () => {
    const r = checkContributionLimit(28000, '401k', 2025, 55);
    expect(r.limit).toBe(31000);
    expect(r.catchUp).toBe(7500);
    expect(r.base).toBe(23500);
    expect(r.overLimit).toBe(false); // 28,000 < 31,000
  });

  it('60-63: 401(k) gets the ENHANCED catch-up, $23,500 + $11,250 = $34,750, not the standard $31,000', () => {
    const r62 = checkContributionLimit(32000, '401k', 2025, 62);
    expect(r62.limit).toBe(34750);
    expect(r62.catchUp).toBe(11250);
    expect(r62.overLimit).toBe(false); // 32,000 < 34,750 (would be over the standard $31,000)
  });

  it('exactly 60 and exactly 63 both get the enhanced tier; 59 and 64 do not (boundary HAND CALC)', () => {
    expect(checkContributionLimit(1, '401k', 2025, 59).limit).toBe(31000); // standard $7,500
    expect(checkContributionLimit(1, '401k', 2025, 60).limit).toBe(34750); // enhanced
    expect(checkContributionLimit(1, '401k', 2025, 63).limit).toBe(34750); // enhanced
    expect(checkContributionLimit(1, '401k', 2025, 64).limit).toBe(31000); // back to standard
  });

  it('IRA has no enhanced 60-63 tier: 50+ is always base + $1,000 (HAND CALC)', () => {
    expect(checkContributionLimit(1, 'ira', 2025, 55).limit).toBe(8000);
    expect(checkContributionLimit(1, 'ira', 2025, 62).limit).toBe(8000); // same as 55, no 60-63 boost
    expect(checkContributionLimit(1, 'ira', 2025, 70).limit).toBe(8000);
  });

  it('2026: 401(k) catch-up rises to $8,000 (50-59/64+) but the 60-63 tier stays $11,250 (HAND CALC)', () => {
    expect(checkContributionLimit(1, '401k', 2026, 55).limit).toBe(32500); // 24,500 + 8,000
    expect(checkContributionLimit(1, '401k', 2026, 61).limit).toBe(35750); // 24,500 + 11,250
  });

  it('2026: IRA catch-up rises to $1,100 (HAND CALC)', () => {
    expect(checkContributionLimit(1, 'ira', 2026, 55).limit).toBe(8600); // 7,500 + 1,100
  });

  it('age omitted (undefined) behaves exactly like age 0: base limit only', () => {
    const withAge = checkContributionLimit(20000, '401k', 2025, 0);
    const noAge = checkContributionLimit(20000, '401k', 2025);
    expect(noAge).toEqual(withAge);
    expect(noAge.limit).toBe(23500);
  });

  it('the over-limit message names the catch-up when one applies (HAND CALC)', () => {
    // 55-year-old, 401(k), limit 31,000, contributing 35,000 -> excess 4,000
    const { message } = checkContributionLimit(35000, '401k', 2025, 55);
    expect(message).toContain('$31,000');
    expect(message).toContain('$7,500 catch-up contribution for being 50 or older');
    expect(message).toContain('extra $4,000/year');
  });

  it('the at-limit (not over) message also names the catch-up', () => {
    const { message } = checkContributionLimit(30000, '401k', 2025, 55); // 30,000 >= 90% of 31,000
    expect(message).toContain("$31,000 (that includes a $7,500 catch-up");
  });

  it('splitAtContributionLimit respects catch-up too (HAND CALC)', () => {
    // 62-year-old contributing $40,000 to a 401(k): limit 34,750, excess 5,250.
    const r = splitAtContributionLimit(40000, '401k', 2025, 62);
    expect(r.toAccount).toBe(34750);
    expect(r.excessToTaxable).toBe(5250);
    expect(r.catchUp).toBe(11250);
  });

  it('splitAtContributionLimit and checkContributionLimit agree on the limit for the same age', () => {
    for (const age of [30, 50, 55, 60, 63, 64, 70]) {
      expect(splitAtContributionLimit(1, '401k', 2025, age).limit).toBe(
        checkContributionLimit(1, '401k', 2025, age).limit,
      );
    }
  });
});
