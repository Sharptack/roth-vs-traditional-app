// The #/next preview: the new version, built alongside the current calculator (see CLAUDE.md,
// "Build alongside, then switch over"). Not linked from the current pages.
// The suite shell (roadmap phase 2): one household, shared by every page —
//   #/next       the homepage: the shared household inputs and a tile per calculator
//   #/next/roth  the Roth vs. Pre-tax calculator (household model, phase 1)
//   #/next/tax   the tax calculator (single-year engine, phase 2)
// Each calculator page shows its own inputs first, then the shared ones, and links back home.
// State is its own; the current calculator's inputs are not shared or touched.
import { useEffect, useMemo, useState } from 'react';
import ResultsSummary from '../components/ResultsSummary.jsx';
import { compareRothVsTraditional } from '../lib/compare.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold, validateHousehold } from '../lib/household.js';
import { householdValuesFromSearch } from '../lib/householdLink.js';
import { SHARED_SECTION_IDS } from '../lib/householdForm.js';
import { CALCULATOR_HASH, NEXT_HASH, NEXT_PAGES, nextPageFromHash } from '../lib/route.js';
import { rothTile, taxTile } from '../lib/suiteTiles.js';
import { householdToYearTaxParams, taxCalculatorResult } from '../lib/taxCalculator.js';
import HouseholdForm from './HouseholdForm.jsx';
import ShareHousehold from './ShareHousehold.jsx';
import TaxResult from './TaxResult.jsx';

const CURRENT_YEAR = new Date().getFullYear();

// A shared link (household or old-style) is read once, on load.
const FROM_LINK = typeof window === 'undefined' ? null : householdValuesFromSearch(window.location.search);

// The Roth calculator's whole calculation, outside React so it can be tested.
export function previewResult(values, year) {
  const household = toHousehold(values, year);
  const householdErrors = validateHousehold(household);
  const result = compareRothVsTraditional(householdToCompareInputs(household));
  if (householdErrors.length === 0) return { household, result };
  const errors = [...(result.valid ? [] : result.errors), ...householdErrors];
  return { household, result: { valid: false, errors } };
}

export const CALCULATORS = [
  {
    id: 'roth',
    title: 'Roth vs. Pre-tax',
    blurb: 'Which leaves more after tax: saving Future Contributions Roth or Pre-tax?',
    ownSections: ['contributions'],
    ownTitle: 'Roth vs. Pre-tax inputs',
    sharedSections: SHARED_SECTION_IDS,
  },
  {
    id: 'tax',
    title: 'Tax calculator',
    blurb: 'This year’s federal tax: marginal and effective rates, and the room left in each bracket.',
    ownSections: ['thisYear'],
    ownTitle: 'Tax calculator inputs',
    // This year's Pre-tax savings are deducted, so Future Contributions are listed here too.
    sharedSections: [...SHARED_SECTION_IDS.slice(0, 4), 'contributions', ...SHARED_SECTION_IDS.slice(4)],
  },
];

function usePreviewPage() {
  const read = () => (typeof window === 'undefined' ? 'home' : nextPageFromHash(window.location.hash));
  const [page, setPage] = useState(read);
  useEffect(() => {
    const onHashChange = () => {
      setPage(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return page;
}

export default function NextApp({ initialPage }) {
  const [values, setValues] = useState(FROM_LINK?.values ?? PREVIEW_DEFAULT_VALUES);
  const [locked, setLocked] = useState(Boolean(FROM_LINK?.viewOnly));
  const hashPage = usePreviewPage();
  const page = initialPage ?? hashPage; // initialPage: for tests (no browser hash)
  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const roth = useMemo(() => previewResult(values, CURRENT_YEAR), [values]);
  const tax = useMemo(() => taxCalculatorResult(householdToYearTaxParams(roth.household)), [roth]);
  const tiles = { roth: rothTile(roth.result), tax: taxTile(tax) };

  const formProps = { values, onChange: handleChange, locked, onEditCopy: () => setLocked(false) };
  const share = !locked && <ShareHousehold values={values} />;
  const calculator = CALCULATORS.find((c) => c.id === page);

  return (
    <div>
      <p className="alert preview-banner" role="status">
        <strong>Preview, not finished.</strong> This is the next version of the calculator, built
        alongside the current one. Numbers and layout may change.{' '}
        <a href={CALCULATOR_HASH}>Back to the current calculator &rarr;</a>
      </p>

      {!calculator && (
        <>
          <header className="page-header">
            <h1>Client household (preview)</h1>
            <p>Set up the household once; every calculator reads the same inputs.</p>
          </header>
          <main className="calc-layout">
            <div className="inputs-column">
              <HouseholdForm {...formProps} title="Household" footer={share} />
            </div>
            <div className="results-column">
              <div className="suite-tiles">
                {CALCULATORS.map((c) => (
                  <a key={c.id} className="card suite-tile" href={NEXT_PAGES[c.id]}>
                    <span className="suite-tile-title">{c.title}</span>
                    <span className="suite-tile-headline">{tiles[c.id].headline}</span>
                    <span className="suite-tile-detail">{tiles[c.id].detail}</span>
                    <span className="suite-tile-blurb">{c.blurb}</span>
                    <span className="suite-tile-open">Open &rarr;</span>
                  </a>
                ))}
              </div>
            </div>
          </main>
        </>
      )}

      {calculator && (
        <>
          <header className="page-header">
            <p className="header-links">
              <a href={NEXT_HASH}>&larr; All calculators</a>
            </p>
            <h1>{calculator.title} (preview)</h1>
            <p>{calculator.blurb}</p>
          </header>
          <main className="calc-layout">
            <div className="inputs-column">
              <HouseholdForm
                key={`${calculator.id}-own`}
                {...formProps}
                title={calculator.ownTitle}
                only={calculator.ownSections}
                defaultOpen={calculator.ownSections}
              />
              <HouseholdForm
                key={`${calculator.id}-shared`}
                {...formProps}
                title="Household"
                only={calculator.sharedSections}
                defaultOpen={[]}
                footer={share}
              />
            </div>
            <div className="results-column">
              {calculator.id === 'roth' ? <ResultsSummary result={roth.result} /> : <TaxResult tax={tax} />}
            </div>
          </main>
        </>
      )}
    </div>
  );
}
