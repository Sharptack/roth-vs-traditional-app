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
import ResultsSummary, { RothDisclaimer } from '../components/ResultsSummary.jsx';
import { compareRothVsTraditional } from '../lib/compare.js';
import { householdToCompareInputs } from '../lib/household.js';
import { toHouseholdV2, validateHouseholdV2 } from '../lib/householdV2.js';
import { upgradeHouseholdValues } from '../lib/householdUpgrade.js';
import { householdValuesV2FromSearch } from '../lib/householdLink.js';
import { CALCULATOR_INPUTS, INPUT_GROUPS, inputSections } from '../lib/householdInputs.js';
import { DOCS_HASH, docsHash } from '../lib/docs.js';
import { BLANK_HOUSEHOLD_VALUES, DEFAULT_HOUSEHOLD_VALUES, activePeople, isoDate, refreshAges, updateRow } from '../lib/householdValues.js';
import { projectionView } from '../lib/projectionSummary.js';
import { everyoneRetired, spendingNeed } from '../lib/spendingNeed.js';
import { rmdStartAge } from '../lib/rmd.js';
import { HOME_HASH, PAGES, pageFromHash } from '../lib/route.js';
import { conversionTile, pensionTile, projectionTile, rothTile, spendingTile, taxTile } from '../lib/suiteTiles.js';
import { applySpendingChoice, legacyTradeoff, retirementSpendingView, spendingChoice } from '../lib/retirementSpending.js';
import RetirementSpendingResult from './RetirementSpendingResult.jsx';
import { conversionResult } from '../lib/conversionCalculator.js';
import { conversionLifetime } from '../lib/conversionLifetime.js';
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
import ContributionNotes from './ContributionNotes.jsx';
import UseInPlan from './UseInPlan.jsx';
import { applyContributionSwitch, contributionSwitch } from '../lib/useInPlan.js';
import ScenarioCompare from '../components/ScenarioCompare.jsx';
import { contributionNotes } from '../lib/contributionRules.js';

const CURRENT_YEAR = new Date().getFullYear();

// A shared link (version 2, version 1 or an old public-calculator link, the last two converted) is
// read once, on load.
const FROM_LINK = typeof window === 'undefined' ? null : householdValuesV2FromSearch(window.location.search, CURRENT_YEAR);
// A household opened from a link or a save: birthdate-entered ages brought up to date.
const opening = (values) => refreshAges(values, isoDate(new Date()));

export const RETIRED_MESSAGE =
  'Everyone in the household has retired, with no earnings this year, so there are no contributions to compare. The Roth conversion calculator weighs moving Pre-tax money to Roth.';

// The Roth calculator's whole calculation, outside React so it can be tested.
//  values: the form's values (version 2; version 1 values, as older tests pass, are converted
//    first); every calculator reads the version 2 household.
//  blend: compute the blend explorer (only the Roth page shows it; it is most of the run time).
// -> { household, result, spending }: spending = the spending need every calculator reads
//    (spendingNeed.js; phase 3), worked out even when there is nothing to compare.
export function previewResult(values, year, { blend = true } = {}) {
  const household = toHouseholdV2(upgradeHouseholdValues(values, year), year);
  const householdErrors = validateHouseholdV2(household);
  const inputs = householdToCompareInputs(household);
  const withSpending = (result) => ({
    household,
    result,
    spending: householdErrors.length === 0 ? spendingNeed(household, result) : { need: null, error: householdErrors[0] },
  });
  // Already retired, with no earnings this year: nothing is saved from a paycheck to compare.
  if (householdErrors.length === 0 && everyoneRetired(household) && !(inputs.grossIncome > 0)) {
    return withSpending({ valid: false, errors: [RETIRED_MESSAGE] });
  }
  const result = compareRothVsTraditional({ ...inputs, skipBlend: !blend });
  if (householdErrors.length === 0) return withSpending(result);
  const errors = [...(result.valid ? [] : result.errors), ...householdErrors];
  return withSpending({ valid: false, errors });
}

// Each calculator's result from the household (shared by its page, its tile and Copy summary).
const irmaaOf = (household) => ({ irmaa: Boolean(household.assumptions.medicareIrmaa) });
const taxOf = (household) => taxCalculatorResult(householdToYearTaxParams(household), irmaaOf(household));
const conversionOf = (household) =>
  conversionResult(householdToYearTaxParams(household), household.calculators.conversion.amount, irmaaOf(household));
const projectionOf = (r) => (r.spending.need !== null ? projectionView(r.household, r.spending.need) : null);
const spendingOf = (r) => (r.spending.need !== null ? retirementSpendingView(r.household, r.spending.need) : null);
// The homepage shows every calculator's tile; a calculator page shows only its own result; the
// inputs page shows none.
const isHome = (page) => page === 'home';
const shownOn = (page, id) => isHome(page) || page === id;

// Each calculator is a decision (weighs one choice) or an evaluation (shows where the household
// stands); decided 2026-10-09. The dashboard shows them in these two groups, in this order.
export const CALCULATOR_GROUPS = [
  { id: 'decisions', title: 'Decisions', blurb: 'Weigh one choice against the other.' },
  { id: 'evaluations', title: 'Evaluations', blurb: 'Where the household stands: this year, and every year of the plan.' },
];

export const CALCULATORS = [
  {
    id: 'roth',
    group: 'decisions',
    title: 'Roth vs. Pre-tax',
    blurb: 'Which leaves more after tax: saving Future Contributions Roth or Pre-tax?',
    ownTitle: 'Roth vs. Pre-tax inputs',
  },
  {
    id: 'conversion',
    group: 'decisions',
    title: 'Roth conversion',
    blurb: 'A Roth conversion this year: its tax now and its effective rate, and lifetime tax, the legacy and retirement income with and without it.',
    ownTitle: 'Roth conversion inputs',
    article: 'conversion',
  },
  {
    id: 'pension',
    group: 'decisions',
    title: 'Pension: lump sum or monthly',
    blurb: 'The return the lump sum would have to earn to match the monthly benefit.',
    ownTitle: 'Pension inputs',
    article: 'pension',
  },
  {
    id: 'projection',
    group: 'evaluations',
    title: 'Year-by-year projection',
    blurb: 'From today to the end age: income, taxes, RMDs and balances every year, and whether the money lasts.',
    ownTitle: 'Projection inputs',
    article: 'projection',
  },
  {
    id: 'spending',
    group: 'evaluations',
    title: 'Retirement spending',
    blurb: 'What the household’s resources allow it to spend each year, with a legacy goal, against the spending need.',
    ownTitle: 'Retirement spending inputs',
    article: 'spending',
  },
  {
    id: 'tax',
    group: 'evaluations',
    title: 'Tax calculator',
    blurb: 'This year’s federal tax: the marginal rate, the effective marginal rate (EMTR), the average tax rate, and the room left in each bracket.',
    ownTitle: 'Tax calculator inputs',
    article: 'tax',
  },
];

function usePreviewPage() {
  const read = () => (typeof window === 'undefined' ? 'home' : pageFromHash(window.location.hash));
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
// loaded on demand (services/supabaseClient.js). initialValues: for tests (the household to open with).
export default function NextApp({ initialPage, initialValues, client }) {
  const [values, setValues] = useState(() => initialValues ?? (FROM_LINK ? opening(FROM_LINK.values) : DEFAULT_HOUSEHOLD_VALUES));
  const [locked, setLocked] = useState(Boolean(FROM_LINK?.viewOnly));
  // "Clear inputs" (decided 2026-10-09; "Start a new household" before it): a blank form, with an Undo
  // that restores the household on screen (and which saved household it was). A saved household is
  // never touched until it is saved over.
  const [beforeClear, setBeforeClear] = useState(null);
  // "Compare a change" on the Roth page (decided 2026-10-08): a second household, starting as a copy.
  const [compareValues, setCompareValues] = useState(null);
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
  // The pension calculator needs a pension income row (none: nothing to work out).
  const pensionInputs = useMemo(() => (h.calculators.pension ? householdToPensionInputs(h) : null), [h]);
  const pension = useMemo(() => (shownOn(page, 'pension') && pensionInputs ? pensionResult(pensionInputs) : null), [pensionInputs, page]);
  const pretaxBalance = h.accounts.filter((a) => a.type === 'pretax').reduce((sum, a) => sum + (a.balance || 0), 0);
  // A lump sum is invested in retirement: the return after retirement (version 1: the one return).
  const realReturn = h.assumptions.retirementReturnRate ?? h.assumptions.returnRate;
  const inflation = h.assumptions.inflationRate ?? 0;
  // The projection runs many whole projections (sustainable spending), so it follows the inputs a
  // beat behind while typing (useDeferredValue) instead of blocking each keystroke.
  const deferredRoth = useDeferredValue(roth);
  const projection = useMemo(() => (shownOn(page, 'projection') ? projectionOf(deferredRoth) : null), [deferredRoth, page]);
  const spendingView = useMemo(() => (shownOn(page, 'spending') ? spendingOf(deferredRoth) : null), [deferredRoth, page]);
  // "Use in the plan" on Retirement spending (decided 2026-10-10): the budget that spends what the resources allow.
  // The trade-off chart: several sustainable-spending searches, so only on its own page.
  const tradeoff = useMemo(() => (page === 'spending' && spendingView ? legacyTradeoff(deferredRoth.household, spendingView.need) : null), [page, deferredRoth, spendingView]);
  const spendingPick = useMemo(() => (page === 'spending' ? spendingChoice(deferredRoth.household, spendingView) : null), [page, deferredRoth, spendingView]);
  // The conversion over a lifetime (two projections, with and without it): its own page only.
  const conversionOverLife = useMemo(() => {
    if (page !== 'conversion' || deferredRoth.spending.need === null) return null;
    const hh = deferredRoth.household;
    return conversionLifetime(hh, deferredRoth.spending.need, hh.calculators.conversion.amount);
  }, [deferredRoth, page]);
  // The lifetime Roth vs. Pre-tax comparison (phase 6): only on the Roth page (two projections and
  // two sustainable-spending searches), a beat behind the inputs like the projection.
  const comparing = page === 'roth' && compareValues !== null;
  const changed = useMemo(() => (comparing ? previewResult(compareValues, CURRENT_YEAR, { blend: false }) : null), [comparing, compareValues]);
  const scenario = (r) => ({ inputs: householdToCompareInputs(r.household), result: r.result });
  // Who can contribute to what (the Roth page only).
  const notes = useMemo(() => (page === 'roth' ? contributionNotes(h) : []), [h, page]);
  // "Use in the plan" (the trial): switch the plan's Future Contributions to the other type.
  const choice = useMemo(() => (page === 'roth' ? contributionSwitch(values, h, roth.result) : null), [page, values, h, roth.result]);
  const lifetime = useMemo(() => {
    if (page !== 'roth' || !deferredRoth.result.valid) return null;
    const own = deferredRoth.household.calculators?.projection ?? {};
    return compareLifetime(deferredRoth.household, deferredRoth.result, {
      endAge: own.endAge,
      heirTaxRate: own.heirTaxRate,
      charityShare: deferredRoth.household.legacy?.charityShare ?? 0,
      strategy: strategyById(own.strategy),
    });
  }, [deferredRoth, page]);
  const tilesOf = (parts) => ({
    roth: rothTile(roth.result),
    tax: taxTile(parts.tax),
    projection: projectionTile(parts.projection),
    spending: spendingTile(parts.spending),
    conversion: conversionTile(parts.conversion),
    pension: pensionTile(parts.pension, pensionInputs),
  });
  const tiles = isHome(page) ? tilesOf({ tax, conversion, pension, projection, spending: spendingView }) : null;
  // For Copy summary: every calculator's headline, working out on demand what this page skipped.
  const summaryTiles = () => {
    const all = tilesOf({
      tax: tax ?? taxOf(h),
      conversion: conversion ?? conversionOf(h),
      pension: pension ?? (pensionInputs && pensionResult(pensionInputs)),
      projection: projection ?? projectionOf(roth),
      spending: spendingView ?? spendingOf(roth),
    });
    return CALCULATORS.map((c) => ({ title: c.title, ...all[c.id] }));
  };

  const formProps = { values, onUpdate: setValues, locked, onEditCopy: () => setLocked(false) };
  // Clear inputs, or Undo right after: on the Households card when signed in, else beside the inputs.
  const clearControl = beforeClear ? (
    <span className="clear-inputs">
      <span className="dim">Inputs cleared.</span>{' '}
      <button
        type="button"
        className="link-button"
        onClick={() => {
          setValues(beforeClear.values);
          setOpened(beforeClear.opened);
          setLocked(beforeClear.locked);
          setBeforeClear(null);
        }}
      >
        Undo
      </button>
    </span>
  ) : (
    <button
      type="button"
      className="link-button clear-inputs"
      onClick={() => {
        setBeforeClear({ values, opened, locked });
        setValues(BLANK_HOUSEHOLD_VALUES);
        setOpened(null);
        setLocked(false);
      }}
    >
      Clear inputs
    </button>
  );
  const ownClear = !cloud.session && clearControl;
  const share = !locked && <ShareHousehold values={values} household={h} getTiles={summaryTiles} />;
  const calculator = CALCULATORS.find((c) => c.id === page);
  // Saved households: the whole card (every client) on the dashboard and the inputs page, compact
  // (the household on screen only) on each calculator.
  const saved = (compact) =>
    cloud.session && (
      <SavedHouseholds
        client={cloud.client}
        values={values}
        opened={opened}
        compact={compact}
        onOpen={({ id, label, values: stored }) => {
          setBeforeClear(null);
          setValues(opening(stored));
          setLocked(false);
          setOpened({ id, label, values: stored });
        }}
        onSaved={setOpened}
        clearControl={clearControl}
      />
    );

  return (
    <div className="next-app">
      <AccountBar client={cloud.client} cloud={cloud} onSignedOut={() => setOpened(null)} />

      {page === 'inputs' && (
        <>
          <header className="page-header">
            <p className="header-links">
              <a href={HOME_HASH}>&larr; Dashboard</a>
            </p>
            <h1>Inputs</h1>
            <p>
              Every input in one place. Each calculator reads the ones it needs, and its own inputs card
              edits the same household.
            </p>
            <p className="header-links">
              <a href={docsHash('inputs')}>How the inputs work &rarr;</a>{' '}
              {ownClear}
            </p>
          </header>
          <main className="inputs-page">
            {saved(false)}
            <HouseholdInputs
              {...formProps}
              layout="page"
              title={null}
              groups={INPUT_GROUPS}
              defaultOpen={['household', 'income', 'contributions']}
              footer={share}
            />
            <nav className="card inputs-next" aria-label="Calculators">
              <h2>Open a calculator</h2>
              {CALCULATOR_GROUPS.map((g) => (
                <div key={g.id}>
                  <h3>{g.title}</h3>
                  <ul>
                    {CALCULATORS.filter((c) => c.group === g.id).map((c) => (
                      <li key={c.id}>
                        <a href={PAGES[c.id]}>{c.title}</a> <span className="dim">{c.blurb}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </main>
        </>
      )}

      {page === 'home' && (
        <>
          <header className="page-header">
            <h1>Dashboard</h1>
            <p>Set up the household&rsquo;s inputs once; every calculator reads them.</p>
            <p className="header-links">
              <a href={DOCS_HASH}>Docs &rarr;</a> How each calculator works and how to use it.
            </p>
          </header>
          <main className="calc-layout">
            <div className="inputs-column">
              <section className="card home-household" aria-labelledby="home-household-title">
                <div className="form-head">
                  <h2 id="home-household-title" className="form-title">
                    Inputs
                  </h2>
                  <div className="form-head-actions">
                    {ownClear}
                    <a className="link-button" href={PAGES.inputs}>
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
              {CALCULATOR_GROUPS.map((g) => (
                <section key={g.id} className="suite-group" aria-labelledby={`group-${g.id}`}>
                  <h2 id={`group-${g.id}`} className="suite-group-title">
                    {g.title} <span className="dim">{g.blurb}</span>
                  </h2>
                  <div className="suite-tiles">
                    {CALCULATORS.filter((c) => c.group === g.id).map((c) => (
                      <a key={c.id} className="card suite-tile" href={PAGES[c.id]}>
                        <span className="suite-tile-title">{c.title}</span>
                        <span className="suite-tile-headline">{tiles[c.id].headline}</span>
                        <span className="suite-tile-detail">{tiles[c.id].detail}</span>
                        <span className="suite-tile-blurb">{c.blurb}</span>
                        <span className="suite-tile-open">Open &rarr;</span>
                      </a>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </main>
        </>
      )}

      {calculator && (
        <>
          <header className="page-header">
            <p className="header-links">
              <a href={HOME_HASH}>&larr; Dashboard</a>
            </p>
            <h1>{calculator.title}</h1>
            <p>{calculator.blurb}</p>
            {calculator.article && (
              <p className="header-links">
                <a href={docsHash(calculator.article)}>How this calculator works &rarr;</a>
              </p>
            )}
            {calculator.id === 'roth' && Number.isFinite(roth.household.people[0].birthYear) && (
              <p className="header-links">
                RMDs start at {rmdStartAge(roth.household.people[0].birthYear)}.{' '}
                <a href={PAGES.projection}>See year-by-year taxes &rarr;</a>
              </p>
            )}
          </header>
          <main className={comparing ? 'calc-layout comparing' : `calc-layout with-bar${inputsHidden ? ' inputs-hidden' : ''}`}>
            {/* Hidden, not removed, so what is typed and which sections are open survive. */}
            <div className="inputs-column" id="calc-inputs" hidden={inputsHidden && !comparing}>
              {saved(true)}
              <div className={comparing ? 'input-columns' : undefined}>
                <HouseholdInputs
                  key={calculator.id}
                  {...formProps}
                  title={comparing ? 'Your inputs (baseline)' : calculator.ownTitle}
                  sections={CALCULATOR_INPUTS[calculator.id].sections}
                  fields={CALCULATOR_INPUTS[calculator.id].fields}
                  titles={CALCULATOR_INPUTS[calculator.id].titles}
                  defaultOpen={CALCULATOR_INPUTS[calculator.id].sections.slice(0, 1)}
                  headLink={
                    <a className="link-button" href={PAGES.inputs}>
                      All inputs
                    </a>
                  }
                  footer={share}
                />
                {comparing && (
                  <HouseholdInputs
                    key={`${calculator.id}-compare`}
                    values={compareValues}
                    onUpdate={setCompareValues}
                    baseValues={values}
                    title="With a change"
                    sections={CALCULATOR_INPUTS[calculator.id].sections}
                    fields={CALCULATOR_INPUTS[calculator.id].fields}
                    titles={CALCULATOR_INPUTS[calculator.id].titles}
                    defaultOpen={CALCULATOR_INPUTS[calculator.id].sections.slice(0, 1)}
                  />
                )}
              </div>
              {calculator.id === 'roth' && !comparing && !locked && (
                <ScenarioCompare baseline={scenario(roth)} current={null} onStart={() => setCompareValues(values)} />
              )}
            </div>
            {!comparing && (
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
            )}
            <div className="results-column">
              {calculator.id === 'roth' && (
                <>
                  {comparing && (
                    <ScenarioCompare
                      baseline={scenario(roth)}
                      current={scenario(changed)}
                      onReset={() => setCompareValues(values)}
                      onAdopt={() => {
                        setValues(compareValues);
                        setCompareValues(null);
                      }}
                      onStop={() => setCompareValues(null)}
                    />
                  )}
                  <ContributionNotes notes={notes} />
                  {!comparing && !locked && (
                    <UseInPlan choice={choice} onUse={() => setValues((v) => applyContributionSwitch(v, contributionSwitch(v, h, roth.result)))} />
                  )}
                  <ResultsSummary result={roth.result} showBlend disclaimer={false} />
                  <LifetimeComparison lifetime={lifetime} household={deferredRoth.household} result={deferredRoth.result} />
                  <RothDisclaimer dataYear={roth.result.dataYear} />
                </>
              )}
              {calculator.id === 'tax' && <TaxResult tax={tax} />}
              {calculator.id === 'spending' && (
                <RetirementSpendingResult
                  view={spendingView}
                  error={roth.spending.error}
                  choice={spendingPick}
                  tradeoff={tradeoff}
                  onUse={locked || !spendingPick ? undefined : () => setValues((v) => applySpendingChoice(v, spendingPick))}
                />
              )}
              {calculator.id === 'projection' && <ProjectionResult view={projection} error={roth.spending.error} />}
              {calculator.id === 'conversion' && <ConversionResult
                  conversion={conversion}
                  pretaxBalance={pretaxBalance}
                  lifetime={conversionOverLife}
                  lifetimeError={roth.spending.error}
                />}
              {calculator.id === 'pension' && (
                <PensionResult
                  pension={pension}
                  inputs={pensionInputs}
                  election={h.calculators.pension?.election}
                  onElect={
                    locked
                      ? undefined
                      : (election) =>
                          setValues((v) => {
                            const row = v.incomes.find((r) => r.type === 'pension' && activePeople(v).some((p) => p.id === r.owner));
                            return row ? updateRow(v, 'incomes', row.id, 'election', election) : v;
                          })
                  }
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
