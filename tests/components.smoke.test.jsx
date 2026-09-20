import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App.jsx';
import InputForm from '../src/components/InputForm.jsx';
import ResultsSummary from '../src/components/ResultsSummary.jsx';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from '../src/lib/formInputs.js';

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
      'Total value of other Pre-tax accounts',
      'Total value of other Roth accounts',
      'Total value of other taxable investment accounts',
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toMatch(/type="submit"|<button/);
  });

  it('drops the two hints, rewords the savings hint, and moves the return into Assumptions', () => {
    expect(html).not.toContain('Also used as the contribution amount in the comparison');
    expect(html).not.toContain('Used only to check against the IRS contribution limit');
    expect(html).toContain("The amount you're currently contributing to retirement accounts each year, or the amount you're considering.".replaceAll("'", '&#x27;'));
    // the return selector lives inside a collapsed Assumptions section that shows the current rate
    const assumptions = html.slice(html.indexOf('class="details assumptions"'));
    expect(assumptions).toContain('Assumptions:');
    expect(assumptions).toContain('7% expected annual investment return');
    expect(assumptions).toContain('Expected annual investment return');
    // ...and is not in the main fieldsets above it
    const mainForm = html.slice(0, html.indexOf('class="details assumptions"'));
    expect(mainForm).not.toContain('Expected annual investment return');
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
      'Effective rate in retirement',
      'Current possible contribution',
      'Value of a single contribution at retirement',
      'After-tax value of that contribution',
      'Total value of account',
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


  it('shows the retirement number as its own hero line, with the rates after it', () => {
    const html = render();
    const hero = html.indexOf('class="hero"');
    const marginal = html.indexOf('Marginal rate while working');
    const effective = html.indexOf('Effective rate in retirement');
    expect(hero).toBeGreaterThan(-1);
    expect(hero).toBeLessThan(marginal);
    expect(marginal).toBeLessThan(effective);
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
    expect(html).toContain('How is the effective rate calculated?');
    expect(html).toContain('Extra tax caused by the withdrawal');
    expect(html).toContain('Why it can be higher than your tax bracket');
  });

  it('explains when no withdrawal is needed from this account', () => {
    const html = render({ knowsSocialSecurity: 'yes', socialSecurityBenefit: '90000' });
    expect(html).toContain('no withdrawal from');
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

  it('rewords the rates note and drops the old sentence', () => {
    const html = render();
    expect(html).toContain('Why two different rates?');
    expect(html).not.toContain('different kinds of rate on purpose');
  });

  it('puts the Pre-tax and Roth contribution amounts in the comparison table, not in Section 1', () => {
    const html = render();
    const sec1 = html.slice(html.indexOf('id="sec1"'), html.indexOf('id="sec2"'));
    expect(sec1).not.toContain('Current possible');
    const sec2 = html.slice(html.indexOf('id="sec2"'), html.indexOf('id="sec3"'));
    expect(sec2).toContain('Current possible contribution');
    expect(sec2).toContain('cost you the same take-home pay');
  });

  it('explains what "this account" and "other income" mean in the effective-rate dropdown', () => {
    const html = render();
    expect(html).toContain('the account your contributions are building');
    expect(html).toContain('Step 1: income from everything except this account');
    expect(html).toContain('Step 2: what this account has to supply');
    expect(html).toContain('Still needed from this account, after tax');
    expect(html).not.toContain('Gap left after other sources');
    expect(html).not.toContain('before this account');
  });

  it('has the simple view without Social Security, using the marginal rate', () => {
    const html = render();
    expect(html).toContain('Simple view: the same comparison without Social Security');
    expect(html).toContain('Marginal rate in retirement (bracket of the last dollar)');
    expect(html).toContain('Tax rate on the withdrawal');
    expect(html).toContain('the effect of Social Security');
  });

  it('explains the forced-draw case in the simple view when other accounts already cover the need', () => {
    const html = render({ grossIncome: '30000', savings: '0', otherPretaxBalance: '1500000' });
    expect(html).toContain('your other accounts alone already produce more taxable');
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
});
