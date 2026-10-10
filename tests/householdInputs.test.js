import { describe, it, expect } from 'vitest';
import {
  ALL_SECTION_IDS,
  ASSUMPTION_FIELDS,
  CALCULATOR_INPUTS,
  INPUT_GROUPS,
  INPUT_SECTIONS,
  PERSON_FIELDS,
  accountsSummary,
  incomeRowSummary,
  accountRowSummary,
  inputSections,
} from '../src/lib/householdInputs.js';
import { DEFAULT_HOUSEHOLD_VALUES as D, addRow, setGroupField, setIncludeSpouse, updateRow } from '../src/lib/householdValues.js';

const summary = (id, values) => INPUT_SECTIONS.find((s) => s.id === id).summary(values);

// A couple: you $100,000 W-2 + $20,000 1099, Pre-tax 401(k) $10,000; the spouse $50,000 W-2,
// Roth 401(k) $5,000.
function couple() {
  let v = setIncludeSpouse({ ...D, filingStatus: 'mfj' }, true);
  v = addRow(v, 'incomes', { type: '1099', amount: '20000' });
  v = addRow(v, 'incomes', { owner: 'p2', amount: '50000' });
  v = addRow(v, 'contributions', { owner: 'p2', tax: 'roth', amount: '5000' });
  return v;
}

describe('the version 2 inputs: section summaries', () => {
  it('summarizes the default household', () => {
    expect(summary('household', D)).toBe('Single · You 35, retires at 65, life expectancy 95');
    expect(summary('income', D)).toBe('W-2 $100,000 · Social Security estimated');
    expect(summary('contributions', D)).toBe('$10,000 per year · Pre-tax · 401(k)');
    expect(summary('accounts', D)).toBe('Pre-tax $100,000');
    expect(summary('liabilities', D)).toBe('None');
    expect(summary('deductions', D)).toBe('The standard deduction');
    expect(summary('deductions', setGroupField(D, 'deductions', 'itemized', '30000'))).toBe('Itemized $30,000 per year, when more than the standard deduction');
    expect(summary('spending', D)).toBe('$6,000 per year ends at retirement · retirement spending same as today');
    expect(summary('assumptions', D)).toBe('7% return after inflation · 2.5% inflation · proportional (every account alike) in retirement · heirs taxed at 24%');
    expect(summary('assumptions', { ...D, assumptions: { ...D.assumptions, retirementReturnRate: '0.05' } })).toMatch(/^7% return after inflation, 5% in retirement · /);
    expect(summary('projection', D)).toBe('Proportional (every account alike) · heirs taxed at 24%');
    expect(summary('conversion', D)).toBe('Convert $50,000 this year');
    expect(summary('pension', D)).toBe('No pension yet');
    const withPension = addRow(D, 'incomes', { type: 'pension', amount: '1800', fromAge: '65' });
    expect(summary('pension', withPension)).toBe('$300,000 or $1,800 per month from 65 · the plan takes the monthly payments');
    expect(summary('income', withPension)).toBe('W-2 $100,000 · Social Security estimated · Pension $1,800/mo from 65');
    // other income by kind; an entered PIA
    let other = addRow(D, 'incomes', { type: 'other', treatment: 'qualified', amount: '8000' });
    other = updateRow(updateRow(other, 'incomes', 'i2', 'ssMode', 'pia'), 'incomes', 'i2', 'amount', '2400');
    expect(summary('income', other)).toBe('W-2 $100,000 · Qualified $8,000 · Social Security $2,400/mo PIA');
  });

  it('adds up a couple by type, and leaves the spouse out when not included', () => {
    const v = couple();
    expect(summary('household', v)).toBe('Married filing jointly · You 35, retires at 65, life expectancy 95 · Spouse 35, retires at 65, life expectancy 95');
    // W-2: 100,000 + 50,000 = 150,000
    expect(summary('income', v)).toBe("W-2 $150,000 · 1099 $20,000 · Your Social Security estimated · Spouse's Social Security estimated");
    // two kinds (Pre-tax 401(k), Roth 401(k)) -> totals by type
    expect(summary('contributions', v)).toBe('Pre-tax $10,000 · Roth $5,000 per year');
    const without = setIncludeSpouse(v, false);
    expect(summary('household', without)).toBe('Married filing jointly, one combined income · You 35, retires at 65, life expectancy 95');
    expect(summary('income', without)).toBe('W-2 $100,000 · 1099 $20,000 · Social Security estimated');
    expect(summary('contributions', without)).toBe('$10,000 per year · Pre-tax · 401(k)');
  });

  it('summarizes debts, spending and assumptions', () => {
    let v = addRow(D, 'liabilities', { balance: '250000', rate: '0.06', payment: '1800' });
    expect(summary('liabilities', v)).toBe('Mortgage · $250,000 · $1,800 per month');
    v = addRow(v, 'liabilities', { kind: 'car', balance: '15000', rate: '0.07', payment: '400' });
    // 250,000 + 15,000 = 265,000; 1,800 + 400 = 2,200
    expect(summary('liabilities', v)).toBe('2 debts · $265,000 · $2,200 per month');

    v = setGroupField(setGroupField(D, 'spending', 'otherExpenses', '2000'), 'spending', 'retirementLifestyle', '0.8');
    // 6,000 + 2,000 = 8,000; 0.8 = 20% lower
    expect(summary('spending', v)).toBe('$8,000 per year ends at retirement · retirement spending 20% lower');
    v = setGroupField(setGroupField(v, 'spending', 'debtPayments', ''), 'spending', 'otherExpenses', '0');
    expect(summary('spending', setGroupField(v, 'spending', 'retirementLifestyle', '1.25'))).toBe('Retirement spending 25% higher');

    v = setGroupField(setGroupField(D, 'assumptions', 'retirementRateShift', '-0.02'), 'assumptions', 'medicareIrmaa', 'no');
    expect(summary('assumptions', v)).toBe('7% return after inflation · 2.5% inflation · rates −2 pts in retirement · no IRMAA · proportional (every account alike) in retirement · heirs taxed at 24%');
    expect(summary('assumptions', { ...v, assumptions: { ...v.assumptions, dividendYield: '0.02' } })).toContain('no IRMAA · 2% dividends · proportional');
    expect(summary('assumptions', { ...v, assumptions: { ...v.assumptions, dividendYield: '0' } })).toContain('no IRMAA · no dividends · proportional');
  });

  it('adds up accounts by type (blank balances count as 0)', () => {
    expect(
      accountsSummary([
        { type: 'roth', balance: '20000' },
        { type: 'pretax', balance: '100,000' },
        { type: 'pretax', balance: '' },
        { type: 'roth', balance: '5000' },
      ]),
    ).toBe('Pre-tax $100,000 · Roth $25,000');
    expect(accountsSummary([])).toBe('None');
  });

  it('shows one kind of taxable contribution without an account type', () => {
    const v = updateRow(D, 'contributions', 'c1', 'tax', 'taxable');
    expect(summary('contributions', v)).toBe('$10,000 per year · Taxable');
  });
});

describe('the inputs each calculator reads', () => {
  it('lists only known sections and fields, with no repeats, its own section first', () => {
    const known = INPUT_SECTIONS.map((s) => s.id);
    for (const [id, { sections, fields = {} }] of Object.entries(CALCULATOR_INPUTS)) {
      expect(sections.every((s) => known.includes(s)), id).toBe(true);
      expect(new Set(sections).size, id).toBe(sections.length);
      for (const f of fields.people ?? []) expect(PERSON_FIELDS).toContain(f);
      for (const f of fields.assumptions ?? []) expect(ASSUMPTION_FIELDS).toContain(f);
    }
    expect(CALCULATOR_INPUTS.roth.sections[0]).toBe('contributions');
    expect(CALCULATOR_INPUTS.tax.sections[0]).toBe('income');
    expect(CALCULATOR_INPUTS.pension.sections[0]).toBe('pension');
  });

  it('the inputs page: four groups, every household section once; the calculator-only sections are not on it', () => {
    expect(INPUT_GROUPS.map((g) => g.title)).toEqual(['Household', 'Income and expenses', 'Assets and liabilities', 'Assumptions']);
    expect(ALL_SECTION_IDS).toEqual(['household', 'dependents', 'income', 'contributions', 'spending', 'legacy', 'deductions', 'accounts', 'liabilities', 'assumptions']);
    expect(INPUT_SECTIONS.map((s) => s.id).filter((id) => !ALL_SECTION_IDS.includes(id))).toEqual(['projection', 'conversion', 'pension']);
    expect(CALCULATOR_INPUTS.roth.titles).toEqual({ contributions: 'Future Contributions' });
  });

  it('keeps the order given and skips unknown ids', () => {
    expect(inputSections(['income', 'nope', 'household']).map((s) => s.id)).toEqual(['income', 'household']);
    expect(inputSections().map((s) => s.id)).toEqual(ALL_SECTION_IDS);
  });
});

describe('sectionChanged', () => {
  it('marks only the section whose values differ', async () => {
    const { sectionChanged, ALL_SECTION_IDS } = await import('../src/lib/householdInputs.js');
    const changed = updateRow(D, 'contributions', 'c1', 'tax', 'roth');
    expect(ALL_SECTION_IDS.filter((id) => sectionChanged(id, D, changed))).toEqual(['contributions']);
    expect(ALL_SECTION_IDS.filter((id) => sectionChanged(id, D, D))).toEqual([]);
  });
});

describe('an income row, closed (decided 2026-10-09): its type and amount on one line', () => {
  const row = (fields) => ({ owner: 'p1', type: 'w2', treatment: 'ordinary', amount: '', fromAge: '', toAge: '', ssMode: 'estimate', ...fields });
  it('earnings and other income: per year, with any ages', () => {
    expect(incomeRowSummary(row({ amount: '100000' }))).toBe('W-2 wages · $100,000 per year');
    expect(incomeRowSummary(row({ type: '1099', amount: '20000', fromAge: '60', toAge: '65' }))).toBe('1099 (self-employed) · $20,000 per year · from 60 to 65');
    expect(incomeRowSummary(row({ type: 'other', treatment: 'qualified', amount: '5000', toAge: '70' }))).toBe(
      'Other: Qualified dividends, long-term gains · $5,000 per year · to 70',
    );
    expect(incomeRowSummary(row({}))).toBe('W-2 wages · no amount yet');
  });
  it('Social Security and pensions: per month; whose, with a spouse', () => {
    expect(incomeRowSummary(row({ type: 'socialSecurity' }))).toBe('Social Security · estimated from earnings');
    expect(incomeRowSummary(row({ type: 'socialSecurity', ssMode: 'pia', amount: '2500', fromAge: '67' }))).toBe(
      'Social Security · $2,500 per month at full retirement age',
    );
    expect(incomeRowSummary(row({ type: 'pension', amount: '1800', fromAge: '65', owner: 'p2' }), true)).toBe('Pension · $1,800 per month from 65 · Spouse');
    expect(incomeRowSummary(row({ type: 'pension', amount: '1800', fromAge: '65', lumpSum: '300000', election: 'lumpSum' }))).toBe('Pension · $300,000 lump sum, rolled over at 65');
  });
});

describe('accountRowSummary (an account row, closed; 2026-10-09)', () => {
  it('type, balance, a taxable account\'s basis, and whose with a spouse', () => {
    expect(accountRowSummary({ type: 'pretax', owner: 'p1', balance: '100000', basisShare: '0.5' })).toBe('Pre-tax · $100,000');
    expect(accountRowSummary({ type: 'taxable', owner: 'p2', balance: '50000', basisShare: '0.25' }, true)).toBe('Taxable · $50,000 · 25% basis · Spouse');
    expect(accountRowSummary({ type: 'roth', owner: 'p1', balance: '' })).toBe('Roth · no balance yet');
  });
});
