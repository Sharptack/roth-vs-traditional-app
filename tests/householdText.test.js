import { describe, it, expect } from 'vitest';
import { describeHousehold, householdShareText } from '../src/lib/householdText.js';
import { PREVIEW_DEFAULT_VALUES, toHousehold } from '../src/lib/household.js';

describe('the household as text', () => {
  it('one person: every input, labelled', () => {
    expect(describeHousehold(toHousehold(PREVIEW_DEFAULT_VALUES, 2026))).toEqual([
      '- Filing status: Single',
      '- You: age 35, retires at 65',
      '- You, income: $100,000 W-2',
      '- You, Social Security: estimated from earnings, claimed at retirement',
      '- Future Contributions, you: $10,000 per year, Pre-tax, 401(k)',
      '- Existing Account: Pre-tax $100,000',
      '- Costs ending before retirement: $6,000 debt, $0 other, per year',
      "- Retirement lifestyle: 100% of today's spending",
      '- Return after inflation: 7%',
      '- Inflation (fixed-dollar thresholds): 2.5%',
      '- Age 65+ deductions in retirement: included',
      '- Medicare IRMAA surcharges: included',
      '- Tax saved now: across the whole contribution',
    ]);
  });

  it('a couple: both people, their own savings types, and who owns each account', () => {
    const lines = describeHousehold(
      toHousehold(
        {
          ...PREVIEW_DEFAULT_VALUES,
          filingStatus: 'mfj',
          includeSpouse: 'yes',
          spouseIncome: '60000',
          spouseIncomeType: '1099',
          spouseSavings: '6000',
          spouseCurrentType: 'roth',
          spouseAccountType: 'ira',
          spouseKnowsSocialSecurity: 'yes',
          spouseSocialSecurityBenefit: '18000',
          spouseClaimAge: '67',
          accounts: [
            { id: 'a1', owner: 'p1', type: 'pretax', balance: '100000', basisShare: '0.5' },
            { id: 'a2', owner: 'p2', type: 'taxable', balance: '40000', basisShare: '0.25' },
          ],
        },
        2026,
      ),
    );
    expect(lines).toContain('- Filing status: Married Filing Jointly');
    expect(lines).toContain('- Spouse, income: $60,000 1099');
    expect(lines).toContain('- Spouse, Social Security: $18,000 per year (entered), claimed at 67');
    expect(lines).toContain('- Future Contributions, spouse: $6,000 per year, Roth, IRA');
    expect(lines).toContain('- Existing Account: you, Pre-tax $100,000');
    expect(lines).toContain('- Existing Account: spouse, Taxable $40,000, 25% cost basis');
  });

  it('the share text: link, inputs, then a line per calculator', () => {
    const text = householdShareText({
      household: toHousehold(PREVIEW_DEFAULT_VALUES, 2026),
      tiles: [{ title: 'Tax calculator', headline: '22.0% marginal · 11.0% effective', detail: '$10,970 federal income tax this year' }],
      url: 'https://example.test/?hh=1#/next',
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('Client household (2026 tax rules)');
    expect(lines[1]).toBe('Link: https://example.test/?hh=1#/next');
    expect(lines[lines.length - 1]).toBe('- Tax calculator: 22.0% marginal · 11.0% effective ($10,970 federal income tax this year)');
  });
});

describe('the household as text: ages (2026-10-09)', () => {
  it('a blank retirement age, an already-retired person, the life expectancy; receiving Social Security', async () => {
    const { toHouseholdV2 } = await import('../src/lib/householdV2.js');
    const { DEFAULT_HOUSEHOLD_VALUES: D, newPerson } = await import('../src/lib/householdValues.js');
    const blank = describeHousehold(toHouseholdV2({ ...D, people: [newPerson('p1', { age: '49', retirementAge: '', planToAge: '' })] }, 2026));
    expect(blank).toContain('- You: age 49, retirement age not entered');
    const retired = describeHousehold(
      toHouseholdV2({ ...D, people: [newPerson('p1', { age: '75', retirementAge: '65' })], incomes: [{ ...D.incomes[1], ssMode: 'receiving', amount: '2500' }] }, 2026),
    );
    expect(retired).toContain('- You: age 75, retired at 65, life expectancy 95');
    expect(retired).toContain('- You, Social Security: $2,500 per month, received now');
  });
});
