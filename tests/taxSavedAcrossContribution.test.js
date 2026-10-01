import { describe, it, expect } from 'vitest';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from '../src/lib/formInputs.js';

const Y = 2026;
// Single, $76,500 wages: taxable 76,500 - 16,100 = 60,400, i.e. $10,000 into the 22% bracket
// (which starts at 50,400). Tax with no deduction: 1,240 + 4,560 + 22% x 10,000 (2,200) = 8,000.
const inputs = (over, on = true) => ({
  ...toCompareInputs({ ...DEFAULT_FORM_VALUES, grossIncome: '76500', otherPretaxBalance: '0', ...over }, Y),
  taxSavedAcrossContribution: on,
});

describe('tax saved now across the whole contribution (2026, HAND CALC)', () => {
  it('a $20,000 Pre-tax saver: 22% on the first $10,000, 12% on the rest = 17%', () => {
    // deduct 20,000: taxable 40,400 -> 1,240 + 12% x 28,000 (3,360) = 4,600; saved 3,400 = 17%
    // same take-home cost: 20,000 - 3,400 = 16,600 -> the Roth equivalent
    // (the marginal-rate rule says 20,000 x 0.78 = 15,600)
    const r = compareRothVsTraditional(inputs({ savings: '20000', currentType: 'pretax' }));
    expect(r.rates.marginalNow).toBe(0.22);
    expect(r.rates.contributionRate).toBeCloseTo(0.17, 12);
    expect(r.rates.contributionRateBasis).toBe('average');
    expect(r.contributionSplit.takeHomeCost).toBeCloseTo(16600, 6);
    expect(r.contributionSplit.roth.toAccount).toBeCloseTo(16600, 6);
    expect(r.contributionSplit.pretax.toAccount).toBeCloseTo(20000, 6);
    expect(r.rates.taxSavedNow).toBeCloseTo(0.17, 10); // nothing over the limit
    const old = compareRothVsTraditional(inputs({ savings: '20000', currentType: 'pretax' }, false));
    expect(old.contributionSplit.roth.toAccount).toBeCloseTo(15600, 6);
    expect(old.rates.contributionRateBasis).toBe('marginal');
  });

  it('a $16,600 Roth saver: the same take-home cost buys $20,000 Pre-tax', () => {
    // A - saved(A) = 16,600 at A = 20,000 (saved 3,400)
    const r = compareRothVsTraditional(inputs({ savings: '16600', currentType: 'roth' }));
    expect(r.contributionSplit.pretax.toAccount).toBeCloseTo(20000, 4);
    expect(r.rates.contributionRate).toBeCloseTo(0.17, 8);
  });

  it('over the limit: only the deductible $24,500 saves tax, at its own average rate', () => {
    // Pre-tax saver of 30,000, limit 24,500. Deduct 24,500: taxable 35,900 -> 1,240 + 12% x 23,500
    // (2,820) = 4,060; saved 8,000 - 4,060 = 3,940; rate 3,940 / 24,500 = 0.1608163
    // take-home cost 24,500 - 3,940 + 5,500 = 26,060
    // Roth: 24,500 to the account, 1,560 to taxable. Pre-tax: 24,500, and 26,060 - 20,560 = 5,500
    const r = compareRothVsTraditional(inputs({ savings: '30000', currentType: 'pretax' }));
    expect(r.rates.contributionRate).toBeCloseTo(3940 / 24500, 10);
    expect(r.contributionSplit.takeHomeCost).toBeCloseTo(26060, 6);
    expect(r.contributionSplit.roth.excessToTaxable).toBeCloseTo(1560, 6);
    expect(r.contributionSplit.pretax.toAccount).toBe(24500);
    expect(r.contributionSplit.pretax.excessToTaxable).toBeCloseTo(5500, 6);
  });

  it('the blend explorer: each mix saves its own average rate', () => {
    // the $20,000 Pre-tax saver (take-home cost 16,600). Half Roth: the Pre-tax half P = A/2.
    // If P <= 10,000 it all saves 22%: A - 0.22 x A/2 = 0.89 A = 16,600 -> A = 18,651.69,
    // P = 9,325.84 (<= 10,000, so consistent); rate 22%.
    const r = compareRothVsTraditional(inputs({ savings: '20000', currentType: 'pretax' }));
    const half = r.blend.points[50];
    expect(half.rothShare).toBe(0.5);
    expect(half.rateNow).toBeCloseTo(0.22, 10);
    expect(half.pretaxToAccount).toBeCloseTo(16600 / 0.89 / 2, 4);
    expect(half.rothToAccount).toBeCloseTo(16600 / 0.89 / 2, 4);
    // the ends match the comparison's own split
    expect(r.blend.points[0].pretaxToAccount).toBeCloseTo(20000, 4);
    expect(r.blend.points[100].rothToAccount).toBeCloseTo(16600, 6);
  });

  it("off (the default): exactly today's result", () => {
    const base = toCompareInputs({ ...DEFAULT_FORM_VALUES }, Y);
    expect(compareRothVsTraditional({ ...base, taxSavedAcrossContribution: false })).toEqual(
      { ...compareRothVsTraditional(base) },
    );
  });
});
