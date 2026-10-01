// The preview's household inputs (roadmap phase 1, step 7): one form for the household, built to
// become the shared-inputs component the homepage and every calculator page use (phase 2).
// People (you, and a spouse when filing jointly), Future Contributions per person, and the
// Existing Accounts as a list with an owner and a type. Sections and summaries come from
// lib/householdForm.js; the fields are the current form's own (InputForm.jsx).
import { useState } from 'react';
import Collapsible, { toggleId } from '../components/Collapsible.jsx';
import {
  AgeInput,
  BASIS_OPTIONS,
  CurrencyInput,
  INCOME_TYPE_OPTIONS,
  LIFESTYLE_OPTIONS,
  RETURN_OPTIONS,
  RadioGroup,
  SelectInput,
  toOptions,
} from '../components/InputForm.jsx';
import { ACCOUNT_TYPES, CONTRIBUTION_TYPES, FILING_STATUSES } from '../lib/constants.js';
import { hasSpouse } from '../lib/household.js';
import { ACCOUNT_TYPE_LABELS, newAccountRow, visibleSections } from '../lib/householdForm.js';

const YES_NO = [
  { value: 'no', label: 'No, estimate it' },
  { value: 'yes', label: 'Yes' },
];

const CLAIM_AGE_OPTIONS = [
  { value: '', label: 'At retirement (62–70)' },
  ...[62, 63, 64, 65, 66, 67, 68, 69, 70].map((age) => ({ value: String(age), label: String(age) })),
];

const SPOUSE_INCOME_TYPES = INCOME_TYPE_OPTIONS.filter((o) => o.value !== 'both');

export const DEFAULT_OPEN_HOUSEHOLD = ['household', 'you'];

// locked: view only (a view-only share link); the fields are disabled and onEditCopy unlocks them.
// footer: content at the bottom of the card (the share link).
export default function HouseholdForm({ values, onChange, locked = false, onEditCopy, footer }) {
  const [open, setOpen] = useState(() => new Set(DEFAULT_OPEN_HOUSEHOLD));
  const set = (name) => (value) => onChange(name, value);
  const spouse = hasSpouse(values);
  const sections = visibleSections(values);
  const allOpen = sections.every((s) => open.has(s.id));

  // Called as a function, not rendered as a component, so the inputs inside keep their state.
  const section = (id, content) => {
    const sec = sections.find((s) => s.id === id);
    if (!sec) return null;
    return (
      <Collapsible
        variant="row"
        title={sec.title}
        summary={sec.summary(values)}
        open={open.has(id)}
        onToggle={() => setOpen(toggleId(open, id))}
      >
        {locked ? (
          <fieldset className="locked-fieldset" disabled>
            {content}
          </fieldset>
        ) : (
          content
        )}
      </Collapsible>
    );
  };

  const setAccounts = (accounts) => onChange('accounts', accounts);
  const updateAccount = (id, field, value) =>
    setAccounts(values.accounts.map((a) => (a.id === id ? { ...a, [field]: value } : a)));

  // Social Security fields for one person. `keys` names that person's form fields.
  const socialSecurityFields = (keys, who) => (
    <>
      <RadioGroup
        legend={`Do you know ${who} Social Security benefit?`}
        name={`hh-${keys.knows}`}
        value={values[keys.knows]}
        onChange={set(keys.knows)}
        options={YES_NO}
      />
      {values[keys.knows] === 'yes' && (
        <CurrencyInput
          label="Annual gross Social Security benefit"
          hint={
            spouse
              ? `${who === 'your' ? 'Your' : "Your spouse's"} own benefit, before taxes, in today's dollars. An entered benefit is used as is, and no spousal benefit is figured from it.`
              : "Your annual benefit before taxes, in today's dollars."
          }
          value={values[keys.benefit]}
          onChange={set(keys.benefit)}
        />
      )}
      <SelectInput
        label="Claim Social Security at"
        value={values[keys.claimAge]}
        onChange={set(keys.claimAge)}
        options={CLAIM_AGE_OPTIONS}
        hint="Benefits can start at 62 at the earliest; waiting past 70 adds nothing."
      />
    </>
  );

  return (
    <form className="card input-form household-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="form-head">
        <h2 className="form-title">Inputs</h2>
        <div className="form-head-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => setOpen(new Set(allOpen ? [] : sections.map((s) => s.id)))}
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>
      {locked && (
        <p className="alert locked-note">
          <strong>View only.</strong> These inputs came from a view-only link.{' '}
          <button type="button" className="link-button" onClick={onEditCopy}>
            Edit a copy
          </button>
        </p>
      )}

      {section('household', (
        <>
          <SelectInput
            label="Filing status"
            value={values.filingStatus}
            onChange={set('filingStatus')}
            options={toOptions(FILING_STATUSES)}
          />
          {values.filingStatus === 'mfj' && (
            <RadioGroup
              legend="Enter your spouse separately?"
              name="hh-includeSpouse"
              value={values.includeSpouse}
              onChange={set('includeSpouse')}
              options={[
                { value: 'no', label: 'No, one combined income' },
                { value: 'yes', label: 'Yes' },
              ]}
              hint={
                spouse
                  ? 'Payroll tax, Social Security and the IRS contribution limit are figured per person, with a spousal benefit when it is larger. The comparison retires when the first of you does.'
                  : 'With one combined income, payroll tax and Social Security treat the household as one earner (as the current calculator does).'
              }
            />
          )}
        </>
      ))}

      {section('you', (
        <>
          <CurrencyInput
            label={spouse ? 'Your gross income (annual)' : 'Total gross income (annual)'}
            value={values.grossIncome}
            onChange={set('grossIncome')}
          />
          <SelectInput
            label="Type of income"
            hint={
              values.incomeType === 'w2'
                ? undefined
                : 'Self-employment tax replaces FICA on 1099 income (and half of it is deductible). Enter 1099 income as net earnings, after business expenses.'
            }
            value={values.incomeType}
            onChange={set('incomeType')}
            options={INCOME_TYPE_OPTIONS}
          />
          {values.incomeType === 'both' && (
            <CurrencyInput
              label="How much of that is 1099?"
              hint="The rest is treated as W-2 wages."
              value={values.selfEmploymentIncome}
              onChange={set('selfEmploymentIncome')}
            />
          )}
          <div className="field-row">
            <AgeInput label="Current age" value={values.currentAge} onChange={set('currentAge')} />
            <AgeInput label="Planned retirement age" value={values.retirementAge} onChange={set('retirementAge')} />
          </div>
          {socialSecurityFields({ knows: 'knowsSocialSecurity', benefit: 'socialSecurityBenefit', claimAge: 'claimAge' }, 'your')}
        </>
      ))}

      {section('spouse', (
        <>
          <CurrencyInput label="Spouse's gross income (annual)" value={values.spouseIncome} onChange={set('spouseIncome')} />
          <SelectInput
            label="Spouse's type of income"
            value={values.spouseIncomeType}
            onChange={set('spouseIncomeType')}
            options={SPOUSE_INCOME_TYPES}
          />
          <div className="field-row">
            <AgeInput label="Current age" value={values.spouseAge} onChange={set('spouseAge')} />
            <AgeInput label="Planned retirement age" value={values.spouseRetirementAge} onChange={set('spouseRetirementAge')} />
          </div>
          {socialSecurityFields(
            { knows: 'spouseKnowsSocialSecurity', benefit: 'spouseSocialSecurityBenefit', claimAge: 'spouseClaimAge' },
            "your spouse's",
          )}
        </>
      ))}

      {section('costs', (
        <>
          <CurrencyInput
            label="Current debt payments that will end by retirement (annual)"
            value={values.debtPayments}
            onChange={set('debtPayments')}
          />
          <CurrencyInput
            label="Other expenses that will end by retirement (annual)"
            hint="For example private school or kids' college."
            value={values.otherExpenses}
            onChange={set('otherExpenses')}
          />
        </>
      ))}

      {section('contributions', (
        <>
          <CurrencyInput
            label={spouse ? 'Your savings for retirement (annual)' : 'Savings for retirement (annual)'}
            hint="The amount currently contributed to retirement accounts each year, or the amount being considered. These are the Future Contributions."
            value={values.savings}
            onChange={set('savings')}
          />
          {spouse && (
            <CurrencyInput
              label="Your spouse's savings for retirement (annual)"
              hint="Each of you has your own IRS limit, with your own catch-up at 50."
              value={values.spouseSavings}
              onChange={set('spouseSavings')}
            />
          )}
          <RadioGroup
            legend="Are these savings currently Pre-tax or Roth?"
            name="hh-currentType"
            value={values.currentType}
            onChange={set('currentType')}
            options={toOptions(CONTRIBUTION_TYPES)}
          />
          <SelectInput
            label="Account type these savings are held in"
            value={values.accountType}
            onChange={set('accountType')}
            options={toOptions(ACCOUNT_TYPES)}
          />
        </>
      ))}

      {section('existing', (
        <>
          <p className="hint">
            What is already saved today, one row per account (or per group of accounts). Future
            Contributions are kept separate.
          </p>
          <ul className="account-list">
            {values.accounts.map((a, i) => (
              <li key={a.id} className="account-row">
                <div className="field-row">
                  <SelectInput
                    label="Type"
                    value={a.type}
                    onChange={(v) => updateAccount(a.id, 'type', v)}
                    options={Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                  {spouse && (
                    <SelectInput
                      label="Owner"
                      value={a.owner}
                      onChange={(v) => updateAccount(a.id, 'owner', v)}
                      options={[
                        { value: 'p1', label: 'You' },
                        { value: 'p2', label: 'Spouse' },
                      ]}
                    />
                  )}
                </div>
                <CurrencyInput label="Balance" value={a.balance} onChange={(v) => updateAccount(a.id, 'balance', v)} />
                {a.type === 'taxable' && (
                  <SelectInput
                    label="Cost basis"
                    hint="The share of today's balance that is money put in, not gains. Only gains are taxed."
                    value={a.basisShare}
                    onChange={(v) => updateAccount(a.id, 'basisShare', v)}
                    options={BASIS_OPTIONS}
                  />
                )}
                {values.accounts.length > 1 && (
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`Remove account ${i + 1}`}
                    onClick={() => setAccounts(values.accounts.filter((x) => x.id !== a.id))}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="link-button" onClick={() => setAccounts([...values.accounts, newAccountRow(values.accounts)])}>
            + Add an account
          </button>
        </>
      ))}

      {section('assumptions', (
        <>
          <SelectInput
            label="Expected annual investment return"
            hint="Applied to every account until retirement. No inflation is modeled, so this is a return after inflation."
            value={values.returnRate}
            onChange={set('returnRate')}
            options={RETURN_OPTIONS}
          />
          <SelectInput
            label="Expected retirement lifestyle"
            hint="Spending each year in retirement compared with today."
            value={values.retirementLifestyle}
            onChange={set('retirementLifestyle')}
            options={LIFESTYLE_OPTIONS}
          />
        </>
      ))}
      {footer}
    </form>
  );
}
