import { describe, it, expect } from 'vitest';
import { irr, pensionPayments, pensionResult } from '../src/lib/pensionCalculator.js';

describe('irr (HAND CALC)', () => {
  it('-1,000 now, 1,100 in one period: 10%', () => {
    expect(irr([-1000, 1100])).toBeCloseTo(0.1, 10);
  });
  it('-1,000 now, 600 and 600: 13.0662%', () => {
    // 600x + 600x^2 = 1,000 with x = 1/(1+r): x = (-600 + sqrt(360,000 + 2,400,000)) / 1,200
    //   = (-600 + 1,661.3248) / 1,200 = 0.8844373 -> r = 0.1306624
    expect(irr([-1000, 600, 600])).toBeCloseTo(0.1306624, 6);
  });
  it('no sign change, no rate', () => {
    expect(irr([1000, 500])).toBeNull();
    expect(irr([-1000, 0, 0])).toBeNull();
  });
});

describe('pensionPayments (HAND CALC)', () => {
  it('a 3% cost-of-living increase steps up once a year', () => {
    // two years: 12 x 1,000 then 12 x 1,030 = 24,360
    const { payments } = pensionPayments({ monthly: 1000, startAge: 65, cola: 0.03, endAge: 67 });
    expect(payments).toHaveLength(24);
    expect(payments[11]).toBe(1000);
    expect(payments[12]).toBeCloseTo(1030, 10);
    expect(payments.reduce((a, b) => a + b, 0)).toBeCloseTo(24360, 6);
  });

  it('a 50% survivor benefit runs from the owner\'s end to the spouse\'s end age', () => {
    // owner 65 -> 70: 60 payments of 1,000. Spouse is 63 at the start, 68 then; to 75 = 84 payments
    // of 500. Total 60,000 + 42,000 = 102,000
    const r = pensionPayments({ monthly: 1000, startAge: 65, endAge: 70, survivorShare: 0.5, spouseAgeAtStart: 63, spouseEndAge: 75 });
    expect([r.ownMonths, r.survivorMonths]).toEqual([60, 84]);
    expect(r.payments[59]).toBe(1000);
    expect(r.payments[60]).toBe(500);
    expect(r.payments.reduce((a, b) => a + b, 0)).toBe(102000);
  });
});

describe('pensionResult (HAND CALC)', () => {
  const base = { lumpSum: 120000, monthly: 1000, startAge: 65, endAge: 75 };

  it('$120,000 or $1,000 a month for 10 years: the payments just return the lump sum, 0%', () => {
    const r = pensionResult(base);
    expect(r.totalPayments).toBe(120000);
    expect(r.irr).toBeCloseTo(0, 8);
    expect(r.breakEvenAge).toBe(75); // the 120th payment
  });

  it('the same pension to 85: about 8.2% a year, and the rate makes the payments worth the lump sum', () => {
    // 120 = (1 - (1+m)^-240) / m: m between 0.65% (121.35) and 0.70% (116.08) a month,
    // so between 8.08% and 8.73% a year
    const r = pensionResult({ ...base, endAge: 85 });
    expect(r.irr).toBeGreaterThan(0.0808);
    expect(r.irr).toBeLessThan(0.0873);
    expect(r.presentValueAt(r.irr)).toBeCloseTo(120000, 2);
    expect(r.breakEvenAge).toBe(75); // same payments, so the same break-even
  });

  it('living longer raises the return; the table shows it by end age', () => {
    const r = pensionResult({ ...base, endAge: 85 });
    expect(r.byEndAge.map((x) => x.endAge)).toEqual([75, 80, 85, 90, 95, 100]);
    expect(r.byEndAge[0].irr).toBeCloseTo(0, 8);
    for (let i = 1; i < r.byEndAge.length; i++) expect(r.byEndAge[i].irr).toBeGreaterThan(r.byEndAge[i - 1].irr);
    expect(r.byEndAge[2].irr).toBeCloseTo(r.irr, 12);
  });

  it('dying before the payments add up to the lump sum: a negative return, no break-even', () => {
    const r = pensionResult({ ...base, endAge: 70 }); // 60,000 back on 120,000
    expect(r.irr).toBeLessThan(0);
    expect(r.breakEvenAge).toBeNull();
  });
});

describe('the pension calculator in the household', () => {
  it('takes ages from the shared inputs: the spouse\'s age when payments start', async () => {
    const { PREVIEW_DEFAULT_VALUES, toHousehold } = await import('../src/lib/household.js');
    const { householdToPensionInputs } = await import('../src/lib/pensionCalculator.js');
    const { pensionTile } = await import('../src/lib/suiteTiles.js');
    // you 60, spouse 57; payments start at 65 (in 5 years) -> the spouse is 62 then
    const values = { ...PREVIEW_DEFAULT_VALUES, filingStatus: 'mfj', includeSpouse: 'yes', currentAge: '60', retirementAge: '65', spouseAge: '57', spouseRetirementAge: '65', penSurvivor: '0.5', penLumpSum: '120000', penMonthly: '1000', penEndAge: '75', penSpouseEndAge: '80' };
    const inputs = householdToPensionInputs(toHousehold(values, 2026));
    expect(inputs).toEqual({ lumpSum: 120000, monthly: 1000, startAge: 65, cola: 0, survivorShare: 0.5, endAge: 75, spouseAgeAtStart: 62, spouseEndAge: 80, sex: '', spouseSex: '' });
    // own 120 payments; the spouse is 72 at your 75 -> 8 more years = 96 payments of 500
    const r = pensionResult(inputs);
    // and on life expectancy (the average of the two tables, no sex entered)
    expect(r.expected.irr).toBeGreaterThan(-0.5);
    expect(r.expected.lifeExpectancy).toBeGreaterThan(15);
    expect(r.months).toEqual({ own: 120, survivor: 96 });
    expect(r.totalPayments).toBe(168000);
    expect(pensionTile(r, inputs).headline).toMatch(/^\d+\.\d% a year$/);
    // without a spouse entered, the survivor share is ignored
    const single = householdToPensionInputs(toHousehold({ ...values, includeSpouse: 'no' }, 2026));
    expect(single.survivorShare).toBe(0);
    expect(single.spouseAgeAtStart).toBeNull();
  });
});
