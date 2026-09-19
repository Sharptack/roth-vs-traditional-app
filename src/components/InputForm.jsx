import { useId, useState } from 'react';
import { ACCOUNT_TYPES, CONTRIBUTION_TYPES, FILING_STATUSES } from '../lib/constants.js';
import { formatCurrency } from '../lib/format.js';
import { parseNumber } from '../lib/formInputs.js';

const RETURN_OPTIONS = [
  { value: '0.05', label: '5%' },
  { value: '0.07', label: '7%' },
  { value: '0.09', label: '9%' },
];

function Field({ label, hint, children, id }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

// Dollar input: shows raw text while typing, "$12,345" once you leave the field.
function CurrencyInput({ label, hint, value, onChange }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const parsed = parseNumber(value);
  const display = !focused && Number.isFinite(parsed) ? formatCurrency(parsed) : value;
  return (
    <Field label={label} hint={hint} id={id}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        placeholder="$0"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,$]/g, ''))}
      />
    </Field>
  );
}

function AgeInput({ label, value, onChange }) {
  const id = useId();
  return (
    <Field label={label} id={id}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
      />
    </Field>
  );
}

function SelectInput({ label, hint, value, onChange, options }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function RadioGroup({ legend, name, value, onChange, options, hint }) {
  return (
    <fieldset className="radio-group">
      <legend>{legend}</legend>
      <div className="radio-options">
        {options.map((o) => (
          <label key={o.value} className="radio">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  );
}

const toOptions = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

export default function InputForm({ values, onChange }) {
  const set = (name) => (value) => onChange(name, value);

  return (
    <form className="card input-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <fieldset>
        <legend>About you</legend>
        <CurrencyInput
          label="Total gross income (annual)"
          value={values.grossIncome}
          onChange={set('grossIncome')}
        />
        <SelectInput
          label="Filing status"
          value={values.filingStatus}
          onChange={set('filingStatus')}
          options={toOptions(FILING_STATUSES)}
        />
        <div className="field-row">
          <AgeInput label="Current age" value={values.currentAge} onChange={set('currentAge')} />
          <AgeInput
            label="Planned retirement age"
            value={values.retirementAge}
            onChange={set('retirementAge')}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Costs that end before retirement</legend>
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
      </fieldset>

      <fieldset>
        <legend>Your retirement savings</legend>
        <CurrencyInput
          label="Savings for retirement (annual)"
          hint="Also used as the contribution amount in the comparison."
          value={values.savings}
          onChange={set('savings')}
        />
        <RadioGroup
          legend="Are these savings currently Pre-tax or Roth?"
          name="currentType"
          value={values.currentType}
          onChange={set('currentType')}
          options={toOptions(CONTRIBUTION_TYPES)}
        />
        <SelectInput
          label="Account type these savings are held in"
          hint="Used only to check against the IRS contribution limit."
          value={values.accountType}
          onChange={set('accountType')}
          options={toOptions(ACCOUNT_TYPES)}
        />
        <SelectInput
          label="Expected annual investment return"
          hint="No inflation is modeled, so think of this as a return after inflation."
          value={values.returnRate}
          onChange={set('returnRate')}
          options={RETURN_OPTIONS}
        />
      </fieldset>

      <fieldset>
        <legend>Social Security</legend>
        <RadioGroup
          legend="Do you know your Social Security benefit?"
          name="knowsSocialSecurity"
          value={values.knowsSocialSecurity}
          onChange={set('knowsSocialSecurity')}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
        {values.knowsSocialSecurity === 'yes' ? (
          <CurrencyInput
            label="Annual gross Social Security benefit"
            hint="Your annual benefit before taxes, in today's dollars. For a couple, enter the household total."
            value={values.socialSecurityBenefit}
            onChange={set('socialSecurityBenefit')}
          />
        ) : (
          <p className="hint disclaimer">
            We'll estimate it from your income and retirement age. Estimated — see{' '}
            <a href="https://www.ssa.gov" target="_blank" rel="noreferrer">
              ssa.gov
            </a>{' '}
            for a precise figure. Estimates only — not tax or financial advice.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>Other retirement account balances</legend>
        <p className="hint">Current balances, not counting the savings above.</p>
        <CurrencyInput
          label="Total value of other Pre-tax accounts"
          value={values.otherPretaxBalance}
          onChange={set('otherPretaxBalance')}
        />
        <CurrencyInput
          label="Total value of other Roth accounts"
          value={values.otherRothBalance}
          onChange={set('otherRothBalance')}
        />
        <CurrencyInput
          label="Total value of other taxable investment accounts"
          value={values.otherTaxableBalance}
          onChange={set('otherTaxableBalance')}
        />
      </fieldset>
    </form>
  );
}
