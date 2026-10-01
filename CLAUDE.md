# CLAUDE.md — project notes for Claude Code

Living document. **Update it whenever behavior, decisions, data or workflow change**, and add a line to
the change log at the bottom. Read this first in a new session.

## What this is
Client-side React (Vite) calculator: does a Roth or Pre-tax (Traditional) contribution leave more
after-tax wealth? Bracket-aware, budget-driven ("top-down") model. No backend. Owner: Michael Sharpnack.
Plain-language explainer in `ARTICLE.md`: must match actual behavior (update it when behavior changes), and it
is **also the public "How this works" page** — see "Article page" below.

## Audience and direction (set by the user 2026-09-25)
- **Audience: internal tool for financial advisors**, not the general public. Advisor-level density and
  terminology are fine; showing more of the working (step-by-step math, side-by-side comparisons) is a feature.
  A pared-down public/consumer Roth-vs-Traditional calculator may be split off later as a separate thing.
- **Desktop-first.** Design for desktop widths. Phone should not break (no horizontal page scroll), but
  phone polish is not a goal unless the user asks; a separate mobile look may or may not come later. Don't let
  phone constraints limit a desktop layout (e.g. a wider page or a form-beside-results layout is fair game).
- **End goal: a suite of calculators** sharing one set of client inputs, with an "aggregate" page showing all
  calculators as blocks (inputs on that page; click a block to open that calculator and its outputs). This app
  is calculator #1. Implications for how we build now, without restructuring prematurely:
  - Keep ALL financial logic pure in `src/lib` (already true) so another calculator or the aggregate page can
    import it.
  - Keep one plain input object (`formInputs.js`: form strings -> `toCompareInputs`) as the shared shape; new
    inputs go there, not into component state.
  - Express explanations and outputs as data (e.g. `rateSteps.js` rows) rather than JSX-only, so the same
    numbers can feed comparisons, summaries and an aggregate page.
  - Don't build the multi-calculator shell (routing, shared input store, aggregate page) until a second
    calculator exists; note ideas here instead.
- **Roadmap** (set by the user 2026-09-29): the implementation plan lives in a Claude doc,
  https://claude.ai/artifact/WGnaEb88G1i2n26rsBeT45 (household model -> single-year tax engine `calculateYearTax` +
  tax calculator page -> RMDs -> year-by-year projection -> projection page -> lifetime Roth vs. Pre-tax -> withdrawal
  strategies). The Roth calculator is NOT rebuilt; it moves onto the shared tax engine. Two decisions recorded there:
  - **Inflation:** everything stays in today's dollars (real return, brackets/limits fixed because the law indexes
    them), but thresholds written as fixed dollar amounts (Social Security taxability, NIIT, Additional Medicare,
    the senior deduction if modeled) shrink each year at an inflation input, via `thresholdScale` in the engine.
  - **Two tiers:** the current Roth calculator stays open with no login; each calculator gets a simplified free
    version and, later, a signed-in version that saves client data. Both tiers share `src/lib` and the household
    shape (a simpler version fills unasked inputs with defaults); the free tier stores nothing on a server.
  - **App structure** (2026-09-29): a homepage with the shared inputs and a tile per calculator (headline number);
    each calculator on its own page with the current Roth layout (its own inputs, then the shared inputs, in the
    left column; report cards on the right), linking back home. Calculator-only inputs live in the household
    object under the calculator's name. The shell is built in phase 2 with the tax calculator.
  - **Tax engine income grouping** (2026-09-29): by tax treatment, not source — W-2 and 1099 per person;
    `ordinaryIncome` (Pre-tax withdrawals, Roth conversions, pensions: ordinary rates, no FICA, not NIIT);
    `investmentOrdinaryIncome` (interest, non-qualified dividends, short-term gains: ordinary rates + NIIT);
    `preferentialIncome` (long-term gains, qualified dividends); `socialSecurity`.
  - Open questions answered 2026-09-29 are ticked in the plan doc. (Superseded 2026-10-01: `result.old` and
    `#/old-vs-new` STAY for now; the user will say when to remove them.)
  - **Build alongside, then switch over** (user, 2026-10-01): the current calculator stays the default page and
    stays intact while the new implementation is built and tested. The new version lives on `main` behind a
    preview route **`#/next`** (one constant in `route.js`; sub-pages `#/next/...`), not linked from the current
    header/footer, with a "Preview, not finished" banner. New UI goes in `src/next/`; new math in `src/lib` (shared).
    Changes to existing shared lib functions must be ADDITIVE: new optional inputs whose defaults reproduce today's
    behavior exactly, so every existing test keeps passing unchanged (that is the guarantee the current calculator
    is untouched). The current calculator is NOT moved onto the household model / new tax engine until switchover;
    preview pages reuse existing result components rather than copying them. Switchover (when the user says): new
    homepage becomes the default, old calculator moves to `#/classic` briefly, then is deleted via a written
    checklist; old share links must still open (flat values -> one-person household). Netlify branch deploys
    were considered and rejected (long-lived branch drift over shared lib files; extra push step).
  - **Further ideas placed in the plan doc** (2026-10-01; all apply to the NEW version only, per the rule above):
    phase 1 — share links get a view-only flag ("Edit a copy"); phase 2 — "tax saved now" measured incrementally
    across the whole contribution (see Known limitations), a tax-law override on the engine (off by default), a
    "fill up the bracket" bar on the tax page, a feedback link on every page (Netlify Forms; confirm before
    sending data outward; needed before any free version goes public); any time after phase 2 — a single-year
    Roth conversion calculator and a pension IRR calculator; phase 4 open question (decide before it starts) —
    start the projection today so the phase 5 page is the pre-retirement planner (funded status, over/underfunded);
    phase 6 — recommended headline "sustainable spending" (one measure, not a blend of lifetime tax / longevity /
    ending wealth) plus a break-even tax-change report. Future features: print stylesheet, designed PDF report,
    named saved scenarios, a bottom-up budget calculator feeding household spending.
- **Exposure check:** the GitHub repo is public and the Netlify site is open to anyone with the link, and
  ARTICLE.md is written as a public page. Fine for now; raise it with the user before adding anything
  proprietary or client-specific (e.g. make the repo private / add Netlify password protection).

## Commands
```
npm run dev       # dev server (occupies the terminal; Ctrl+C to stop, or use a second tab)
npm test          # vitest: calc layer + component smoke tests (510 tests at last count)
npm run build     # static site -> dist/   (vite base './', works from any URL/sub-path)
```

## Ground rules (how we work)
1. **Order:** data + pure functions in `src/lib` first → unit tests with **hand-verified** arithmetic → only
   then UI. Never build UI ahead of validated math.
2. Hand-verified tests carry their arithmetic in comments and are derived by hand *before* running code.
   When the code disagrees with the hand math, find out which is wrong; don't just adjust the test.
3. All financial logic is pure and framework-free in `src/lib/`. Data is year-keyed in `src/data/`
   (adding a year = copy an object). `getYearData` picks the latest year <= requested.
4. Tests for older hand calcs pass an explicit `year: 2025`; the app itself uses the current calendar year.
5. Don't publish/push anything outward without the user's say-so. Report failures and skipped steps plainly.

## Deployment / git
- Repo: https://github.com/Sharptack/roth-vs-traditional-app (**public**). Branch `main`.
- Live: https://astonishing-sprite-b5d581.netlify.app/ — Netlify auto-deploys on push to `main`
  (`netlify.toml`: `npm run build`, publish `dist`, Node 22). Site access was opened to "anyone with the link".
- **Claude can commit but cannot push** (no GitHub credentials in Claude's shell). The user pushes with
  VS Code Source Control → **Sync Changes**. Always tell them when there are unpushed commits.
- Git identity is repo-local: Michael Sharpnack <sharpnackm7@gmail.com>. End commit messages with the
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` line.
- Machine gotchas: Intel Mac (Homebrew unsupported; `brew install gh` fails); no `gh`; system python
  shim was blocked until the Xcode license was accepted (now fine); use `node -e` for scripted edits.

## Code map
- `src/data/`: `taxBrackets.js` (2025, 2026), `capitalGainsBrackets.js` (0%/15%/20% LTCG brackets),
  `ficaRates.js` (also owns the SS wage base), `niitRates.js` (NIIT rate + MAGI thresholds),
  `ssBendPoints.js` (+ FRA table by birth year), `ssTaxThresholds.js` (fixed by law), `contributionLimits.js`.
- `src/lib/`: `taxCalculations` (progressive tax, marginal rate; accepts above-the-line adjustments), `contributionLimits`
  (`checkContributionLimit` = the UI warning; `splitAtContributionLimit` = caps a contribution at the IRS
  limit and returns the excess; both take an optional `age` for catch-up contributions; shared `getLimit`
  lookup so the two never disagree), `capitalGainsTax` (`calculateCapitalGainsTax`: real 0%/15%/20% brackets, gains stacked on top of ordinary income — see the model section below; also `calculateNiit`), `ficaTax` (`calculateEmploymentTaxes`: FICA + 1099 self-employment tax; `calculateFica` = W-2 only), `socialSecurityTax`
  (IRS combined-income formula), `socialSecurity` (simplified benefit estimator), `retirementTaxStack`
  (shared tax on a retirement income stack), `solver` (monotonic binary search, used by `portfolioTax`),
  `sideAwareRates` (`calculateSideAwareRates`: the Section 2 rate comparison — see the model section below;
  `incomeNeed.js`, the older single-account gross-up solver this replaced, was deleted 2026-09-28), `taxBreakdown`
  (`explainFullTax`: bracket-by-bracket decomposition of a `sideAwareRates` stack, for the "Show the full tax
  calculation" dropdown — reads the same data files as `retirementTaxStack.js` so the two can't drift),
  `portfolioTax` (scale-factor solver across buckets; a different, unaffected question — see its model section), `growthCalculations`,
  `contributionLimits`, `compare` (orchestrator; single source of every UI number), `constants`
  (`WITHDRAWAL_RATE` 4%, `LTCG_RATE` 15%, 90% limit threshold), `format`, `formInputs`, `yearLookup`,
  `shareInputs` (form values <-> link query string, plain-text scenario summary — see "Sharing a scenario"), `scenarios` (runs `src/data/scenarioBatches.js` through `compare.js` for the scenarios page — see below),
  `chartScale` (linear scale + nice-tick axis helper, framework-free),
  `blend` (`splitBlended`, `evaluateBlend`, `findOptimalBlend` — the Roth/Pre-tax split explorer, see its
  own section below), `risingIncome` (`compareWithRisingIncome`: Roth vs. Pre-tax for the contributions made while
  income is low, when it rises later — the Visualization page's "Earning more later" charts; see that section).
  `compare.js` exports `winnerOf` (the 0.5% "even" rule) so risingIncome.js reuses it.
  `household.js` (the household model: `toHousehold`, `validateHousehold`, `householdToCompareInputs`; preview only so
  far, see "Phase 1: household model"). `src/next/`: the `#/next` preview pages (`NextApp.jsx`, `SpouseInputs.jsx`).
- `rateSteps.js`: `sideAwareRateSteps`, the "How are these rates calculated?" walk-through as data rows (three
  steps: Existing Accounts' income -> the taxable-account difference -> add Future Contributions' own
  withdrawal — see the model section below), rendered by the dropdown (`StepRow` in ResultsSummary) AND by the
  scenario comparison — one source for both. `scenarioCompare.js`: `changedInputs`, `headlineRows`,
  `alignRows` (line up two row lists by key, deltas), `compareScenarios`. `format.js` also has
  `formatValue`/`formatDelta` (rates change in "pts").
- `src/data/scenarioBatches.js`: the hand-picked scenario batches charted on the scenarios page (income,
  savings-rate, balance, age-50, and lifestyle sweeps) — plain data, no compare.js calls.
- `src/lib/sectionSummaries.js`: `INPUT_SECTIONS` (the input sections: id, title, the form keys each holds, a one-line
  `summary(values)`), `sectionChanged`, `resultHeadlines(result)` (the headline on each results card header). See "Calculator layout".
- `src/components/`: `InputForm.jsx`, `ResultsSummary.jsx`, `Collapsible.jsx` (the open/close section used by both), `ArticlePage.jsx` (renders ARTICLE.md),
  `ScenariosPage.jsx` (the scenario charts — see below), `charts/LineChart.jsx`, `charts/Heatmap.jsx`,
  `charts/palette.js` (fixed categorical color + shape order, assigned by series identity). `src/lib/route.js`:
  hash routing helper. `src/App.jsx` holds state and the "Future enhancements" comment block. `tests/`
  mirrors `src/lib` plus `components.smoke.test.jsx`.

## Phase 1: household model, in the `#/next` preview (started 2026-10-01)
Progress against the plan doc's phase 1 steps. Everything here is additive: the current calculator still reads its
flat form values (`toCompareInputs`) and never goes through the household; every pre-existing test passed unchanged.
- **Done:** `src/lib/household.js`: `toHousehold(values, year)` (form strings -> household, shape documented at the top of
  the file; `version: 1`, `people` with `birthYear`, `accounts` list with owner/type/balance/`basisShare`),
  `validateHousehold` (structure + the spouse's fields; person 1 is still validated by compare.js with today's messages),
  `householdToCompareInputs` (the adapter; named so it doesn't clash with formInputs' `toCompareInputs`). One person
  round-trips to exactly the flat inputs and the identical compare.js result (tested over 8 form variants, incl. invalid).
  Snapshot timing: retirement = the FIRST person to retire; `currentAge` = Future Contributions' owner's age (sets the
  catch-up limit). Spouse form fields (`SPOUSE_DEFAULT_VALUES`: includeSpouse, spouseAge, spouseRetirementAge,
  spouseIncome, spouseIncomeType w2/1099, spouseKnowsSocialSecurity, spouseSocialSecurityBenefit) are deliberately NOT
  in `DEFAULT_FORM_VALUES` (would change the current form/share links); `PREVIEW_DEFAULT_VALUES` merges them.
- **Done:** per-person payroll tax, `calculateHouseholdEmploymentTaxes` (ficaTax.js): own wage base and SE tax per person,
  Additional Medicare on combined wages + net SE earnings. Per-person Social Security,
  `estimateHouseholdSocialSecurity` + `spousalAdjustmentFactor` (socialSecurity.js): own benefit plus the excess of 50% of
  the other's PIA over own PIA, reduced 25/36% a month (36 months) then 5/12% (source: SSA POMS RS 00615.201, via search
  excerpt; ssa.gov blocks the fetcher), no delayed credits on it, starting at the later of own claim and the other's
  claim. Simplifications: an entered (known) benefit is used as is and gives the other spouse no spousal top-up (its PIA
  is unknown); steady-state amount once both claim; no survivor benefit. Both functions equal the single-earner functions
  for one person (tested). Hand-verified tests: `tests/household.test.js`.
- **Done:** `compare.js` optional input `earners` (absent = today's path): per-person payroll tax and Social Security.
  `householdToCompareInputs` sets it only for two people. Result shapes are unchanged (`current.fica` gains `people`;
  `socialSecurity` has `annualBenefit`, `estimated`, `people`), so ResultsSummary needed no change.
- **Done:** preview route `#/next` (`NEXT_HASH` in route.js; `#/next/...` also routes there), `src/next/NextApp.jsx`
  ("Preview, not finished" banner, link back to `#/`, the existing InputForm + ResultsSummary, own state) and
  `src/next/SpouseInputs.jsx` (shown only for married filing jointly; "Enter your spouse separately?"). InputForm now
  also exports its field helpers (`AgeInput`, `CurrencyInput`, `RadioGroup`, `SelectInput`). `previewResult` in
  NextApp.jsx is the testable calculation. Not linked from the current pages (smoke test checks).
- **Not done yet (phase 1):** contribution limits per person beyond the owner's age (Future Contributions are still one
  entry with one owner; the plan says each spouse can have their own); claiming age as its own input (`claimAge: null` =
  retirement age); the form as the shared-inputs component with an accounts LIST (owner + type) instead of three
  balances; the main form's labels still say "your" income when a spouse is entered (the spouse card's hint explains);
  versioned share links + view-only flag; ARTICLE.md is unchanged because the public calculator's behavior is unchanged.

## Article page ("How this works")
- `ARTICLE.md` is the single source of truth: `ArticlePage.jsx` imports it with Vite's `?raw` and renders it with
  the `marked` library, so editing the file updates the site. No second copy exists.
- Route: hash-based (`#/how-it-works`; anything else = calculator) — works on any static host with no rewrite
  rules. `App.jsx` keeps the calculator mounted but `hidden` while the article is open, so inputs, open
  dropdowns and scroll position survive the round trip (verified in headless Chrome).
- Links from the app: header ("How this works →") and footer; the article has "← Back to the calculator" at
  the top and bottom. The page title switches while the article is open.
- Because it is public, the article must not mention UI section numbers ("Section 3") or renamed labels; smoke
  tests fail on "Section N", "Simple view" and the old dropdown title. Keep the two effective rates named as in
  the app.

## Scenario charts ("Visualization" page, added 2026-09-22; renamed 2026-09-25)
- Route: `#/scenarios`, same hidden/mounted pattern as the article (`App.jsx`'s `useRoute`, generalized to
  "anything other than calculator" leaves/scroll-restores). Linked from the header and footer next to
  "How this works".
- What it's for: shows who comes out ahead, and why, across hand-picked scenarios. Page title "Visualization: who
  comes out ahead, and why" (was "...: does the rate gap predict the winner?" until 2026-09-29). Originally built to
  test whether the **rate gap** (`rates.taxSavedNow − rates.effectiveRetirement`) predicts the winner, a real
  question under the old model, where the two could disagree. Since the 2026-09-28 migration, `gap * W` IS the
  dollar difference (an identity), so the winner is just the sign of the gap: the intro callout now states that
  as exact, and the gap-vs-advantage scatter and its OLS trend line were REMOVED 2026-09-29 as circular (under the
  limit, advantagePct = −gap / (1 − e) × 100 exactly, checked on all 431 such points; the winner differed from the
  gap's sign on only 5 of 545 points, the "even" bands). Don't bring back a "does X predict the winner" chart
  whose X is computed from the same numbers as the winner.
- Data flow: `src/data/scenarioBatches.js` (plain data: a `base` input object per batch + one or more
  `series`, each a list of `{x, overrides}` points) → `src/lib/scenarios.js`'s `runAllBatches` merges
  `base + overrides` and calls `compareRothVsTraditional` per point, extracting `gap` and `advantagePct`
  (Roth's after-tax annuity withdrawal vs. Pre-tax's, as a % — the Section-2, Future-Contributions-only lens) →
  `ScenariosPage.jsx` renders one `LineChart` per batch (x = the swept variable, y = advantagePct).
  No new financial logic: `scenarios.js` only merges inputs and reads fields already on `compare.js`'s result.
- The nine batches (single filer, W-2 only, no self-employment income, 0 debt/other-expenses, 7% return,
  estimated Social Security, 401(k); the IRS limit DOES bind at higher incomes/savings rates — 114 of 467 points in 2026 — and the excess goes to a taxable account under the current model, so advantagePct includes that taxable side): income sweep
  at a fixed 10% savings rate (age 35→65, 14 incomes from $25k to $500k); the same income sweep at 5%/10%/20%/30% savings
  rates; the same income sweep with an existing Pre-tax balance of $0/$20k/$100k/$250k/$500k; the same income
  sweep at age 50→65 with a balance of $0/$100k/$500k/$1M; an age-50 savings-rate sweep (5/10/20/30% saved, $500k existing Pre-tax balance, 401(k) limit $32,500 with catch-up); and a lifestyle sweep (1×→2× in 0.1 steps, i.e. "spending
  20/40/60/80/100% more in retirement") at incomes $25k/$50k/$75k/$150k/$500k; and a retirement-age sweep (55-70, age 35, 10% saved, incomes $25k/$50k/$100k/$150k/$500k; flat before 62 because Social Security is estimated as if claimed at 62 for earlier retirees; the 59½ early-withdrawal penalty is not modeled). Extending or adding a batch
  is a data-only change in `scenarioBatches.js` — no chart code changes needed.
- Charts are hand-rolled inline SVG (`src/components/charts/`), not a charting library — the app has no chart
  dependency, and these are simple line charts and heatmaps. `LineChart` is generic (series/points in, chart
  out); `chartScale.js` (linear scale + "nice" tick axis rounding) is hand-verified in tests. Category colors
  are assigned by fixed order (`charts/palette.js`, CSS vars `--series-1..5` in `App.css`, light/dark), never by rank.
  (`ScatterChart.jsx`, `regression.js` and their tests were deleted with the scatter on 2026-09-29.)
  Every chart has a hover/focus tooltip and a "Show the numbers" `<details>` table underneath as the
  non-interactive fallback.

- **"Earning more later" charts** (added 2026-09-29, at the user's request: "someone making $20k today who expects
  $100k later"). Two batches, `risingIncomeSweep` (today $20k/$40k/$60k, x = income from 35) and
  `risingIncomeLaterType` ($20k today; later savings all Pre-tax / half / all Roth), placed after the lifestyle chart.
  They carry `engine: 'risingIncome'`, so `scenarios.js` runs them through `lib/risingIncome.js`
  (`runRisingIncomePoint`) instead of compare.js; same point shape, so the page and tables need no changes.
  Why a new function: the retirement lifestyle multiplier can't show this — since the 2026-09-28 migration it no
  longer moves the rate comparison at all, and the "Spending more in retirement" chart is now FLAT lines (checked
  2026-09-29). The user chose to KEEP it, retitled "Spending more in retirement, on its own, changes nothing",
  with a caption saying the flatness is the point: Roth vs. Pre-tax depends on retirement taxable income, not the
  spending target. The same framing is in ARTICLE.md ("If you expect to spend more, or less, in retirement"). What higher future income really
  changes is the retirement tax stack. The model: age 25, income rises at 35, retire 65, 10% saved throughout.
  The decision = the contributions of the 10 years at today's income (today's marginal rate, splitAtTakeHome, grown
  10 years then 30 more). The later years' savings (10% of the later income, capped at the IRS limit at the raise
  age, excess to a taxable account, all basis) sit UNDER them in the stack like an Existing Account. Social Security:
  AIME from the average of each working year's earnings (each capped at the wage base). Then
  `calculateSideAwareRates`, so the gap x W identity still holds (tested). Findings: with later savings Pre-tax, Roth
  wins for the early contributions once later income passes about $40k at $20k today, tracking the retirement
  bracket of the top slice (+15.4% = 22% later vs. 10% now, +18.4% = 24%), with spikes in the Social Security
  phase-in band (half-and-half at $200k: +40%, 22% x 1.85); with later savings Roth, Pre-tax wins (-10%, the 10%
  rate now vs. 0% later) all the way to $250k. Note the stacking order: the early slice is measured ON TOP of the
  later savings (the incremental view used everywhere), so even with no raise these points differ from the
  calculator's flat-income answer, and the card says so. Tests: `tests/risingIncome.test.js` (two hand-verified
  cases, reproduces compare.js exactly when the raise is at retirement, the identity), two wiring tests in
  scenarios.test.js. Not modeled: the later contributions' own Roth/Pre-tax decision is an input, not optimized.
- Page layout (2026-09-25k, simplified at the user's request — no repeated explanations, "let the graphs speak"):
  the rule (gap > 0 -> Pre-tax, < 0 -> Roth; exact, not a rule of thumb) appears ONCE, as a highlighted callout in the intro; every batch card is a title, one sentence of
  setup, and ONE line chart of Roth's advantage (`advantagePct`), with the area above the zero line tinted blue and
  labelled "▲ Roth comes out ahead" and the area below tinted orange, "▼ Pre-tax comes out ahead" (`LineChart`
  `zones` prop). Roth = blue / Pre-tax = orange everywhere the winner is shown (zones, heatmaps). The rate gap
  for the same points is in each card's "Show the numbers" (ONE table: the advantage the chart plots; the rate gap is shown once, in "What the rate gap is made of"). The income-sweep card is
  followed by "What the rate gap is made of" (marginal-now and effective-in-retirement as two lines). After the batches:
  two break-even maps (`charts/Heatmap.jsx`; `HEATMAPS` in scenarioBatches.js, run by `runHeatmap`: income across, then
  savings rate 5-30% or existing Pre-tax balance $0-$2M down; `*` = over the IRS limit, from `overLimit`). The page ends there.
- Where Roth wins (found by scanning the engine 2026-09-25): a large existing Pre-tax balance (forced taxable withdrawals;
  +7% to +35% at $100k-$1M+ balances, still +3-7% at $300k income with $1M+), a large existing taxable balance at lower
  incomes (+14-26% at $500k-$1M and $40k-$60k income), married filing jointly with balances (found in the scan; no longer charted — the MFJ chart was removed 2026-09-26), big lifestyle increases at
  $50k-$60k (2x), retiring at 70 at $150k, and 20-30% savings at $175k-$200k (the excess in a taxable account). Age at
  contribution start does NOT matter (both sides scale with the same growth). Existing Roth balances do not help Roth.
  The batches for these: `pretaxBalanceSweep`, `taxableBalanceSweep`. The age-50 finding: the same $500k existing balance gives Roth +3-9% at 35 but is about even at 50 (only 15 years to grow, so fewer forced taxable withdrawals) — the reason for `age50SavingsSweep`. `BASE` uses
  `otherTaxableBasis: 0.5` (the form default).
- For screenshots of this long page, headless Chrome's `--screenshot` garbles pages taller than ~8000px; slice with the
  DevTools protocol instead (`Page.captureScreenshot` with a `clip`, `captureBeyondViewport`).

## Calculator layout (2026-09-25m, at the user's request: "more easily navigable")
- Desktop: two columns (`.calc-layout`, page `.calc-page` max 1280px): inputs on the left (420px, sticky, scrolls on its
  own), results on the right. Below 900px everything stacks. The article and Visualization pages keep the 760px width.
- Inputs: one "Inputs" card holding a LIST of collapsible sections (`INPUT_SECTIONS`: About you, Costs that end before
  retirement, Future Contributions, Social Security, Existing Accounts, Assumptions — Assumptions was a `<details>`
  before). Each closed header shows a one-line summary of its values, so every input can be read at a glance; only
  "About you" starts open; "Expand all / Collapse all" in the card head. In compare mode a section whose inputs differ
  gets a "changed" pill. "Clear all" (main form only, card head): every dollar field to $0, ages blank, choices
  back to defaults (`CLEARED_FORM_VALUES` in formInputs.js); it becomes "Undo clear" until the next edit (`App.jsx`
  `beforeClear`). The inner dropdowns ("Will you earn more or less later?", cost basis) are unchanged.
- Results: five cards (Retirement income number, **Your portfolio at retirement** (added 2026-09-28, see its own
  section below), **Tax rate comparison**, **After-tax comparison**, Total future portfolio comparison ("Total portfolio tax comparison" until 2026-09-30); the middle two
  of the original four were "Roth vs. Traditional" and "The trade-off in dollars" until 2026-09-26 (n) — the user
  asked for names that say what they are; the tax rate card carries a subtle accent bar, `key-card`, as the number
  that matters most) are `Collapsible` cards; the header shows the headline (`resultHeadlines`) while closed; all start
  open; "Collapse all results" above them. Heading ids `sec1`, `sec-portfolio`, `sec2`, `sec-tradeoff`, `sec3` are kept.
- `Collapsible` hides a closed body (`hidden`), never unmounts it, so typed values and open dropdowns survive. Section
  bodies in InputForm are built by a `section(id, content)` function call, NOT an inner component (an inner component
  would remount every render and lose input state).

## "Your portfolio at retirement" card (added 2026-09-28; revives a 2026-09-25 REJECTED idea)
Sits between "Retirement income number" (`sec1`) and "Tax rate comparison" (`sec2`) — `id="sec-portfolio"`,
card id `buildup`, component `PortfolioBuildup` in ResultsSummary.jsx. The user asked for it explicitly, aware
of the earlier rejection ("we had something like this before, but it fits better now, I think, with the new
expandable blocks") — the difference from the 2026-09-25 version: that one was either a standalone card ABOVE
the retirement number (competing with it for attention) or merged INTO the trade-off table (muddying a table
that was about something else); this one is its own collapsible card, positioned to set up the very next card
(the rate comparison) rather than compete with anything, and closes as easily as it opens. If it starts
muddying things again, that's the difference to revisit first.
- No new pure functions or hand-verified tests were needed — every number was already on `result` and already
  tested elsewhere; this is a different VIEW of `contributionSplit`/`contribution`, `grown`, `annuity.{roth,pretax}.{futureValue,side.futureValue,totalFutureValue}`
  and `portfolio.{roth,pretax}.{buckets,totalValue}`, reused as-is.
- Content, top to bottom: an opening note ("Why this matters") that Pre-tax contributes more for the same
  take-home pay and names the exact dollar gap (`contribution.pretax - contribution.roth`, always >= 0 since
  P = R/(1-t)) — a "there's nothing saved yet" variant when that gap is ~$0 (`hasContribution` guard, mirrors
  how the rates card handles `$0` saved, though this card's own numbers never crash or need an availability
  check, unlike `sideAware`). Then a `compare-table tradeoff-table`-styled grouped table (reuses the trade-off
  table's CSS classes as-is, so no new styles were needed): "Your contribution this year" (to the account, to a
  taxable account when `contributionSplit.X.excessToTaxable > 0.5`, total); "Existing Accounts, grown to
  retirement" (Pre-tax/Roth/Taxable from `grown`, identical in both columns since Existing Accounts don't
  depend on the Roth/Traditional choice — shown in both columns anyway for visual consistency with the rest of
  the page, not because they differ); "Future Contributions, grown to retirement" (Pre-tax/Roth/Taxable, this
  time genuinely different per column: the Roth scenario's contribution is 100% in the Roth bucket plus its own
  taxable side, the Pre-tax scenario's is 100% Pre-tax plus its own taxable side); then a bold "Total portfolio
  at retirement" row using `BucketBreakdown` (the same small component Section 3's "Total future portfolio
  value" row already uses) — deliberately NOT `win`-highlighted, since a bigger total isn't a verdict (it's the
  Pre-tax side's un-taxed money, which is exactly the tension the rest of the app resolves). A "How is this
  calculated?" dropdown closes it, ending with the explicit hand-off line the user asked for: the total above
  is a starting point, and the tax rate comparison next measures the rate on withdrawing from Future
  Contributions **stacked on top of** whatever Existing Accounts (and Social Security) already draw — never a
  flat rate on the total. (Watch the literal substring "contribution limit" in this dropdown's copy: the
  existing "shows the contribution-limit warning only at/near the limit" smoke test asserts that phrase is
  ABSENT under the limit, so this card's prose says "over the IRS limit," not "over the IRS contribution
  limit.")
- `resultHeadlines` gained a `buildup` key (`"$X Roth vs. $Y Pre-tax at retirement"`, from `portfolio.X.totalValue`);
  the unused `ratesNew` key (dead since the 2026-09-28 rates migration removed the card that read it) was
  removed in the same pass.

## "Compare a change" (added 2026-09-25; reworked same day)
- Reworked at the user's request: they disliked editing the existing inputs to make a comparison. Now
  "Compare a change" (button under the main form, `ScenarioCompare.jsx`) opens a SECOND full `InputForm`
  beside the main one ("Your inputs (baseline)" left, "With a change" right; `App.jsx` `compareValues` state, a
  copy of the main values, memory only). The main form is never touched; it is the baseline. While comparing, the
  two forms go across the top (the inputs column stops being sticky), the compare card and results below; the forms
  stack below 900px. Both forms share one set of open sections (`App.jsx` `openInputs`), so they stay lined up. Fields in the second form that
  differ from the main form are highlighted (`changed` class); any number of them may change at once.
  `InputForm` gained optional `title`, `baseValues` (enables the highlight) and `namePrefix` (keeps the two
  forms' radio groups separate).
- Below the two forms the compare card shows: "What changed" (auto-detected), a headline table (retirement
  number, SS, both rates, lean, contributions, after-tax income, winner) with Baseline / With your change /
  Change, and, open by default, "How the rates are calculated, side by side" (the `sideAwareRateSteps` three
  steps, each side with its own arithmetic — the old "What sets the rate" narrative facts were removed along
  with the rest of `rateDrivers` in the 2026-09-28 migration). Buttons: "Reset changes" (re-copy the main inputs),
  "Use these as my inputs" (second form becomes the main form, comparison closes), "Stop comparing".
- Possible next steps (not built): also compare the retirement-number walk and the portfolio section; remember
  the comparison across reloads; named/saved scenarios (would need storage — see the backend future item).

## Sharing a scenario (added 2026-09-25)
- "Copy inputs to share" button (`ShareInputs.jsx`, at the very bottom of the MAIN inputs card, below Assumptions, via `InputForm`'s `footer` prop; the user wanted it apart from Compare a change) copies plain text:
  every input (labelled, via `scenarioCompare.describeInputs`), the headline results (`headlineRows`), and a
  link. When comparing, it adds the changed inputs and the changed side's results. Falls back to a textarea if
  the clipboard is blocked. Meant for pasting a scenario into a conversation with Claude.
- The link carries every form value in the query string (`?grossIncome=…`; the compare side as `c.<key>`).
  `App.jsx` reads it once on load (`valuesFromSearch`; missing keys = defaults, unknown keys ignored). The URL
  is not rewritten as you type. Query string, not hash, so it coexists with the hash routes.
- For Claude: to reproduce a pasted scenario, turn the link's query into form values with
  `valuesFromSearch`, then `toCompareInputs` + `compareRothVsTraditional` (e.g. in a `node -e`/vitest snippet).

## Taxable-account cost basis (2026-09-25d)
- A taxable withdrawal is split pro-rata into cost basis (tax-free, NOT in SS combined income) and gain (LTCG
  brackets, IS in combined income). `calculateRetirementTax` takes `taxableGainShare` (default 1 = all gain,
  the old behavior) and returns `capitalGains`; `sideAwareRates.js`'s `calculateSideAwareRates` derives it per
  stack from `other.taxableGains`/`other.taxableGross` plus each side account's own gains; `solvePortfolioWithdrawal`
  takes `{ taxableGainShare }` and returns `taxableGains`.
- Existing taxable accounts: input `otherTaxableBasis` (share of TODAY'S balance; form default '0.5', options
  0/25/50/75/100% in a select inside a collapsed `<details>` ("Cost basis of those taxable accounts: 50%") under the taxable balance, shown only when that balance > 0; the summary is highlighted when it differs in Compare a change; lib default 0 = all
  gain so older callers/tests are unchanged). Growth to retirement is all gain: gain share = 1 − basis$ / grown
  balance (`otherWithdrawals.taxableGains`, `taxableGainShare`).
- Taxable side of Future Contributions: every contributed dollar is basis (excess × years); `annuity.X.side`
  has `basis`, `gainShare`, `gains`. Section 3 taxable bucket gain share = 1 − (existing basis + side basis)
  / bucket. Simplifications: first-year pro-rata split (no lot selection, basis share held for the year), and the
  single-contribution lump sum's side uses the annuity side's rate.

## The model (as built)
1. Current tax: income tax on (gross − half of any self-employment tax − **Pre-tax savings, if
   `currentType` is pretax, capped at the IRS limit** − standard deduction) + payroll tax (Pre-tax savings do
   NOT reduce FICA). The **marginal rate is read BEFORE the Pre-tax deduction** (the rate on the top dollars of
   pay, i.e. what a Pre-tax contribution saves and a Roth one pays), so it is the same whichever way the
   savings are held today. `breakdown` carries `pretaxDeduction`, `standardDeduction`, `taxableIncome`,
   `incomeTaxWithoutPretaxDeduction` for the Section 1 dropdown's "Step 1: federal income tax". Then:
   **FICA** on the W-2 part, **self-employment tax** on the 1099 part (12.4% + 2.9% on 92.35% of net
   earnings; SS part limited by wage-base room left by W-2 wages; none under $400; Additional Medicare on
   the combined total). Marginal rate = rate of the bracket the next dollar falls in (0% if below the
   standard deduction). Input: `selfEmploymentIncome` = the 1099 part of gross (net earnings).
2. Retirement income number (after-tax need) = gross − income tax − FICA − debt payments ending −
   other expenses ending − retirement savings (as entered). Floored at 0. Payroll tax is subtracted because
   it stops at retirement. Then × `retirementLifestyle` (default 1; UI offers 0.6–2): a single multiplier
   for people who expect to spend more/less in retirement (e.g. rising earnings). Since the 2026-09-28
   migration, `retirementLifestyle` affects ONLY this need and Section 3's portfolio solve (which scales its
   withdrawals to hit whatever the need is) — it does NOT move Section 2's rate comparison at all, because
   `sideAwareRates.js` measures the rate on Future Contributions' own natural 4% withdrawal, a fixed dollar
   amount that has nothing to do with the need. (Under the pre-2026-09-28 model, a higher lifestyle could
   raise a need-scaled withdrawal into a higher bracket and tip Section 2 toward Roth; that mechanism no
   longer exists.)
3. Social Security: user-entered benefit, or a simplified estimate (AIME = income capped at wage base / 12,
   bend-point PIA, claiming age = retirement age clamped to 62–70, FRA from birth year = year − age).
4. Other balances grow at the chosen return to retirement; 4% of each is withdrawn. Pre-tax = ordinary
   income; Roth = tax-free; taxable = treated as long-term capital gain, taxed via the REAL 0%/15%/20%
   LTCG brackets (capitalGainsTax.js), stacked ON TOP of ordinary taxable income (grossOrdinaryIncome =
   pretax withdrawal + taxable SS; unused standard-deduction room shelters gains too — see the function's
   doc comment for the derivation). Counts toward SS "other income". NOT a flat rate: a modest-income
   retiree can pay 0% on some or all of a taxable-account withdrawal, and a bigger Pre-tax withdrawal can
   push a FIXED taxable-account withdrawal into a higher LTCG bracket (a real, correct cross-account
   effect — see retirementTaxStack.test.js for a clean, isolated, hand-verified example). **NIIT** (added 2026-09-25h): 3.8% × min(gains, MAGI − $200k Single /
   $250k MFJ); MAGI = Pre-tax withdrawals + taxable SS + gains (Roth and returned basis excluded).
   `calculateRetirementTax` returns `magi` and `niit` and includes it in `totalTax`, so every rate, the
   side account and Section 3 pick it up. Cross-account effect like the LTCG push: Pre-tax withdrawals are
   not investment income but raise MAGI, exposing more gains to NIIT (visible in the "Show the full tax
   calculation" breakdown's before/after NIIT rows, `taxBreakdown.js`). Retirement only: the model has no
   investment income during working years.
5. **Effective rate on the account withdrawal** (`rates.effectiveRetirement`; `sideAwareRates.js`'s
   `calculateSideAwareRates`, the SOLE rate calculation since the 2026-09-28 migration — see "The rates
   calculation" below for the full derivation, the formula, and how it replaced the old need-based
   `incomeNeed.js` gross-up, now deleted). In brief: W = Future Contributions' own natural 4% withdrawal
   (never a need-scaled or hypothetical amount); the rate is the extra tax W causes stacked on top of
   Social Security + Existing Accounts + that scenario's taxable "side account" (see step 7), divided by W.
   Every account with `savings > 0` always has a W > 0 to measure — there is no more "no withdrawal needed"
   case. `rates.taxSavedNow` is the "now" side: the marginal rate, netted against any tax on the side
   account's extra money when the IRS limit is exceeded (equals the plain marginal rate otherwise).
   `rates.lean` = `leanFromRates(taxSavedNow, effectiveRetirement)`: pretax/roth, "even" within 0.5 points —
   the rule-of-thumb line under the rates (not the dollar verdict; the contribution cap can make them differ).
   `result.sideAware` carries the full `calculateSideAwareRates` output (incl. `stacks` and `stackDetails`,
   the four tax stacks the walk-through and "Show the full tax calculation" dropdown are built from).
6. **Same take-home cost, then the limit** (`splitAtTakeHome` in compare.js, reworked 2026-09-25c). Take-home
   cost C: currently Roth -> C = savings; currently Pre-tax -> C = min(savings, limit)·(1−t) + max(0, savings −
   limit) (only the part under the limit is deducted; matches the need calc). Roth scenario: min(C, limit) to the
   account, rest of C to taxable. Pre-tax scenario: min(C/(1−t), limit) to the account (costs that·(1−t)), rest
   of C to taxable — at the limit that rest is the tax the Pre-tax contribution saved, invested. `limit` =
   `limitCheck.limit` (includes catch-up at `currentAge`, a snapshot). -> `result.contributionSplit` =
   { takeHomeCost, roth/pretax: { toAccount, excessToTaxable } }; `result.contribution.{roth,pretax}` = toAccount +
   excessToTaxable (everything that scenario puts away). OLD model (before 2026-09-25c) capped the uncapped
   equivalents R and P separately, so the Pre-tax excess was P − limit in PRE-TAX-sized dollars: overstated by
   1/(1−t), and a currently-Pre-tax saver over the limit got an understated Roth equivalent. `calculatePaycheckEquivalents`
   is still exported (used inside the split).
7. **The taxable side is part of Future Contributions everywhere.** `annuity.{roth,pretax}.side` = { contribution,
   futureValue, annualWithdrawal (4%), taxRate, afterTaxWithdrawal }; taxRate = extra tax the side's 4% withdrawal
   causes when stacked (as capital gain, via `calculateRetirementTax`) on SS + Existing Accounts' 4% withdrawals +
   (Pre-tax scenario) the account's own 4% withdrawal, ÷ that withdrawal. `annuity.X.totalFutureValue`,
   `totalAfterTaxIncome`; `lumpSum.X.side`, `totalFutureValue`, `totalAfterTaxValue`. `comparison` (the Section 2
   winner), `headlineRows` and `scenarios.js` use the totals. `withoutSocialSecurity.annuity.X.side` = same side
   with SS 0; its winner uses totals too. The account-only fields (`futureValue`, `afterTaxWithdrawal`) are
   unchanged. Section 3 buckets get the side FV in the taxable bucket (unchanged mechanism, corrected amounts).
8. Section 3 (`portfolioTax`): per scenario (all-Roth / all-Pre-tax), 4% baseline per bucket, one scale
   factor k found by binary search so after-tax income (withdrawals + full SS − tax) = need.
   Also `atBaseline` (k = 1): after-tax income each portfolio delivers at a plain 4% from every bucket,
   whatever the need — the "does the bigger Pre-tax portfolio buy more after-tax income?" row.
   Taxable SS uses (pretax + taxable withdrawals) as "other income".
9. No inflation is modeled: treat the return as a real (after-inflation) return; all dollars are today's.
10. **Retirement years without Social Security** (`compare.js` -> `withoutSocialSecurity`; UI dropdown
    under the trade-off table, "Retirement years without Social Security"): the SAME `calculateSideAwareRates`
    call with `ssBenefit` forced to 0, otherwise identical inputs — so Future Contributions' own withdrawal W
    is identical to the main result, and only the tax on it changes. `withoutSocialSecurity.sideAware` holds
    the result; `withoutSocialSecurity.comparison` is its own winner/dollar-difference, independent of the
    main result's.
    PROPERTY (tested, compare.test.js): the no-SS `effectiveRate` is never higher than the main result's
    `rates.effectiveRetirement`, because removing Social Security can only remove tax caused by its phase-in,
    never add any — true unconditionally, with no lifestyle or "is this account needed" caveat (those were
    artifacts of the old need-based model). This view's own winner is NOT bounded by "can only tie or favor
    Pre-tax": since W no longer depends on the need, a large existing Pre-tax balance whose own forced 4%
    draw already sets a high bracket can make this view favor Roth even at lifestyle = 1 (see
    compare.test.js's "big existing Pre-tax balances push the account withdrawal into a high bracket").

## The rates calculation (sideAwareRates.js) — history and the 2026-09-28 migration
For a few days (2026-09-26 to 2026-09-28) the app showed TWO parallel rates blocks — the original need-based
one and a new "sideAware" one — side by side so the user could compare them (see the change log entries from
that window for the day-by-day story). The user then chose the new one as canonical and asked to "migrate
everything to the new calculation." This section describes the result, now the ONLY rates calculation.
- Why the migration happened: at $500k income / $50k saved the OLD rates said Pre-tax, "comes out ahead" said
  Roth +0.4% and the portfolio section said Pre-tax +2.8% — a direct contradiction between the headline rates
  and the dollar verdicts. Cause: the old effective rate (28.4%) was measured on the $354k withdrawal needed
  to hit the retirement income number with only SS + Existing Accounts in the stack, then applied to the
  $92.6k Future Contributions actually yields, and it ignored the taxable "side account" the two scenarios
  build once savings exceed the IRS limit (the Pre-tax side invests the tax its deduction saved).
- The calculation (`calculateSideAwareRates` in `lib/sideAwareRates.js`; first retirement year, 4%
  withdrawals; W = Pre-tax account's own withdrawal, RW = Roth account's own withdrawal, sideP / sideR = each
  scenario's taxable side account, extra = sideP − sideR): e = [tax(Existing + sideP + W) − tax(Existing +
  sideP)] / W (`rates.effectiveRetirement`, "Effective rate on the account withdrawal" — measured WITH the
  Pre-tax scenario's side account already in the stack); s = [tax(Existing + sideP) − tax(Existing + sideR)]
  / extra (the tax rate on the extra taxable money); X = [(W − RW) + extra(1 − s)] / W (`rates.taxSavedNow`,
  "Tax saved now, after any tax on investing it"). No side account (savings fit under the limit): X = the
  plain marginal rate, X − e = today's rate gap. Capped at the limit with no side account: X = t(1 − s).
  `rates.lean` = `leanFromRates(X, e)`.
- IDENTITY (tested to the cent over 200+ combinations, and by hand): (X − e) × W = the exact after-tax income
  the Pre-tax portfolio delivers minus the Roth portfolio's, at a plain 4% withdrawal (`portfolio.X.atBaseline`).
  So the rates can never contradict the exact dollar comparison — the bug above is structurally impossible now.
- Order-dependent stacking is a deliberate, self-consistent choice: the side account (`sideP`/`sideR`) is
  always stacked BEFORE the account's own withdrawal W, never after. This means the side account's OWN
  reported tax rate (`annuity.X.side.taxRate` in compare.js) can be noticeably lower than it would be if
  computed after W (e.g. it can land entirely in the 0% capital-gains bracket even when W alone would push
  well past it) — see compare.test.js's "contribution limits: excess above the IRS limit defaults to a
  taxable account" tests for worked examples. This is a real, intentional modeling choice (the side account
  income exists independent of whether it's measured before or after W; the IDENTITY above holds regardless
  of stacking order), not a bug — but it's worth remembering when eyeballing the side account's own rate.
- Evidence gathered before choosing this over the old model (467 chart scenarios, clear-winner cases checked
  against the exact 4% answer): the new rule agrees 100%; the old rate lean agreed 93%; the old "comes out
  ahead" dollar verdict agreed 88%. Measuring on the account's actual 4% withdrawal (not a need-based one)
  mattered the most of the individual fixes tried.
- What the migration removed: `lib/incomeNeed.js` (`solveGrossWithdrawal`, `explainWithdrawalRate`) and
  `tests/incomeNeed.test.js`, deleted entirely — no code imports them any more. `result.grossUp`,
  `result.rateDrivers`, `result.withoutSocialSecurity.grossUp` and the "$1,000 probe" mechanism (see
  "Effective-rate probe size" below, now historical) no longer exist. The "Tax rate comparison — new
  calculation" duplicate card (`sec2b`) is gone; there is one "Tax rate comparison" card (`sec2`) again.
  `ScenarioCompare.jsx`, `scenarios.js`, the Visualization page and ARTICLE.md were all updated to the new
  numbers/terminology (see their sections and the change log). Two real behavior changes fell out of this and
  needed separate fixes, not just renames: (1) `retirementLifestyle` no longer affects Section 2's rate or
  winner at all (see model step 2) — ARTICLE.md's "If you expect to spend more, or less, in retirement" was
  rewritten accordingly; (2) the "Retirement years without Social Security" section's "Reading this" note
  used to claim this view "can only tie or favor Pre-tax" unless lifestyle > 1 — also no longer true (see
  model step 10) — so that copy was rewritten in `ResultsSummary.jsx`'s `YearsWithoutSocialSecurity`, both
  because it's now more subtle (a large existing Pre-tax balance can favor Roth here at ANY lifestyle) and to
  keep the smoke tests (which enforce ARTICLE.md/UI consistency) passing.
- The walk-through (`sideAwareRateSteps` in `rateSteps.js`) is three steps, unaffected in shape by this
  migration (it was already built to match): Step 1, Existing Accounts' income; Step 2, "the difference" — the
  taxable side account, if any (always shown, with a plain "nothing to add" note when nothing exceeds the
  limit, so the step COUNT never changes, only its content); Step 3, add Future Contributions' own withdrawal
  and re-do the tax. A final, unnumbered "Putting the two rates together" section assembles X vs e into the
  dollar difference.

## "Splitting your contribution" — the Roth/Pre-tax blend explorer (added 2026-09-29)
The user asked what it would take to model mixing Roth and Pre-tax within the same year's Future
Contributions (not just picking one pure strategy), and whether an optimal split is even computable.
Answer: yes, and it's a genuine, non-trivial question in THIS model specifically — "tax saved now" is
close to flat (your marginal rate on one year's contribution), but "effective rate later" is a CURVE
that rises as the Pre-tax slice grows (bracket climbing, the Social Security phase-in band, capital-gains
stacking from a side account), so where that curve crosses today's marginal rate partway through, a mix
can beat either pure extreme. New card, own section, no changes to any existing Roth/Pre-tax table (the
user chose this UI shape explicitly over a "third column everywhere" alternative, given the much larger
surface area the latter would touch).
- **`lib/blend.js`** (pure, hand-verified tests in `tests/blend.test.js`): `splitBlended(takeHomeCost, marginalRate,
  limit, rothShare)` generalizes `compare.js`'s `splitAtTakeHome` from "all-Roth or all-Pre-tax" to an
  arbitrary Roth SHARE OF THE ACCOUNT DOLLARS (0-1) — the same thing a real 401(k)'s Roth/Traditional
  deferral election splits. `A_uncapped = C / (1 - (1-r)*t)`, `A = min(A_uncapped, limit)`,
  `rothToAccount = r*A`, `pretaxToAccount = (1-r)*A`, `excessToTaxable = C - A*(1-(1-r)*t)`. PROVEN
  algebraically (and tested directly against `splitAtTakeHome`) that `r=0` and `r=1` exactly reproduce
  its pretax/roth branches respectively, for any C/t/limit, capped or not — a blend is a genuine
  generalization of the existing rule, not a new one. `evaluateBlend({ rothShare, takeHomeCost,
  marginalRate, limit, returnRate, years, other, existingTax, ssBenefit, filingStatus, year })` grows each
  piece to retirement and reuses `calculateRetirementTax` directly (same as `sideAwareRates.js`) to work
  out the total after-tax income at that split, with Existing Accounts (`other`) and Social Security
  already in the stack (`existingTax` = tax on those alone) so the account's own tax is the extra tax it
  causes on top of them — the same incremental measure the rest of the app uses. `findOptimalBlend(params,
  steps = 101)` evaluates a DENSE GRID (not a faster search: bracket edges and the SS phase-in can put a
  kink in the curve, so nothing assumes smoothness/concavity) and returns every point (for the chart) plus
  the best one.
- **`compare.js`**: `result.blend` = `{ available, points, best }` (`available: false` when nothing is
  saved — `contributionSplit.takeHomeCost` is 0). Uses the SAME take-home cost as today's actual
  `savings`/`currentType` (`contributionSplit.takeHomeCost`), so it's a genuine "what if you split this
  same budget differently" exploration, not a separate what-if income. `existingTax` is computed with a
  direct `calculateRetirementTax` call (Existing Accounts + Social Security only), independent of
  `sideAware.available`, so it works even when there's nothing to blend (though blend is skipped
  entirely in that case anyway).
- **`ResultsSummary.jsx`** (`BlendExplorer`, card id `blend`, `id="sec-blend"`, between "After-tax
  comparison" and "Total future portfolio comparison"): a `<strong>Here, blending helps</strong>` /
  `<strong>Here, a pure strategy already wins</strong>` note (the latter whenever the optimum sits at
  either end AND the gain over the better pure strategy is under $0.50 — i.e. genuinely nothing to find,
  not just a rounding artifact); a native `<input type="range">` (0-100, `accent-color: var(--accent)`,
  no custom thumb/track styling) that indexes directly into the 101 precomputed `blend.points` — no
  live recomputation in the browser, the slider is pure UI state over already-computed data, initialized
  to the optimal index on mount; a small facts list (to Roth / to Pre-tax / to a taxable account when over
  the limit / after-tax income); a "Jump to the best mix" button; a `LineChart` of the whole curve (101
  points, `includeZero={false}` — see below); a "Show the numbers" `<details>` table (every 5 points plus
  the exact best one), matching the Visualization page's "chart + non-interactive fallback table"
  convention. `sectionSummaries.js` gained a `blend` headline ("Best mix: 56% Roth, $1,671/yr more than
  either pure strategy", or "Best mix: all Pre-tax"/"all Roth" when a pure strategy wins, or "Nothing
  saved to split").
- **`charts/LineChart.jsx`** gained an `includeZero` prop (default `true`, so the Visualization page's
  existing rate-gap charts are unaffected). Found while screenshotting this feature: the chart's y-axis
  always forced $0 into view, which is right for a rate-gap chart centered on zero but wrong here — the
  values are always positive and cluster in a narrow few-thousand-dollar band, so forcing $0 into view
  squashed the whole interesting hump into a thin sliver at the top of the chart. `BlendExplorer` passes
  `includeZero={false}`.
- **Rates per mix** (added 2026-09-29 (h), at the user's request): every blend point carries `taxSavedNow` and
  `effectiveRate` (`blendRates` in blend.js, applied by `findOptimalBlend`): the mix measured against the
  all-Roth mix exactly as sideAwareRates.js measures all-Pre-tax vs. all-Roth (W = the mix's Pre-tax withdrawal, side
  account stacked before W). So (taxSavedNow − effectiveRate) × W = the mix's after-tax income minus all-Roth's (tested
  to the cent, over the limit too), at r = 0 both equal `rates.taxSavedNow`/`rates.effectiveRetirement` (tested),
  under the limit taxSavedNow is exactly the marginal rate, and both are null at all-Roth. The card shows them in the
  facts list, a second LineChart (points 0-99%) and the numbers table. The effective rate is an AVERAGE over the Pre-tax
  part, so at the optimum it is usually well below tax saved now (the optimum is where the NEXT Pre-tax dollar's rate
  reaches it); the card's hint says so. `evaluateBlend` also returns `taxWithoutPretaxSlice` and `pretaxSliceTax`.
- Also added, same session: a "Show the calculation" dropdown (`AfterTaxIncomeMath`) under the After-tax
  comparison table's "After-tax income it generates" row — each side's account withdrawal and its tax,
  plus the taxable side account's own withdrawal and tax when there is one. Pure presentation, no new
  math (see the "Page layout" Decisions bullet above for the detail). This is why the "shows Adjusted
  Gross Income (AGI)..." smoke test now scopes to `sec3` — "Show the calculation" is no longer a unique
  label on the page.
- Not built (possible follow-ups, noted rather than done prematurely): marking the current slider
  position and/or the optimum directly on the chart itself (LineChart assumes every series has the same
  number of points at the same x-positions, so a sparse single-point marker series doesn't fit its
  current design without changes); extending "Compare a change" or the Visualization page to include a
  blended scenario; letting a blend become one of Section 3's whole-portfolio scenarios (today Section 3
  is still exactly All-Roth vs. All-Pre-tax, unaffected by this).

## `result.old` — TEMPORARY duplicate of the pre-migration calculation (added 2026-09-29)
The user asked to bring the old (pre-2026-09-28) need-based calculation back, restored from git history
(commit `92b16f0`, the commit right before the migration — see "The rates calculation" above), so the two
methodologies can be compared side by side again while they test some scenarios. **This is temporary and
will be removed** — the user's own words: "We'll remove it again, but I am interested in testing some
things." Nothing above this section changed; this is a pure addition.
- `compare.js`: a clearly-marked block near the end of `compareRothVsTraditional` (search
  `TEMPORARY (2026-09-29)`) recomputes the old `grossUp` (via restored `lib/incomeNeed.js`), `rateDrivers`,
  old-style `rates` (`effectiveRetirement`/`overallEffectiveRetirement`/`lean` from the grossUp, not
  sideAware), old `annuity`/`lumpSum`/`comparison` (old side-account tax: stacked AFTER the account's own
  withdrawal, via a restored `oldSideTaxRate`/`oldSideFor` using `calculateRetirementTax` directly — the
  opposite stacking order from `sideAwareRates.js`, which is the #1 source of numeric disagreement between
  the two), and old `withoutSocialSecurity` (old `grossUp`/`rateDrivers`/`marginalRateRetirement` +
  `afterTaxWithdrawalAtMarginal`, reference-only, from the restored `getMarginalRate`). All of it is nested
  under one new field, `result.old`, so it can never collide with the current top-level fields (which are
  untouched and still power everything already built, including "Your portfolio at retirement").
  `rothSideRaw`/`pretaxSideRaw`/`lumpSum.X.side.futureValue` (already computed for the current methodology)
  are reused as-is where the underlying dollar amounts don't depend on which methodology taxes them.
- `lib/incomeNeed.js` and `tests/incomeNeed.test.js`: restored verbatim (`git show 92b16f0:<path>`).
- `lib/rateSteps.js`: `effectiveRateSteps` and `rateDriverRows` restored (search `TEMPORARY (2026-09-29)` at
  the bottom of the file), adapted to read `result.old.{grossUp,rateDrivers,retirementOverall,rates}` instead
  of the top level (shared fields — `otherWithdrawals`, `socialSecurity`, `retirementNeed`,
  `current.standardDeduction` — are unchanged and still read from the top level, since they don't depend on
  which rate methodology is used).
- `ResultsSummary.jsx`: a whole new, clearly-marked section (search `TEMPORARY (2026-09-29)`) with
  `ExtraTaxSplitOld`, `RateDriversOld`, `EffectiveRateMathOld`, `YearsWithoutSocialSecurityOld` (+its verdict
  helper), and `TaxRatesOld` — all restored old copy, reading `result.old.*`. One new `RESULT_CARDS` entry,
  `{ id: 'ratesOld', headingId: 'sec2-old', title: 'Tax rate comparison — old calculation' }`, sits directly
  after the current "Tax rate comparison" card (`sec2`) and before "After-tax comparison" — including its OWN
  "Retirement years without Social Security (old calculation)" dropdown (nested inside it, not added to the
  current `TradeOff` card, so all old-methodology UI is contained in one card for easy removal). Its own
  `<p className="hint">` labels it "Temporary, for comparison." `sectionSummaries.js` gained a matching
  `ratesOld` headline key.
- Sanity-checked: at the defaults, `result.old.grossUp.grossWithdrawal` and `.rates.effectiveRetirement` match
  the exact pre-migration values to the decimal (verified against numbers hand-derived before 2026-09-28), and
  the full test suite (455 tests) plus the existing "no NaN/Infinity anywhere" smoke test (unscoped — covers
  the whole page, old card included) pass with no changes to any already-passing assertion about the CURRENT
  methodology's numbers.
- Test changes were adjustments only, not new coverage of the old card's own content — a few existing smoke
  tests that assert something is absent from "the page" now use a new `withoutOldRatesCard` helper in
  `components.smoke.test.jsx` (cuts the `sec2-old` `<section>` out of the rendered HTML) so they keep testing
  the CURRENT methodology specifically, unaffected by the old card legitimately reusing old phrasing nearby.
- **Test page `#/old-vs-new`** (added 2026-09-29 (h), at the user's request: charts to see where the two calculations
  differ most and check them). Not linked from the site. `lib/methodCheck.js` (wiring only: `runMethodPoint` reads both
  calculations off one `compare.js` result, plus a benchmark, the exact after-tax income at a plain 4% withdrawal from
  `portfolio.X.atBaseline`; `summarize`, `differenceCauses`, `flattenPoints` (dedupes repeated scenarios), `toFormValues` for
  an "Open" link into the calculator) + `tests/methodCheck.test.js`; `components/OldVsNewPage.jsx` (summary tiles, a sortable
  "Where they differ most" table, both break-even maps showing new/old winners with disagreements outlined, and a rates
  chart + advantage chart per Visualization batch; the two risingIncome batches are skipped, they have no old calculation);
  `route.js` `OLD_VS_NEW_HASH`; `App.jsx` route (wide `calc-page` width); `.ovn-*` CSS at the end of `App.css`; one smoke test.
  Findings at the time (2026, 436 distinct scenarios): winners differ in 53; the new calculation matches the benchmark to
  the cent everywhere (expected: it was built to), the old one names the wrong winner in 32 and misses by up to $15,213/yr.
  The biggest gaps come from WHICH withdrawal the rate is measured on: (1) high savers (25-30% saved, $50k-$150k): the old
  need-based withdrawal is small ($7k-$31k), so the old rate is ~0-12%, but the account really pays $57k-$93k; (2) $500k
  income with a higher lifestyle: the old one measured $400k-$820k withdrawals (29-33%) for an account paying $92.6k; (3)
  age 50, no balance: new 0-6% vs. old 16-22% (same winner). Open question raised with the user: the benchmark shares
  the new method's assumption that the account pays 4% whatever the need, so case (3), where Future Contributions are
  the only savings and fall short of the need, isn't independently checked.
${anchor} delete `lib/incomeNeed.js`, `tests/incomeNeed.test.js`;
  in `compare.js`, delete the block marked `TEMPORARY (2026-09-29)` (down to `const rothTax = ...`), its two
  extra imports, and `old,` from the return object; in `rateSteps.js`, delete everything from the
  `TEMPORARY (2026-09-29)` marker to the end of the file; in `ResultsSummary.jsx`, delete the whole marked
  section (`ExtraTaxSplitOld` through `TaxRatesOld`) and the `ratesOld` `RESULT_CARDS` entry; in
  `sectionSummaries.js`, delete the `ratesOld` headline key; delete the `#/old-vs-new` test page (`lib/methodCheck.js`, `tests/methodCheck.test.js`,
  `components/OldVsNewPage.jsx`, `OLD_VS_NEW_HASH` in route.js + its route test, its import/route/width in App.jsx, the `.ovn-*`
  CSS block, and the `OldVsNewPage` smoke test); in `components.smoke.test.jsx`, delete
  `withoutOldRatesCard` and revert its three call sites to the plain `render()`/`html` they replaced (and drop
  the "shows each results card..." title and `sectionSummaries.test.js`'s `old`/`ratesOld` additions). Re-run
  the full suite after.

## Full tax calculation dropdown (2026-09-28)
Nested inside "How are these rates calculated?": "Show the full tax calculation," a bracket-by-bracket
breakdown for each scenario's FINAL stack (`sideAware.stackDetails.rothWorld` / `.preTaxWorld` — Social
Security + Existing Accounts + that scenario's taxable side account + (Pre-tax only) the account's own withdrawal).
New pure module `lib/taxBreakdown.js`, `explainFullTax`: same bracket tables and stacking order as
`retirementTaxStack.js`'s `calculateRetirementTax` (which it does not replace or duplicate logic from — it reads
the same three data files directly and decomposes into rows), so the two are tested to always agree on every
subtotal (ordinary tax, capital-gains tax, NIIT, total), not just the total. Shows: SS benefit and its taxable part,
AGI, standard deduction, ordinary taxable income with each bracket's slice and tax, the taxable-account withdrawal
split into basis/gain with each capital-gains bracket's slice and tax, MAGI and the NIIT calc. `sideAwareRates.js`
now also returns `stackDetails` (the four stacks' raw inputs, parallel to `stacks`) so the UI never has to
reconstruct them. Hand-verified tests (3 cases: ordinary-only spanning 3 brackets, gains split across 0%/15%,
SS phase-in + NIIT together) plus a 200+-input grid asserting agreement with `calculateRetirementTax` to the cent.

## Catch-up contributions (2026-09-23)
`data/contributionLimits.js` entries changed shape from a plain number to `{ base, catchUp50,
catchUp60to63 }` (401(k) only has `catchUp60to63`; IRA has no enhanced tier). `getLimit(accountType,
year, age)` in `lib/contributionLimits.js` computes `base + catchUpAmount(entry, age)`: 0 below 50;
`catchUp60to63` for ages exactly 60-63 if the entry has one (SECURE 2.0's enhanced 401(k) tier —
REPLACES, not adds to, the standard catch-up for those four ages only); `catchUp50` otherwise for 50+.
`age` is optional on both `checkContributionLimit` and `splitAtContributionLimit` (omit or pass < 50 for
the base limit only — fully backward compatible, all pre-existing calls/tests unchanged). `compare.js`
passes `currentAge` (a snapshot at today's age, same simplification as the base limit and tax brackets
elsewhere — does NOT model aging into a higher tier partway through a multi-decade projection).
2025: 401(k) $7,500 catch-up / $11,250 for ages 60-63; IRA $1,000. 2026: 401(k) $8,000 / $11,250
(60-63 tier unchanged); IRA $1,100. Sources: IRS Notice 2024-80 and the "401(k) limit increases to
$24,500 for 2026..." newsroom announcement (both re-confirmed 2026-09-23). The over/at-limit message in
`checkContributionLimit` now names the catch-up amount when one applies ("...that includes a $7,500
catch-up contribution for being 50 or older"). No UI code changes were needed beyond wiring `currentAge`
through — the Section 2 capping sub-note and the limit alert already read from these functions.

## Effective-rate probe size (2026-09-23) — HISTORICAL, superseded 2026-09-28
Bug report: lowering the retirement need (e.g. an expense going away) made the reported effective rate go UP,
which looked backwards. Root cause: the old `incomeNeed.js` model measured the rate on a gross-up withdrawal
G sized to close the gap between the need and other income; whenever other income already covered the target
(G = 0), it fell back to reading the rate from a fixed, arbitrary $1,000 probe withdrawal, unrelated to the
size of withdrawal that rate then got applied to elsewhere. The fix at the time sized that probe to the
account's own natural 4% withdrawal instead of $1,000. The 2026-09-28 migration to `sideAwareRates.js` (see
its section above) removed the whole G / probe distinction: the rate is now ALWAYS measured on the account's
own natural withdrawal, for every scenario with `savings > 0` — there is no more "other income already covers
it" special case, no probe, and `incomeNeed.js` itself was deleted. This section is kept only as a historical
record of the bug and its first (superseded) fix.

## Contribution limits: excess now defaults to taxable (2026-09-22; amounts corrected 2026-09-25c, see model step 6)
Previously `savings`/R/P compounded at their full entered value regardless of the IRS limit — a
$50,000 "401(k)" contribution would compound as if it all fit. Fixed: `splitAtContributionLimit` caps
each of R and P at the limit for the selected `accountType`/year; the excess grows as an additional
taxable-account annuity, one per scenario (see the model section above). The limit DATA was already
year-keyed and extensible (`data/contributionLimits.js`) — no change needed there, just the missing
behavior that used it. `checkContributionLimit`'s over-limit message now names the exact dollar excess
and explains the redirect, instead of saying "a fuller comparison is planned." Resolves the "excess
contribution" half of the "maxing out" future-enhancement item; the other half (investing a Traditional
filer's tax SAVINGS from staying at-but-not-over the limit) is still unmodeled — see App.jsx and
ARTICLE.md's "Why maxing out changes the math," which now distinguishes the two.

## Capital gains: corrected from a flat rate (2026-09-22)
Originally implemented per spec as a flat 15% (`LTCG_RATE` in constants.js). The user flagged that real
LTCG brackets include a 0% tier based on income, which this missed. Fixed: `capitalGainsTax.js` +
`data/capitalGainsBrackets.js`, wired into `retirementTaxStack.js`; `LTCG_RATE`/`ltcgRate` removed
everywhere. 2025 thresholds fetched directly from IRS Topic 409; 2026 thresholds corroborated via
secondary sources (CNBC, Kiplinger) — the IRS Rev. Proc. 2025-32 PDF wasn't machine-readable, re-verify
against it when convenient. This resolved one of the two model quirks discussed with the user on
2026-09-21 (the flat-rate one); the other (effective rate measured on the gap-filling slice, applied to
the whole account) is still open — see "Known limitations."

## Decisions and deviations from the original spec (deliberate)
- **SS taxability:** the spec's "$6,000 (Single) / $12,000 (MFJ)" was wrong. The IRS worksheet uses half the
  band width: **$4,500 Single / $6,000 MFJ**. Implemented per IRS; a test documents the difference.
- **FICA** was added (spec omitted it). Couples' income is treated as one earner's (single wage base),
  same as the SS estimator.
- Section 3 has an extra **"Withdrawal rate needed"** row and a note: a higher tax bill is not a verdict
  (the Pre-tax scenario also got a deduction and starts larger). Section 2 has a one-line verdict.
- **Page layout (2026-09-25g):** (1) "Retirement income number": hero value, SS + income-needed-from-portfolio
  facts, note, "How is this calculated?" dropdown. (2) **"Your portfolio at retirement"** card — see its own
  section below; added 2026-09-28, superseding the REJECTED note that used to be recorded here (2026-09-25: an
  earlier version of this block, first as its own card, then merged into the trade-off table, was rejected as
  muddying things; the user brought a version of it back 2026-09-28 now that results are collapsible, explicitly
  citing that as the reason it fits better now — see that section for why this isn't the same rejected thing).
  (3) **"Tax rate comparison"** card (named "Roth vs. Traditional" before 2026-09-26) (`id="sec2"`) holding ONLY the
  rates: the tax-saved-now vs. effective-rate pair (no subheading since 2026-09-26; the card title says it), the short lean phrase ("Tends to favor Roth" / "About even"; the
  user removed the explanatory sentence and rule-of-thumb hint) and the "How are these rates calculated?"
  dropdown. (4) **"After-tax comparison"** card (was "The trade-off in dollars") (`id="sec-tradeoff"`, `TradeOff` component): limit alert, then
  ONE table (Roth / Pre-tax only, no Difference column, no "Tax on withdrawals" row) with three shaded groups:
  "What you put in" (current possible contribution); "A single year's contribution" (value at retirement, after-tax
  value); "Contributing every year until retirement" (Future Contributions at retirement, after-tax income it
  generates). Future Contributions only. Then, added 2026-09-29, "Show the calculation" (`AfterTaxIncomeMath`):
  each side's account withdrawal (4%) and its tax (Roth $0; Pre-tax at `rates.effectiveRetirement`), plus the
  taxable side account's own withdrawal and tax when `annuity.X.side.futureValue > 0` — no new math, purely a
  breakdown of `annuity.X.{annualWithdrawal,afterTaxWithdrawal,side,totalAfterTaxIncome}`, which already summed
  to the "After-tax income it generates" row. Then "Why is the Pre-tax side bigger?" and "Retirement years without
  Social Security" dropdowns. (5) "Total future portfolio comparison" (`id="sec3"`; renamed from "Total portfolio tax comparison" 2026-09-30). Its
  verdict is the bold last row, **"Withdrawal rate needed"** (same lifestyle, lower rate = less strain), with the lower
  rate highlighted (`win`, "X pts lower"; no highlight if either side misses the target or they match to 0.005 pts).
  "After-tax income at a 4% withdrawal" stays as a plain row above it — its gap equals the After-tax comparison's
  (sideAware identity), so it isn't highlighted. It — also has its own "Show the
  calculation" dropdown (`PortfolioMath`, pre-existing); the AGI-ordering smoke test is scoped to `sec3`'s copy
  since the label is no longer unique on the page.
  Cells show "incl. $X in a taxable account (over the IRS limit)" when a taxable side exists.
- **Terminology (user, 2026-09-25c):** the savings being decided on = **"Future Contributions"** (capitalized);
  all other retirement/investment balances collectively = **"Existing Accounts"**. Never "this account",
  "other accounts/balances" or "other income" (for SS + existing) in the UI or ARTICLE.md; smoke tests enforce
  "this account" is absent from the results, form and article. Form fieldsets are titled "Future
  Contributions" and "Existing Accounts". (The IRS combined-income "other income" in the portfolio math note
  is a tax term and stays.)
- Rate naming: "Effective rate on the account withdrawal" = extra tax caused by Future Contributions' own
  withdrawal, stacked on Social Security + Existing Accounts + that scenario's taxable side account, ÷ that
  withdrawal (`rates.effectiveRetirement`; the number that drives the comparison). "Tax saved now, after any
  tax on investing it" = `rates.taxSavedNow`, the "now" side. `rates.overallEffectiveRetirement` (total tax ÷
  gross income, incl. Roth) is still computed but is NOT shown anywhere in the UI as of the 2026-09-28
  migration (it was a reference line in the old rates block; no replacement was built — if it's wanted back,
  it would need a new home, since the new rates card doesn't have an "outside the dropdown" reference-line slot).
- Form: "Type of income" dropdown under gross income (W-2 / 1099 / Both, with a 1099-amount field for
  Both). Assumptions dropdown also holds "Expected retirement lifestyle".
- Form: expected return lives in a collapsed **Assumptions** section (default 7%; summary shows the current
  value). Savings hint reads "the amount you're currently contributing ... or considering". Account-type
  hint removed.
- The Pre-tax/Roth contribution amounts ("Current possible contribution") are a row in the Section 2
  table, with a note that they cost the same take-home pay; no longer in Section 1.
- Section 3 calculation dropdown labels total income "Gross income (withdrawals + Social Security)".
- "Without Social Security" = benefit set to $0 (plan as if it isn't there), NOT "benefit received but
  untaxed". Named "Retirement years without Social Security" (the user rejected "Simple view").
- Employer match in the article says "most plans" (SECURE 2.0 permits Roth match, few offer it).
- SS wage base lives only in `ficaRates.js`.

## Known limitations / open items
- **"Tax saved now" uses one flat rate for the whole contribution** (`splitAtTakeHome` in compare.js,
  `splitBlended` in blend.js: P = C / (1 − t), t = the top-of-bracket marginal rate). A Pre-tax contribution
  that crosses a bracket edge (e.g. $10k into 22%, $20k deducted) really saves 22% on part and 12% on the rest,
  so the app overstates the deduction's value there. The retirement side already uses an incremental measure.
  Planned fix in the new version only (plan doc phase 2): tax without the deduction minus tax with it.
- **RESOLVED 2026-09-28** (was the top item here): the effective rate used to be measured on a *need-based
  gap-filling* withdrawal but applied to the account's full 4% withdrawal, which could overstate or understate
  tax. `sideAwareRates.js` now measures the rate directly on the account's own actual 4% withdrawal — see "The
  rates calculation" above. No known analogous gap remains.
- The side account's own reported tax rate (`annuity.X.side.taxRate`) is measured BEFORE the account's own
  withdrawal stacks on top of it (an intentional, self-consistent ordering choice — see "The rates
  calculation" above), so it can read lower than a saver eyeballing "my side account's gain, stacked after
  everything else" would expect. The combined dollar comparison is exact regardless; only the side account's
  own displayed rate is order-dependent.
- Not modeled: state tax, 65+ additional standard deduction and the temporary senior deduction (both
  would lower retirement tax), RMDs, employer match, raises, tax-efficient withdrawal order, IRA phase-outs,
  two-earner couples' separate wage bases. (Catch-up contributions ARE now modeled —
  see "Catch-up contributions" above — but only as a snapshot at today's age, not aging into a tier over
  a multi-decade projection.)
- The lifestyle factor is one multiplier on the retirement income number and Section 3's portfolio solve.
  Since 2026-09-28 it no longer moves Section 2's rate comparison at all (see model step 2) — the account's
  own withdrawal is fixed regardless of the need. It also does not model contributions made at a *higher
  future* marginal rate when earnings rise (marginal-now/tax-saved-now stays today's), which would offset it
  toward Pre-tax; time-varying contributions are a future feature.
- 1099: self-employment tax IS modeled (see model step 1). Still simplified: income entered is *net*
  earnings (after business expenses); the 20% QBI deduction is not modeled (it would lower today's taxable
  income and can lower the marginal rate, tilting toward Roth for eligible owners); solo-401(k)/SEP limits
  are not modeled (the employee 401(k) limit is used, too low for someone who can also make the employer
  contribution); MFJ couples treated as one earner (single wage base).
- A Roth/Traditional split is a future feature (the app warns at >= 90% of the contribution limit). The
  "maxing out" side account IS modeled since 2026-09-25c (see model steps 6–7) and, since 2026-09-28, its tax
  is measured directly (not via a whole-account caveat) — see "The rates calculation" above.

## Data provenance (checked 2026-09-19)
- Verified on irs.gov: 2025 and 2026 brackets, 2026 standard deduction, FICA rates, Additional Medicare
  thresholds ($200k / $250k MFJ), 2026 wage base $184,500, 2026 limits ($24,500 / $7,500).
- 2025 standard deduction ($15,750 / $31,500): confirmed via IRS search excerpts, not opened directly.
- **Not verified from SSA directly** (ssa.gov blocks Claude's fetcher; corroborated via excerpts): bend points
  2025 $1,226 / $7,391 and 2026 $1,286 / $7,749; 2025 wage base $176,100.
- SS taxability thresholds ($25k/$34k Single, $32k/$44k MFJ) are statutory; not fetched.
- Self-employment tax (12.4% + 2.9%, 92.35%, $400 minimum, half deductible): IRS Topic 554, checked 2026-09-20.
- NIIT (3.8%; $200,000 Single / $250,000 MFJ; not indexed; MAGI = AGI; SS and qualified-plan distributions
  are not investment income, stock/fund gains are): IRS Topic 559 and the IRS NIIT Q&A, checked 2026-09-25.
- Catch-up contributions (401(k) $7,500/2025, $8,000/2026; 60-63 enhanced tier $11,250 both years; IRA
  $1,000/2025, $1,100/2026): IRS Notice 2024-80 and the 2026 401(k)/IRA newsroom announcement, checked 2026-09-23.
- Every data file names its sources in comments. Re-verify each January when new-year data is added.

## Checking the UI without a browser session
Desktop width is the primary check (see "Audience and direction"); phone width only needs to not break.
Headless Chrome works: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new
--virtual-time-budget=6000 --window-size=W,H --screenshot=out.png URL`. Window width has a minimum, so to
check true phone width, load the app in an iframe of width 390 inside a wrapper page and measure
`documentElement.scrollWidth`. Use `--dump-dom` to assert rendered text on the live site.

## Change log
- 2026-10-01 (b) — Placed the user's further ideas in the plan doc and the Roadmap notes (see "Further ideas placed");
  recorded the flat-rate "tax saved now" limitation. Plan doc's Phase 2 "swap the Roth calculator onto the new
  engine" wording reconciled with build-alongside (the current calculator keeps its own path until switchover).
  No code change.
- 2026-10-01 (b) — Phase 1 started in the `#/next` preview (see "Phase 1: household model"): `household.js`, per-person
  payroll tax and Social Security with the spousal benefit (hand-verified), optional `earners` input on compare.js, the
  preview route with a Spouse block. Current calculator untouched; all 491 existing tests passed unchanged. 510 tests.
- 2026-10-01 — Decided how to build the roadmap: alongside the current calculator, on `main`, behind a preview route
  `#/next` (see "Build alongside, then switch over" under Roadmap); `result.old` and `#/old-vs-new` stay for now. Plan
  doc updated to match. No code change. 491 tests.
- 2026-09-30 — "Total portfolio tax comparison" renamed "Total future portfolio comparison"; "Withdrawal rate needed"
  moved to the bottom as the highlighted verdict row, the 4% row demoted to a plain row. ARTICLE.md's description of
  the card rewritten to match. 491 tests.
- 2026-09-29 (h) — TEMPORARY test page `#/old-vs-new`: old vs. new calculation charted across the Visualization
  scenarios and checked against the exact 4% benchmark (see the `result.old` section). No model change. 490 tests.
- 2026-09-29 (h) — Splitting your contribution: tax saved now and the effective rate on the Pre-tax part at every mix
  (facts, a rates chart, table columns; `blendRates`, hand-verified + identity tests). Total portfolio tax comparison:
  removed the "Total tax difference between scenarios" callout (and `result.taxDifference`) at the user's request;
  its closed headline is now the withdrawal rate needed. ARTICLE.md: the split section no longer calls the best mix a
  "planned future feature". Open question raised with the user: that card's "after-tax income at a 4% withdrawal"
  difference is identical to the After-tax comparison's (the sideAware identity), so only "withdrawal rate needed" is
  unique to it, and at the defaults the two disagree (Roth +$903/yr at 4%, Pre-tax needs 2.08% vs 2.09%). 482 tests.
- 2026-09-29 (g) — Visualization: removed the gap-vs-advantage scatter and its trend line (circular: the winner IS
  the sign of the gap since 2026-09-28), deleted `ScatterChart.jsx`, `regression.js`, `flattenForScatter` and their
  tests and CSS. Page retitled "Visualization: who comes out ahead, and why"; the callout states the gap rule as exact.
  479 tests.
- 2026-09-29 (e) — Visualization: two "Earning more later" charts (see the Scenario charts section), backed by the
  new pure `lib/risingIncome.js` (hand-verified tests). Found and recorded that the existing lifestyle chart is flat
  under the current model. `compare.js` now exports `winnerOf`. 484 tests.
- 2026-09-29 (f) — Kept the flat lifestyle chart with a new title and a caption explaining why it is flat; the
  "Earning more later" chart and ARTICLE.md now say that retirement taxable income, not the spending target, decides
  Roth vs. Pre-tax (and that higher future income only favors Roth now if the later savings are Pre-tax). 484 tests.
- 2026-09-29 (d) — No code change. Recorded the roadmap (plan doc link), the inflation-on-fixed-thresholds
  decision and the free / signed-in two-tier direction under "Audience and direction".
- 2026-09-29 (c) — New "Splitting your contribution" card: a Roth/Pre-tax blend explorer (see its own
  section above for the full detail) — a slider over 101 precomputed points, a "Jump to the best mix"
  button, and a chart of after-tax income vs. Roth share, with a note explaining whether blending finds
  anything a pure strategy didn't. New `lib/blend.js` (`splitBlended`, `evaluateBlend`, `findOptimalBlend`),
  hand-verified including a genuine interior-optimum example (55-56% Roth beating both pure strategies by
  over $1,600/yr in a Social-Security-phase-in scenario). `result.blend` in compare.js. `LineChart` gained
  an `includeZero` prop (found while screenshotting: forcing $0 into view squashed this chart's narrow,
  always-positive value range into a sliver). 477 tests.
- 2026-09-29 (b) — "Show the calculation" dropdown for the After-tax comparison card's "After-tax income it
  generates" row (see the Page layout section above): each side's account withdrawal and its tax, plus the
  taxable side account's own withdrawal and tax when there is one. Pure presentation, no new math. Fixed the
  "shows Adjusted Gross Income (AGI)..." smoke test, which had assumed "Show the calculation" was unique on
  the page (now scoped to `sec3`). 456 tests.
- 2026-09-29 — TEMPORARY: restored the pre-2026-09-28 need-based rate calculation from git history
  (commit `92b16f0`) alongside the current one, at the user's request, so they can compare the two while
  testing some scenarios (see `result.old` above for the full detail and the removal checklist). New "Tax
  rate comparison — old calculation" card between the current rates card and the after-tax comparison. Pure
  restoration/addition — nothing about the current methodology changed. 455 tests.
- 2026-09-28 (d) — New "Your portfolio at retirement" card between the retirement number and the tax rate
  comparison (see its own section above): contribution difference, Existing Accounts and Future Contributions
  each grown and split by account type, and the total, ending with a hand-off line into the rate comparison's
  "stacked on top of" framing. Pure presentation — no new lib functions or tests, every number already existed
  on `result`. Removed the dead `ratesNew` headline key (left over from the deleted duplicate rates card).
  428 tests.
- 2026-09-28 (c) — Migrated everything to `sideAwareRates.js` as the sole rate calculation (see "The rates
  calculation" above for the full detail); the "new calculation" duplicate card is gone, so there is one
  "Tax rate comparison" card again. `lib/incomeNeed.js` and `tests/incomeNeed.test.js` deleted (no longer
  imported anywhere): `result.grossUp`, `result.rateDrivers` and the "$1,000/probe" machinery no longer exist.
  Updated: `ResultsSummary.jsx` (merged rates card, `RateWalkthrough` now guards `!sideAware.available` instead
  of crashing — a real bug found and fixed mid-migration, since `YearsWithoutSocialSecurity` could reach it
  with `$0` saved), `ScenarioCompare.jsx`, `scenarios.js`, `ScenariosPage.jsx`, ARTICLE.md (rewritten sections:
  "Tax saved now, effective rate later", "How the calculator estimates your retirement tax rate" now the
  three-step walk-through, the Social Security phase-in caveat paragraph, "Years without Social Security",
  "If you expect to spend more, or less, in retirement"). Two real behavior changes fell out and needed their
  own fixes: (1) `retirementLifestyle` no longer moves Section 2's rate/winner at all — only the retirement
  income number and Section 3's portfolio solve (model step 2); (2) the "Retirement years without Social
  Security" section's "Reading this" note claimed that view "can only tie or favor Pre-tax" outside a higher
  lifestyle, which is no longer true (a large existing Pre-tax balance can favor Roth there at ANY lifestyle
  now) — copy rewritten in `YearsWithoutSocialSecurity`. Every hand-verified test in `compare.test.js` and
  `scenarioCompare.test.js` affected by the old need-based numbers was re-derived by hand against the new
  model (not just adjusted to match the code) before being accepted; two of those hand-derivations (the
  "contribution limits...savings $40,000" and "...AT the limit" side-account tests) surfaced that the side
  account's own reported tax rate is now measured BEFORE the account's own withdrawal stacks on top of it —
  a real, order-dependent modeling choice, documented in "Known limitations." 426 tests (453 immediately
  before this change, minus the 27 in the deleted incomeNeed.test.js; no coverage was lost, since every
  scenario it tested is either now meaningless under the new model or re-tested elsewhere).
- 2026-09-28 (b) — "Show the full tax calculation" nested dropdown (see its section): every ordinary and capital-
  gains bracket, NIIT and the Social Security math, for each scenario's full stack. New `lib/taxBreakdown.js`
  (`explainFullTax`) and `sideAware.stackDetails`. The user is leaning toward adopting the new block as canonical;
  not yet done — see the "NOT done yet" list in the duplicate-block section (verdict, ScenarioCompare, Visualization,
  ARTICLE.md, and the "Retirement years without Social Security" dropdown all still use the old rates only). 455 tests.
- 2026-09-28 — Reworded the new-calculation block's walk-through from 4 steps to the SAME 3-step shape as the
  original (existing-accounts income -> the difference -> add the withdrawal), at the user's request: the taxable-
  account tax now lives inside Step 2 ("the difference"), which is always shown (a plain note when nothing exceeds
  the IRS limit) rather than appearing/disappearing. No calculation changed, only the walk-through's structure and
  wording. 449 tests.
- 2026-09-26 (d) — Duplicate "Tax rate comparison — new calculation" block (see its section): rates that include each scenario's taxable
  account and are measured on the account's actual 4% withdrawal, with a walk-through; the original block is unchanged. New
  `lib/sideAwareRates.js` (two hand-verified tests, the to-the-cent identity with the exact dollar comparison over 200+ inputs, the
  $500k regression), `sideAwareRateSteps` in rateSteps.js, a `ratesNew` headline, and `result.sideAware`. 449 tests.
- 2026-09-26 (c) — Visualization: each "Show the numbers" dropdown now holds ONE table (the plotted advantage; the separate gap table
  is gone); removed the "Married filing jointly" chart (every chart is now single-filer, and the page says so); added "Age 50: saving more,
  with a $500k existing Pre-tax balance" (5/10/20/30% saved across incomes) because age changes the answer once there is an existing
  balance and catch-up contributions raise the limit at 50. 438 tests.
- 2026-09-26 (o) — Removed the "Your tax rate now vs. later" subheading from the Tax rate comparison card (repeated
  the card title). 436 tests.
- 2026-09-26 (n) — "Clear all" (with undo) in the inputs card. Results cards renamed: "Roth vs. Traditional" ->
  "Tax rate comparison" (accent bar), "The trade-off in dollars" -> "After-tax comparison". 436 tests.
- 2026-09-26 (b) — Added a $500k income at the top end of every income axis (14 incomes, $25k-$500k) and as a line in the
  income-as-lines charts, which were trimmed to 5 lines each (lifestyle $25k/$50k/$75k/$150k/$500k; existing Pre-tax and taxable
  balance: $25k/$75k-or-$60k/$150k/$300k/$500k; retirement age $25k/$50k/$100k/$150k/$500k), so the sixth series colour was
  removed again. At $500k with no existing balance the two are about even (Roth +0.4%: later rate 28% vs. 35% now), so "Pre-tax
  wins at every income with no balance" now holds only up to $300k. Over-limit points (113 of 467) are where the rate gap
  predicts least (r² 0.53 vs. 0.98 for the rest): the gap covers only the account's withdrawals, not the taxable side. 434 tests.
- 2026-09-26 — Added a $25k income to every Visualization chart that has income: as an x-axis point (the income sweeps, MFJ sweep and both
  break-even maps: 13 incomes, $25k-$300k) and as a line in the lifestyle, existing Pre-tax balance, existing taxable balance and
  retirement-age charts (now 6 lines each, so the sixth series colour `--series-6` is back). At $25k the marginal rate is 10% and
  the later rate 0%, so Pre-tax wins by 10% with no existing balance. Rates that round to zero now print "0.0%" (not "-0.0%"). 434 tests.
- 2026-09-25 (m) — Layout: inputs become a list of collapsible sections with one-line summaries, beside the results
  (sticky left column on desktop); the four results cards collapse too, showing their headline when closed. New
  `lib/sectionSummaries.js` (hand-checked tests) and `components/Collapsible.jsx`. No model change. 434 tests.
- 2026-09-25 (l) — Cost basis moved into a collapsed dropdown under the taxable balance (summary shows the chosen
  share). The rate walk-through, when no withdrawal is needed (G = 0), now shows how "Extra tax that withdrawal would
  cause" is worked out: taxable SS and taxable income with the hypothetical withdrawal added (vs. before), the tax with
  it, and "$with − $without" (`rateSteps.js` probe rows, from `grossUp.probeStack`); the no-Social-Security dropdown
  gets the same rows. Display only, no model change. 425 tests.
- 2026-09-25 (k) — Visualization simplified and extended. One chart per batch (Roth's advantage with tinted "who wins" zones
  around the zero line) instead of gap + advantage; the "The rate gap" headings and repeated rule-of-thumb callouts removed
  (rule stated once, in the intro). Three Roth-friendly batches added (existing Pre-tax balance sweep, existing taxable balance
  sweep, married filing jointly with balances) and a second break-even map (income x existing Pre-tax balance). Scatter now
  coloured by winner (407 points, r² 0.97), dropping the per-batch colours/shapes and the 6th series colour. Fixed a bug from
  the previous commit: the retirement-age legend labels lost their "$" (a String.replace `$` collapse in my edit script — beware
  `$`/`$1` in replacement strings). 423 tests.
- 2026-09-25 (j) — Visualization additions: a "Who actually comes out ahead?" chart under every rate-gap chart; "What the rate
  gap is made of" (two-rates chart); a break-even map (income x savings rate heatmap); a retirement-age sweep batch; the rule of
  thumb highlighted as a callout in the intro and above every gap chart. New pure pieces: `runHeatmap`, `overLimit`,
  `HEATMAP`, `RETIREMENT_AGES` (tested). Scatter trend with all 279 points: r² 0.95. 420 tests.
- 2026-09-25 (i) — Re-ran all 199 Visualization scenarios on the current engine (taxable side account, cost basis, NIIT, corrected
  contribution-limit split) against the version from 2026-09-25 (cb363e4). The page is computed live, so it already showed the new
  numbers; nothing to regenerate. Rate gaps moved by up to 4.2 pts (mean ~0.4) and Roth advantage by up to 32 pts, mostly at
  high incomes / 20% savings where savings exceed the IRS limit (the old model overstated the Pre-tax spillover, so Roth looked far
  better there); 12 winners flipped, mostly Roth -> Pre-tax at $250k-$300k. The scatter trend went from r² 0.48 to 0.95 (about
  −1.1% Roth advantage per point of gap). Independently recomputed three points from the pieces (matched to the dollar), and
  corrected a wrong comment that said the limit never binds. Added two tests (a hand-verified over-the-limit scenario; charts use
  total after-tax income). 410 tests.
- 2026-09-25 (h) — NIIT modeled (see model step 4): `calculateNiit` + `data/niitRates.js`, in `totalTax`; the rate
  walk-throughs, "What sets the rate" and the total portfolio calculation show it only when owed. Hand-verified
  tests (capitalGainsTax, retirementTaxStack); the incomeNeed $300k-gains stacking test was re-derived by hand
  with NIIT (rate 15% -> 18.8%). ARTICLE.md updated. Removed the stale "self-employment tax not modeled" entry
  and expanded the 1099 limitations. 408 tests.
- 2026-09-25 (g) — Removed "Your portfolio at retirement" (the user found it muddying). The trade-off table is back
  to its pre-merge form, in its own "The trade-off in dollars" card below the rates. The total-value redundancy
  item is moot (the total now appears only in the total portfolio tax comparison). 395 tests.
- 2026-09-25 (f) — "Copy inputs to share" moved to the very bottom of the main inputs card. 395 tests.
- 2026-09-25 (e) — Layout: the rates get their own "Roth vs. Traditional" card; the portfolio summary and the
  trade-off table merged into one "Your portfolio at retirement" card below it (one table: what you put in -> total
  portfolio = Existing + Future Contributions -> Future Contributions only, after tax). Rates subhead shortened to
  "Your tax rate now vs. later". 395 tests.
- 2026-09-25 (d) — Cost basis for taxable accounts (see its section): existing taxable balances default to 50%
  basis with a dropdown; Future-Contribution spillover is all basis; only gains are taxed and count toward SS
  combined income. Hand-verified tests (new tests/retirementTaxStack.test.js; compare.test.js side-account figures
  re-derived by hand; all matched first run). "Copy inputs to share" moved to the page header. "Comparing a
  change" highlights the retirement income number and, more strongly, the marginal vs. effective rate rows
  (`headlineRows` rows carry `emphasis`). 396 tests.
- 2026-09-25 (c) — (1) MODEL FIX, contribution limit: both scenarios now cost the same take-home pay and whatever
  doesn't fit under the limit goes to a taxable account (`splitAtTakeHome`); at the limit with Roth savings, the
  Pre-tax side invests the tax it saves (e.g. $23,500 at 24% -> $5,640/yr). Old code overstated the Pre-tax
  spillover by 1/(1−t). The taxable side now counts in Section 2 (totals, capital-gains-taxed) and the verdict.
  Three new hand-verified compare tests (all matched first run). (2) Terminology "Future Contributions" /
  "Existing Accounts" across the UI and ARTICLE.md; new "Your portfolio at retirement" summary card above
  Section 1. (3) "Will you earn more or less later?" with both directions explained. (4) The trade-off table is one
  grouped table again, no Difference column, no "Tax on withdrawals" row. ARTICLE.md's maxing-out section
  rewritten (no longer "planned"). App.jsx future item removed. 388 tests.
- 2026-09-25 — Round of five: (1) lean line trimmed to the short phrase; (2) Section 3's "Tax paid is not the whole
  story" note replaced by a real figure, "After-tax income at a 4% withdrawal" per scenario (`portfolioTax`
  `atBaseline`, hand-verified), with the leader highlighted; ARTICLE.md updated; (3) retirement lifestyle
  gains 30%/40% lower; (4) Section 2 split into "Pre-tax builds a bigger account…" and "…but does it leave more
  after tax?" tables, "Total value of account" renamed "Total future value of your contributions"; (5) "Copy
  inputs to share" (text + reopen link). 382 tests.
- 2026-09-25 — "Compare a change" reworked: instead of pinning a baseline and editing the one form, it now opens a
  second full set of inputs beside the main form (changed fields highlighted); the main form stays the baseline.
  Buttons: Reset changes / Use these as my inputs / Stop comparing. 372 tests.
- 2026-09-25 — "Compare a change" (pin a baseline, edit, see both side by side incl. the rate calculation step
  by step). The rate-calculation dropdown now renders from `lib/rateSteps.js` rows (shared with the comparison).
  Recorded the new direction: internal advisor tool, desktop-first, future multi-calculator suite. 372 tests.
- 2026-09-25 — Five user adjustments. (1) MODEL FIX: Pre-tax savings (capped at the IRS limit) are now
  deducted before income tax when computing today's take-home pay, so the retirement income number rises for
  Pre-tax savers (default 2025 case: need 68,901 -> 71,101; a Pre-tax saver and the equivalent Roth saver now
  get the same need). Marginal rate still read before the deduction. The Section 1 dropdown gained "Step 1:
  federal income tax" showing the deduction, standard deduction, taxable income and tax saved. All affected
  hand-verified tests were re-derived by hand (all matched the code first time). (2) The rate dropdowns split
  tax into ordinary + capital-gains rows and show "…of which extra capital-gains tax" (the math already
  counted it). (3) The old "Why the rate … can be higher than your tax bracket" note became "What sets the rate
  on these withdrawals": income taxed first (other Pre-tax accounts + taxable SS -> start bracket), SS
  phase-in, capital-gains push. (4) Section 2 regrouped: "The comparison" rates, then "The trade-off in
  dollars" table with a Difference column and put-in / grows-to / keep groups. (5) "Tends to favor …" lean
  line under the rates. Note the app defaults now read "About even" (22.0% vs 22.2%, SS phase-in). ARTICLE.md
  example updated. 355 tests.
- 2026-09-25 — Scenario-charts page polish: renamed "Test the theory" -> "Visualization" everywhere (header/footer
  links, page title, h1, comments; the page text now says "rule of thumb" instead of "theory"); every chart now has
  a titled Y axis ("Rate gap (percentage points)" on the line charts, "Roth advantage (% of Pre-tax income)" on the
  scatter) and a titled X axis, with unit-free tick labels (+15, not "+15.0 pts"); more data points: 12 incomes
  ($40k-$300k, was 6) and lifestyle in 0.1 steps 1.0x-2.0x (was 0.2 steps), so the scatter now has 199 points.
  `LineChart` labels only round x values (via `niceTicks`) once there are more than 8 points, so labels do not collide.
  341 tests.
- 2026-09-23 — Two fixes reported by the user. (1) Catch-up contributions (age 50+, and SECURE 2.0's
  enhanced 60-63 401(k) tier) now raise the IRS limit used everywhere (contribution split, limit-check
  alert), keyed off `currentAge`. (2) The "Effective rate on these withdrawals" no longer jumps around
  confusingly when other income already covers the need (G = 0): the probe withdrawal used to read the
  rate is now sized to the account's own natural 4% withdrawal (stable, hand-verified) instead of a fixed,
  arbitrary $1,000 — see the two dedicated sections above for the full detail. Also fixed a "$0 ÷ $0"
  display bug found while investigating: the two rate-calculation dropdowns now show the real probe
  arithmetic instead of a formula that didn't match the value shown. 341 tests.
- 2026-09-22 — New scenario-charts page (originally titled "Test the theory", renamed "Visualization" on 2026-09-25) (`#/scenarios`, linked from the header/footer):
  charts the rate gap (marginal now − effective on withdrawals) across five hand-picked scenario batches
  (income; income × savings rate; income × existing balance at 35; income × existing balance at 50; and
  retirement lifestyle × income), plus a combined scatter of gap vs. Roth's after-tax advantage with an
  OLS trend line, to visually test whether the gap predicts the winner. New pure modules: `src/lib/scenarios.js`
  (runs `src/data/scenarioBatches.js` through the existing `compare.js`, no new financial logic),
  `src/lib/chartScale.js`, `src/lib/regression.js` — all hand-verified in tests before the UI was built.
  Charts are hand-rolled inline SVG (`src/components/charts/`), no new dependency. 313 tests.
- 2026-09-22 — Contribution limits: excess above the limit now defaults to a taxable account,
  independently per Roth/Pre-tax scenario (splitAtContributionLimit); Section 2 table shows a capping
  sub-note; limitCheck message names the exact excess. ARTICLE.md and the future-enhancements comment
  now distinguish "excess over the limit" (modeled) from "invest the Traditional deduction's tax
  savings at the limit" (still future work). 286 tests. Tax-drag / inefficiency of ongoing taxable-
  account growth (dividends/turnover taxed annually, on top of the withdrawal-time capital-gains tax
  already modeled) was discussed with the user and intentionally NOT built pending their direction —
  see the conversation; if picked up later, keep it as an explicit, separately-labeled assumption
  (e.g. a haircut on the taxable bucket's return), not folded silently into `returnRate`.
- 2026-09-22 — Round 4 UI cleanup: moved 'Will you earn more later?' directly below gross income
  (was above it); moved Social Security benefit + 'Income needed from your portfolio' to directly
  below the hero retirement number, above 'How is this calculated?' (was above the hero); removed the
  explanatory lead sentence ('The number that matters most...'), the rate-lean verdict sentence, the
  Section 2 winnerText verdict paragraph, and the table caption — the calculator stays numbers-first,
  explanatory prose lives in ARTICLE.md only. The overall effective rate no longer has an outer
  reference line; it exists only inside the 'How are the retirement rates calculated?' dropdown
  (value + explanation, both already there). Added an 'Adjusted gross income, AGI' row (Pre-tax +
  taxable-account withdrawals + taxable Social Security) to the Section 3 calculation dropdown, between
  'Taxable part of Social Security' and the (renamed) 'Ordinary taxable income' row — renamed from
  'Taxable income' to avoid confusion with the new AGI row (this model's ordinary taxable income
  deliberately excludes the capital-gains component, which is taxed separately — do not "simplify"
  this to AGI − standard deduction, that would overstate it). 271 tests.
- 2026-09-22 — Capital gains: replaced the flat 15% LTCG rate with the real 0%/15%/20% brackets, stacked
  on top of ordinary income (see the dedicated section above). UI: highlighted "Effective rate on these
  withdrawals" as the number that matters (paired with marginal rate, gap-lean sentence), de-emphasized
  the overall effective rate to a reference line; moved Social Security benefit + a new "Income needed
  from your portfolio" figure into the retirement-number section, above the hero; moved the retirement-
  lifestyle assumption into its own dropdown ("Will you earn more later?") at the top of the income
  section, aimed explicitly at people who expect to earn more later; added a one-line caption above the
  Section 2 table noting it illustrates the rate gap. 270 tests.
- 2026-09-20 — Article is now an in-app page: `#/how-it-works` renders ARTICLE.md (marked + ?raw), linked
  from the header and footer with a back link; wording fixed (no "Section 3", current dropdown names). Round 3
  moved the rates to the top of Roth vs. Traditional. 250 tests.
- 2026-09-20 — Round 3: retirement number is its own section; rates at the top of the Roth vs. Traditional
  section (first placed in the portfolio section by mistake, then corrected) and renamed (effective rate on these withdrawals; new overall effective rate = total tax ÷ gross
  income); "Simple view" renamed "Retirement years without Social Security" and now headlines the blended
  rate; W-2 / 1099 income type with self-employment tax (verified vs IRS Topic 554); retirement-lifestyle
  assumption (0.8–2×); effective-rate dropdown wording; 242 tests.
- 2026-09-19 — Round 2 UI changes: reworded rate note; savings/account-type hints; return moved into an
  Assumptions dropdown; contribution amounts moved into the Section 2 table; "Gross income" label in
  Section 3; effective-rate dropdown rewritten (this account vs other income, Steps 1–3); new
  "Simple view" (no Social Security, marginal rate) with hand-verified tests + property test. 203 tests.
- 2026-09-19 — Initial build (data, lib, tests, UI, article). Added FICA; hero line + calculation
  dropdowns; Social Security shown in Section 3. Published to GitHub + Netlify. Added 2026 data verified
  against IRS pages; article examples moved to 2026 figures. Created this file.
