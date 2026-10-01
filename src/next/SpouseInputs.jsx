// The preview's "Spouse" block (household model, phase 1). Always shown; the spouse's fields
// appear only when filing jointly and "Enter your spouse separately?" is Yes.
// A first version: the full shared-inputs component (people + an accounts list) replaces the
// current form in a later step.
import { AgeInput, CurrencyInput, RadioGroup, SelectInput } from '../components/InputForm.jsx';

const SPOUSE_INCOME_TYPES = [
  { value: 'w2', label: 'W-2 (employee)' },
  { value: '1099', label: '1099 (self-employed)' },
];

export default function SpouseInputs({ values, onChange }) {
  const set = (name) => (value) => onChange(name, value);
  const joint = values.filingStatus === 'mfj';
  const included = joint && values.includeSpouse === 'yes';
  return (
    <section className="card input-form spouse-inputs" aria-labelledby="spouse-title">
      <div className="form-head">
        <h2 className="form-title" id="spouse-title">
          Spouse
        </h2>
      </div>
      {!joint && (
        <>
          <p className="hint">
            New in the preview: a spouse can be entered with their own income, age and Social Security.
          </p>
          <button type="button" className="link-button" onClick={() => onChange('filingStatus', 'mfj')}>
            Switch to married filing jointly to add a spouse
          </button>
        </>
      )}
      {joint && <RadioGroup
        legend="Enter your spouse separately?"
        name="includeSpouse"
        value={values.includeSpouse}
        onChange={set('includeSpouse')}
        options={[
          { value: 'no', label: 'No, one combined income' },
          { value: 'yes', label: 'Yes' },
        ]}
        hint={
          included
            ? 'The income, age and Social Security above are now yours alone. Payroll tax and Social Security are figured per person, with a spousal benefit when it is larger. The comparison retires when the first of you does.'
            : 'With one combined income, payroll tax and Social Security treat the household as one earner (as the current calculator does).'
        }
      />}
      {included && (
        <>
          <CurrencyInput label="Spouse's gross income (annual)" value={values.spouseIncome} onChange={set('spouseIncome')} />
          <SelectInput
            label="Spouse's type of income"
            value={values.spouseIncomeType}
            onChange={set('spouseIncomeType')}
            options={SPOUSE_INCOME_TYPES}
          />
          <AgeInput label="Spouse's current age" value={values.spouseAge} onChange={set('spouseAge')} />
          <AgeInput
            label="Spouse's planned retirement age"
            value={values.spouseRetirementAge}
            onChange={set('spouseRetirementAge')}
          />
          <RadioGroup
            legend="Do you know your spouse's Social Security benefit?"
            name="spouseKnowsSocialSecurity"
            value={values.spouseKnowsSocialSecurity}
            onChange={set('spouseKnowsSocialSecurity')}
            options={[
              { value: 'no', label: 'No, estimate it' },
              { value: 'yes', label: 'Yes' },
            ]}
            hint="An entered benefit is used as is, and no spousal benefit is figured from it."
          />
          {values.spouseKnowsSocialSecurity === 'yes' && (
            <CurrencyInput
              label="Spouse's annual Social Security benefit"
              value={values.spouseSocialSecurityBenefit}
              onChange={set('spouseSocialSecurityBenefit')}
            />
          )}
        </>
      )}
    </section>
  );
}
