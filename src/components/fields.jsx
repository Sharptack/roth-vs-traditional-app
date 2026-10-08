// The input fields the household forms are built from (HouseholdInputs.jsx): a dollar amount, an
// age, a dropdown, a set of radio buttons; and the option lists several forms share. (Until the
// switchover at the end of round 2's phase 1 they lived in the single calculator's form.)
import { useId, useState } from 'react';
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
  { value: '0.6', label: '40% lower than today' },
  { value: '0.7', label: '30% lower than today' },
  { value: '0.8', label: '20% lower than today' },
  { value: '0.9', label: '10% lower than today' },
  { value: '1', label: 'Same as today' },
  { value: '1.1', label: '10% higher than today' },
  { value: '1.25', label: '25% higher than today' },
  { value: '1.5', label: '50% higher than today' },
  { value: '2', label: '100% higher than today' },
];

const BASIS_OPTIONS = [
  { value: '0', label: '0% (all of it is gains)' },
  { value: '0.25', label: '25%' },
  { value: '0.5', label: '50% (default)' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100% (no gains yet)' },
];

function Field({ label, hint, children, id, changed }) {
  return (
    <div className={changed ? 'field changed' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

// Dollar input: shows raw text while typing, "$12,345" once you leave the field.
function CurrencyInput({ label, hint, value, onChange, changed }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const parsed = parseNumber(value);
  const display = !focused && Number.isFinite(parsed) ? formatCurrency(parsed) : value;
  return (
    <Field label={label} hint={hint} id={id} changed={changed}>
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

function AgeInput({ label, value, onChange, changed }) {
  const id = useId();
  return (
    <Field label={label} id={id} changed={changed}>
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

function SelectInput({ label, hint, value, onChange, options, changed }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id} changed={changed}>
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

function RadioGroup({ legend, name, value, onChange, options, hint, changed }) {
  return (
    <fieldset className={changed ? 'radio-group changed' : 'radio-group'}>
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

export const toOptions = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

export { AgeInput, CurrencyInput, RadioGroup, SelectInput };
export { BASIS_OPTIONS, INCOME_TYPE_OPTIONS, LIFESTYLE_OPTIONS, RETURN_OPTIONS };
