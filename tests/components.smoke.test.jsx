import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App.jsx';
import ArticlePage from '../src/components/ArticlePage.jsx';
import articleMarkdown from '../ARTICLE.md?raw';
import InputForm from '../src/components/InputForm.jsx';
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

// TEMPORARY (2026-09-29): cuts the duplicate "old calculation" card (result.old, id "sec2-old")
// out of a rendered page, so tests written for the CURRENT (sideAware) methodology's page keep
// testing only that, unaffected by the restored old card sitting between it and the after-tax
// comparison card. Remove this helper (and its call sites) along with the old card itself.
const withoutOldRatesCard = (html) => {
  const oldStart = html.indexOf('aria-labelledby="sec2-old"');
  if (oldStart === -1) return html;
  const oldSectionStart = html.lastIndexOf('<section', oldStart);
  const nextSectionStart = html.indexOf('<section', oldStart);
  return html.slice(0, oldSectionStart) + html.slice(nextSectionStart);
};

describe('InputForm', () => {
  const html = renderToStaticMarkup(<InputForm values={DEFAULT_FORM_VALUES} onChange={() => {}} />);

  it('has every input from the spec, and no submit button', () => {
    for (const label of [
      'Total gross income (annual)',
      'Filing status',
      'Current age',
      'Planned retirement age',
      'Current debt payments that will end by retirement (annual)',
      'Other expenses that will end by retirement (annual)',
      'Savings for retirement (annual)',
      'Are these savings currently Pre-tax or Roth?',
      'Account type these savings are held in',
      'Do you know your Social Security benefit?',
      'Expected annual investment return',
      'Existing Pre-tax accounts (total value)',
      'Existing Roth accounts (total value)',
      'Existing taxable investment accounts (total value)',
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toMatch(/type="submit"/);
    // the only buttons are the section headers and "Expand all"
    expect(html).not.toMatch(/<button(?! type="button")/);
  });

  it('drops the two hints, rewords the savings hint, and moves the return into Assumptions', () => {
    expect(html).not.toContain('Also used as the contribution amount in the comparison');
    expect(html).not.toContain('Used only to check against the IRS contribution limit');
    expect(html).toContain("The amount you're currently contributing to retirement accounts each year, or the amount you're considering.".replaceAll("'", '&#x27;'));
    // the return selector lives in the last section, Assumptions, whose header shows the current rate
    const assumptions = html.slice(html.indexOf('>Assumptions<'));
    expect(assumptions).toContain('7% expected annual return');
    expect(assumptions).toContain('Expected annual investment return');
    // ...and is not in the sections above it
    const mainForm = html.slice(0, html.indexOf('>Assumptions<'));
    expect(mainForm).not.toContain('Expected annual investment return');
  });

  it('has a type-of-income dropdown under gross income, and the 1099 amount only for "both"', () => {
    const iGross = html.indexOf('Total gross income (annual)');
    const iType = html.indexOf('Type of income');
    const iFiling = html.indexOf('Filing status');
    expect(iGross).toBeLessThan(iType);
    expect(iType).toBeLessThan(iFiling);
    expect(html).toContain('W-2 (employee)');
    expect(html).toContain('1099 (self-employed)');
    expect(html).toContain('Both W-2 and 1099');
    expect(html).not.toContain('How much of your gross income is 1099?');
    const both = renderToStaticMarkup(
      <InputForm values={{ ...DEFAULT_FORM_VALUES, incomeType: 'both' }} onChange={() => {}} />,
    );
    expect(both).toContain('How much of your gross income is 1099?');
    expect(both).toContain('Self-employment tax replaces FICA');
  });

  it('puts the retirement lifestyle in its own dropdown directly below gross income, for earning more or less later', () => {
    const grossIncomeIdx = html.indexOf('Total gross income');
    const lifestyleIdx = html.indexOf('Will you earn more or less later?');
    const typeIdx = html.indexOf('Type of income');
    expect(grossIncomeIdx).toBeGreaterThan(-1);
    expect(lifestyleIdx).toBeGreaterThan(grossIncomeIdx);
    expect(typeIdx).toBeGreaterThan(lifestyleIdx);
    const block = html.slice(grossIncomeIdx, typeIdx);
    expect(block).toContain('class="details lifestyle-assumption"');
    expect(block).toContain('People earlier in their careers often expect to earn and spend more later');
    expect(block).toContain('Others expect to spend less in');
    expect(block).toContain('Expected retirement lifestyle');
    // the return-rate Assumptions dropdown no longer mentions lifestyle
    const assumptions = html.slice(html.indexOf('>Assumptions<'));
    expect(assumptions).toContain('7% expected annual return');
    expect(assumptions).not.toContain('retirement lifestyle');
    expect(assumptions).not.toContain('Expected retirement lifestyle');
    const higher = renderToStaticMarkup(
      <InputForm values={{ ...DEFAULT_FORM_VALUES, retirementLifestyle: '1.25' }} onChange={() => {}} />,
    );
    expect(higher).toContain('Will you earn more or less later? (25% higher retirement lifestyle)');
  });

  it('hides the SS benefit input when the answer is No, and shows the estimate disclaimer', () => {
    expect(html).not.toContain('Annual gross Social Security benefit');
    expect(html).toContain('Estimated — see');
  });

  it('shows the SS benefit input when the answer is Yes', () => {
    const yes = renderToStaticMarkup(
      <InputForm values={{ ...DEFAULT_FORM_VALUES, knowsSocialSecurity: 'yes' }} onChange={() => {}} />,
    );
    expect(yes).toContain('Annual gross Social Security benefit');
  });
});

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
      'Total tax difference between scenarios',
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

  it('shows a portfolio build-up card between the retirement number and the rates: contribution difference, existing balances, and Future Contributions, each split by account type', () => {
    const html = render();
    const buildup = html.slice(html.indexOf('id="sec-portfolio"'), html.indexOf('id="sec2"'));
    expect(buildup).toContain('Your portfolio at retirement</span>');
    expect(buildup).toContain('Why this matters');
    expect(buildup).toContain('Your contribution this year');
    expect(buildup).toContain('To your account');
    expect(buildup).toContain('Total contribution');
    expect(buildup).toContain('Existing Accounts, grown to retirement');
    expect(buildup).toContain('Future Contributions, grown to retirement');
    expect(buildup).toContain('Total portfolio at retirement');
    expect(buildup).toContain('class="breakdown"'); // reuses the same bucket breakdown as Section 3
    expect(buildup).toContain('How is this calculated?');
    expect(buildup).toContain('stacked <strong>on top of</strong>');
    // no taxable side account in the default case: the row is omitted, not shown as $0
    expect(buildup).not.toContain('To a taxable account');
    expect(buildup).not.toMatch(/NaN|Infinity/);
  });

  it('shows the taxable-account contribution row only when savings exceed the IRS limit', () => {
    const under = render({ savings: '10000' });
    const buildupUnder = under.slice(under.indexOf('id="sec-portfolio"'), under.indexOf('id="sec2"'));
    expect(buildupUnder).not.toContain('To a taxable account');
    const over = render({ grossIncome: '150000', savings: '30000', otherPretaxBalance: '0' });
    const buildupOver = over.slice(over.indexOf('id="sec-portfolio"'), over.indexOf('id="sec2"'));
    expect(buildupOver).toContain('To a taxable account');
    expect(buildupOver).toContain('Over the IRS limit');
  });

  it('handles $0 saved without NaN, with a graceful "nothing saved yet" note', () => {
    const html = render({ savings: '0' });
    const buildup = html.slice(html.indexOf('id="sec-portfolio"'), html.indexOf('id="sec2"'));
    expect(buildup).not.toMatch(/NaN|Infinity/);
    expect(buildup).toContain('there’s nothing saved yet to compare');
    expect(buildup).not.toContain('Why this matters:</strong> a Pre-tax dollar');
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
    expect(trade).toContain('Why is the Pre-tax side bigger?');
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
    expect(dropdown).not.toContain('spilled into a taxable account');

    // Over the limit: $150,000 income, $30,000 saved — both sides spill over (see
    // compare.test.js's "contribution limits" hand calcs for the underlying numbers).
    const over = render({ grossIncome: '150000', savings: '30000', otherPretaxBalance: '0' });
    const tradeOver = over.slice(over.indexOf('id="sec-tradeoff"'), over.indexOf('id="sec3"'));
    const dropdownOver = tradeOver.slice(tradeOver.indexOf('Show the calculation'), tradeOver.indexOf('</details>', tradeOver.indexOf('Show the calculation')));
    expect(dropdownOver).toContain('spilled into a taxable account over the IRS limit');
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

  it('shows the Pre-tax deduction in the retirement-number calculation, and says so for Roth', () => {
    const html = render({ savings: '10000', currentType: 'pretax' });
    const sec1 = html.slice(html.indexOf('id="sec1"'), html.indexOf('id="sec2"'));
    expect(sec1).toContain('Step 1: federal income tax');
    expect(sec1).toContain('Pre-tax savings for retirement (not taxed now)');
    expect(sec1).toContain('Taxable income');
    expect(sec1).toContain('Your savings are Pre-tax, so they come out before income tax');
    const roth = render({ savings: '10000', currentType: 'roth' });
    const rothSec1 = roth.slice(roth.indexOf('id="sec1"'), roth.indexOf('id="sec2"'));
    expect(rothSec1).not.toContain('Pre-tax savings for retirement (not taxed now)');
    expect(rothSec1).toContain('Your savings are Roth, so they come out after income tax');
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
    // Section 3's "Show the calculation" also notes it, since both portfolio scenarios owe it here
    expect(html).toContain('the gain also owes the 3.8% Net Investment Income Tax');
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

  it('keeps "How the rates fit together" inside a rates dropdown, not loose on the page', () => {
    // TEMPORARY (2026-09-29): a duplicate "old calculation" card is on the page for comparison
    // (see result.old); it happens to reuse the same lead sentence, so these checks are scoped
    // to exclude it, to keep testing the CURRENT (sideAware) methodology's own page specifically.
    const html = withoutOldRatesCard(render());
    const start = html.indexOf('How are these rates calculated?');
    const dropdown = html.slice(start, html.indexOf('</details>', start));
    expect(dropdown).toContain('How the rates fit together.');
    // it appears twice: the main rates card and "Retirement years without Social Security" share
    // the same walk-through component, each in its own dropdown — never loose on the page
    expect(html.split('How the rates fit together.').length - 1).toBe(2);
    let from = 0;
    for (let i = 0; i < 2; i++) {
      const at = html.indexOf('How the rates fit together.', from);
      expect(at).toBeGreaterThan(-1);
      // immediately inside a details-body, itself inside an open <details>
      expect(html.slice(Math.max(0, at - 200), at)).toContain('<div class="details-body">');
      from = at + 1;
    }
    // it comes before the step-by-step explanation
    expect(dropdown.indexOf('How the rates fit together.')).toBeLessThan(dropdown.indexOf('Step 1: income from Social Security and Existing Accounts'));
  });

  it('highlights the two rates in a paired box, no explanatory lead-in or verdict sentence', () => {
    // TEMPORARY (2026-09-29): see the note in the previous test — scoped to exclude the
    // duplicate "old calculation" card, which legitimately still says "Overall effective rate".
    const html = withoutOldRatesCard(render());
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
    expect(html).toContain('Half of your self-employment tax');
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

  it('explains how the three rates fit together, and drops the old sentence', () => {
    const html = render();
    expect(html).toContain('How the rates fit together.');
    expect(html).not.toContain('different kinds of rate on purpose');
    expect(html).not.toContain('Why two different rates?');
  });

  it('puts the Pre-tax and Roth contribution amounts in the comparison table, not in Section 1', () => {
    const html = render();
    const sec1 = html.slice(html.indexOf('id="sec1"'), html.indexOf('id="sec2"'));
    expect(sec1).not.toContain('Current possible');
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec3"'));
    expect(sec2).toContain('Current possible contribution');
    expect(sec2).toContain('cost you the same take-home pay');
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
    expect(html).toContain('the effect of Social Security');
    // the old marginal-vs-marginal headline and the "stricter rule of thumb" remark are gone
    expect(html).not.toContain('stricter rule of thumb');
    expect(html).not.toContain('Marginal rate in retirement (bracket of the last dollar)');
  });

  it('the "Retirement years without Social Security" reading note no longer keys off lifestyle', () => {
    // Fixed as part of the migration: under sideAwareRates.js the retirement lifestyle does not
    // change this view's rate at all (see the "retirement lifestyle factor" HAND CALC tests in
    // compare.test.js), so the old lifestyle-specific "That is how a higher-earning future can
    // favor Roth" copy was no longer true and was removed. The note is now the same regardless of
    // the chosen lifestyle.
    const withLifestyle = render({ grossIncome: '60000', savings: '5000', debtPayments: '0', otherPretaxBalance: '0', retirementLifestyle: '2' });
    const plain = render({ grossIncome: '60000', savings: '5000', debtPayments: '0', otherPretaxBalance: '0' });
    const note = (html) => html.slice(html.indexOf('<strong>Reading this:</strong> removing Social Security'));
    expect(note(withLifestyle).slice(0, 400)).toBe(note(plain).slice(0, 400));
    expect(withLifestyle).toContain('depends only on your Existing Accounts');
    // TEMPORARY (2026-09-29): the duplicate "old calculation" card legitimately still has this
    // exact lifestyle-specific copy restored verbatim, so this check is scoped to exclude it —
    // it's the CURRENT methodology's card that must no longer say it.
    expect(withoutOldRatesCard(withLifestyle)).not.toContain('you expect to spend more in retirement');
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
    expect(section).toContain('there is nothing saved to measure a rate on');
  });

  it('shows a "Splitting your contribution" card between the after-tax comparison and total portfolio tax comparison', () => {
    const html = render();
    expect(html.indexOf('id="sec-tradeoff"')).toBeLessThan(html.indexOf('id="sec-blend"'));
    expect(html.indexOf('id="sec-blend"')).toBeLessThan(html.indexOf('id="sec3"'));
    const blend = html.slice(html.indexOf('id="sec-blend"'), html.indexOf('id="sec3"'));
    expect(blend).toContain('Splitting your contribution</span>');
    expect(blend).toContain('Roth share of the contribution');
    expect(blend).toContain('type="range"');
    expect(blend).toContain('To Roth');
    expect(blend).toContain('To Pre-tax');
    expect(blend).toContain('Jump to the best mix');
    expect(blend).toContain('Show the numbers');
    expect(blend).not.toMatch(/NaN|Infinity/);
  });

  it('the blend slider defaults to the best mix, and says so when a pure strategy already wins', () => {
    // Default inputs (estimated Social Security + a $100,000 existing Pre-tax balance, both
    // Roth-favorable per the app's already-established findings): the best mix is 100% Roth,
    // matching the main rate comparison's own "Tends to favor Roth" verdict at these defaults.
    const html = render();
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
    const html = render({
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
    const html = render({ savings: '0' });
    const blend = html.slice(html.indexOf('id="sec-blend"'), html.indexOf('id="sec3"'));
    expect(blend).toContain('There is nothing saved yet to split.');
    expect(blend).not.toContain('type="range"');
    expect(blend).not.toMatch(/NaN|Infinity/);
  });

  it('lists validation errors instead of results for bad input', () => {
    const html = render({ retirementAge: '30' });
    expect(html).toContain('Retirement age must be after your current age');
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
      expect(html, JSON.stringify(c)).toContain('Total tax difference');
    }
  });
});

describe('App', () => {
  it('renders end to end with the defaults', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Roth vs. Pre-Tax Calculator');
    expect(html).toContain('Total portfolio tax comparison');
  });

  it('links to the "How this works" page from the header and the footer', () => {
    const html = renderToStaticMarkup(<App />);
    const links = html.match(/href="#\/how-it-works"/g) ?? [];
    expect(links.length).toBe(2);
    expect(html).toContain('How this works');
    expect(html).toContain('class="page-footer"');
  });

  it('links to the "Visualization" scenarios page from the header and the footer', () => {
    const html = renderToStaticMarkup(<App />);
    const links = html.match(/href="#\/scenarios"/g) ?? [];
    expect(links.length).toBe(2);
    expect(html).toContain('Visualization');
  });

  it('shows the calculator (not the article or the scenarios page) by default', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toContain('Back to the calculator');
    expect(html).not.toContain('Visualization: who comes out ahead, and why');
    expect(html).not.toMatch(/<div hidden/); // the calculator wrapper is visible
  });
});

describe('ArticlePage', () => {
  const html = renderToStaticMarkup(<ArticlePage />);

  it('renders the article as real headings and paragraphs, not raw markdown', () => {
    expect(html).toContain('<h1>Roth or Traditional? How to Think About It, and How This Calculator Does</h1>');
    expect(html).toContain('<h2>Years without Social Security</h2>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<strong>');
    expect(html).not.toMatch(/(^|>)#{1,3} /); // no leaked "## " heading markers
    expect(html).not.toContain('**');
  });

  it('renders every section of ARTICLE.md (the file is the single source)', () => {
    const h2InMarkdown = articleMarkdown.split('\n').filter((l) => l.startsWith('## ')).length;
    const h2InHtml = (html.match(/<h2>/g) ?? []).length;
    expect(h2InMarkdown).toBeGreaterThan(5);
    expect(h2InHtml).toBe(h2InMarkdown);
    expect(html).toContain('educational purposes only');
  });

  it('has a back link to the calculator at the top and bottom', () => {
    const back = html.match(/href="#\/"/g) ?? [];
    expect(back.length).toBe(2);
    expect(html).toContain('Back to the calculator');
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
    expect(html).toContain('At the IRS limit.');
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
    expect(sec3).toMatch(/\+\$[\d,]+ a year/); // the larger portfolio's lead
    expect(html).not.toContain('not the whole story');
  });

  it('offers 30% and 40% lower retirement lifestyles', () => {
    const html = renderToStaticMarkup(<InputForm values={DEFAULT_FORM_VALUES} onChange={() => {}} />);
    expect(html).toContain('30% lower than today');
    expect(html).toContain('40% lower than today');
  });

  it('App offers "Copy inputs to share" at the very bottom of the main inputs card, apart from Compare a change', () => {
    const html = renderToStaticMarkup(<App />);
    const header = html.slice(html.indexOf('class="page-header"'), html.indexOf('</header>'));
    expect(header).not.toContain('Copy inputs to share');
    const form = html.slice(html.indexOf('<form'), html.indexOf('</form>'));
    expect(form).toContain('Copy inputs to share');
    expect(form.indexOf('Copy inputs to share')).toBeGreaterThan(form.indexOf('Assumptions:'));
    const compareCard = html.slice(html.indexOf('compare-start'), html.indexOf('</section>', html.indexOf('compare-start')));
    expect(compareCard).not.toContain('Copy inputs to share');
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
    expect(html).toContain('At the IRS limit.');
    expect(html).toContain('Plus the taxable account (over the IRS limit)');
  });

  it('labels the form sections Future Contributions and Existing Accounts', () => {
    const html = renderToStaticMarkup(<InputForm values={DEFAULT_FORM_VALUES} onChange={() => {}} />);
    expect(html).toMatch(/class="collapsible-title"[^>]*>Future Contributions</);
    expect(html).toMatch(/class="collapsible-title"[^>]*>Existing Accounts</);
    expect(html).not.toMatch(/this account|other retirement account/i);
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
  it('appears only when there is a taxable balance, defaulting to 50%', () => {
    const none = renderToStaticMarkup(<InputForm values={DEFAULT_FORM_VALUES} onChange={() => {}} />);
    expect(none).not.toContain('Cost basis of those taxable accounts');
    const some = renderToStaticMarkup(
      <InputForm values={{ ...DEFAULT_FORM_VALUES, otherTaxableBalance: '50000' }} onChange={() => {}} />,
    );
    expect(some).toContain('Cost basis of those taxable accounts');
    expect(some).toMatch(/<option value="0.5" selected="">50% \(default\)/);
  });

  it("sits in a collapsed dropdown whose summary shows the current basis", () => {
    const html = renderToStaticMarkup(
      <InputForm values={{ ...DEFAULT_FORM_VALUES, otherTaxableBalance: "50000", otherTaxableBasis: "0" }} onChange={() => {}} />,
    );
    expect(html).toMatch(/<details class="details basis-option"><summary>Cost basis of those taxable accounts: (<!-- -->)?0% \(all gains\)<\/summary>/);
  });

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
  it('lists every input section with a summary; only the first starts open, and closed ones stay rendered', () => {
    const html = renderToStaticMarkup(<InputForm values={DEFAULT_FORM_VALUES} onChange={() => {}} />);
    const titles = [...html.matchAll(/class="collapsible-title"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(titles).toEqual([
      'About you',
      'Costs that end before retirement',
      'Future Contributions',
      'Social Security',
      'Existing Accounts',
      'Assumptions',
    ]);
    expect(html).toContain('class="collapsible-summary">$100,000 W-2 · Single · age 35, retiring at 65<');
    expect((html.match(/aria-expanded="true"/g) ?? []).length).toBe(1);
    expect((html.match(/class="collapsible-body" hidden=""/g) ?? []).length).toBe(5);
    // a closed section's inputs are still in the page (hidden), so nothing is lost by closing it
    expect(html).toContain('Savings for retirement (annual)');
    expect(html).toContain('Expand all');
  });

  it('opens the sections App passes in, and flags changed sections when comparing', () => {
    const html = renderToStaticMarkup(
      <InputForm
        values={{ ...DEFAULT_FORM_VALUES, savings: '20000' }}
        baseValues={DEFAULT_FORM_VALUES}
        onChange={() => {}}
        open={new Set(['about', 'costs', 'contributions', 'socialSecurity', 'existing', 'assumptions'])}
        onOpenChange={() => {}}
      />,
    );
    expect(html).not.toContain('aria-expanded="false"');
    expect(html).toContain('Collapse all');
    expect((html.match(/class="collapsible-flag">changed</g) ?? []).length).toBe(1);
  });

  it('shows each results card with its headline, all open', () => {
    const html = renderToStaticMarkup(<ResultsSummary result={compareRothVsTraditional(toCompareInputs(DEFAULT_FORM_VALUES, 2026))} />);
    const titles = [...html.matchAll(/class="collapsible-title"[^>]*>([^<]+)</g)].map((m) => m[1]);
    // TEMPORARY (2026-09-29): includes the duplicate "old calculation" card (see result.old).
    expect(titles).toEqual([
      'Retirement income number',
      'Your portfolio at retirement',
      'Tax rate comparison',
      'Tax rate comparison — old calculation',
      'After-tax comparison',
      'Splitting your contribution',
      'Total portfolio tax comparison',
    ]);
    expect(html).toContain('class="collapsible-summary">$65,380 a year after tax<');
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

  it("offers Clear all in the main inputs card only", () => {
    const app = renderToStaticMarkup(<App />);
    expect((app.match(/>Clear all</g) ?? []).length).toBe(1);
  });
});
