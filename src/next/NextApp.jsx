// The #/next preview: the new version, built alongside the current calculator (see CLAUDE.md,
// "Build alongside, then switch over"). Not linked from the current pages.
// The suite shell (roadmap phase 2): one household, shared by every page —
//   #/next       the homepage: the shared household inputs and a tile per calculator
//   #/next/roth  the Roth vs. Pre-tax calculator (household model, phase 1)
//   #/next/tax   the tax calculator (single-year engine, phase 2)
//   #/next/projection  the year-by-year projection (phases 4-5)
//   #/next/conversion  the single-year Roth conversion calculator
//   #/next/pension     the pension calculator (lump sum vs. monthly benefit)
// Each calculator page shows its own inputs first, then the shared ones, and links back home.
// State is its own; the current calculator's inputs are not shared or touched.
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import ResultsSummary from '../components/ResultsSummary.jsx';
import { compareRothVsTraditional } from '../lib/compare.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold, validateHousehold } from '../lib/household.js';
import { householdValuesFromSearch } from '../lib/householdLink.js';
import { DEFAULT_SECTION_IDS, SHARED_SECTION_IDS } from '../lib/householdForm.js';
import { projectionView } from '../lib/projectionSummary.js';
import { rmdStartAge } from '../lib/rmd.js';
import { CALCULATOR_HASH, NEXT_HASH, NEXT_PAGES, nextPageFromHash } from '../lib/route.js';
import { conversionTile, pensionTile, projectionTile, rothTile, taxTile } from '../lib/suiteTiles.js';
import { conversionResult } from '../lib/conversionCalculator.js';
import { householdToPensionInputs, pensionResult } from '../lib/pensionCalculator.js';
import { householdToYearTaxParams, taxCalculatorResult } from '../lib/taxCalculator.js';
import HouseholdForm from './HouseholdForm.jsx';
import ShareHousehold from './ShareHousehold.jsx';
import TaxResult from './TaxResult.jsx';
import ProjectionResult from './ProjectionResult.jsx';
import LifetimeComparison from './LifetimeComparison.jsx';
import ConversionResult from './ConversionResult.jsx';
import PensionResult from './PensionResult.jsx';
import { compareLifetime } from '../lib/lifetimeComparison.js';
import { strategyById } from '../lib/strategies.js';
import { useCloud } from './useCloud.js';
import AccountBar from './AccountBar.jsx';
import SavedHouseholds from './SavedHouseholds.jsx';

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
  {
    id: 'projection',
    title: 'Year-by-year projection',
    blurb: 'From today to the end age: income, taxes, RMDs and balances every year, and whether the money lasts.',
    ownSections: ['projection'],
    ownTitle: 'Projection inputs',
    sharedSections: DEFAULT_SECTION_IDS,
  },
  {
    id: 'conversion',
    title: 'Roth conversion',
    blurb: 'This year’s tax cost of converting Pre-tax money to Roth, and the conversion that fills each bracket.',
    // The year's other income sits under the conversion, so it is listed with it.
    ownSections: ['conversion', 'thisYear'],
    ownTitle: 'Roth conversion inputs',
    sharedSections: [...SHARED_SECTION_IDS.slice(0, 4), 'contributions', ...SHARED_SECTION_IDS.slice(4)],
  },
  {
    id: 'pension',
    title: 'Pension: lump sum or monthly',
    blurb: 'The return the lump sum would have to earn to match the monthly benefit.',
    ownSections: ['pension'],
    ownTitle: 'Pension inputs',
    sharedSections: ['household', 'you', 'spouse', 'assumptions'],
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

// client: a Supabase client for tests (null = no backend); omitted = the configured backend,
// loaded on demand (services/supabaseClient.js).
export default function NextApp({ initialPage, client }) {
  const [values, setValues] = useState(FROM_LINK?.values ?? PREVIEW_DEFAULT_VALUES);
  const [locked, setLocked] = useState(Boolean(FROM_LINK?.viewOnly));
  // Sign-in and the saved household on screen ({ id, label }), when a backend is configured.
  const cloud = useCloud(client);
  const [opened, setOpened] = useState(null);
  const hashPage = usePreviewPage();
  const page = initialPage ?? hashPage; // initialPage: for tests (no browser hash)
  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const roth = useMemo(() => previewResult(values, CURRENT_YEAR), [values]);
  const tax = useMemo(() => taxCalculatorResult(householdToYearTaxParams(roth.household)), [roth]);
  const conversion = useMemo(
    () => conversionResult(householdToYearTaxParams(roth.household), roth.household.calculators.conversion.amount),
    [roth],
  );
  const pensionInputs = useMemo(() => householdToPensionInputs(roth.household), [roth]);
  const pension = useMemo(() => pensionResult(pensionInputs), [pensionInputs]);
  const pretaxBalance = roth.household.accounts.filter((a) => a.type === 'pretax').reduce((s, a) => s + (a.balance || 0), 0);
  const realReturn = roth.household.assumptions.returnRate;
  const inflation = roth.household.assumptions.inflationRate ?? 0;
  // The projection runs many whole projections (sustainable spending), so it follows the inputs a
  // beat behind while typing (useDeferredValue) instead of blocking each keystroke.
  const deferredRoth = useDeferredValue(roth);
  const projection = useMemo(
    () => (deferredRoth.result.valid ? projectionView(deferredRoth.household, deferredRoth.result.retirementNeed.target) : null),
    [deferredRoth],
  );
  // The lifetime Roth vs. Pre-tax comparison (phase 6): only on the Roth page (two projections and
  // two sustainable-spending searches), a beat behind the inputs like the projection.
  const lifetime = useMemo(() => {
    if (page !== 'roth' || !deferredRoth.result.valid) return null;
    const own = deferredRoth.household.calculators?.projection ?? {};
    return compareLifetime(deferredRoth.household, deferredRoth.result, {
      endAge: own.endAge,
      heirTaxRate: own.heirTaxRate,
      strategy: strategyById(own.strategy),
    });
  }, [deferredRoth, page]);
  const tiles = {
    roth: rothTile(roth.result),
    tax: taxTile(tax),
    projection: projectionTile(projection),
    conversion: conversionTile(conversion),
    pension: pensionTile(pension, pensionInputs),
  };

  const formProps = { values, onChange: handleChange, locked, onEditCopy: () => setLocked(false) };
  const share = !locked && (
    <ShareHousehold
      values={values}
      household={roth.household}
      tiles={CALCULATORS.map((c) => ({ title: c.title, ...tiles[c.id] }))}
    />
  );
  const calculator = CALCULATORS.find((c) => c.id === page);
  // Saved households: the whole card on the homepage, compact on a calculator page.
  const saved = (compact) =>
    cloud.session && (
      <SavedHouseholds
        client={cloud.client}
        values={values}
        opened={opened}
        compact={compact}
        onOpen={({ id, label, values: stored }) => {
          setValues(stored);
          setLocked(false);
          setOpened({ id, label, values: stored });
        }}
        onSaved={setOpened}
      />
    );

  return (
    <div className="next-app">
      <p className="alert preview-banner" role="status">
        <strong>Preview, not finished.</strong> This is the next version of the calculator, built
        alongside the current one. Numbers and layout may change.{' '}
        <a href={CALCULATOR_HASH}>Back to the current calculator &rarr;</a>
      </p>
      <AccountBar client={cloud.client} cloud={cloud} onSignedOut={() => setOpened(null)} />

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
              {saved(false)}
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
            {calculator.id === 'roth' && Number.isFinite(roth.household.people[0].birthYear) && (
              <p className="header-links">
                RMDs start at {rmdStartAge(roth.household.people[0].birthYear)}.{' '}
                <a href={NEXT_PAGES.projection}>See year-by-year taxes &rarr;</a>
              </p>
            )}
          </header>
          <main className="calc-layout">
            <div className="inputs-column">
              {saved(true)}
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
              {calculator.id === 'roth' && (
                <>
                  <ResultsSummary result={roth.result} showBlend />
                  <LifetimeComparison lifetime={lifetime} household={deferredRoth.household} result={deferredRoth.result} />
                </>
              )}
              {calculator.id === 'tax' && <TaxResult tax={tax} />}
              {calculator.id === 'projection' && <ProjectionResult view={projection} />}
              {calculator.id === 'conversion' && <ConversionResult conversion={conversion} pretaxBalance={pretaxBalance} />}
              {calculator.id === 'pension' && (
                <PensionResult
                  pension={pension}
                  inputs={pensionInputs}
                  realReturn={realReturn}
                  inflation={inflation}
                  nominalReturn={(1 + realReturn) * (1 + inflation) - 1}
                />
              )}
            </div>
          </main>
        </>
      )}
    </div>
  );
}
