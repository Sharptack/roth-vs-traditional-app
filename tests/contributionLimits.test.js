import { describe, it, expect } from 'vitest';
import { checkContributionLimit } from '../src/lib/contributionLimits.js';

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
  it('an over-the-limit message says so', () => {
    expect(checkContributionLimit(30000, '401k', 2025).message).toContain('above the 2025 401(k)');
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
