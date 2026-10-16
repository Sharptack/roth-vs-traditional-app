import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SocialSecurityResult from '../src/next/SocialSecurityResult.jsx';
import { socialSecurityView } from '../src/lib/socialSecurityCalculator.js';

// The Social Security page renders (before phase 6, asked 2026-10-12): the grid with monthly
// benefits in its headers, Year by year, and Break-even. The couple from
// socialSecurityLifetime.test.js: A born 1960, PIA 2,000, plan-to 80, claiming at 67; B born 1962,
// PIA 600, plan-to 90, claiming at 64 (766,400 in all).
const person = (id, birthYear, planToAge, pia, claimAge) => ({
  id,
  birthYear,
  retirementAge: 60,
  planToAge,
  wages: 0,
  selfEmploymentIncome: 0,
  socialSecurity: { mode: 'pia', known: false, pia, benefit: NaN, claimAge },
});
const couple = {
  year: 2026,
  filingStatus: 'mfj',
  people: [person('p1', 1960, 80, 2000, 67), person('p2', 1962, 90, 600, 64)],
  assumptions: { inflationRate: 0.025 },
  calculators: { socialSecurity: { discountRate: 0 } },
};
const render = (h) => renderToStaticMarkup(<SocialSecurityResult view={socialSecurityView(h)} survival={null} onUse={() => {}} />);

// Reworked 2026-10-16: the grid is "Claiming strategy" with its selection (the plan's to start)
// beside the most; Year by year a stacked bar chart with the table under it; Break-even two
// strategies of any ages; no per-person "when to claim" tables.
describe('the Social Security page', () => {
  it('a couple: Claiming strategy, Year by year, Break-even, in that order; no per-person tables', () => {
    const html = render(couple);
    const grid = html.indexOf('Claiming strategy');
    expect(grid).toBeGreaterThan(-1);
    expect(grid).toBeLessThan(html.indexOf('Year by year'));
    expect(html.indexOf('Year by year')).toBeLessThan(html.indexOf('Break-even'));
    expect(html).not.toContain('when to claim');
    expect(html).not.toContain('ss-dot');
    // A at 67 (full retirement age) = 2,000 a month; B at 64 = 480
    expect(html).toContain('$2,000/mo');
    expect(html).toContain('$480/mo');
    // the plan's cell is marked and selected; the selected set beside the most
    expect(html).toContain('plan-cell');
    expect(html).toContain('picked-cell');
    expect(html).toContain('Selected vs. the most');
    // A 70, B 64 (823,680) vs. the plan's 67/64 (766,400), hand-worked in socialSecurityLifetime.test.js
    expect(html).toContain('The selected compared with the most');
    // the year table sits in a details under the stacked bar chart
    expect(html).toMatch(/<details[^>]*><summary>The table, year by year<\/summary>/);
    expect(html).toContain('Running total');
    // Break-even: two strategies, each person's age chosen
    expect(html).toContain('Strategy 1');
    expect(html).toContain('Strategy 2');
    expect(html.match(/<select/g).length).toBeGreaterThanOrEqual(6); // 2 + 2 ages, the year by year strategy and dollars
  });
  it('one person: a one-row grid', () => {
    const html = render({ ...couple, filingStatus: 'single', people: [person('p1', 1960, 80, 2000, 67)] });
    expect(html).toContain('Claiming strategy');
    expect(html).toContain('Selected (the plan)');
    expect(html.match(/\/mo</g)).toHaveLength(5); // 66 to 70 open, each header with its monthly benefit
  });
});
