// The #/next preview: the new version, built alongside the current calculator (see CLAUDE.md,
// "Build alongside, then switch over"). Not linked from the current pages.
// Phase 1 (household model): the Roth calculator, run through the household object
// (toHousehold -> householdToCompareInputs), with an optional spouse entered separately.
// Its state is its own; the current calculator's inputs are not shared or touched.
import { useMemo, useState } from 'react';
import InputForm from '../components/InputForm.jsx';
import ResultsSummary from '../components/ResultsSummary.jsx';
import { compareRothVsTraditional } from '../lib/compare.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold, validateHousehold } from '../lib/household.js';
import { CALCULATOR_HASH } from '../lib/route.js';
import SpouseInputs from './SpouseInputs.jsx';

const CURRENT_YEAR = new Date().getFullYear();

// The preview's whole calculation, outside React so it can be tested.
export function previewResult(values, year) {
  const household = toHousehold(values, year);
  const householdErrors = validateHousehold(household);
  const result = compareRothVsTraditional(householdToCompareInputs(household));
  if (householdErrors.length === 0) return { household, result };
  const errors = [...(result.valid ? [] : result.errors), ...householdErrors];
  return { household, result: { valid: false, errors } };
}

export default function NextApp() {
  const [values, setValues] = useState(PREVIEW_DEFAULT_VALUES);
  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));
  const { result } = useMemo(() => previewResult(values, CURRENT_YEAR), [values]);

  return (
    <div>
      <p className="alert preview-banner" role="status">
        <strong>Preview, not finished.</strong> This is the next version of the calculator, built
        alongside the current one. Numbers and layout may change.{' '}
        <a href={CALCULATOR_HASH}>Back to the current calculator &rarr;</a>
      </p>
      <header className="page-header">
        <h1>Roth vs. Pre-Tax Calculator (preview)</h1>
        <p>Household model: when filing jointly, a spouse can be entered separately.</p>
      </header>
      <main className="calc-layout">
        <div className="inputs-column">
          <InputForm values={values} onChange={handleChange} title="Inputs" />
          <SpouseInputs values={values} onChange={handleChange} />
        </div>
        <div className="results-column">
          <ResultsSummary result={result} />
        </div>
      </main>
    </div>
  );
}
