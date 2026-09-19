import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent, formatMultiple } from '../src/lib/format.js';
import { DEFAULT_FORM_VALUES, parseNumber, toCompareInputs } from '../src/lib/formInputs.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';

describe('formatCurrency', () => {
  it('formats whole dollars with separators', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,568');
    expect(formatCurrency(0)).toBe('$0');
  });
  it('supports one decimal place', () => {
    expect(formatCurrency(1234.56, 1)).toBe('$1,234.6');
  });
  it('formats negatives, without "-$0"', () => {
    expect(formatCurrency(-2500)).toBe('-$2,500');
    expect(formatCurrency(-0.2)).toBe('$0');
  });
  it('shows a dash for non-finite values', () => {
    expect(formatCurrency(NaN)).toBe('—');
  });
});

describe('formatPercent / formatMultiple', () => {
  it('formats decimals as percentages', () => {
    expect(formatPercent(0.121915)).toBe('12.2%');
    expect(formatPercent(0.22, 0)).toBe('22%');
    expect(formatPercent(0)).toBe('0.0%');
  });
  it('formats multiples', () => {
    expect(formatMultiple(2.3073)).toBe('2.31×');
  });
});

describe('parseNumber', () => {
  it('handles currency text', () => {
    expect(parseNumber('$1,234.50')).toBe(1234.5);
    expect(parseNumber(' 75000 ')).toBe(75000);
    expect(parseNumber('12.')).toBe(12);
    expect(parseNumber('.5')).toBe(0.5);
  });
  it('returns NaN for blank or junk', () => {
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('1.2.3')).toBeNaN();
    expect(parseNumber(undefined)).toBeNaN();
  });
});

describe('toCompareInputs', () => {
  it('the default form values produce a valid comparison', () => {
    const result = compareRothVsTraditional(toCompareInputs(DEFAULT_FORM_VALUES, 2025));
    expect(result.valid).toBe(true);
  });
  it('treats blank optional dollar fields as zero, but blank income/ages as invalid', () => {
    const blankOptional = toCompareInputs({ ...DEFAULT_FORM_VALUES, debtPayments: '', otherRothBalance: '' }, 2025);
    expect(blankOptional.debtPayments).toBe(0);
    expect(blankOptional.otherRothBalance).toBe(0);
    const blankIncome = compareRothVsTraditional(toCompareInputs({ ...DEFAULT_FORM_VALUES, grossIncome: '' }, 2025));
    expect(blankIncome.valid).toBe(false);
  });
  it('converts the SS toggle and return rate', () => {
    const inputs = toCompareInputs(
      { ...DEFAULT_FORM_VALUES, knowsSocialSecurity: 'yes', socialSecurityBenefit: '$24,000', returnRate: '0.09' },
      2025,
    );
    expect(inputs.knowsSocialSecurity).toBe(true);
    expect(inputs.socialSecurityBenefit).toBe(24000);
    expect(inputs.returnRate).toBe(0.09);
  });
  it('"yes" with a blank benefit is flagged rather than silently zero', () => {
    const r = compareRothVsTraditional(
      toCompareInputs({ ...DEFAULT_FORM_VALUES, knowsSocialSecurity: 'yes', socialSecurityBenefit: '' }, 2025),
    );
    expect(r.valid).toBe(false);
  });
});
