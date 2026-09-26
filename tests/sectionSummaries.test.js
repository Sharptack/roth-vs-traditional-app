import { describe, it, expect } from 'vitest';
import { INPUT_SECTIONS, resultHeadlines, sectionChanged } from '../src/lib/sectionSummaries.js';
import { DEFAULT_FORM_VALUES } from '../src/lib/formInputs.js';

const summaries = (values) => Object.fromEntries(INPUT_SECTIONS.map((s) => [s.id, s.summary(values)]));

describe('INPUT_SECTIONS', () => {
  it('holds every form value in exactly one section', () => {
    const all = INPUT_SECTIONS.flatMap((s) => s.fields);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(Object.keys(DEFAULT_FORM_VALUES).sort());
  });

  it('summarizes the default inputs', () => {
    // Defaults: $100,000 W-2, single, 35 -> 65, lifestyle 1 (not shown); $6,000 debt, $0 other
    // (only the non-zero part shown); $10,000 Pre-tax 401(k); SS estimated; $100,000 Pre-tax,
    // $0 Roth and $0 taxable (zeros left out); 7% return.
    expect(summaries(DEFAULT_FORM_VALUES)).toEqual({
      about: '$100,000 W-2 · Single · age 35, retiring at 65',
      costs: '$6,000 debt a year',
      contributions: '$10,000 a year · Pre-tax · 401(k)',
      socialSecurity: 'Estimated from your income',
      existing: 'Pre-tax $100,000',
      assumptions: '7% expected annual return',
    });
  });

  it('summarizes other choices', () => {
    const v = {
      ...DEFAULT_FORM_VALUES,
      grossIncome: '250,000',
      incomeType: 'both',
      filingStatus: 'mfj',
      retirementLifestyle: '1.25',
      debtPayments: '',
      otherExpenses: '0',
      savings: '23500',
      currentType: 'roth',
      accountType: 'ira',
      knowsSocialSecurity: 'yes',
      socialSecurityBenefit: '42000',
      otherPretaxBalance: '0',
      otherRothBalance: '50000',
      otherTaxableBalance: '200000',
      otherTaxableBasis: '0.25',
      returnRate: '0.05',
    };
    expect(summaries(v)).toEqual({
      about: '$250,000 W-2 + 1099 · Married filing jointly · age 35, retiring at 65 · 25% higher retirement lifestyle',
      costs: 'None',
      contributions: '$23,500 a year · Roth · IRA',
      socialSecurity: '$42,000 a year (entered)',
      existing: 'Roth $50,000 · Taxable $200,000 (25% basis)',
      assumptions: '5% expected annual return',
    });
    // 0.6 = 40% lower; both costs present are joined with "+".
    const lower = { ...DEFAULT_FORM_VALUES, retirementLifestyle: '0.6', otherExpenses: '12000' };
    expect(INPUT_SECTIONS[0].summary(lower)).toMatch(/· 40% lower retirement lifestyle$/);
    expect(INPUT_SECTIONS[1].summary(lower)).toBe('$6,000 debt + $12,000 other a year');
  });

  it('flags a section whose inputs differ from the baseline', () => {
    const about = INPUT_SECTIONS[0];
    const costs = INPUT_SECTIONS[1];
    const changed = { ...DEFAULT_FORM_VALUES, currentAge: '40' };
    expect(sectionChanged(about, changed, DEFAULT_FORM_VALUES)).toBe(true);
    expect(sectionChanged(costs, changed, DEFAULT_FORM_VALUES)).toBe(false);
    expect(sectionChanged(about, changed, undefined)).toBe(false);
  });
});

describe('resultHeadlines', () => {
  // A hand-made result with only the fields the headlines read.
  const result = {
    retirementNeed: { target: 65380 },
    rates: { marginalNow: 0.22, effectiveRetirement: 0.1234, lean: 'pretax' },
    comparison: { winner: 'pretax', afterTaxIncomeDifference: 1234.4 },
    portfolio: { roth: { totalTaxPaid: 8000 }, pretax: { totalTaxPaid: 11250.6 } },
  };

  it('formats each card headline', () => {
    expect(resultHeadlines(result)).toEqual({
      need: '$65,380 a year after tax',
      rates: '22.0% now vs. 12.3% in retirement · tends to favor Pre-tax',
      tradeoff: 'Pre-tax ahead by $1,234 a year after tax',
      portfolio: 'Tax a year: All-Roth $8,000 vs. All-Pre-tax $11,251',
    });
  });

  it('says "About even" when neither side wins', () => {
    const even = { ...result, comparison: { winner: 'even', afterTaxIncomeDifference: 3 } };
    expect(resultHeadlines(even).tradeoff).toBe('About even');
  });
});
