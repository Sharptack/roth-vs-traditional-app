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
      'Marginal rate while working',
      'Effective rate on these withdrawals',
      'Overall effective rate',
      'Current possible contribution',
      'The trade-off in dollars',
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

  it('gives the rates their own Roth vs. Traditional block, followed by the trade-off in dollars', () => {
    const html = render();
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec-tradeoff"'));
    const trade = html.slice(html.indexOf('id="sec-tradeoff"'), html.indexOf('id="sec3"'));
    const sec3 = html.slice(html.indexOf('id="sec3"'));
    // order: retirement number, rates, trade-off, total portfolio tax
    expect(html.indexOf('id="sec1"')).toBeLessThan(html.indexOf('id="sec2"'));
    expect(html.indexOf('id="sec2"')).toBeLessThan(html.indexOf('id="sec-tradeoff"'));
    expect(html.indexOf('id="sec-tradeoff"')).toBeLessThan(html.indexOf('id="sec3"'));
    // the rates block holds only the rates: no table
    for (const label of ['Your tax rate now vs. later', 'Marginal rate while working', 'Effective rate on these withdrawals', 'How are the retirement rates calculated?']) {
      expect(sec2, label).toContain(label);
    }
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
    // the merged "Your portfolio at retirement" rows are gone
    expect(html).not.toContain('Your portfolio at retirement');
    expect(html).not.toContain('Total portfolio at retirement');
    expect(trade).toContain('Why is the Pre-tax side bigger?');
    expect(trade).toContain('Retirement years without Social Security');
    expect(sec3).not.toContain('Marginal rate while working');
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
    // no Social Security, no other accounts: 11.3% later vs 22% now -> leans Pre-tax
    const html = render({ otherPretaxBalance: '0', debtPayments: '0', knowsSocialSecurity: 'yes', socialSecurityBenefit: '0' });
    const lean = html.indexOf('class="rate-lean"');
    expect(lean).toBeGreaterThan(html.indexOf('class="rate-pair"'));
    expect(lean).toBeLessThan(html.indexOf('How are the retirement rates calculated?'));
    expect(html).toContain('Tends to favor Pre-tax (Traditional)');
    // just the lean: no sentence restating the two rates, no rule-of-thumb hint
    expect(html).not.toContain('Rule of thumb');
    expect(html).not.toContain('within half a percentage point');
    // a 2x lifestyle at $60k pushes the retirement rate above 12%: leans Roth
    const roth = render({ grossIncome: '60000', savings: '5000', debtPayments: '0', otherPretaxBalance: '0', retirementLifestyle: '2' });
    expect(roth).toContain('Tends to favor Roth');
    // the defaults land in the Social Security phase-in: 22.2% later vs 22% now
    expect(render()).toContain('About even');
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

  it('shows capital-gains tax in the rate calculation, and explains when the withdrawal pushes gains up', () => {
    // A large taxable balance plus existing Pre-tax money: this account's withdrawal pushes gains out of 0%.
    const html = render({ otherTaxableBalance: '150000', otherPretaxBalance: '100000' });
    const start = html.indexOf('How are the retirement rates calculated?');
    const dropdown = html.slice(start, html.indexOf('</details>', start));
    expect(dropdown).toContain('Capital-gains tax on taxable-account withdrawals');
    expect(dropdown).toContain('of which extra capital-gains tax');
    expect(dropdown).toContain('Capital gains pushed into a higher bracket.');
    // ...and nothing about capital gains when there is no taxable account
    const none = render({ otherTaxableBalance: '0' });
    expect(none).not.toContain('Capital-gains tax on taxable-account withdrawals');
  });

  it('shows the Net Investment Income Tax when gains pass the MAGI threshold', () => {
    // High income, a large taxable balance: MAGI is over $200,000 and the withdrawal adds NIIT.
    const html = render({ grossIncome: '300000', otherPretaxBalance: '300000', otherTaxableBalance: '600000' });
    const start = html.indexOf('How are the retirement rates calculated?');
    const dropdown = html.slice(start, html.indexOf('</details>', start));
    expect(dropdown).toContain('Net Investment Income Tax (3.8% on gains');
    expect(dropdown).toContain('of which extra Net Investment Income Tax');
    expect(html).toContain('The Net Investment Income Tax.');
    expect(html).toContain('the gain also owes the 3.8% Net Investment Income Tax');
    // ...and none of it for the default (modest-income) case
    expect(render()).not.toContain('Net Investment Income Tax');
  });

  it('explains that other Pre-tax accounts are taxed first and push the rate up', () => {
    const html = render({ otherPretaxBalance: '100000' });
    expect(html).toContain('What sets the rate on these withdrawals');
    expect(html).toContain('Income that&rsquo;s taxed first.'.replace('&rsquo;', '’'));
    expect(html).toContain('from your Pre-tax Existing Accounts');
    const none = render({ otherPretaxBalance: '0', otherTaxableBalance: '0', knowsSocialSecurity: 'yes', socialSecurityBenefit: '0' });
    expect(none).toContain('Pre-tax Existing\n        Accounts would change this'.replace(/\s+/g, ' '));
  });

  it('keeps "How the rates fit together" inside the rates dropdown, not loose on the page', () => {
    const html = render();
    const start = html.indexOf('How are the retirement rates calculated?');
    const dropdown = html.slice(start, html.indexOf('</details>', start));
    expect(dropdown).toContain('How the rates fit together.');
    // exactly one copy on the whole page, and it is the one inside the dropdown
    expect(html.split('How the rates fit together.').length - 1).toBe(1);
    // it comes before the step-by-step explanation
    expect(dropdown.indexOf('How the rates fit together.')).toBeLessThan(dropdown.indexOf('Step 1: income from Social Security and Existing Accounts'));
  });

  it('highlights the effective rate on withdrawals in a paired box with the marginal rate, no explanatory lead-in', () => {
    const html = render();
    // the calculator stays numbers-first: no "number that matters" lead sentence, no lean verdict
    expect(html).not.toContain('The number that matters most');
    expect(html).not.toContain('rate-verdict');
    expect(html).not.toContain('rate-lead');
    expect(html).not.toContain('Pre-tax is most likely better');
    expect(html).not.toContain('Roth is most likely better');
    expect(html).toContain('class="rate-pair-item highlight"');
    // the highlighted pair holds exactly marginal-now and effective-on-withdrawals
    const pairEnd = html.indexOf('How are the retirement rates calculated?');
    const pair = html.slice(html.indexOf('class="rate-pair"'), pairEnd);
    expect(pair).toContain('Marginal rate while working');
    expect(pair).toContain('Effective rate on these withdrawals');
    expect(pair).not.toContain('Overall effective rate');
    // no plain reference line outside the dropdown either — the overall rate lives ONLY in the dropdown now
    expect(html).not.toContain('rate-side-note');
    expect(html).toContain('Overall effective rate (');
    expect(html).toContain('overall effective rate</strong> is simply all the tax you owe in retirement');
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
    const dropdown = html.slice(html.indexOf('Show the calculation'));
    const agiIdx = dropdown.indexOf('Adjusted gross income, AGI');
    const taxableSSIdx = dropdown.indexOf('Taxable part of Social Security');
    const ordinaryIdx = dropdown.indexOf('Ordinary taxable income');
    expect(agiIdx).toBeGreaterThan(taxableSSIdx);
    expect(agiIdx).toBeLessThan(ordinaryIdx);
  });

  it('shows the contribution-limit warning in the Roth vs. Traditional section', () => {
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
    expect(html).toContain('How are the retirement rates calculated?');
    expect(html).toContain('Extra tax caused by the withdrawal');
    expect(html).toContain('The Social Security phase-in.');
    expect(html).toContain('That is why this rate can be higher than your tax');
  });

  it('explains when no withdrawal is needed from this account', () => {
    const html = render({ knowsSocialSecurity: 'yes', socialSecurityBenefit: '90000' });
    expect(html).toContain('no withdrawal from');
  });

  it('shows the actual probe arithmetic instead of "$0 ÷ $0" when no withdrawal is needed', () => {
    const html = render({ knowsSocialSecurity: 'yes', socialSecurityBenefit: '90000' });
    expect(html).toContain('own natural withdrawal (4% of their projected value)');
    expect(html).not.toContain('÷ $0)');
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

  it('explains what "Future Contributions" and "Existing Accounts" mean in the effective-rate dropdown', () => {
    const html = render();
    expect(html).toContain('<strong>Future Contributions</strong> are the savings you make from now until retirement');
    expect(html).toContain('<strong>Existing Accounts</strong>');
    expect(html).toContain('Step 1: income from Social Security and Existing Accounts');
    expect(html).toContain('Step 2: what Future Contributions have to supply');
    expect(html).toContain('Still needed from Future Contributions, after tax');
    // the old "this account" wording is gone from the results
    expect(html).not.toMatch(/this account/i);
    expect(html).not.toContain('Gap left after other sources');
    expect(html).not.toContain('before this account');
  });

  it('has the retirement-years-without-Social-Security section, using the blended rate', () => {
    const html = render();
    expect(html).toContain('Retirement years without Social Security');
    expect(html).not.toContain('Simple view');
    expect(html).toContain('the blended rate: the extra tax they cause, divided by the');
    expect(html).toContain('Effective rate on the withdrawal');
    expect(html).toContain('Bracket the last dollar falls in (for reference)');
    expect(html).toContain('the effect of Social Security');
    // the old marginal-vs-marginal headline and the "stricter rule of thumb" remark are gone
    expect(html).not.toContain('stricter rule of thumb');
    expect(html).not.toContain('Marginal rate in retirement (bracket of the last dollar)');
  });

  it('explains that a higher retirement lifestyle can favor Roth, in that section', () => {
    // gross 60k saved 5k, 2x lifestyle: retirement bracket (22%) exceeds today\'s (12%)
    const html = render({ grossIncome: '60000', savings: '5000', debtPayments: '0', otherPretaxBalance: '0', retirementLifestyle: '2' });
    expect(html).toContain('you expect to spend more in retirement than you do');
    expect(html).toContain('That is how');
  });

  it('explains the forced-draw case in the simple view when other accounts already cover the need', () => {
    const html = render({ grossIncome: '30000', savings: '0', otherPretaxBalance: '1500000' });
    expect(html).toContain('your Existing Accounts alone already produce more taxable');
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
    expect(html).not.toContain('Visualization: does the rate gap predict the winner?');
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
    expect(html).toContain('Visualization: does the rate gap predict the winner?');
    const back = html.match(/href="#\/"/g) ?? [];
    expect(back.length).toBe(2);
    expect(html).toContain('Back to the calculator');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('renders every scenario batch with its title and exactly one chart', () => {
    for (const batch of SCENARIO_BATCHES) {
      expect(html).toContain(batch.title);
    }
    // one chart per batch + the two-rates chart + the combined scatter
    expect((html.match(/class="chart-svg"/g) ?? []).length).toBe(SCENARIO_BATCHES.length + 2);
  });

  it('renders the combined scatter, coloured by winner, with a trend-line summary sentence', () => {
    expect(html).toContain('Does the gap predict the winner?');
    expect(html).toContain('Trend line:');
    expect(html).toMatch(/r² = -?\d\.\d\d\)/);
    expect(html).toContain('Roth comes out ahead');
    expect(html).toContain('Pre-tax comes out ahead');
    expect(html).toContain('About even');
  });

  it('has a "Show the numbers" table for each batch, plus one for the two-rates chart', () => {
    expect((html.match(/Show the numbers/g) ?? []).length).toBe(SCENARIO_BATCHES.length + 1);
  });

  it('states the rule of thumb once, at the top, and does not repeat it per chart', () => {
    const sentence = 'The rule of thumb: the higher that gap, the more Pre-tax should come out ahead';
    expect(html).toContain(sentence);
    expect((html.match(/class="rule-callout"/g) ?? []).length).toBe(1);
    expect((html.match(/The rule of thumb/g) ?? []).length).toBe(1);
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
    expect(html).toContain('Marginal rate while working');
    expect(html).toContain('Effective rate on withdrawals in retirement');
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
    const balanceMap = html.slice(second, html.indexOf('Does the gap predict the winner?'));
    for (const balance of ['$0', '$100k', '$250k', '$500k', '$1M', '$2M']) {
      expect(balanceMap).toContain(`<th scope="row">${balance}</th>`);
    }
  });

  it('includes the Roth-friendly sweeps: existing Pre-tax balance, existing taxable balance, married filing jointly', () => {
    expect(html).toContain('A bigger existing Pre-tax balance, at different incomes');
    expect(html).toContain('A bigger existing taxable investment account, at different incomes');
    expect(html).toContain('Married filing jointly, with different existing Pre-tax balances');
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
    expect(html).toContain('Bracket of its last dollar');
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
    expect(html).toMatch(/class="total-row emph-rate"><th scope="row">Marginal rate while working/);
    expect(html).toMatch(/class="total-row emph-rate"><th scope="row">Effective rate on these withdrawals/);
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

describe("Rate walk-through when no withdrawal is needed", () => {
  it("shows how the extra tax on the hypothetical withdrawal is worked out", () => {
    const result = compareRothVsTraditional(
      toCompareInputs({ ...DEFAULT_FORM_VALUES, otherPretaxBalance: "400000", otherTaxableBalance: "200000" }),
    );
    expect(result.grossUp.grossWithdrawal).toBe(0);
    const html = renderToStaticMarkup(<ResultsSummary result={result} />);
    expect(html).toContain("Taxable income after the standard deduction, with that withdrawal added");
    expect(html).toContain("Total tax, with that withdrawal added");
    expect(html).toMatch(/Extra tax that withdrawal would cause \(\$[\d,]+ − \$[\d,]+ without it\)/);
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
    expect(titles).toEqual(['Retirement income number', 'Roth vs. Traditional', 'The trade-off in dollars', 'Total portfolio tax comparison']);
    expect(html).toContain('class="collapsible-summary">$65,380 a year after tax<');
    expect(html).not.toContain('aria-expanded="false"');
    expect(html).toContain('Collapse all results');
  });
});
