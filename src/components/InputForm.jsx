import { useId, useState } from 'react';
import { ACCOUNT_TYPES, CONTRIBUTION_TYPES, FILING_STATUSES } from '../lib/constants.js';
import { formatCurrency } from '../lib/format.js';
import { parseNumber } from '../lib/formInputs.js';

const RETURN_OPTIONS = [
  { value: '0.05', label: '5%' },
  { value: '0.07', label: '7%' },
  { value: '0.09', label: '9%' },
];

const INCOME_TYPE_OPTIONS = [
  { value: 'w2', label: 'W-2 (employee)' },
  { value: '1099', label: '1099 (self-employed)' },
  { value: 'both', label: 'Both W-2 and 1099' },
];

const LIFESTYLE_OPTIONS = [
  { value: '0.8', label: '20% lower than today' },
  { value: '0.9', label: '10% lower than today' },
  { value: '1', label: 'Same as today' },
  { value: '1.1', label: '10% higher than today' },
  { value: '1.25', label: '25% higher than today' },
  { value: '1.5', label: '50% higher than today' },
  { value: '2', label: '100% higher than today' },
];

const returnLabel = (value) => RETURN_OPTIONS.find((o) => o.value === value)?.label ?? value;
// Short form for a dropdown summary: "same", "25% higher", "20% lower".
const lifestyleLabel = (value) =>
  value === '1'
    ? 'same'
    : (LIFESTYLE_OPTIONS.find((o) => o.value === value)?.label ?? value).replace(' than today', '');

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

        <details className="details lifestyle-assumption">
          <summary>
            Will you earn more later?
            {values.retirementLifestyle !== '1' && (
              <> ({lifestyleLabel(values.retirementLifestyle)} retirement lifestyle)</>
            )}
          </summary>
          <div className="details-body">
            <p>
              This is for people whose income &mdash; and spending &mdash; is likely to grow a lot
              before they retire, typically people earlier in their careers who are lower earners
              right now. If that&rsquo;s you, your retirement lifestyle may end up well above what
              you spend today, which raises your retirement income number and can push your
              retirement tax bracket higher, an effect that favors Roth.
            </p>
            <SelectInput
              label="Expected retirement lifestyle"
              hint="How much you expect to spend each year in retirement compared with what you spend today."
              value={values.retirementLifestyle}
              onChange={set('retirementLifestyle')}
              options={LIFESTYLE_OPTIONS}
            />
          </div>
        </details>

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
            label="How much of your gross income is 1099?"
            hint="The rest is treated as W-2 wages."
            value={values.selfEmploymentIncome}
            onChange={set('selfEmploymentIncome')}
          />
        )}
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
          hint="The amount you're currently contributing to retirement accounts each year, or the amount you're considering."
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
          value={values.accountType}
          onChange={set('accountType')}
          options={toOptions(ACCOUNT_TYPES)}
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

      <details className="details assumptions">
        <summary>Assumptions: {returnLabel(values.returnRate)} expected annual investment return</summary>
        <div className="details-body">
          <SelectInput
            label="Expected annual investment return"
            hint="Applied to every account until you retire. The default is 7%. No inflation is modeled, so think of this as a return after inflation."
            value={values.returnRate}
            onChange={set('returnRate')}
            options={RETURN_OPTIONS}
          />
        </div>
      </details>
    </form>
  );
}
