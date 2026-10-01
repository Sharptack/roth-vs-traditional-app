import { describe, it, expect } from 'vitest';
import { accountsSummary, newAccountRow, visibleSections, HOUSEHOLD_SECTIONS } from '../src/lib/householdForm.js';
import { PREVIEW_DEFAULT_VALUES } from '../src/lib/household.js';

const summary = (id, values) => HOUSEHOLD_SECTIONS.find((s) => s.id === id).summary(values);

describe('household form sections', () => {
  it('shows the Spouse section only when a spouse is entered', () => {
    expect(visibleSections(PREVIEW_DEFAULT_VALUES).map((s) => s.id)).not.toContain('spouse');
    const v = { ...PREVIEW_DEFAULT_VALUES, filingStatus: 'mfj', includeSpouse: 'yes' };
    expect(visibleSections(v).map((s) => s.id)).toContain('spouse');
    expect(visibleSections({ ...v, filingStatus: 'single' }).map((s) => s.id)).not.toContain('spouse');
  });

  it('summarizes each section in one line', () => {
    expect(summary('household', PREVIEW_DEFAULT_VALUES)).toBe('Single');
    expect(summary('you', PREVIEW_DEFAULT_VALUES)).toBe('$100,000 · age 35, retires at 65');
    expect(summary('costs', PREVIEW_DEFAULT_VALUES)).toBe('$6,000 debt a year');
    expect(summary('contributions', PREVIEW_DEFAULT_VALUES)).toBe('$10,000 a year · Pre-tax · 401(k)');
    // the spouse's savings count only while a spouse is entered
    const couple = { ...PREVIEW_DEFAULT_VALUES, filingStatus: 'mfj', includeSpouse: 'yes', spouseSavings: '5000' };
    expect(summary('contributions', couple)).toBe('$15,000 a year · Pre-tax · 401(k)');
    expect(summary('contributions', { ...couple, includeSpouse: 'no' })).toBe('$10,000 a year · Pre-tax · 401(k)');
    expect(summary('existing', PREVIEW_DEFAULT_VALUES)).toBe('Pre-tax $100,000');
    expect(summary('assumptions', PREVIEW_DEFAULT_VALUES)).toBe('7% return after inflation · 2.5% inflation');
  });

  it('adds up accounts by type', () => {
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

  it('gives a new account an id no other row has', () => {
    expect(newAccountRow([{ id: 'a1' }, { id: 'a2' }]).id).toBe('a3');
    expect(newAccountRow([{ id: 'a2' }]).id).toBe('a3');
  });
});
