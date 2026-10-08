import { describe, it, expect } from 'vitest';
import { resultHeadlines } from '../src/lib/sectionSummaries.js';
import { DEFAULT_FORM_VALUES } from '../src/lib/formInputs.js';

describe('resultHeadlines', () => {
  // A hand-made result with only the fields the headlines read.
  const result = {
    retirementNeed: { target: 65380 },
    rates: { marginalNow: 0.22, effectiveRetirement: 0.1234, lean: 'pretax' },
    comparison: { winner: 'pretax', afterTaxIncomeDifference: 1234.4 },
    portfolio: {
      roth: { impliedWithdrawalRate: 0.020904, totalValue: 940608.15 },
      pretax: { impliedWithdrawalRate: 0.020776, totalValue: 1147211.98 },
    },
    blend: {
      available: true,
      best: { rothShare: 0.56, totalAfterTaxIncome: 35103.67 },
      points: [{ totalAfterTaxIncome: 33432.7 }, { totalAfterTaxIncome: 33250.2 }],
    },
  };

  it('formats each card headline', () => {
    expect(resultHeadlines(result)).toEqual({
      need: '$65,380 a year after tax',
      buildup: '$940,608 Roth vs. $1,147,212 Pre-tax at retirement',
      rates: '22.0% now vs. 12.3% in retirement · tends to favor Pre-tax',
      tradeoff: 'Pre-tax ahead by $1,234 a year after tax',
      blend: 'Best mix: 56% Roth, $1,671/yr more than either pure strategy',
      portfolio: 'Withdrawal rate needed: All-Roth 2.09% vs. All-Pre-tax 2.08%',
    });
  });

  it('says "About even" when neither side wins', () => {
    const even = { ...result, comparison: { winner: 'even', afterTaxIncomeDifference: 3 } };
    expect(resultHeadlines(even).tradeoff).toBe('About even');
  });

  it('blend headline: "Nothing saved to split" when unavailable, "all Pre-tax/Roth" when a pure strategy wins', () => {
    const none = { ...result, blend: { available: false } };
    expect(resultHeadlines(none).blend).toBe('Nothing saved to split');
    const purePretax = {
      ...result,
      blend: {
        available: true,
        best: { rothShare: 0, totalAfterTaxIncome: 35378.69 },
        points: [{ totalAfterTaxIncome: 35378.69 }, { totalAfterTaxIncome: 29471.77 }],
      },
    };
    expect(resultHeadlines(purePretax).blend).toBe('Best mix: all Pre-tax');
  });
});
