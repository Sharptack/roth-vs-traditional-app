import { describe, it, expect } from 'vitest';
import { rothTile, taxTile } from '../src/lib/suiteTiles.js';
import { householdToYearTaxParams, taxCalculatorResult } from '../src/lib/taxCalculator.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';

const Y = 2026;
const household = (v = {}) => toHousehold({ ...PREVIEW_DEFAULT_VALUES, ...v }, Y);

describe('homepage tiles', () => {
  it('Roth: the winner and the dollars, from the comparison', () => {
    const r = compareRothVsTraditional(householdToCompareInputs(household()));
    const tile = rothTile(r);
    const who = r.comparison.winner === 'roth' ? 'Roth' : r.comparison.winner === 'pretax' ? 'Pre-tax' : null;
    if (who) expect(tile.headline).toMatch(new RegExp(`^${who} \\+\\$[\\d,]+/yr$`));
    else expect(tile.headline).toBe('About even');
    expect(tile.detail).toMatch(/^Tax saved now \d+(\.\d)?% vs\. \d+(\.\d)?% on the withdrawal later$/);
  });

  it('Roth: invalid inputs say so', () => {
    const r = compareRothVsTraditional(householdToCompareInputs(household({ grossIncome: '' })));
    expect(rothTile(r)).toEqual({ headline: 'Needs inputs', detail: 'Enter your total gross income.' });
  });

  it('Tax: the marginal (bracket), effective (next dollar) and average rates (default household: 22%, 22%, 10,970 / 100,000)', () => {
    const t = taxCalculatorResult(householdToYearTaxParams(household()));
    expect(taxTile(t)).toEqual({ headline: '22% marginal · 22.0% EMTR', detail: '11.0% average tax rate: $10,970 federal income tax this year' });
  });
});
