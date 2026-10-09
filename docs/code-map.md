# Code map

Where things are, file by file. `CLAUDE.md` has the short version; read this when you need a specific file.

## Data (`src/data/`)
Year-keyed tables: `taxBrackets`, `capitalGainsBrackets`, `ficaRates` (incl. the SS wage base), `ssBendPoints`
(+ full retirement age by birth year), `contributionLimits` (catch-up 50+ and 60–63), `ageDeductions` (65+ and the
2025–2028 senior deduction), `irmaa`. Fixed by law: `ssTaxThresholds`, `niitRates`, `rmdTable`. Also `lifeTable.js`
(SSA period life table), `yearlyTables.js` (the annual-update registry), `scenarioBatches.js` (Visualization page data).
`getYearData` picks the latest year <= the one requested.

## Tax engine (`src/lib/`)
- `yearTax.js`: `calculateYearTax`, the ONE engine: every income source, payroll tax, SS taxability, ordinary +
  capital-gains brackets, NIIT, age deductions, marginal rates, bracket room; options `thresholdScale`, `rateShift`,
  `calendarYear`, `qbi`. `calculateYearTaxTotals` = the same without the marginal probes.
- Built from `taxCalculations`, `capitalGainsTax`, `ficaTax`, `socialSecurityTax`, `qbi.js` (QBI deduction, basic rule).
- `retirementTaxStack.js` (`calculateRetirementTax`, a thin wrapper over the engine); `yearTaxRows.js` and
  `taxBreakdown.js` (the calculation as rows); `childTaxCredit.js`, `dependents.js`; `rateProfile.js` (the tax page's
  two buckets); `iraRules.js` (Roth IRA limits, IRA deduction phase-out, Roth catch-up).
- QBI is on through `household.assumptions.qualifiedBusinessIncome` (version 2 households).

## Roth comparison (`src/lib/`)
`compare.js` (orchestrator, every number on the Roth page; optional inputs `earners`, `contributors`,
`retirementTaxRules`, `taxSavedAcrossContribution`, `skipBlend`), `sideAwareRates.js` (identity (X − e) × W = the exact
after-tax difference), `portfolioTax.js`, `blend.js`, `rateSteps.js`, `growthCalculations.js`, `contributionLimits.js`,
`socialSecurity.js`, `risingIncome.js`, `scenarios.js`; `formInputs.js`/`shareInputs.js` (old v1 values and links, still read).

## Household (`src/lib/`)
- Version 2: `householdValues.js` (form values: people, income/contribution/account/liability rows, linked
  age/birthdate; `cleanHouseholdValues` = the allow-list for saves and links), `householdV2.js` (`toHouseholdV2`: values
  → the household object the calculators read; a pension taken as a lump sum becomes `household.rollovers`),
  `householdUpgrade.js` (v1 → v2), `employerContributions.js`, `householdInputs.js` (inputs page sections and summaries;
  `CALCULATOR_INPUTS` = what each calculator reads). Saves are schema_version 2, links `?hh=2`; v1 opens converted.
- v1 pins: `tests/householdV1Pins.test.js` + `tests/fixtures/`.
- Older/shared: `household.js` (v1 values → household → compare inputs), `householdLink.js`, `householdText.js`,
  `savedHousehold.js`.

## Calculators (`src/lib/`)
`taxCalculator.js`, `conversionCalculator.js`, `pensionCalculator.js`, `irmaa.js`, `rmd.js`, `projection.js`
(`runProjection`: the year loop, strategy seam, `convertNow`), `strategies.js`, `projectionSummary.js` (sustainable
spending, `projectionView`), `spendingNeed.js` (the spending need every calculator reads: top-down or the budget),
`lifetimeComparison.js`, `conversionLifetime.js`, `suiteTiles.js`, `blockHeadlines.js`.

## UI
- `src/App.jsx`: the shell (hash routes from `src/lib/route.js`; NextApp always mounted; Docs and Visualization lazy;
  the feedback footer).
- `src/next/`: `NextApp.jsx` (Dashboard, inputs page, each calculator, computed only on its own page or the home tiles),
  `HouseholdInputs.jsx` (the v2 form), `Blocks.jsx` (results layout).
- `src/components/`: `ResultsSummary.jsx` (Roth page blocks), `fields.jsx`, `DocsPage.jsx`, `Feedback.jsx`, `charts/`.
- `src/services/`: Supabase. Docs articles: `articles/*.md`, listed in `src/lib/docs.js`.

## Backend
`supabase/migrations/` (saved households with forced RLS, an audit log, households open only through
`open_saved_household`), `supabase/tests/` (self-check SQL the user runs), `docs/backend-setup.md`, `docs/security.md`.

## Tests
`tests/` mirrors `src/lib`, plus `components.smoke.test.jsx`.

## How the model works (short; full detail in `docs/history.md` and `articles/`)
- Today: income tax + payroll tax; the marginal rate is read before any Pre-tax deduction. Retirement income number =
  take-home pay − costs that end − savings, × lifestyle.
- Roth vs. Pre-tax: same take-home cost both ways; over the IRS limit the excess goes to a taxable "side account"; the
  effective rate is the extra tax Future Contributions' own 4% withdrawal causes on top of Social Security + Existing
  Accounts + the side account; taxable withdrawals split pro-rata into basis and gain.
- Social Security: per person, estimated from earnings or from an entered PIA; the spousal top-up from both.
- Also: inflation on fixed thresholds, 65+ deductions, tax saved across the whole contribution, IRMAA (two-year
  lookback), RMDs, survivor years, a projection from today to the end age with strategies and conversions, sustainable
  spending, the lifetime comparison (headline = sustainable spending).
