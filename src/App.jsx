import { useMemo, useState } from 'react';
import InputForm from './components/InputForm.jsx';
import ResultsSummary from './components/ResultsSummary.jsx';
import { compareRothVsTraditional } from './lib/compare.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from './lib/formInputs.js';
import './App.css';

/*
 * Future enhancements (explicitly out of scope for this version)
 *
 * - "Maxing out" side-account comparison. When contributing at the IRS limit,
 *   model the after-tax value of (Traditional contribution + the tax savings
 *   invested in a taxable side account, with capital gains drag) against a Roth
 *   contribution at the same limit. Today, step 7's warning only flags the case.
 * - Optimal split between Roth and Traditional ("straddling brackets"), rather
 *   than only comparing the pure extremes.
 * - Tax-efficient withdrawal sequencing across accounts (vs. the simplified
 *   proportional withdrawal used in Section 3).
 * - State income tax.
 * - Full SSA benefit calculation (35-year indexed earnings history).
 * - RMD age rules.
 * - Employer match modeling: the match amount, and the match-optimization math
 *   when Roth contributions alone can't capture the full match.
 * - Contributions that change over time (e.g. raises).
 * - Graphs / charts.
 * - PDF client report export.
 * - A backend (saved scenarios, client database, user accounts).
 * - A Simple/Advanced mode split.
 * - Access control for any future internal-only features.
 */

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  const [values, setValues] = useState(DEFAULT_FORM_VALUES);

  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  // Results update live: recomputed on every input change, no submit button.
  const result = useMemo(
    () => compareRothVsTraditional(toCompareInputs(values, CURRENT_YEAR)),
    [values],
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1>Roth vs. Pre-Tax Calculator</h1>
        <p>
          Which retirement contribution leaves you with more after-tax wealth? Change any number
          below and the results update right away.
        </p>
        <p className="disclaimer">Estimates only — not tax or financial advice.</p>
      </header>

      <main>
        <InputForm values={values} onChange={handleChange} />
        <ResultsSummary result={result} />
      </main>
    </div>
  );
}
