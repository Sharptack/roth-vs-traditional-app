import { describe, it, expect } from 'vitest';
import { conversionHeadlines, lifetimeHeadline, pensionHeadlines, projectionHeadlines, taxHeadlines } from '../src/lib/blockHeadlines.js';

// Small made-up results: only the fields the headlines read.
describe('result block headlines', () => {
  it('the tax calculator', () => {
    const t = {
      marginal: { incomeTax: 0.22 },
      steps: { probe: 100, extraTax: 22.2, rate: 0.222 },
      bar: { currentRate: 0.22, room: 12345 },
      result: { effectiveRate: 0.11, incomeTax: 10970, bracketRoom: { ordinary: { rate: 0.22, room: 12345 } } },
      irmaa: { enrolled: 1, tier: 2, total: 2000, premiumYear: 2028 },
    };
    expect(taxHeadlines(t)).toEqual({
      rates: '22% marginal · 22.0% EMTR',
      next: '$22.20 more tax on the next $100: 22.2%',
      buckets: '22% bracket, $12,345 of room',
      irmaa: 'Tier 2 of 5: $2,000 in 2028',
      calculation: '$10,970 federal income tax',
    });
    expect(taxHeadlines({ ...t, irmaa: { ...t.irmaa, tier: 0 } }).irmaa).toBe('No surcharge in 2028');
    // no one 65 by then (or IRMAA left out): no headline, the block isn't shown
    expect(taxHeadlines({ ...t, irmaa: { ...t.irmaa, enrolled: 0 } }).irmaa).toBe('');
    expect(taxHeadlines({ ...t, irmaa: null }).irmaa).toBe('');
  });

  it('the Roth conversion calculator', () => {
    const c = { cost: 11364, rate: 0.2273, amount: 50000, fills: [{ rate: 0.22, amount: 30000 }], bar: { currentRate: 0.24, room: 5000 } };
    expect(conversionHeadlines(c)).toEqual({
      lifetime: '',
      cost: '$11,364 tax, an effective rate of 22.7%',
      bar: 'Reaches the 24.0% bracket, $5,000 of room',
    });
    const lifetime = { difference: { lifetimeTax: 2727.27, legacyAfterTax: -1200.4 } };
    expect(conversionHeadlines(c, lifetime).lifetime).toBe("Lifetime tax +$2,727 · legacy after heirs' tax −$1,200");
  });

  it('the pension calculator', () => {
    const p = { irr: 0.06, expected: { irr: 0.054 }, byEndAge: [{ endAge: 80, irr: 0.01 }, { endAge: 95, irr: null }] };
    const inputs = { lumpSum: 300000, monthly: 1800, endAge: 90 };
    expect(pensionHeadlines(p, inputs, 0.1)).toEqual({
      irr: '5.4% a year vs. 10.0% assumed',
      ages: '1.0% to age 80, none to age 95',
    });
    expect(pensionHeadlines({ ...p, expected: { irr: null }, byEndAge: [] }, inputs, 0.1)).toEqual({ irr: 'No return vs. 10.0% assumed', ages: '' });
  });

  it('the projection', () => {
    const row = (year, working, total) => ({ year, working: [working], endBalances: { total } });
    const view = {
      rows: [row(2026, true, 100), row(2027, false, 300), row(2028, false, 200)],
      summary: { totalTax: 5000, endingBalance: { total: 200 }, runsOut: false, endLabel: 'age 95' },
      strategies: [
        { label: 'Proportional (every account alike)', endingAfterTax: 10 },
        { label: 'Fill the 12% bracket from Pre-tax', endingAfterTax: 20 },
      ],
      endAge: 95,
      funded: 1.5,
      sustainable: 1000,
      need: 900,
    };
    expect(projectionHeadlines(view)).toEqual({
      funded: '150% funded',
      strategies: 'Most left for heirs: fill the 12% bracket from pre-tax',
      summary: '$5,000 lifetime tax · $200 left at age 95',
      income: '2027 to 2028', // the retired years
      balances: 'Peak $300 in 2027',
      table: '3 years, 2026 to 2028',
    });
    // nobody retires before the end: no income-in-retirement block
    expect(projectionHeadlines({ ...view, rows: [row(2026, true, 100)] }).income).toBe('');
  });

  it('the lifetime comparison', () => {
    expect(lifetimeHeadline({ winner: 'pretax', difference: { sustainable: -834.4 } })).toBe('Pre-tax supports $834 a year more');
    expect(lifetimeHeadline({ winner: 'roth', difference: { sustainable: 1200 } })).toBe('Roth supports $1,200 a year more');
    expect(lifetimeHeadline({ winner: 'even', difference: { sustainable: 3 } })).toBe('About even');
  });
});
