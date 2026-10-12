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
const render = (h) => renderToStaticMarkup(<SocialSecurityResult view={socialSecurityView(h)} effect={null} survival={null} onUse={() => {}} />);

describe('the Social Security page', () => {
  it('a couple: the grid first, with monthly benefits in the headers, then Year by year and Break-even', () => {
    const html = render(couple);
    const grid = html.indexOf('Every pair of claiming ages');
    expect(grid).toBeGreaterThan(-1);
    expect(grid).toBeLessThan(html.indexOf('Year by year'));
    expect(html.indexOf('Year by year')).toBeLessThan(html.indexOf('Break-even'));
    expect(html.indexOf('Break-even')).toBeLessThan(html.indexOf('You: when to claim'));
    // A at 67 (full retirement age) = 2,000 a month; B at 64 = 480
    expect(html).toContain('$2,000/mo');
    expect(html).toContain('$480/mo');
    // the plan's cell is marked; the year table opens on the most (the first strategy)
    expect(html).toContain('plan-cell');
    expect(html).toContain('Running total');
  });
  it('one person: a one-row grid', () => {
    const html = render({ ...couple, filingStatus: 'single', people: [person('p1', 1960, 80, 2000, 67)] });
    expect(html).toContain('Every claiming age');
    expect(html).toContain('Claim at 67 (the plan)'); // the plan's age is compared from the start
    expect(html.match(/\/mo</g)).toHaveLength(5); // 66 to 70 open, each header with its monthly benefit
  });
});
