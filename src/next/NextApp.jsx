// The #/next preview: the new version, built alongside the current calculator (see CLAUDE.md,
// "Build alongside, then switch over"). Not linked from the current pages.
// The suite shell (roadmap phase 2): one household, shared by every page —
//   #/next       the homepage: the household in brief and a tile per calculator
//   #/next/inputs      the inputs page: every input, each section its own card (round 2 phase 0)
//   #/next/roth  the Roth vs. Pre-tax calculator (household model, phase 1)
//   #/next/tax   the tax calculator (single-year engine, phase 2)
//   #/next/projection  the year-by-year projection (phases 4-5)
//   #/next/conversion  the single-year Roth conversion calculator
//   #/next/pension     the pension calculator (lump sum vs. monthly benefit)
// Each calculator page has one inputs card with only the inputs it reads (householdInputs.js
// CALCULATOR_INPUTS), editing the same household, and a link to the inputs page.
// State is its own; the current calculator's inputs are not shared or touched.
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import ResultsSummary from '../components/ResultsSummary.jsx';
import { compareRothVsTraditional } from '../lib/compare.js';
import { householdToCompareInputs } from '../lib/household.js';
import { toHouseholdV2, validateHouseholdV2 } from '../lib/householdV2.js';
import { upgradeHouseholdValues } from '../lib/householdUpgrade.js';
import { householdValuesV2FromSearch } from '../lib/householdLink.js';
import { CALCULATOR_INPUTS, inputSections } from '../lib/householdInputs.js';
import { DOCS_HASH, docsHash } from '../lib/docs.js';
import { DEFAULT_HOUSEHOLD_VALUES, isoDate, refreshAges } from '../lib/householdValues.js';
import { projectionView } from '../lib/projectionSummary.js';
import { rmdStartAge } from '../lib/rmd.js';
import { CALCULATOR_HASH, NEXT_HASH, NEXT_PAGES, nextPageFromHash } from '../lib/route.js';
import { conversionTile, pensionTile, projectionTile, rothTile, taxTile } from '../lib/suiteTiles.js';
import { conversionResult } from '../lib/conversionCalculator.js';
import { householdToPensionInputs, pensionResult } from '../lib/pensionCalculator.js';
import { householdToYearTaxParams, taxCalculatorResult } from '../lib/taxCalculator.js';
import HouseholdInputs from './HouseholdInputs.jsx';
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

// A shared link (version 2, version 1 or an old public-calculator link, the last two converted) is
// read once, on load.
const FROM_LINK = typeof window === 'undefined' ? null : householdValuesV2FromSearch(window.location.search, CURRENT_YEAR);
// A household opened from a link or a save: birthdate-entered ages brought up to date.
const opening = (values) => refreshAges(values, isoDate(new Date()));

// The Roth calculator's whole calculation, outside React so it can be tested.
//  values: the form's values (version 2; version 1 values, as older tests pass, are converted
//    first); every calculator reads the version 2 household.
//  blend: compute the blend explorer (only the Roth page shows it; it is most of the run time).
export function previewResult(values, year, { blend = true } = {}) {
  const household = toHouseholdV2(upgradeHouseholdValues(values, year), year);
  const householdErrors = validateHouseholdV2(household);
  const result = compareRothVsTraditional({ ...householdToCompareInputs(household), skipBlend: !blend });
  if (householdErrors.length === 0) return { household, result };
  const errors = [...(result.valid ? [] : result.errors), ...householdErrors];
  return { household, result: { valid: false, errors } };
}

// Each calculator's result from the household (shared by its page, its tile and Copy summary).
const irmaaOf = (household) => ({ irmaa: Boolean(household.assumptions.medicareIrmaa) });
const taxOf = (household) => taxCalculatorResult(householdToYearTaxParams(household), irmaaOf(household));
const conversionOf = (household) =>
  conversionResult(householdToYearTaxParams(household), household.calculators.conversion.amount, irmaaOf(household));
const projectionOf = (r) => (r.result.valid ? projectionView(r.household, r.result.retirementNeed.target) : null);
// The homepage shows every calculator's tile; a calculator page shows only its own result; the
// inputs page shows none.
const isHome = (page) => page === 'home';
const shownOn = (page, id) => isHome(page) || page === id;

export const CALCULATORS = [
  {
    id: 'roth',
    title: 'Roth vs. Pre-tax',
    blurb: 'Which leaves more after tax: saving Future Contributions Roth or Pre-tax?',
    ownTitle: 'Roth vs. Pre-tax inputs',
  },
  {
    id: 'tax',
    title: 'Tax calculator',
    blurb: 'This year’s federal tax: the marginal rate, the effective marginal rate (EMTR), the average tax rate, and the room left in each bracket.',
    ownTitle: 'Tax calculator inputs',
  },
  {
    id: 'projection',
    title: 'Year-by-year projection',
    blurb: 'From today to the end age: income, taxes, RMDs and balances every year, and whether the money lasts.',
    ownTitle: 'Projection inputs',
  },
  {
    id: 'conversion',
    title: 'Roth conversion',
    blurb: 'This year’s tax cost of converting Pre-tax money to Roth, and the conversion that fills each bracket.',
    ownTitle: 'Roth conversion inputs',
  },
  {
    id: 'pension',
    title: 'Pension: lump sum or monthly',
    blurb: 'The return the lump sum would have to earn to match the monthly benefit.',
    ownTitle: 'Pension inputs',
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
  const [values, setValues] = useState(() => (FROM_LINK ? opening(FROM_LINK.values) : DEFAULT_HOUSEHOLD_VALUES));
  const [locked, setLocked] = useState(Boolean(FROM_LINK?.viewOnly));
  // "Start a new household" (decided 2026-10-08): back to the defaults, with an Undo that restores the
  // household on screen (and which saved household it was). A saved household is never touched.
  const [beforeNew, setBeforeNew] = useState(null);
  // Sign-in and the saved household on screen ({ id, label }), when a backend is configured.
  const cloud = useCloud(client);
  const [opened, setOpened] = useState(null);
  // The collapse bar: the inputs tucked away on calculator pages (kept from page to page).
  const [inputsHidden, setInputsHidden] = useState(false);
  const hashPage = usePreviewPage();
  const page = initialPage ?? hashPage; // initialPage: for tests (no browser hash)

  // Each calculator is worked out only where it is shown: its own page, or the homepage's tiles
  // (the blend explorer only on the Roth page). Copy summary works out the rest when pressed.
  const roth = useMemo(() => previewResult(values, CURRENT_YEAR, { blend: page === 'roth' }), [values, page]);
  const h = roth.household;
  const tax = useMemo(() => (shownOn(page, 'tax') ? taxOf(h) : null), [h, page]);
  const conversion = useMemo(() => (shownOn(page, 'conversion') ? conversionOf(h) : null), [h, page]);
  const pensionInputs = useMemo(() => householdToPensionInputs(h), [h]);
  const pension = useMemo(() => (shownOn(page, 'pension') ? pensionResult(pensionInputs) : null), [pensionInputs, page]);
  const pretaxBalance = h.accounts.filter((a) => a.type === 'pretax').reduce((sum, a) => sum + (a.balance || 0), 0);
  const realReturn = h.assumptions.returnRate;
  const inflation = h.assumptions.inflationRate ?? 0;
  // The projection runs many whole projections (sustainable spending), so it follows the inputs a
  // beat behind while typing (useDeferredValue) instead of blocking each keystroke.
  const deferredRoth = useDeferredValue(roth);
  const projection = useMemo(() => (shownOn(page, 'projection') ? projectionOf(deferredRoth) : null), [deferredRoth, page]);
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
  const tilesOf = (parts) => ({
    roth: rothTile(roth.result),
    tax: taxTile(parts.tax),
    projection: projectionTile(parts.projection),
    conversion: conversionTile(parts.conversion),
    pension: pensionTile(parts.pension, pensionInputs),
  });
  const tiles = isHome(page) ? tilesOf({ tax, conversion, pension, projection }) : null;
  // For Copy summary: every calculator's headline, working out on demand what this page skipped.
  const summaryTiles = () => {
    const all = tilesOf({
      tax: tax ?? taxOf(h),
      conversion: conversion ?? conversionOf(h),
      pension: pension ?? pensionResult(pensionInputs),
      projection: projection ?? projectionOf(roth),
    });
    return CALCULATORS.map((c) => ({ title: c.title, ...all[c.id] }));
  };

  const formProps = { values, onUpdate: setValues, locked, onEditCopy: () => setLocked(false) };
  const share = !locked && <ShareHousehold values={values} household={h} getTiles={summaryTiles} />;
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
          setValues(opening(stored));
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

      {page === 'inputs' && (
        <>
          <header className="page-header">
            <p className="header-links">
              <a href={NEXT_HASH}>&larr; All calculators</a>
            </p>
            <h1>Household inputs (preview)</h1>
            <p>
              Every input in one place. Each calculator reads the ones it needs, and its own inputs card
              edits the same household.
            </p>
            <p className="header-links">
              <a href={docsHash('inputs')}>How the inputs work &rarr;</a>{' '}
              {beforeNew ? (
                <>
                  <span className="dim">Started a new household.</span>{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setValues(beforeNew.values);
                      setOpened(beforeNew.opened);
                      setLocked(beforeNew.locked);
                      setBeforeNew(null);
                    }}
                  >
                    Undo
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setBeforeNew({ values, opened, locked });
                    setValues(DEFAULT_HOUSEHOLD_VALUES);
                    setOpened(null);
                    setLocked(false);
                  }}
                >
                  Start a new household
                </button>
              )}
            </p>
          </header>
          <main className="inputs-page">
            {saved(false)}
            <HouseholdInputs
              {...formProps}
              layout="page"
              title="Household"
              defaultOpen={['household', 'people', 'income', 'contributions']}
              footer={share}
            />
            <nav className="card inputs-next" aria-label="Calculators">
              <h2>Open a calculator</h2>
              <ul>
                {CALCULATORS.map((c) => (
                  <li key={c.id}>
                    <a href={NEXT_PAGES[c.id]}>{c.title}</a> <span className="dim">{c.blurb}</span>
                  </li>
                ))}
              </ul>
            </nav>
          </main>
        </>
      )}

      {page === 'home' && (
        <>
          <header className="page-header">
            <h1>Client household (preview)</h1>
            <p>Set up the household once; every calculator reads the same inputs.</p>
            <p className="header-links">
              <a href={DOCS_HASH}>Docs &rarr;</a> How each calculator works and how to use it.
            </p>
          </header>
          <main className="calc-layout">
            <div className="inputs-column">
              <section className="card home-household" aria-labelledby="home-household-title">
                <div className="form-head">
                  <h2 id="home-household-title" className="form-title">
                    Household
                  </h2>
                  <div className="form-head-actions">
                    <a className="link-button" href={NEXT_PAGES.inputs}>
                      Edit inputs &rarr;
                    </a>
                  </div>
                </div>
                <ul>
                  {inputSections().map((sec) => (
                    <li key={sec.id}>
                      <strong>{sec.title}:</strong> {sec.summary(values)}
                    </li>
                  ))}
                </ul>
                {share}
              </section>
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
          <main className={`calc-layout with-bar${inputsHidden ? ' inputs-hidden' : ''}`}>
            {/* Hidden, not removed, so what is typed and which sections are open survive. */}
            <div className="inputs-column" id="calc-inputs" hidden={inputsHidden}>
              {saved(true)}
              <HouseholdInputs
                key={calculator.id}
                {...formProps}
                title={calculator.ownTitle}
                sections={CALCULATOR_INPUTS[calculator.id].sections}
                fields={CALCULATOR_INPUTS[calculator.id].fields}
                defaultOpen={CALCULATOR_INPUTS[calculator.id].sections.slice(0, 1)}
                headLink={
                  <a className="link-button" href={NEXT_PAGES.inputs}>
                    All inputs
                  </a>
                }
                footer={share}
              />
            </div>
            <button
              type="button"
              className="collapse-bar"
              aria-controls="calc-inputs"
              aria-expanded={!inputsHidden}
              onClick={() => setInputsHidden(!inputsHidden)}
            >
              <span aria-hidden="true">{inputsHidden ? '›' : '‹'}</span>
              <span className="collapse-bar-label">{inputsHidden ? 'Show inputs' : 'Hide inputs'}</span>
            </button>
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
