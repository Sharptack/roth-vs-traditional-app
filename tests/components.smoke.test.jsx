import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App.jsx';
import DocsPage from '../src/components/DocsPage.jsx';
import articleMarkdown from '../articles/roth.md?raw';
import ResultsSummary from '../src/components/ResultsSummary.jsx';
import ScenarioCompare from '../src/components/ScenarioCompare.jsx';
import ScenariosPage from '../src/components/ScenariosPage.jsx';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from '../src/lib/formInputs.js';
import { SCENARIO_BATCHES } from '../src/data/scenarioBatches.js';

// Smoke tests: the real components render without throwing, and show the
// labels the spec calls for. (Numbers are verified in the lib tests.)
const render = (overrides = {}) =>
  renderToStaticMarkup(
    <ResultsSummary
      result={compareRothVsTraditional(toCompareInputs({ ...DEFAULT_FORM_VALUES, ...overrides }, 2025))}
    />,
  );

describe('ResultsSummary', () => {
  it('renders all three sections with the spec labels', () => {
    const html = render();
    for (const text of [
      'Retirement income number',
      'Tax saved now, after any tax on investing it',
      'Effective rate on the account withdrawal',
      'Current possible contribution',
      'After-tax comparison',
      'A single year’s contribution',
      'Value at retirement',
      'After-tax value',
      'Future Contributions at retirement',
      'After-tax income it generates',
      'After-tax income at a 4% withdrawal',
      'After-tax income',
      'All-Roth scenario',
      'All-Pre-tax scenario',
      'Total future portfolio value',
      'Total gross withdrawal needed',
      'Total tax paid',
      'After-tax income achieved',
      'Estimates only — not tax or financial advice',
    ]) {
      expect(html).toContain(text);
    }
  });

  it('shows the contribution-limit warning only at/near the limit', () => {
    expect(render({ savings: '10000' })).not.toContain('contribution limit');
    expect(render({ savings: '22000' })).toContain('at/near the 2025 401(k) contribution limit of $23,500');
  });


  it('gives the retirement number its own section, with a note on what it means', () => {
    const html = render();
    const sec1 = html.slice(html.indexOf('id="sec1"'), html.indexOf('id="sec2"'));
    expect(sec1).toContain('Retirement income number</span>');
    expect(sec1).toContain('class="hero"');
    expect(sec1).toContain('What this number is:');
    expect(sec1).toContain('the after-tax amount you need each year in retirement');
    expect(sec1).toContain('the amount you actually');
    // the rates are NOT in this section any more
    expect(sec1).not.toContain('Marginal rate while working');
    expect(sec1).not.toContain('Effective rate');
  });

  it('shows a portfolio card between the retirement number and the rates: Future Contributions, Existing Accounts, total', () => {
    const html = render();
    const buildup = html.slice(html.indexOf('id="sec-portfolio"'), html.indexOf('id="sec2"'));
    expect(buildup).toContain('Your portfolio at retirement</span>');
    // two groups, then the total, in that order
    const order = ['Future Contributions', 'Your contribution this year', 'Grown to retirement', 'Existing Accounts', 'Grown to retirement', 'Total portfolio at retirement'];
    let at = -1;
    for (const label of order) {
      const next = buildup.indexOf(label, at + 1);
      expect(next, label).toBeGreaterThan(at);
      at = next;
    }
    // $7,800 Roth / $10,000 Pre-tax a year; the existing $100,000 grown 30 years at 7%
    expect(buildup).toContain('For the same take-home pay</span></th><td>$7,800</td><td>$10,000</td>');
    expect(buildup).toContain('Same either way</span></th><td>$761,226</td><td>$761,226</td>');
    expect(buildup).toContain('class="breakdown"'); // reuses the same bucket breakdown as Section 3
    // one contribution line, no explanation blocks
    expect(buildup).not.toContain('Why this matters');
    expect(buildup).not.toContain('To your account');
    expect(buildup).not.toContain('Total contribution');
    expect(buildup).not.toContain('How is this calculated?');
    expect(buildup).not.toContain('in a taxable account');
    expect(buildup).not.toMatch(/NaN|Infinity/);
  });

  it('notes the taxable-account part of the contribution only when savings exceed the IRS limit', () => {
    const under = render({ savings: '10000' });
    const buildupUnder = under.slice(under.indexOf('id="sec-portfolio"'), under.indexOf('id="sec2"'));
    expect(buildupUnder).not.toContain('in a taxable account');
    const over = render({ grossIncome: '150000', savings: '30000', otherPretaxBalance: '0' });
    const buildupOver = over.slice(over.indexOf('id="sec-portfolio"'), over.indexOf('id="sec2"'));
    expect(buildupOver).toContain('in a taxable account (over the IRS limit)');
  });

  it('handles $0 saved without NaN', () => {
    const html = render({ savings: '0' });
    const buildup = html.slice(html.indexOf('id="sec-portfolio"'), html.indexOf('id="sec2"'));
    expect(buildup).not.toMatch(/NaN|Infinity/);
    expect(buildup).toContain('For the same take-home pay</span></th><td>$0</td><td>$0</td>');
  });

  it('gives the rates their own Tax rate comparison block, followed by the After-tax comparison', () => {
    const html = render();
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec-tradeoff"'));
    const trade = html.slice(html.indexOf('id="sec-tradeoff"'), html.indexOf('id="sec3"'));
    const sec3 = html.slice(html.indexOf('id="sec3"'));
    // order: retirement number, portfolio build-up, rates, trade-off, total portfolio tax
    expect(html.indexOf('id="sec1"')).toBeLessThan(html.indexOf('id="sec-portfolio"'));
    expect(html.indexOf('id="sec-portfolio"')).toBeLessThan(html.indexOf('id="sec2"'));
    expect(html.indexOf('id="sec2"')).toBeLessThan(html.indexOf('id="sec-tradeoff"'));
    expect(html.indexOf('id="sec-tradeoff"')).toBeLessThan(html.indexOf('id="sec3"'));
    // the rates block holds only the rates: no table
    for (const label of ['Tax saved now, after any tax on investing it', 'Effective rate on the account withdrawal', 'How are these rates calculated?']) {
      expect(sec2, label).toContain(label);
    }
    expect(sec2).not.toContain('Your tax rate now vs. later'); // the card title says it
    expect(sec2).not.toContain('class="compare-table');
    // one table, three groups, each value next to what it becomes after tax; no Difference column
    const table = trade.slice(trade.indexOf('<table'), trade.indexOf('</table>'));
    const order = [
      'What you put in',
      'Current possible contribution',
      'A single year’s contribution',
      'Value at retirement',
      'After-tax value',
      'Contributing every year until retirement',
      'Future Contributions at retirement',
      'After-tax income it generates',
    ];
    let at = -1;
    for (const label of order) {
      const next = table.indexOf(label, at + 1);
      expect(next, label).toBeGreaterThan(at);
      at = next;
    }
    expect(table).not.toContain('Difference');
    expect(table).not.toContain('Tax on withdrawals');
    // the explanation is a link to the article, not a block of text
    expect(trade).not.toContain('Why is the Pre-tax side bigger?');
    expect(trade).toContain('href="#/docs/roth/tax-saved-now-effective-rate-later"');
    expect(trade).toContain('Retirement years without Social Security');
    expect(sec3).not.toContain('Marginal rate while working');
  });

  it('shows a calculation dropdown for "After-tax income it generates" (HAND CALC)', () => {
    // $100,000/$10,000 default: W = 37,784.31 (see compare.test.js), no side account.
    const html = render();
    const trade = html.slice(html.indexOf('id="sec-tradeoff"'), html.indexOf('id="sec3"'));
    const dropdown = trade.slice(trade.indexOf('Show the calculation'), trade.indexOf('</details>', trade.indexOf('Show the calculation')));
    expect(dropdown).toContain('Account withdrawal (4% of Future Contributions)</th><td>$29,472</td><td>$37,784</td>');
    expect(dropdown).toContain('Tax on it</th><td>$0, tax-free</td><td>24.6% of $37,784 = $9,308</td>');
    expect(dropdown).toContain('After-tax income it generates</th><td>$29,472</td><td>$28,476</td>');
    // no side-account rows when nothing exceeds the IRS limit
    expect(dropdown).not.toContain('Taxable side account withdrawal');

    // Over the limit: $150,000 income, $30,000 saved — both sides spill over (see
    // compare.test.js's "contribution limits" hand calcs for the underlying numbers).
    const over = render({ grossIncome: '150000', savings: '30000', otherPretaxBalance: '0' });
    const tradeOver = over.slice(over.indexOf('id="sec-tradeoff"'), over.indexOf('id="sec3"'));
    const dropdownOver = tradeOver.slice(tradeOver.indexOf('Show the calculation'), tradeOver.indexOf('</details>', tradeOver.indexOf('Show the calculation')));
    expect(dropdownOver).toContain('Taxable side account withdrawal');
    expect(dropdownOver).toContain('Over the IRS limit, 4% of its projected value');
    // the two "After-tax" sub-totals (account, then side) plus the grand total: three total-rows
    // after the header row, ending in the same figure the main table shows
    expect((dropdownOver.match(/class="total-row"/g) ?? []).length).toBe(3);
    const mainTable = tradeOver.slice(tradeOver.indexOf('<table'), tradeOver.indexOf('</table>'));
    const mainAfterTax = mainTable.slice(mainTable.indexOf('After-tax income it generates'));
    const grandTotal = dropdownOver.slice(dropdownOver.lastIndexOf('After-tax income it generates'));
    // same two dollar figures appear in both the summary table and this dropdown's own total row
    const dollars = (s) => s.match(/\$[\d,]+/g).slice(0, 2);
    expect(grandTotal.match(/\$[\d,]+/g).slice(0, 2)).toEqual(dollars(mainAfterTax));
  });

  it('has no dollar verdict sentence or table caption above the table', () => {
    const html = render();
    expect(html).not.toContain('class="verdict"');
    // the Roth-vs-Traditional headline verdict is gone (but the separate
    // 'Retirement years without Social Security' dropdown still has its own)
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec3"'));
    const beforeDropdown = sec2.slice(0, sec2.indexOf('Retirement years without Social Security'));
    expect(beforeDropdown).not.toContain('comes out ahead by about');
    expect(beforeDropdown).not.toContain('the tax treatment washes out');
    expect(html).not.toContain('table-caption');
    expect(html).not.toContain('turns that gap into dollars');
  });

  it('shows one short lean line under the rates, above the rates dropdown', () => {
    // no Social Security, no other accounts: 6.4% later vs 22% now -> leans Pre-tax
    const html = render({ otherPretaxBalance: '0', debtPayments: '0', knowsSocialSecurity: 'yes', socialSecurityBenefit: '0' });
    const lean = html.indexOf('class="rate-lean"');
    expect(lean).toBeGreaterThan(html.indexOf('class="rate-pair"'));
    expect(lean).toBeLessThan(html.indexOf('How are these rates calculated?'));
    expect(html).toContain('Tends to favor Pre-tax (Traditional)');
    // just the lean: no sentence restating the two rates, no rule-of-thumb hint
    expect(html).not.toContain('Rule of thumb');
    expect(html).not.toContain('within half a percentage point');
    // a large existing Pre-tax balance sets the account's bracket well above today's -> leans Roth
    // (unlike the old model, the retirement lifestyle no longer affects the rates at all — see CLAUDE.md)
    const roth = render({ grossIncome: '30000', savings: '2000', otherPretaxBalance: '1500000', knowsSocialSecurity: 'yes', socialSecurityBenefit: '0' });
    expect(roth).toContain('Tends to favor Roth');
    // $70,000 gross, $10,000 saved, estimated Social Security: the two rates land within half a point
    expect(render({ grossIncome: '70000', savings: '10000' })).toContain('About even');
  });

  it('shows the Pre-tax deduction in the retirement-number calculation, only for Pre-tax savings', () => {
    const html = render({ savings: '10000', currentType: 'pretax' });
    const sec1 = html.slice(html.indexOf('id="sec1"'), html.indexOf('id="sec2"'));
    expect(sec1).toContain('Step 1: federal income tax');
    expect(sec1).toContain('Pre-tax savings for retirement (not taxed now)');
    expect(sec1).toContain('Taxable income');
    const roth = render({ savings: '10000', currentType: 'roth' });
    const rothSec1 = roth.slice(roth.indexOf('id="sec1"'), roth.indexOf('id="sec2"'));
    expect(rothSec1).not.toContain('Pre-tax savings for retirement (not taxed now)');
    expect(rothSec1).toContain('href="#/docs/roth/how-the-calculator-estimates-your-retirement-tax-rate"');
  });

  it('shows capital-gains tax bracket-by-bracket in the full tax calculation, and shows the withdrawal pushing gains up', () => {
    // A large taxable balance plus existing Pre-tax money: the Roth scenario's ordinary income
    // (43,142) is still below the $48,350 top of the 0% gains bracket, so part of its gain is
    // untaxed; the Pre-tax scenario's ordinary income (80,926, the account's own withdrawal
    // included) is already past it, so the SAME gain is taxed entirely at 15% — the capital-gains
    // push the rate walk-through's Step 3 describes, made concrete.
    const html = render({ otherTaxableBalance: '150000', otherPretaxBalance: '100000' });
    const start = html.indexOf('Show the full tax calculation');
    const dropdown = html.slice(start, html.indexOf('</details>', start));
    expect(dropdown).toContain('Capital-gains tax');
    expect(dropdown).toContain('…of which capital gain, stacked on top of ordinary income');
    expect(dropdown).toContain('0% on $5,208 ($43,142 to $48,350)'); // Roth scenario: partly sheltered
    expect(dropdown).toContain('15% on $42,674 ($80,926 to $123,600)'); // Pre-tax scenario: all at 15%
    // ...and nothing about capital gains when there is no taxable account
    const none = render({ otherTaxableBalance: '0' });
    expect(none).not.toContain('Capital-gains tax');
  });

  it('shows the Net Investment Income Tax when gains pass the MAGI threshold', () => {
    // High income, a large taxable balance: MAGI is over $200,000 and the withdrawal adds NIIT.
    const html = render({ grossIncome: '300000', otherPretaxBalance: '300000', otherTaxableBalance: '600000' });
    const start = html.indexOf('Show the full tax calculation');
    const dropdown = html.slice(start, html.indexOf('</details>', start));
    expect(dropdown).toContain('NIIT: 3.8% × the lesser of gains and MAGI over $200,000');
    expect(dropdown).toContain('Net Investment Income Tax');
    expect(dropdown).toContain('Modified AGI (for the NIIT test)');
    // Section 3's "Show the calculation" also has its row, since both portfolio scenarios owe it here
    expect(html).toContain('Net Investment Income Tax (3.8% on gains, limited to modified AGI above $200,000');
    // ...and none of it for the default (modest-income) case
    expect(render()).not.toContain('Net Investment Income Tax');
  });

  it('shows existing Pre-tax accounts as taxed income in Step 1, raising the tax on that income', () => {
    const html = render({ otherPretaxBalance: '100000' });
    expect(html).toContain('Step 1: income from Social Security and Existing Accounts');
    // $100,000 grown 30y x 4% = $30,449; taxed (no standard deduction left after it and SS)
    expect(html).toContain('Existing Accounts, Pre-tax (4% withdrawal)</span><span>$30,449</span>');
    expect(html).toContain('Tax on that income</span><span>$3,410</span>');
    const none = render({ otherPretaxBalance: '0', otherTaxableBalance: '0', knowsSocialSecurity: 'yes', socialSecurityBenefit: '0' });
    expect(none).toContain('Existing Accounts, Pre-tax (4% withdrawal)</span><span>$0</span>');
    expect(none).toContain('Tax on that income</span><span>$0</span>');
  });

  it('the rates dropdown is the steps plus a link to the article, with no block of explanation', () => {
    const html = render();
    const start = html.indexOf('How are these rates calculated?');
    const dropdown = html.slice(start, html.indexOf('id="sec-tradeoff"'));
    expect(html).not.toContain('How the rates fit together.');
    expect(dropdown).toContain('Step 1: income from Social Security and Existing Accounts');
    expect(dropdown).toContain('href="#/docs/roth/how-the-calculator-estimates-your-retirement-tax-rate"');
    expect(dropdown).toContain('href="#/docs/roth/the-social-security-phase-in"');
    // the steps come first, the link after them
    expect(dropdown.indexOf('Step 1: income from Social Security')).toBeLessThan(dropdown.indexOf('Explained in How this works'));
  });

  it('highlights the two rates in a paired box, no explanatory lead-in or verdict sentence', () => {
    const html = render();
    // the calculator stays numbers-first: no "number that matters" lead sentence, no lean verdict
    expect(html).not.toContain('The number that matters most');
    expect(html).not.toContain('rate-verdict');
    expect(html).not.toContain('rate-lead');
    expect(html).not.toContain('Pre-tax is most likely better');
    expect(html).not.toContain('Roth is most likely better');
    expect(html).toContain('class="rate-pair-item highlight"');
    // the highlighted pair holds exactly tax-saved-now and effective-on-the-account-withdrawal
    const pairEnd = html.indexOf('How are these rates calculated?');
    const pair = html.slice(html.indexOf('class="rate-pair"'), pairEnd);
    expect(pair).toContain('Tax saved now, after any tax on investing it');
    expect(pair).toContain('Effective rate on the account withdrawal');
    // the old "overall effective rate" reference line is gone entirely (folded into the account's
    // own effective rate, which now already includes every account in the stack)
    expect(html).not.toContain('Overall effective rate');
    expect(html).not.toContain('rate-side-note');
  });

  it('shows the Social Security benefit used and the portfolio need directly below the hero number, above "How is this calculated?"', () => {
    const html = render();
    const sec1 = html.slice(html.indexOf('id="sec1"'), html.indexOf('id="sec2"'));
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec3"'));
    expect(sec1).toContain('Social Security benefit used');
    expect(sec1).toContain('Income needed from your portfolio');
    const heroIdx = sec1.indexOf('class="hero"');
    const factsIdx = sec1.indexOf('Social Security benefit used');
    const howCalcIdx = sec1.indexOf('How is this calculated?');
    expect(factsIdx).toBeGreaterThan(heroIdx);
    expect(factsIdx).toBeLessThan(howCalcIdx);
    // it is no longer duplicated next to the rates
    expect(sec2).not.toContain('Social Security benefit used');
  });

  it('shows Adjusted Gross Income (AGI) in the portfolio calculation dropdown', () => {
    const html = render();
    expect(html).toContain('Adjusted gross income, AGI');
    // scoped to Section 3 (sec3): "Show the calculation" also labels the After-tax comparison
    // card's own dropdown now (AfterTaxIncomeMath), which comes earlier on the page.
    const sec3 = html.slice(html.indexOf('id="sec3"'));
    const dropdown = sec3.slice(sec3.indexOf('Show the calculation'));
    const agiIdx = dropdown.indexOf('Adjusted gross income, AGI');
    const taxableSSIdx = dropdown.indexOf('Taxable part of Social Security');
    const ordinaryIdx = dropdown.indexOf('Ordinary taxable income');
    expect(agiIdx).toBeGreaterThan(taxableSSIdx);
    expect(agiIdx).toBeLessThan(ordinaryIdx);
  });

  it('shows the contribution-limit warning in the results', () => {
    const html = render({ savings: '22000' });
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec3"'));
    expect(sec2).toContain('at/near the 2025 401(k) contribution limit');
  });

  it('scales the number and says so when a different retirement lifestyle is chosen', () => {
    const html = render({ retirementLifestyle: '1.25' });
    expect(html).toContain('scaled by');
    expect(html).toContain('+25%');
    expect(html).toContain('Adjustment for your expected retirement lifestyle (+25%)');
    expect(html).toContain('Spending today');
    const lower = render({ retirementLifestyle: '0.8' });
    expect(lower).toContain('−20%');
    expect(lower).toContain('lower than today');
    // nothing about an adjustment when the lifestyle is unchanged
    expect(render()).not.toContain('Adjustment for your expected retirement lifestyle');
  });

  it('shows self-employment tax in the budget when there is 1099 income', () => {
    const html = render({ incomeType: '1099' });
    expect(html).toContain('FICA and self-employment tax');
    expect(html).toContain('Half of self-employment tax');
    expect(render()).not.toContain('self-employment tax');
  });

  it('has a dropdown showing how the retirement number is calculated, including FICA', () => {
    const html = render();
    expect(html).toContain('<details');
    expect(html).toContain('How is this calculated?');
    expect(html).toContain('FICA (Social Security + Medicare)');
    expect(html).toContain('Take-home pay');
  });

  it('has a dropdown showing how the effective rate is calculated', () => {
    const html = render({ knowsSocialSecurity: 'yes', socialSecurityBenefit: '20000', otherPretaxBalance: '0' });
    expect(html).toContain('How are these rates calculated?');
    expect(html).toContain('Extra tax caused by the withdrawal');
    // the Social Security phase-in shows up as a real number: the account's own withdrawal makes
    // more of the $20,000 benefit taxable ($0 -> $16,217, well under the $17,000 max at 85%)
    expect(html).toContain('Taxable part of Social Security, with the withdrawal ($0 without it)</span><span>$16,217</span>');
  });

  it('shows a plain "nothing to compare" message when there is nothing saved — no hypothetical probe', () => {
    // Under sideAwareRates.js every account with savings > 0 always has its own natural withdrawal
    // to measure, whatever else (Social Security, existing balances) covers the need — the old
    // "no withdrawal needed, so read a hypothetical probe" case no longer exists at all; a large
    // Social Security benefit no longer produces this message.
    const html = render({ savings: '0' });
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec-tradeoff"'));
    expect(sec2).toContain('There is no withdrawal from Future Contributions to measure, so there is no rate to compare.');
    expect(sec2).not.toContain('÷ $0)');
    const bigSS = render({ knowsSocialSecurity: 'yes', socialSecurityBenefit: '90000' });
    expect(bigSS).not.toContain('There is no withdrawal from Future Contributions to measure');
  });

  it('names the catch-up contribution in the limit alert for a 50+ saver over the base limit', () => {
    const html = render({ currentAge: '55', grossIncome: '150000', savings: '30000', accountType: '401k', currentType: 'pretax' });
    expect(html).toContain('catch-up contribution for being 50 or older');
    expect(html).toContain('$31,000');
  });


  it('shows Social Security in the portfolio comparison, with a calculation dropdown', () => {
    const html = render();
    expect(html).toContain('Social Security benefit');
    expect(html).toContain('taxable</span>');
    expect(html).toContain('Show the calculation');
    expect(html).toContain('Taxable part of Social Security');
    expect(html).toContain('Gross income (withdrawals + Social Security)');
    expect(html).not.toContain('Total income before tax');
  });

  it('every article link on the results points at a heading the Roth article really has', () => {
    const html = render({ grossIncome: '150000', savings: '30000' });
    const article = renderToStaticMarkup(<DocsPage hash="#/docs/roth" />);
    const slugs = [...new Set([...html.matchAll(/href="#\/docs\/roth\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
    expect(slugs.length).toBe(6);
    for (const slug of slugs) expect(article, slug).toContain(` id="${slug}"`);
  });

  it('puts the Pre-tax and Roth contribution amounts in the comparison table, not in Section 1', () => {
    const html = render();
    const sec1 = html.slice(html.indexOf('id="sec1"'), html.indexOf('id="sec2"'));
    expect(sec1).not.toContain('Current possible');
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec3"'));
    expect(sec2).toContain('Current possible contribution');
    expect(sec2).toContain('Per year, for the same take-home pay');
  });

  it('names "Future Contributions" and "Existing Accounts" throughout the three-step rate walk-through, never "this account"', () => {
    const html = render();
    expect(html).toContain('Step 1: income from Social Security and Existing Accounts');
    expect(html).toContain(
      'Step 2: the difference — the taxable account each scenario&#x27;s Future Contributions build',
    );
    expect(html).toContain("Step 3: add the Pre-tax account&#x27;s own withdrawal and re-do the tax");
    // the old "this account" wording is gone from the results
    expect(html).not.toMatch(/this account/i);
  });

  it('has the retirement-years-without-Social-Security section, using the account\'s own effective rate', () => {
    const html = render();
    expect(html).toContain('Retirement years without Social Security');
    expect(html).not.toContain('Simple view');
    expect(html).toContain('Effective rate on the account withdrawal');
    // the defaults ($100,000, $10,000 saved) win Pre-tax without Social Security: 13.1% < 22.0%
    expect(html).toContain('is below the tax saved now');
    expect(html).toContain('href="#/docs/roth/years-without-social-security"');
    // the old marginal-vs-marginal headline and the "stricter rule of thumb" remark are gone
    expect(html).not.toContain('stricter rule of thumb');
    expect(html).not.toContain('Marginal rate in retirement (bracket of the last dollar)');
  });

  it('the "Retirement years without Social Security" section is the same whatever the lifestyle', () => {
    // Under sideAwareRates.js the retirement lifestyle does not change this view's rate at all
    // (see the "retirement lifestyle factor" HAND CALC tests in compare.test.js).
    const withLifestyle = render({ grossIncome: '60000', savings: '5000', debtPayments: '0', otherPretaxBalance: '0', retirementLifestyle: '2' });
    const plain = render({ grossIncome: '60000', savings: '5000', debtPayments: '0', otherPretaxBalance: '0' });
    const section = (html) => html.slice(html.indexOf('Retirement years without Social Security'), html.indexOf('id="sec3"'));
    expect(section(withLifestyle)).toBe(section(plain));
    expect(section(plain)).not.toContain('Reading this');
    expect(withLifestyle).not.toContain('you expect to spend more in retirement');
  });

  it('explains a big existing Pre-tax balance setting the no-Social-Security bracket, favoring Roth', () => {
    // grossIncome 30k, savings 2k, a $1,500,000 existing Pre-tax balance: its own forced 4% draw
    // ($456,735/yr) sets the bracket well before this account's small withdrawal is even added,
    // pushing the no-SS effective rate (35.0%) above today's marginal rate (12.0%) -> Roth.
    const html = render({ grossIncome: '30000', savings: '2000', otherPretaxBalance: '1500000' });
    const section = html.slice(html.indexOf('Retirement years without Social Security'));
    expect(section).toContain('Existing Accounts, Pre-tax (4% withdrawal)</span><span>$456,735</span>');
    expect(section).toContain('Roth comes out ahead');
    expect(section).toContain('is above the tax saved now');
  });

  it('shows nothing saved to measure when Future Contributions are $0, even with a huge existing balance', () => {
    const html = render({ grossIncome: '30000', savings: '0', otherPretaxBalance: '1500000' });
    const section = html.slice(html.indexOf('Retirement years without Social Security'));
    expect(section).toContain('There is no withdrawal from Future Contributions to measure, so there is no rate to compare.');
    expect(section).toContain('There is nothing saved to compare.');
  });

  it('leaves the "Splitting your contribution" card out of the public calculator', () => {
    const html = render();
    expect(html).not.toContain('id="sec-blend"');
    expect(html).not.toContain('Splitting your contribution');
    expect(html).not.toContain('type="range"');
  });

  // The card is kept for the #/next preview (`showBlend`).
  const renderWithBlend = (overrides = {}) =>
    renderToStaticMarkup(
      <ResultsSummary
        showBlend
        result={compareRothVsTraditional(toCompareInputs({ ...DEFAULT_FORM_VALUES, ...overrides }, 2025))}
      />,
    );

  it('with showBlend, shows a "Splitting your contribution" card between the after-tax comparison and total future portfolio comparison', () => {
    const html = renderWithBlend();
    expect(html.indexOf('id="sec-tradeoff"')).toBeLessThan(html.indexOf('id="sec-blend"'));
    expect(html.indexOf('id="sec-blend"')).toBeLessThan(html.indexOf('id="sec3"'));
    const blend = html.slice(html.indexOf('id="sec-blend"'), html.indexOf('id="sec3"'));
    expect(blend).toContain('Splitting your contribution</span>');
    expect(blend).toContain('Roth share of the contribution');
    expect(blend).toContain('type="range"');
    expect(blend).toContain('To Roth');
    expect(blend).toContain('To Pre-tax');
    expect(blend).toContain('Tax saved now');
    expect(blend).toContain('Effective rate on the Pre-tax withdrawal');
    expect(blend).toContain('Jump to the best mix');
    expect(blend).toContain('Show the numbers');
    expect(blend).not.toMatch(/NaN|Infinity/);
  });

  it('the blend slider defaults to the best mix, and says so when a pure strategy already wins', () => {
    // Default inputs (estimated Social Security + a $100,000 existing Pre-tax balance, both
    // Roth-favorable per the app's already-established findings): the best mix is 100% Roth,
    // matching the main rate comparison's own "Tends to favor Roth" verdict at these defaults.
    const html = renderWithBlend();
    const blend = html.slice(html.indexOf('id="sec-blend"'), html.indexOf('id="sec3"'));
    expect(blend).toContain('Here, a pure strategy already wins.');
    expect(blend).toContain('value="100"');
    expect(blend).toContain('Roth share of the contribution: <strong>100%</strong>');
    expect(blend).toContain('(the best mix)');
    expect(blend).toContain('Jump to the best mix (100% Roth,');
  });

  it('finds and explains a genuine interior optimum (HAND CALC)', () => {
    // $60,000 income, $10,000 saved, $20,000 known Social Security, no Existing Accounts — the
    // same scenario blend.test.js hand-derives r=0.5 for; the grid's actual best (56%, a whole
    // percentage point away) is confirmed independently via the underlying lib, not re-derived
    // by hand here — blend.test.js already hand-verifies the interior-optimum phenomenon itself.
    const html = renderWithBlend({
      grossIncome: '60000',
      savings: '10000',
      knowsSocialSecurity: 'yes',
      socialSecurityBenefit: '20000',
      otherPretaxBalance: '0',
    });
    const blend = html.slice(html.indexOf('id="sec-blend"'), html.indexOf('id="sec3"'));
    expect(blend).toContain('Here, blending helps.');
    expect(blend).toContain('56% Roth');
    expect(blend).toContain('value="56"');
    expect(blend).toContain('$1,671');
  });

  it('shows "nothing saved yet to split" when $0 is saved, without NaN', () => {
    const html = renderWithBlend({ savings: '0' });
    const blend = html.slice(html.indexOf('id="sec-blend"'), html.indexOf('id="sec3"'));
    expect(blend).toContain('There is nothing saved yet to split.');
    expect(blend).not.toContain('type="range"');
    expect(blend).not.toMatch(/NaN|Infinity/);
  });

  it('lists validation errors instead of results for bad input', () => {
    const html = render({ retirementAge: '30' });
    expect(html).toContain("Retirement age can&#x27;t be before your current age");
    expect(html).not.toContain('Marginal rate while working');
  });

  it('survives awkward-but-valid inputs without NaN or Infinity anywhere', () => {
    const cases = [
      { grossIncome: '10000' }, // under the standard deduction
      { savings: '0' },
      { savings: '' },
      { debtPayments: '200000' }, // need floors at 0
      { otherPretaxBalance: '0', otherRothBalance: '0', otherTaxableBalance: '0', savings: '0' }, // empty portfolio
      { grossIncome: '2000000', filingStatus: 'mfj' },
      { knowsSocialSecurity: 'yes', socialSecurityBenefit: '60000' },
      { currentAge: '64', retirementAge: '65' },
      { currentType: 'roth', accountType: 'ira', savings: '7000' },
      { incomeType: '1099' },
      { incomeType: 'both', selfEmploymentIncome: '40000' },
      { incomeType: 'both', selfEmploymentIncome: '' },
      { retirementLifestyle: '2' },
      { retirementLifestyle: '0.8' },
      { grossIncome: '2000000', incomeType: '1099', filingStatus: 'mfj' },
    ];
    for (const c of cases) {
      const html = render(c);
      expect(html, JSON.stringify(c)).not.toMatch(/NaN|Infinity/);
      expect(html, JSON.stringify(c)).toContain('Withdrawal rate needed');
    }
  });
});

describe('App: the calculators are the site', () => {
  it('opens on the calculators homepage, with no preview banner, and the feedback link', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('<h1>Dashboard</h1>');
    expect(html).not.toContain('Preview, not finished');
    expect(html).not.toContain('(preview)');
    expect(html).toContain('href="#/roth"');
    expect(html).toContain('href="#/docs"');
    expect(html).toContain('Send feedback');
  });
});

describe('The Roth article (Docs)', () => {
  const html = renderToStaticMarkup(<DocsPage hash="#/docs/roth" />);

  it('renders the article as real headings and paragraphs, not raw markdown', () => {
    expect(html).toContain('<h2 id="years-without-social-security">Years without Social Security</h2>');
    expect(html).toContain('<strong>');
    expect(html).not.toMatch(/(^|>)#{1,3} /); // no leaked "## " heading markers
    expect(html).not.toContain('**');
  });

  it('renders every section of articles/roth.md (the file is the single source)', () => {
    const h2InMarkdown = articleMarkdown.split('\n').filter((l) => l.startsWith('## ')).length;
    const h2InHtml = (html.match(/<h2 id="[a-z0-9-]+">/g) ?? []).length;
    expect(h2InMarkdown).toBeGreaterThan(5);
    expect(h2InHtml).toBe(h2InMarkdown);
    expect(html).toContain('educational purposes only');
  });

  it('does not refer to UI sections that no longer exist', () => {
    expect(html).not.toMatch(/Section \d/);
    expect(html).not.toContain('Simple view');
    expect(html).not.toContain('How is the effective rate calculated?');
  });
});

describe('ScenariosPage', () => {
  const html = renderToStaticMarkup(<ScenariosPage />);

  it('renders without throwing, with the intro and a back link at top and bottom', () => {
    expect(html).toContain('Visualization: who comes out ahead, and why');
    const back = html.match(/href="#\/"/g) ?? [];
    expect(back.length).toBe(2);
    expect(html).toContain('Back to the calculator');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('renders every scenario batch with its title and exactly one chart', () => {
    for (const batch of SCENARIO_BATCHES) {
      expect(html).toContain(batch.title);
    }
    // one chart per batch + the two-rates chart (the gap-vs-advantage scatter was removed: circular)
    expect((html.match(/class="chart-svg"/g) ?? []).length).toBe(SCENARIO_BATCHES.length + 1);
  });

  it('has no gap-vs-advantage scatter or trend line (the winner is the sign of the gap, so it was circular)', () => {
    expect(html).not.toContain('Does the gap predict the winner?');
    expect(html).not.toContain('Trend line:');
    expect(html).not.toContain('r²');
    expect(html).not.toContain('predict');
  });

  it('has a "Show the numbers" table for each batch, plus one for the two-rates chart', () => {
    expect((html.match(/Show the numbers/g) ?? []).length).toBe(SCENARIO_BATCHES.length + 1);
  });

  it('has ONE table per "Show the numbers" dropdown', () => {
    const dropdowns = html.split('<details class="details"').slice(1).map((d) => d.slice(0, d.indexOf('</details>')));
    expect(dropdowns.length).toBe(SCENARIO_BATCHES.length + 1);
    for (const d of dropdowns) expect((d.match(/<table/g) ?? []).length).toBe(1);
    expect(html).not.toContain('Rate gap (marginal rate now minus effective rate in retirement)');
  });

  it('states the rule once, at the top, as exact (not a rule of thumb), and does not repeat it per chart', () => {
    expect(html).toContain('When the gap is positive, Pre-tax comes out ahead; when it is negative, Roth does.');
    expect((html.match(/class="rule-callout"/g) ?? []).length).toBe(1);
    expect(html).not.toContain('rule of thumb');
    expect(html).not.toContain('Who actually comes out ahead?');
    expect(html).not.toContain('<h3 class="subhead">The rate gap</h3>');
  });

  it('labels who wins on each side of the zero line of every batch chart', () => {
    expect((html.match(/▲ Roth comes out ahead/g) ?? []).length).toBe(SCENARIO_BATCHES.length);
    expect((html.match(/▼ Pre-tax comes out ahead/g) ?? []).length).toBe(SCENARIO_BATCHES.length);
    expect(html).toContain('Roth advantage (% of Pre-tax income)');
  });

  it('shows the two rates as separate lines, and says the gap is the distance between them', () => {
    expect(html).toContain('What the rate gap is made of');
    expect(html).toContain('Tax saved now');
    expect(html).toContain('Effective rate on the account withdrawal');
    expect(html).toContain('The rate gap is the vertical distance between them.');
  });

  it('renders the two break-even maps with every income column and row', () => {
    expect(html).toContain('Where does each one win? Income against savings rate');
    expect(html).toContain('Where does each one win? Income against existing Pre-tax balance');
    expect((html.match(/class="heatmap"/g) ?? []).length).toBe(2);
    const first = html.indexOf('class="heatmap"');
    const second = html.indexOf('class="heatmap"', first + 1);
    const savingsMap = html.slice(first, second);
    expect((savingsMap.match(/<tr>/g) ?? []).length).toBe(1 + 6); // header + 6 savings rates
    for (const rate of ['5%', '10%', '15%', '20%', '25%', '30%']) expect(savingsMap).toContain(`<th scope="row">${rate}</th>`);
    expect(html).toContain('savings above the IRS limit');
    const balanceMap = html.slice(second);
    for (const balance of ['$0', '$100k', '$250k', '$500k', '$1M', '$2M']) {
      expect(balanceMap).toContain(`<th scope="row">${balance}</th>`);
    }
  });

  it('includes the Roth-friendly sweeps (existing Pre-tax balance, existing taxable balance) and the age-50 savings chart', () => {
    expect(html).toContain('A bigger existing Pre-tax balance, at different incomes');
    expect(html).toContain('A bigger existing taxable investment account, at different incomes');
    expect(html).toContain('Age 50: saving more, with a $500k existing Pre-tax balance');
    expect(html).not.toContain('Married filing jointly');
  });

  it('has the retirement-age sweep', () => {
    expect(html).toContain('Retiring earlier or later, at different incomes');
    expect(html).toContain('10% early-withdrawal penalty before 59½ is not modeled');
  });
});

describe('ResultsSummary — excess contributions default to taxable', () => {
  it('shows no capping note when savings is under the limit', () => {
    const html = render({ savings: '10000' });
    expect(html).not.toContain('in a taxable account (over the IRS limit)');
  });

  it('shows a per-column capping note and updates the limit-check alert when over the limit', () => {
    const html = render({ grossIncome: '150000', savings: '30000', currentType: 'pretax', accountType: '401k' });
    expect(html).toContain('incl. $6,500 in a taxable account (over the IRS limit)');
    expect(html).toContain('incl. $860 in a taxable account (over the IRS limit)');
    expect(html).toContain('href="#/docs/roth/why-maxing-out-changes-the-math"');
    expect(html).toContain('extra $');
    expect(html).toContain('taxable investment account');
  });

  it('reflects the taxable spillover in the Section 3 bucket breakdown, in both scenarios', () => {
    const html = render({ grossIncome: '150000', savings: '30000', currentType: 'pretax', accountType: '401k' });
    const sec3 = html.slice(html.indexOf('id="sec3"'));
    // Pre-tax scenario: $30,000 caps at $23,500, so $6,500/yr spills into taxable -> nonzero taxable bucket.
    expect(sec3).toContain('Taxable $613,995');
    // Roth scenario: the same take-home ($24,360) is $860 over the cap -> 860 x 94.4607862.
    expect(sec3).toContain('Taxable $81,236');
  });
});

describe('ScenarioCompare', () => {
  const scenario = (overrides = {}) => {
    const inputs = toCompareInputs({ ...DEFAULT_FORM_VALUES, ...overrides }, 2025);
    return { inputs, result: compareRothVsTraditional(inputs) };
  };
  const noop = () => {};

  it('offers "Compare a change" when no second set of inputs is open', () => {
    const html = renderToStaticMarkup(
      <ScenarioCompare baseline={scenario()} current={null} onStart={noop} onStop={noop} />,
    );
    expect(html).toContain('Compare a change');
    expect(html).toContain('Opens a second set of inputs');
    expect(html).not.toContain('With your change');
  });

  it('shows what changed, the headline side by side, and the rate calculation side by side', () => {
    const html = renderToStaticMarkup(
      <ScenarioCompare
        baseline={scenario()}
        current={scenario({ grossIncome: '130000' })}
        onStart={noop}
        onStop={noop}
      />,
    );
    expect(html).toContain('What changed');
    expect(html).toContain('$100,000');
    expect(html).toContain('$130,000');
    expect(html).toContain('With your change');
    expect(html).toContain('Retirement income number');
    expect(html).toContain('How the rates are calculated, side by side');
    expect(html).toContain('Step 1: income from Social Security and Existing Accounts');
    expect(html).toContain('Extra tax caused by the withdrawal');
    expect(html).toContain('Tax saved now, after any tax on investing it');
    expect(html).toContain('Effective rate on the account withdrawal');
    expect(html).toContain('Reset changes');
    expect(html).toContain('Use these as my inputs');
    expect(html).toContain('Stop comparing');
    expect(html).toMatch(/\+\$[\d,]+/); // a signed dollar change
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('says nothing changed yet right after pinning', () => {
    const html = renderToStaticMarkup(
      <ScenarioCompare baseline={scenario()} current={scenario()} onStart={noop} onStop={noop} />,
    );
    expect(html).toContain('Nothing yet. Change any input in the second set above.');
  });

  it('asks for valid inputs instead of comparing when the current inputs are invalid', () => {
    const html = renderToStaticMarkup(
      <ScenarioCompare
        baseline={scenario()}
        current={scenario({ retirementAge: '30' })}
        onStart={noop}
        onStop={noop}
      />,
    );
    expect(html).toContain('Fix the inputs above to see the comparison.');
  });
});

describe('Round 2026-09-25b adjustments', () => {
  it('Section 3 shows after-tax income at a 4% withdrawal, and drops the "not the whole story" note', () => {
    const html = render();
    const sec3 = html.slice(html.indexOf('id="sec3"'));
    expect(sec3).toContain('After-tax income at a 4% withdrawal');
    expect(sec3).toMatch(/\+\$[\d,]+ per year/); // the larger portfolio's lead
    expect(html).not.toContain('not the whole story');
  });

  it('the total future portfolio comparison ends on the withdrawal rate needed, lower one highlighted', () => {
    const sec3 = render().slice(render().indexOf('id="sec3"'));
    const table = sec3.slice(0, sec3.indexOf('</table>'));
    const lastRow = table.slice(table.lastIndexOf('<tr'));
    expect(lastRow).toContain('class="total-row"');
    expect(lastRow).toContain('Withdrawal rate needed');
    expect(lastRow).toMatch(/class="win">[\d.]+%<span class="th-sub">[\d.]+ pts lower/);
    // the 4% row is no longer highlighted
    expect(table.slice(0, table.lastIndexOf('<tr'))).not.toContain('class="win"');
  });


});

describe('Future Contributions vs. Existing Accounts', () => {
  it('Existing Accounts + Future Contributions add up to the portfolio section totals', () => {
    const r = compareRothVsTraditional(toCompareInputs({ ...DEFAULT_FORM_VALUES, savings: '23500', currentType: 'roth' }, 2025));
    const existing = r.grown.pretax + r.grown.roth + r.grown.taxable;
    for (const k of ['roth', 'pretax']) {
      expect(existing + r.annuity[k].totalFutureValue).toBeCloseTo(r.portfolio[k].totalValue, 6);
    }
  });

  it('at the limit with Roth savings, the Pre-tax side shows its tax savings in a taxable account', () => {
    const html = render({ grossIncome: '150000', savings: '23500', currentType: 'roth' });
    // 23,500 x 24% = 5,640 a year of tax saved, invested
    expect(html).toContain('incl. $5,640 in a taxable account (over the IRS limit)');
    expect(html).toContain('href="#/docs/roth/why-maxing-out-changes-the-math"');
    expect(html).toContain('Plus the taxable account (over the IRS limit)');
  });


  it('the article uses the same terms and no longer calls the at-limit case unmodeled', () => {
    expect(articleMarkdown).toContain('**Future Contributions**');
    expect(articleMarkdown).toContain('**Existing Accounts**');
    expect(articleMarkdown).not.toMatch(/this account/i);
    expect(articleMarkdown).not.toContain('still a planned future feature');
  });
});

describe('Comparing a change: emphasis', () => {
  it('highlights the retirement income number and, more strongly, the two rates', () => {
    const scenario = (overrides = {}) => {
      const inputs = toCompareInputs({ ...DEFAULT_FORM_VALUES, ...overrides }, 2025);
      return { inputs, result: compareRothVsTraditional(inputs) };
    };
    const html = renderToStaticMarkup(
      <ScenarioCompare baseline={scenario()} current={scenario({ grossIncome: '130000' })} onStart={() => {}} onStop={() => {}} />,
    );
    expect(html).toMatch(/class="total-row emph-key"><th scope="row">Retirement income number/);
    expect(html).toMatch(/class="total-row emph-rate"><th scope="row">Tax saved now, after any tax on investing it/);
    expect(html).toMatch(/class="total-row emph-rate"><th scope="row">Effective rate on the account withdrawal/);
    expect((html.match(/emph-rate/g) ?? []).length).toBe(2);
  });
});

describe('Existing taxable accounts: cost basis dropdown', () => {


  it('shows the gains part of the taxable withdrawal in the rate walk-through', () => {
    const html = render({ otherTaxableBalance: '100000' });
    expect(html).toContain('…of which gains (taxed; the rest is cost basis)');
    expect(html).toContain('of it gains, the rest cost basis');
  });
});

describe("Rate walk-through with large Existing Accounts", () => {
  it("shows how the extra tax the account's own withdrawal causes is worked out (before/after totals)", () => {
    // Under sideAwareRates.js every account with savings > 0 measures its OWN actual withdrawal —
    // there is no more hypothetical "hasn't been withdrawn yet" probe case (see compare.test.js's
    // "the effective rate no longer depends on the retirement need at all"). The Step 3 arithmetic
    // still shows the before/after totals the extra tax is derived from.
    const result = compareRothVsTraditional(
      toCompareInputs({ ...DEFAULT_FORM_VALUES, otherPretaxBalance: "400000", otherTaxableBalance: "200000" }),
    );
    expect(result.sideAware.accountWithdrawal).toBeGreaterThan(0);
    const html = renderToStaticMarkup(<ResultsSummary result={result} />);
    expect(html).toContain("Total tax with the withdrawal");
    expect(html).toContain("Total tax without it");
    expect(html).toMatch(/Extra tax caused by the withdrawal \(\$[\d,]+ − \$[\d,]+\)/);
  });
});

describe('Collapsible sections', () => {


  it('shows each results card with its headline, all open', () => {
    const html = renderToStaticMarkup(<ResultsSummary result={compareRothVsTraditional(toCompareInputs(DEFAULT_FORM_VALUES, 2026))} />);
    const titles = [...html.matchAll(/class="collapsible-title"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(titles).toEqual([
      'Retirement income number',
      'Your portfolio at retirement',
      'Tax rate comparison',
      'After-tax comparison',
      'Total future portfolio comparison',
    ]);
    expect(html).toContain('class="collapsible-summary">$65,380 per year after tax<');
    expect(html).not.toContain('aria-expanded="false"');
    expect(html).toContain('Collapse all results');
    // the tax rate comparison, the number the decision turns on, carries the accent
    expect(html).toMatch(/class="collapsible card collapsible-card open key-card" aria-labelledby="sec2"/);
  });

  it('the rates card is a single block (the "new calculation" duplicate has been merged away)', () => {
    const html = renderToStaticMarkup(<ResultsSummary result={compareRothVsTraditional(toCompareInputs(DEFAULT_FORM_VALUES, 2026))} />);
    expect(html).not.toContain('id="sec2b"');
    expect(html).not.toContain('Tax rate comparison — new calculation');
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec-tradeoff"'));
    // the merged block uses the new-methodology pair, its own dropdown, and the in-dollars cross-check
    expect(sec2).toContain('Tax saved now, after any tax on investing it');
    expect(sec2).toContain('Effective rate on the account withdrawal');
    expect(sec2).toContain('How are these rates calculated?');
    expect(sec2).toContain('comes out ahead by');
    expect(sec2).not.toMatch(/this account/i);
    // only one copy of the rates dropdown summary on the whole page section
    expect(sec2.split('How are these rates calculated?').length - 1).toBe(1);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('the new block always shows Step 2, with content only when savings exceed the IRS limit', () => {
    const step2Heading = "Step 2: the difference — the taxable account each scenario's Future Contributions build".replace(
      "'",
      '&#x27;',
    );
    const under = renderToStaticMarkup(<ResultsSummary result={compareRothVsTraditional(toCompareInputs(DEFAULT_FORM_VALUES, 2026))} />);
    expect(under).toContain(step2Heading);
    expect(under).toContain('nothing to add in this step');
    expect(under).not.toContain('Extra taxable money the Pre-tax scenario holds');
    expect(under).not.toContain('Tax rate on the extra taxable money');
    const over = renderToStaticMarkup(
      <ResultsSummary result={compareRothVsTraditional(toCompareInputs({ ...DEFAULT_FORM_VALUES, grossIncome: '500000', savings: '50000', otherPretaxBalance: '0' }, 2026))} />,
    );
    expect(over).toContain(step2Heading);
    expect(over).toContain('Extra taxable money the Pre-tax scenario holds');
    expect(over).toContain('Tax rate on the extra taxable money');
    expect(over).toContain("Step 3: add the Pre-tax account's own withdrawal and re-do the tax".replace("'", '&#x27;'));
    expect(over).toContain('Putting the two rates together');
    expect(over).not.toMatch(/NaN|Infinity/);
  });

});


// The calculators (NextApp: the site since the switchover).
describe('NextApp', () => {
  it('renders the homepage, every calculator page and its results', async () => {
    const { default: NextApp } = await import('../src/next/NextApp.jsx');
    const html = renderToStaticMarkup(<NextApp />);
    expect(html).not.toContain('Preview, not finished');
    // the homepage: the household and a tile per calculator, each with its headline
    expect(html).toContain('<h1>Dashboard</h1>');
    expect(html).toContain('href="#/roth"');
    expect(html).toContain('href="#/tax"');
    expect(html).toContain('22% marginal · 22.0% EMTR');
    expect(html).toContain('11.0% average tax rate: $10,970 federal income tax this year');
    expect(html).not.toMatch(/NaN|Infinity/);
    // the homepage: the household in brief, with a link to the inputs page
    expect(html).toContain('href="#/inputs"');
    expect(html).toContain('<strong>Income:</strong> W-2 $100,000');
    // the calculator pages: one inputs card (its own section first, only what it reads), results,
    // a way home and to the inputs page
    const firstTitle = (page) => page.match(/class="collapsible-title"[^>]*>([^<]+)</)[1];
    const roth = renderToStaticMarkup(<NextApp initialPage="roth" />);
    expect(roth).toContain('Roth vs. Pre-tax inputs');
    expect(roth).toContain('Compare a change'); // ported from the public page (round 2 phase 1)
    expect(roth).toContain('Use Roth in the plan: $7,800 per year'); // the "Use in the plan" trial
    expect(firstTitle(roth)).toBe('Future Contributions');
    expect(roth).toContain('href="#/inputs"');
    expect(roth).toContain('Claim at');
    expect(roth).not.toContain('Biological sex');
    expect(roth).not.toContain('Lump sum offered');
    expect(roth).toContain('Retirement income number');
    expect(roth).toContain('RMDs start at 75.');
    expect(roth).toContain('Over a lifetime, year by year');
    expect(roth).toMatch(/Find the break-even tax change|there is no break-even to find/);
    expect(roth).toMatch(/(Roth|Pre-tax) supports \$[\d,]+ per year more|About even/);
    expect(roth).toContain('href="#/projection"');
    expect(roth).toContain('href="#/"');
    expect(roth).not.toMatch(/NaN|Infinity/);
    const tax = renderToStaticMarkup(<NextApp initialPage="tax" />);
    expect(tax).toContain('Tax rates this year');
    expect(tax).toContain('Tax bracket visual');
    expect(tax).toContain('class="rate-buckets"');
    expect(tax).toContain('Effective marginal rate');
    expect(tax).toContain('>The calculation<');
    expect(firstTitle(tax)).toBe('Income');
    expect(tax).toContain('+ Add income');
    expect(tax).toContain('Claim at'); // Social Security is an income row: once claimed, it is taxed this year
    expect(tax).not.toContain('Retirement age');
    expect(tax).not.toMatch(/NaN|Infinity/);
    const proj = renderToStaticMarkup(<NextApp initialPage="projection" />);
    expect(proj).toContain('Funded status');
    expect(proj).toContain('Lifetime summary');
    expect(proj).toContain('Income by source in retirement');
    expect(proj).toContain('Balances over time');
    expect(proj).toContain('Year by year');
    expect(proj).toContain('Plan to age');
    expect(proj).not.toContain('Project to age');
    expect(proj).toContain('Compare withdrawal strategies');
    expect(proj).toContain('Withdrawal strategy in retirement');
    expect((proj.match(/<tr class="chosen-row"/g) ?? []).length).toBe(1);
    expect(proj).toContain(' most left');
    expect(proj).not.toMatch(/NaN|Infinity/);
    expect(html).toContain('href="#/projection"');
    const conv = renderToStaticMarkup(<NextApp initialPage="conversion" />);
    // (reworked 2026-10-09) the lifetime view first, this year's tax with its effective rate, the bar
    // with the conversion that fills each bracket; no table of fills
    expect(conv).toContain('Over a lifetime, with and without it');
    for (const label of ['Lifetime tax (federal income tax and IRMAA)', 'Legacy: the portfolio in', 'Total retirement income', 'Tax paid each year']) {
      expect(conv, label).toContain(label);
    }
    expect(conv).toContain('Effective rate of the conversion');
    expect(conv).toContain('fills it</text>');
    expect(conv).not.toContain('Converting to fill a bracket');
    expect(conv).toContain('Convert to Roth this year');
    expect(conv).toContain('class="bb-added"');
    expect(conv).not.toMatch(/NaN|Infinity/);
    // The default household has no pension: the page says so and offers one.
    const pen = renderToStaticMarkup(<NextApp initialPage="pension" />);
    expect(pen).toContain('No pension yet');
    expect(pen).toContain('>Add a pension</button>');
    // the lump sum is part of the pension (2026-10-09): nothing to fill in before adding one
    expect(pen).not.toContain('Lump sum offered');
    // With a pension row, the results.
    const { default: PensionResult } = await import('../src/next/PensionResult.jsx');
    const { householdToPensionInputs, pensionResult } = await import('../src/lib/pensionCalculator.js');
    const { DEFAULT_HOUSEHOLD_VALUES, NEW_PENSION, addRow } = await import('../src/lib/householdValues.js');
    const { previewResult } = await import('../src/next/NextApp.jsx');
    const pensionValues = addRow(DEFAULT_HOUSEHOLD_VALUES, 'incomes', { type: 'pension', ...NEW_PENSION });
    const { household: withPension } = previewResult(pensionValues, 2026);
    const penPage = renderToStaticMarkup(<NextApp initialPage="pension" client={null} initialValues={pensionValues} />);
    expect(penPage).toContain('Lump sum offered');
    expect(penPage).toContain('>In the plan<');
    expect(penPage).toContain('>Use the lump sum in the plan</button>');
    const penInputs = householdToPensionInputs(withPension);
    const penResult = renderToStaticMarkup(
      <PensionResult pension={pensionResult(penInputs)} inputs={penInputs} nominalReturn={0.0975} realReturn={0.07} inflation={0.025} />,
    );
    expect(penResult).toContain('rate of return');
    expect(penResult).toContain('How long you live decides it');
    expect(penResult).not.toMatch(/NaN|Infinity/);
    expect(pen).toContain('href="#/docs/pension"');
    expect(tax).toContain('href="#/docs/tax"');
    expect(firstTitle(pen)).toBe('Pension offer');
    expect(pen).not.toContain('Expected retirement lifestyle');
    expect(pen).not.toMatch(/NaN|Infinity/);
    expect(html).toContain('href="#/conversion"');
    expect(html).toContain('href="#/pension"');
    // every calculator's results are blocks: collapsible cards with a headline, one Expand/Collapse all
    const blockCount = (page) => (page.match(/class="collapsible card collapsible-card/g) ?? []).length;
    expect(blockCount(tax)).toBeGreaterThanOrEqual(3); // the rates sit in a fixed card above them
    expect(tax).toContain('<h2 id="block-rates">Tax rates this year</h2>');
    expect(tax).toContain('>Marginal rate<');
    expect(tax).toContain('>Effective marginal rate (EMTR)<');
    expect(tax).toContain('>Average tax rate<');
    expect(blockCount(proj)).toBe(6);
    expect(proj).toMatch(/Peak \$[\d,]+ in \d{4}/);
    expect(blockCount(conv)).toBe(4); // the charts block at the bottom (2026-10-09)
    expect(blockCount(pen)).toBe(0); // no pension: no results
    expect(blockCount(penResult)).toBe(3); // with "In the plan"
    // the Roth page: its five cards, the blend explorer, the lifetime comparison and its full table
    expect(blockCount(roth)).toBe(8);
    expect(roth).toContain('>Show full table<');
    // income and tax rates year by year, and the tax each year over the whole lifetime (2026-10-09)
    expect(roth).toContain('>Income and tax rates, year by year</h3>');
    expect(roth).toContain('>Tax each year</h3>');
    expect(roth).not.toContain('Tax each year in retirement');
    expect(roth.indexOf('Estimates only')).toBeGreaterThan(roth.indexOf('>Show full table<'));
    for (const page of [tax, proj, conv]) expect(page).toMatch(/(Expand|Collapse) all results/);
    // the collapse bar: on calculator pages only, inputs shown at first
    expect(roth).toContain('class="collapse-bar" aria-controls="calc-inputs" aria-expanded="true"');
    expect(html).not.toContain('collapse-bar');
  });

  it('the inputs page: the groups as blocks with their sections inside, and links to each calculator', async () => {
    const { default: NextApp } = await import('../src/next/NextApp.jsx');
    const page = renderToStaticMarkup(<NextApp initialPage="inputs" />);
    expect(page).toContain('<h1>Inputs</h1>');
    expect(page).toContain('>Clear inputs</button>');
    // three groups as blocks (closed at first, a line per section), Assumptions a block of its own
    for (const group of ['household', 'income', 'assets']) {
      expect(page, group).toContain(`class="collapsible card collapsible-card inputs-group inputs-group-${group}"`);
    }
    expect(page).toContain('<strong>Existing Accounts:</strong> Pre-tax $100,000');
    expect(page).toContain('class="collapsible card collapsible-card inputs-assumptions"');
    expect((page.match(/mini-block/g) ?? []).length).toBe(8);
    // income rows: closed, one line each
    expect(page).toContain('<span>W-2 wages · $100,000 per year</span>');
    expect(page).toContain('<span>Social Security · estimated from earnings</span>');
    expect(page).toContain('>Set start/end ages</button>');
    for (const label of ['Biological sex', 'Plan to age', 'or birthdate', '+ Add a debt', '+ Add income', 'Withdrawal strategy in retirement']) {
      expect(page, label).toContain(label);
    }
    // the calculators' own inputs aren't on the inputs page (decided 2026-10-08)
    for (const label of ['+ Add other income types', 'Lump sum offered', 'Project to age', 'Convert to Roth this year']) {
      expect(page, label).not.toContain(label);
    }
    expect((page.match(/class="collapsible card collapsible-card/g) ?? []).length).toBe(12);
    expect(page).toContain('Open a calculator');
    expect(page).toContain('href="#/pension"');
    expect(page).not.toContain('suite-tile-headline');
    expect(page).not.toMatch(/NaN|Infinity/);
  });

  it('a cleared household (Clear inputs): every page renders, asking for the inputs', async () => {
    const { default: NextApp } = await import('../src/next/NextApp.jsx');
    const { BLANK_HOUSEHOLD_VALUES } = await import('../src/lib/householdValues.js');
    for (const page of ['home', 'inputs', 'roth', 'tax', 'projection', 'conversion', 'pension']) {
      const html = renderToStaticMarkup(<NextApp initialPage={page} initialValues={BLANK_HOUSEHOLD_VALUES} client={null} />);
      expect(html, page).not.toMatch(/NaN|Infinity/);
    }
    const home = renderToStaticMarkup(<NextApp initialPage="home" initialValues={BLANK_HOUSEHOLD_VALUES} client={null} />);
    expect(home).toContain('Needs inputs');
  });

  it('shows the spouse only when filing jointly, side by side, and renders a two-earner result', async () => {
    const { default: HouseholdInputs } = await import('../src/next/HouseholdInputs.jsx');
    const { previewResult } = await import('../src/next/NextApp.jsx');
    const { DEFAULT_HOUSEHOLD_VALUES: D, addRow, setIncludeSpouse, setPersonField } = await import('../src/lib/householdValues.js');
    const noop = () => {};
    const single = renderToStaticMarkup(<HouseholdInputs values={D} onUpdate={noop} />);
    expect(single).not.toContain('Enter your spouse separately?');
    expect(single).not.toContain('<legend>Spouse</legend>');
    expect(single).toContain('+ Add an account');
    const values = addRow(setIncludeSpouse({ ...D, filingStatus: 'mfj' }, true), 'incomes', { owner: 'p2', amount: '60000' });
    const form = renderToStaticMarkup(<HouseholdInputs values={values} onUpdate={noop} />);
    expect(form).toContain('Enter your spouse separately?');
    expect(form).toContain('<legend>You</legend>');
    expect(form).toContain('<legend>Spouse</legend>');
    expect(form).toContain('>Whose<');
    const { result } = previewResult(values, 2026);
    expect(result.valid).toBe(true);
    expect(result.current.fica.people).toHaveLength(2);
    expect(renderToStaticMarkup(<ResultsSummary result={result} />)).not.toMatch(/NaN|Infinity/);
    const older = setPersonField(setPersonField(values, 'p2', 'age', '70'), 'p2', 'retirementAge', '65');
    // the spouse retired at 65 and 70 now: already retired, no error (decided 2026-10-09)
    expect(previewResult(older, 2026).result.valid).toBe(true);
  });

  it("a view-only household opens locked, with Edit a copy and no share button", async () => {
    const { default: HouseholdInputs } = await import("../src/next/HouseholdInputs.jsx");
    const { DEFAULT_HOUSEHOLD_VALUES } = await import("../src/lib/householdValues.js");
    const noop = () => {};
    const locked = renderToStaticMarkup(<HouseholdInputs values={DEFAULT_HOUSEHOLD_VALUES} onUpdate={noop} locked onEditCopy={noop} />);
    expect(locked).toContain("View only.");
    expect(locked).toContain("Edit a copy");
    expect(locked).toMatch(/<fieldset class="locked-fieldset" disabled/);
    const { default: NextApp } = await import("../src/next/NextApp.jsx");
    const home = renderToStaticMarkup(<NextApp />);
    expect(home).toContain("Copy link to this household");
    expect(home).toContain("Copy summary (inputs, results, link)");
  });
});

describe('preview sign-in and saved households', () => {
  it('no backend configured: no sign-in anywhere', async () => {
    const { default: NextApp } = await import('../src/next/NextApp.jsx');
    const html = renderToStaticMarkup(<NextApp client={null} />);
    expect(html).not.toContain('Sign in to save households');
    expect(html).not.toContain('Saved households');
  });

  it('the account bar: signed out offers a link sign-in; signed in shows who', async () => {
    const { default: AccountBar } = await import('../src/next/AccountBar.jsx');
    const out = renderToStaticMarkup(<AccountBar client={{}} cloud={{ configured: true, ready: true, session: null }} />);
    expect(out).toContain('Sign in to save households');
    const signedIn = renderToStaticMarkup(
      <AccountBar client={{}} cloud={{ configured: true, ready: true, session: {}, email: 'advisor@firm.test' }} />,
    );
    expect(signedIn).toContain('Signed in as <strong>advisor@firm.test</strong>');
    expect(signedIn).toContain('Sign out');
    // until the session has been read, nothing (no flash of "Sign in")
    expect(renderToStaticMarkup(<AccountBar client={{}} cloud={{ configured: true, ready: false, session: null }} />)).toBe('');
  });

  it('the households card (dashboard, inputs page): a block, the testing-stage notice, save form, the open household', async () => {
    const { default: SavedHouseholds } = await import('../src/next/SavedHouseholds.jsx');
    const { DEFAULT_HOUSEHOLD_VALUES } = await import('../src/lib/householdValues.js');
    const html = renderToStaticMarkup(
      <SavedHouseholds
        client={{}}
        values={DEFAULT_HOUSEHOLD_VALUES}
        opened={{ id: 'n1', label: 'J.M. 2026', values: DEFAULT_HOUSEHOLD_VALUES }}
        onOpen={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(html).toContain('<span class="collapsible-title" id="saved-title">Households</span>');
    expect(html).toContain('aria-expanded="false"'); // closed at first (2026-10-09)
    expect(html).toContain('On screen: J.M. 2026</span>'); // the summary, seen when closed
    expect(html).toContain('Don’t store client names');
    expect(html).not.toContain('Re-open saved');
    expect(html).toContain('On screen: <strong>J.M. 2026</strong>');
    expect(html).toContain('Or save as a new household');
    // the form matches what was saved: "Saved", and Save changes has nothing to do
    expect(html).toContain('<span class="dim">Saved</span>');
    expect(html).not.toContain('Unsaved changes');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save changes<\/button>/);
  });

  it('the saved households card marks unsaved changes', async () => {
    const { default: SavedHouseholds } = await import('../src/next/SavedHouseholds.jsx');
    const { DEFAULT_HOUSEHOLD_VALUES: D, updateRow } = await import('../src/lib/householdValues.js');
    const html = renderToStaticMarkup(
      <SavedHouseholds
        client={{}}
        values={updateRow(D, 'incomes', 'i1', 'amount', '123456')}
        opened={{ id: 'n1', label: 'J.M. 2026', values: D }}
        onOpen={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(html).toContain('Unsaved changes');
    expect(html).toMatch(/<button type="button" class="button secondary">Save changes<\/button>/);
    // the way back to the saved version
    expect(html).toContain('>Re-open saved</button>');
  });

  it('the compact card for other pages: only the household on screen, saving as new behind a closed section', async () => {
    const { default: SavedHouseholds } = await import('../src/next/SavedHouseholds.jsx');
    const { DEFAULT_HOUSEHOLD_VALUES } = await import('../src/lib/householdValues.js');
    const props = { client: {}, values: DEFAULT_HOUSEHOLD_VALUES, onOpen: () => {}, onSaved: () => {}, compact: true };
    const open = renderToStaticMarkup(
      <SavedHouseholds {...props} opened={{ id: 'n1', label: 'J.M. 2026', values: DEFAULT_HOUSEHOLD_VALUES }} />,
    );
    expect(open).toContain('On screen: <strong>J.M. 2026</strong>');
    expect(open).toContain('<summary>Save as a new household</summary>');
    expect(open).not.toContain('<h2');
    expect(open).not.toContain('client-select'); // no list of clients
    expect(open).toContain('dashboard</a>');
    expect(open).not.toMatch(/<details[^>]* open/);
    const none = renderToStaticMarkup(<SavedHouseholds {...props} opened={null} />);
    expect(none).toContain('Not saved yet.');
    expect(none).toContain('<summary>Save this household</summary>');
    expect(none).toContain('Don’t store client names');
  });
});

describe('preview pages: Medicare IRMAA', () => {
  const person = (age, income) => ({ filingStatus: 'single', year: 2026, people: [{ age, wages: 0, selfEmploymentIncome: 0 }], pretaxDeferrals: 0, income });

  it('the tax page: the 2028 premium this year sets, for someone 65 by then; nothing for someone younger', async () => {
    const { default: TaxResult } = await import('../src/next/TaxResult.jsx');
    const { taxCalculatorResult } = await import('../src/lib/taxCalculator.js');
    // $150,000 pension at 64: tier 2, $2,884.80; $21,000 of room to $171,000
    const html = renderToStaticMarkup(<TaxResult tax={taxCalculatorResult(person(64, { ordinaryIncome: 150000 }), { irmaa: true })} />);
    expect(html).toContain('Medicare premiums in 2028');
    expect(html).toContain('2 of 5');
    expect(html).toContain('$2,885 per year');
    expect(html).toContain('$21,000');
    const young = renderToStaticMarkup(<TaxResult tax={taxCalculatorResult(person(50, { ordinaryIncome: 150000 }), { irmaa: true })} />);
    expect(young).not.toContain('Medicare premiums');
  });

  it('the conversion page: the IRMAA the conversion adds and the room in the tier', async () => {
    const { default: ConversionResult } = await import('../src/next/ConversionResult.jsx');
    const { conversionResult } = await import('../src/lib/conversionCalculator.js');
    // the hand case in conversionCalculator.test.js: +$1,736.40 (tier 1 to 2), room $11,500
    const c = conversionResult(person(64, { ordinaryIncome: 100000, socialSecurity: 30000 }), 20000, { irmaa: true });
    const html = renderToStaticMarkup(<ConversionResult conversion={c} pretaxBalance={500000} />);
    expect(html).toContain('Medicare IRMAA in 2028 (tier 1 to 2)');
    expect(html).toContain('$1,736');
    expect(html).toContain('Tax cost plus IRMAA');
    expect(html).toContain('converting up to $11,500 keeps');
  });

  it('the projection page: the lifetime IRMAA total and the column in the strategy table', async () => {
    const { default: ProjectionResult } = await import('../src/next/ProjectionResult.jsx');
    const { projectionView } = await import('../src/lib/projectionSummary.js');
    const { PREVIEW_DEFAULT_VALUES, toHousehold } = await import('../src/lib/household.js');
    const h = toHousehold({ ...PREVIEW_DEFAULT_VALUES, currentAge: '66', retirementAge: '67', otherPretaxBalance: '3000000', accounts: undefined }, 2026);
    const html = renderToStaticMarkup(<ProjectionResult view={projectionView(h, 60000)} />);
    expect(html).toMatch(/Medicare IRMAA surcharges \(\d+ years\)/);
    expect(html).toContain('<th scope="col">Medicare IRMAA</th>');
  });
});

describe('Docs (#/docs)', () => {
  it('the index lists the articles; an article renders with heading ids; an unknown one says so', async () => {
    const { default: DocsPage } = await import('../src/components/DocsPage.jsx');
    const index = renderToStaticMarkup(<DocsPage hash="#/docs" />);
    expect(index).toContain('<h1>Docs</h1>');
    expect(index).toContain('href="#/docs/inputs"');
    expect(index).toContain('href="#/docs/roth"');
    expect(index).toContain('href="#/scenarios"');
    const inputs = renderToStaticMarkup(<DocsPage hash="#/docs/inputs/social-security" />);
    expect(inputs).toContain('<h1 id="the-household-inputs">The household inputs</h1>');
    expect(inputs).toContain('id="social-security"');
    expect(inputs).toContain('href="#/docs"');
    expect(renderToStaticMarkup(<DocsPage hash="#/docs/nothing-here" />)).toContain('There is no article at this address.');
    const { default: NextApp } = await import('../src/next/NextApp.jsx');
    expect(renderToStaticMarkup(<NextApp />)).toContain('href="#/docs"');
    expect(renderToStaticMarkup(<NextApp initialPage="inputs" />)).toContain('href="#/docs/inputs"');
  });
});

describe('Who can contribute (the Roth page)', () => {
  it('lists the notes, and shows nothing without any', async () => {
    const { default: ContributionNotes } = await import('../src/next/ContributionNotes.jsx');
    expect(renderToStaticMarkup(<ContributionNotes notes={[]} />)).toBe('');
    const html = renderToStaticMarkup(<ContributionNotes notes={[{ owner: 'p1', kind: 'rothIra', status: 'none', message: 'No Roth IRA.' }]} />);
    expect(html).toContain('Who can contribute');
    expect(html).toContain('<li>No Roth IRA.</li>');
  });
});

describe('Send feedback', () => {
  it('is on every page, closed until clicked', async () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('<footer class="site-footer"><p class="feedback"><button type="button" class="link-button">Send feedback</button>');
    const { default: Feedback } = await import('../src/components/Feedback.jsx');
    expect(renderToStaticMarkup(<Feedback />)).not.toContain('<textarea');
    // and the tab on the right edge (decided 2026-10-09)
    expect(html).toContain('<button type="button" class="feedback-tab" aria-expanded="false">Feedback</button>');
  });
});

describe('Survivor years on the projection page (phase 2)', () => {
  it('a couple ten years apart: the band on the charts, shaded rows, who died and when', async () => {
    const { default: ProjectionResult, firstDeath } = await import('../src/next/ProjectionResult.jsx');
    const { default: HouseholdInputs } = await import('../src/next/HouseholdInputs.jsx');
    const { previewResult } = await import('../src/next/NextApp.jsx');
    const { projectionView } = await import('../src/lib/projectionSummary.js');
    const { DEFAULT_HOUSEHOLD_VALUES: D, setIncludeSpouse, setPersonField } = await import('../src/lib/householdValues.js');
    let values = setIncludeSpouse({ ...D, filingStatus: 'mfj' }, true);
    values = setPersonField(values, 'p1', 'age', '60', '2026-10-09');
    values = setPersonField(values, 'p2', 'age', '50', '2026-10-09');
    const { household, result } = previewResult(values, 2026);
    const view = projectionView(household, result.retirementNeed.target);
    // You (60) reach 95 in 2061, when your spouse is 85; your spouse lives to 95 in 2071
    expect(firstDeath(view.rows)).toEqual({ year: 2061, firstSurvivorYear: 2062, who: 0, age: 95 });
    expect(view.rows.at(-1).year).toBe(2071);
    const html = renderToStaticMarkup(<ProjectionResult view={view} />);
    expect(html).toContain('Survivor years');
    expect(html).toContain('class="chart-shade"');
    expect(html).toContain('You at 95, in 2061');
    expect((html.match(/survivor-row/g) ?? []).length).toBe(10);
    expect(html).toContain('<td>— / 86</td>');
    expect(html).not.toMatch(/NaN|Infinity/);
    // the input shows for a couple only
    const couple = renderToStaticMarkup(<HouseholdInputs values={values} onUpdate={() => {}} sections={['assumptions']} defaultOpen={['assumptions']} />);
    expect(couple).toContain('Spending after the first death');
    expect(couple).toContain('survivor spends 80%');
    const single = renderToStaticMarkup(<HouseholdInputs values={D} onUpdate={() => {}} sections={['assumptions']} defaultOpen={['assumptions']} />);
    expect(single).not.toContain('Spending after the first death');
  });
});

describe('Tax drag (phase 2)', () => {
  it('the dividends input in Assumptions, and the year table’s dividends', async () => {
    const { default: ProjectionResult } = await import('../src/next/ProjectionResult.jsx');
    const { default: HouseholdInputs } = await import('../src/next/HouseholdInputs.jsx');
    const { previewResult } = await import('../src/next/NextApp.jsx');
    const { projectionView } = await import('../src/lib/projectionSummary.js');
    const { DEFAULT_HOUSEHOLD_VALUES: D } = await import('../src/lib/householdValues.js');
    const inputs = renderToStaticMarkup(<HouseholdInputs values={D} onUpdate={() => {}} sections={['assumptions']} defaultOpen={['assumptions']} />);
    expect(inputs).toContain('Dividends on taxable accounts');
    expect(inputs).toContain('1.3% (broad stock index fund)');
    // a taxable account: its dividends show in the year table (behind "Show all columns")
    const values = { ...D, accounts: [{ ...D.accounts[0], type: 'taxable', basisShare: '0.5' }] };
    const { household, result } = previewResult(values, 2026);
    const view = projectionView(household, result.retirementNeed.target);
    expect(view.rows[0].dividends).toBeCloseTo(1300, 6); // 1.3% of $100,000 while working
    expect(view.rows[0].dividendTaxFromAccounts).toBeCloseTo(195, 6); // at 15%
    expect(renderToStaticMarkup(<ProjectionResult view={view} />)).not.toMatch(/NaN|Infinity/);
  });
});

describe('Employer contributions (phase 2)', () => {
  it('the contribution row’s employer fields, the summary and the year table', async () => {
    const { default: HouseholdInputs } = await import('../src/next/HouseholdInputs.jsx');
    const { previewResult } = await import('../src/next/NextApp.jsx');
    const { projectionView } = await import('../src/lib/projectionSummary.js');
    const { inputSections } = await import('../src/lib/householdInputs.js');
    const { DEFAULT_HOUSEHOLD_VALUES: D } = await import('../src/lib/householdValues.js');
    const values = { ...D, contributions: [{ ...D.contributions[0], employer: 'match', matchRate: '1', matchUpTo: '0.04' }] };
    const html = renderToStaticMarkup(<HouseholdInputs values={values} onUpdate={() => {}} sections={['contributions']} defaultOpen={['contributions']} />);
    expect(html).toContain('Employer contribution');
    expect(html).toContain('100% of what is deferred, on deferrals up to 4% of W-2 pay');
    expect(inputSections(['contributions'])[0].summary(values)).toBe('$10,000 per year · Pre-tax · 401(k) · employer match');
    // an IRA has no employer fields
    const ira = { ...D, contributions: [{ ...D.contributions[0], account: 'ira' }] };
    expect(renderToStaticMarkup(<HouseholdInputs values={ira} onUpdate={() => {}} sections={['contributions']} defaultOpen={['contributions']} />)).not.toContain(
      'Employer contribution',
    );
    const { household, result } = previewResult(values, 2026);
    const view = projectionView(household, result.retirementNeed.target);
    expect(view.rows[0].employerContributions).toBe(4000);
    expect(view.rows.at(-1).employerContributions).toBe(0);
  });
});

describe('The rest of the household in the projection (phase 2 step f)', () => {
  it('rent in retirement, the surplus setting, and the year table', async () => {
    const { default: ProjectionResult } = await import('../src/next/ProjectionResult.jsx');
    const { default: HouseholdInputs } = await import('../src/next/HouseholdInputs.jsx');
    const { previewResult } = await import('../src/next/NextApp.jsx');
    const { projectionView } = await import('../src/lib/projectionSummary.js');
    const { DEFAULT_HOUSEHOLD_VALUES: D } = await import('../src/lib/householdValues.js');
    // $15,000 a year of rent from 35 to 95
    const rent = { id: 'i3', owner: 'p1', type: 'other', treatment: 'ordinary', amount: '15000', fromAge: '', toAge: '95' };
    const values = { ...D, incomes: [...D.incomes.map((r) => ({ ...r })), { ...D.incomes[0], ...rent }] };
    const saved = projectionView(...(({ household, result }) => [household, result.retirementNeed.target])(previewResult(values, 2026)));
    // working: the rent after its tax is beyond the paycheck, saved
    expect(saved.rows[0].otherIncome).toBe(15000);
    expect(saved.rows[0].reinvested).toBeGreaterThan(10000);
    const spendValues = { ...values, assumptions: { ...values.assumptions, surplus: 'spend' } };
    const spent = projectionView(...(({ household, result }) => [household, result.retirementNeed.target])(previewResult(spendValues, 2026)));
    expect(spent.rows[0].extraSpending).toBeCloseTo(saved.rows[0].reinvested, 6);
    expect(spent.rows[0].reinvested).toBe(0);
    expect(renderToStaticMarkup(<ProjectionResult view={spent} />)).not.toMatch(/NaN|Infinity/);
    const html = renderToStaticMarkup(<HouseholdInputs values={D} onUpdate={() => {}} sections={['assumptions']} defaultOpen={['assumptions']} />);
    expect(html).toContain('Income above what is needed');
  });
});

describe('Already retired (2026-10-09)', () => {
  it('75, retired at 65, receiving Social Security: every page renders; the Roth page says there is nothing to compare', async () => {
    const { default: NextApp, previewResult, RETIRED_MESSAGE } = await import('../src/next/NextApp.jsx');
    const { DEFAULT_HOUSEHOLD_VALUES: D, newPerson } = await import('../src/lib/householdValues.js');
    const values = {
      ...D,
      people: [newPerson('p1', { age: '75', retirementAge: '65' })],
      incomes: [D.incomes[0], { ...D.incomes[1], ssMode: 'receiving', amount: '2500' }], // the W-2 row ends at retirement
      contributions: [],
      accounts: [{ ...D.accounts[0], balance: '800000' }],
    };
    expect(previewResult(values, 2026).result.errors).toEqual([RETIRED_MESSAGE]);
    for (const page of ['home', 'inputs', 'roth', 'tax', 'conversion', 'pension', 'projection']) {
      const html = renderToStaticMarkup(<NextApp initialPage={page} initialValues={values} client={null} />);
      expect(html).not.toMatch(/NaN|Infinity|must be after/);
    }
    const inputs = renderToStaticMarkup(<NextApp initialPage="inputs" initialValues={values} client={null} />);
    expect(inputs).toContain('You 75, retired at 65');
  });
});

describe('The tax page (2026-10-09)', () => {
  it('AGI and the tax paid under the rates, the calculation below the chart, IRMAA tiers in a key', async () => {
    const { default: NextApp } = await import('../src/next/NextApp.jsx');
    const { DEFAULT_HOUSEHOLD_VALUES: D, setPersonField } = await import('../src/lib/householdValues.js');
    const values = setPersonField(D, 'p1', 'age', '64', '2026-10-09');
    const html = renderToStaticMarkup(<NextApp initialPage="tax" initialValues={values} client={null} />);
    expect(html).toContain('<div class="stat-note">(also called the effective tax rate)</div>');
    // by hand, single, 2026: AGI 100,000 − 10,000 Pre-tax deferral = 90,000; taxable 90,000 − 16,100 =
    // 73,900; tax 10% × 12,400 + 12% × 38,000 + 22% × 23,500 = 1,240 + 4,560 + 5,170 = 10,970;
    // payroll 7.65% × 100,000 = 7,650; total 18,620
    expect(html).toContain('Adjusted gross income (AGI)</span><strong>$90,000</strong>');
    expect(html).toContain('Total tax paid</span><strong>$18,620</strong>');
    // the calculation below the chart (2026-10-09, reversed), then the next $100 worked out:
    // 22% of $100 = $22.00, + $7.65 payroll -> 29.7% (29.65% at one decimal)
    expect(html.indexOf('>The calculation<')).toBeGreaterThan(html.indexOf('>Tax bracket visual<'));
    expect(html).toContain('>Tax on $100 at 22%</span><span>+ $22.00</span>');
    expect(html).toContain('Effective marginal rate: $22.00 ÷ $100');
    expect(html).toContain('With $7.65 more payroll tax');
    expect(html).toContain('Medicare IRMAA tiers:');
    expect(html).not.toContain('IRMAA +$'); // no longer labelled on the chart
  });
});
