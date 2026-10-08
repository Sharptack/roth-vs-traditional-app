import { describe, it, expect } from 'vitest';
import {
  ALL_SECTION_IDS,
  ASSUMPTION_FIELDS,
  CALCULATOR_INPUTS,
  INPUT_SECTIONS,
  PERSON_FIELDS,
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
    expect(summary('household', D)).toBe('Single');
    expect(summary('people', D)).toBe('You 35, retires at 65');
    expect(summary('income', D)).toBe('W-2 $100,000');
    expect(summary('contributions', D)).toBe('$10,000 a year · Pre-tax · 401(k)');
    expect(summary('accounts', D)).toBe('Pre-tax $100,000');
    expect(summary('liabilities', D)).toBe('None');
    expect(summary('spending', D)).toBe('$6,000 a year ends at retirement · retirement spending same as today');
    expect(summary('assumptions', D)).toBe('7% return after inflation · 2.5% inflation');
    expect(summary('projection', D)).toBe('To age 95 · heirs taxed at 24% · proportional (every account alike)');
    expect(summary('conversion', D)).toBe('Convert $50,000 this year');
    expect(summary('pension', D)).toBe('$300,000 or $1,800 a month from 65');
  });

  it('adds up a couple by type, and leaves the spouse out when not included', () => {
    const v = couple();
    expect(summary('household', v)).toBe('Married filing jointly · two people');
    expect(summary('people', v)).toBe('You 35, retires at 65 · Spouse 35, retires at 65');
    // W-2: 100,000 + 50,000 = 150,000
    expect(summary('income', v)).toBe('W-2 $150,000 · 1099 $20,000');
    // two kinds (Pre-tax 401(k), Roth 401(k)) -> totals by type
    expect(summary('contributions', v)).toBe('Pre-tax $10,000 · Roth $5,000 a year');
    const without = setIncludeSpouse(v, false);
    expect(summary('household', without)).toBe('Married filing jointly · one combined income');
    expect(summary('people', without)).toBe('You 35, retires at 65');
    expect(summary('income', without)).toBe('W-2 $100,000 · 1099 $20,000');
    expect(summary('contributions', without)).toBe('$10,000 a year · Pre-tax · 401(k)');
  });

  it('summarizes debts, spending and assumptions', () => {
    let v = addRow(D, 'liabilities', { balance: '250000', rate: '0.06', payment: '1800' });
    expect(summary('liabilities', v)).toBe('Mortgage · $250,000 · $1,800 a month');
    v = addRow(v, 'liabilities', { kind: 'car', balance: '15000', rate: '0.07', payment: '400' });
    // 250,000 + 15,000 = 265,000; 1,800 + 400 = 2,200
    expect(summary('liabilities', v)).toBe('2 debts · $265,000 · $2,200 a month');

    v = setGroupField(setGroupField(D, 'spending', 'otherExpenses', '2000'), 'spending', 'retirementLifestyle', '0.8');
    // 6,000 + 2,000 = 8,000; 0.8 = 20% lower
    expect(summary('spending', v)).toBe('$8,000 a year ends at retirement · retirement spending 20% lower');
    v = setGroupField(setGroupField(v, 'spending', 'debtPayments', ''), 'spending', 'otherExpenses', '0');
    expect(summary('spending', setGroupField(v, 'spending', 'retirementLifestyle', '1.25'))).toBe('Retirement spending 25% higher');

    v = setGroupField(setGroupField(D, 'assumptions', 'retirementRateShift', '-0.02'), 'assumptions', 'medicareIrmaa', 'no');
    expect(summary('assumptions', v)).toBe('7% return after inflation · 2.5% inflation · rates −2 pts in retirement · no IRMAA');
  });

  it('shows one kind of taxable contribution without an account type', () => {
    const v = updateRow(D, 'contributions', 'c1', 'tax', 'taxable');
    expect(summary('contributions', v)).toBe('$10,000 a year · Taxable');
  });
});

describe('the inputs each calculator reads', () => {
  it('lists only known sections and fields, with no repeats, its own section first', () => {
    for (const [id, { sections, fields = {} }] of Object.entries(CALCULATOR_INPUTS)) {
      expect(sections.every((s) => ALL_SECTION_IDS.includes(s)), id).toBe(true);
      expect(new Set(sections).size, id).toBe(sections.length);
      for (const f of fields.people ?? []) expect(PERSON_FIELDS).toContain(f);
      for (const f of fields.assumptions ?? []) expect(ASSUMPTION_FIELDS).toContain(f);
    }
    expect(CALCULATOR_INPUTS.roth.sections[0]).toBe('contributions');
    expect(CALCULATOR_INPUTS.tax.sections[0]).toBe('income');
    expect(CALCULATOR_INPUTS.pension.sections[0]).toBe('pension');
  });

  it('keeps the order given and skips unknown ids', () => {
    expect(inputSections(['income', 'nope', 'household']).map((s) => s.id)).toEqual(['income', 'household']);
    expect(inputSections().map((s) => s.id)).toEqual(ALL_SECTION_IDS);
  });
});
