# CLAUDE.md — project notes for Claude Code

Read this first in a new session. Keep it SHORT: it loads into every session. It holds only what a session needs to
work: ground rules, commands, code map, the current step, and pointers. **Where things are written:** the round 2 plan
doc (below) holds the plan, each step's status and every decision with its reason, the single source of truth;
git history holds what changed in the code; `docs/history.md` is the frozen archive of round one (search it before
re-deciding something old). Don't copy decisions into this file. Add one change-log line per step at the bottom.

## What this is
Client-side React (Vite) app for financial advisors (owner: Michael Sharpnack): a suite of calculators on one
household model: the tax calculator, the Roth vs. Pre-tax comparison, a year-by-year projection with withdrawal
strategies, Roth conversion and pension calculators, Medicare IRMAA, and Supabase sign-in with saved households.
- **The switchover is done (2026-10-08):** the suite is the site at `#/`; the old single Roth calculator's code is
  deleted. Old links still work: `#/next/...` → the same page, `#/how-it-works` → `#/docs/roth`, an old
  `?grossIncome=...` link opens as a one-person household.
- **Docs** (`#/docs`): one markdown article per feature in `articles/`; each must match actual behavior.
- Gating, free/simple versions: later (the user, 2026-10-08: focus on the product's UI and functionality now).

## Direction and roadmap
- Rate terms (the user's, standard usage, everywhere in the preview): **marginal rate** = the tax bracket; **average tax
  rate** = total tax ÷ total income (what most sources call "effective tax rate", so never write "effective rate" alone for
  it); **effective marginal rate (EMTR)** = the real tax on the next dollar, with everything it sets off. Explained in `articles/rates.md`. The Roth comparison keeps its pairing: marginal today vs. the effective rate on the withdrawal.
- Audience: internal advisor tool; advisor-level density is fine. Desktop-first (phone must not break, no polish goal).
- **Round 2 plan (current):** https://claude.ai/artifact/DQyr9BcgMUKAkxpue1SmNU (same doc as
  https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095; a Claude Doc, edited only through the Claude
  Docs connector). **Keep it updated:** at the end of each step, and whenever the user decides something, write the
  status and decisions into it. If the connector is unavailable, say so and queue the text in
  `docs/plan-doc-pending.md`; write the queue into the doc as soon as the connector is back. Its sections: the phases
  (0 to 11), "How the plan fits together" (decision calculators vs. the plan evaluators; what the projection must
  include), the decision tables and the open questions.
- **Current step:** phase 2, steps (a)–(e) done (survivor years, tax drag, employer contributions, returns before and
  after retirement; 2026-10-09); next is (f), the rest of the household in the projection (steps in the plan doc).
- **Docs**: articles listed in `src/lib/docs.js`; each phase ends with its article. **Feedback:** "Send feedback" on every page, through Netlify Forms (the hidden form in
  `index.html`; Netlify's form detection must be on).
- Round one's plan (finished): https://claude.ai/artifact/WGnaEb88G1i2n26rsBeT45.
- Defaults decided: everything in TODAY's dollars (real return; brackets and limits indexed by law); fixed-dollar
  thresholds (SS taxability, NIIT, Additional Medicare, the senior deduction) shrink at the inflation input (2.5%) via
  `thresholdScale`. A today's/future-dollars switch is a later item.
- Paused at the user's request (2026-10-07): security launch items (`docs/security.md`), free/simple versions.

## Ground rules
1. **Math first:** data + pure functions in `src/lib` → unit tests with **hand-verified** arithmetic (worked out by hand
   BEFORE running the code, kept in comments) → only then UI. When code and hand math disagree, find out which is wrong.
2. All financial logic is pure and framework-free in `src/lib/`. Data is year-keyed in `src/data/`; `getYearData` picks
   the latest year <= the one requested. Old hand-calc tests pin `year: 2025`/`2026`.
3. Results change only on purpose: a change to existing numbers is one the user decided (record it in the plan doc).
   New engine options default to today's results; the v1 pins (`tests/householdV1Pins.test.js`) change by additions
   only unless a decided change says otherwise.
4. Calculator pages go in `src/next/`; shared components in `src/components/`; math in `src/lib`.
5. Don't push or publish without the user's say-so. Report failures and skipped steps plainly.
6. Run `npm test` and `npm run lint` before committing. One logical change per commit, so history stays clean.

## Commands
```
npm run dev       # dev server (port 5173 is allowed in Supabase's redirect URLs)
npm test          # vitest, 4 workers at a time (more ran the Windows laptop out of memory); 810 tests
npm run lint      # ESLint with the React hooks rules
npm run build     # static site -> dist/ (base './')
```

## Deployment / git
- Repo https://github.com/Sharptack/roth-vs-traditional-app (**public**), branch `main`. Live:
  https://astonishing-sprite-b5d581.netlify.app/ (Netlify builds on push to `main`).
- **Netlify credits: keep production deploys down.** A build costs 15 credits (free plan 300/month, about 20). Commit
  locally and push in BATCHES, only when the user asks. `netlify.toml`'s `ignore` rule skips builds when no site file
  changed (src, index.html, public, package files, vite.config.js, articles, netlify.toml); add any new folder the site
  imports from. Skipped builds, branch deploys and form submissions are free.
- Pushing: on the Windows laptop Claude can push (`gh` signed in); on the home Mac the user pushes (VS Code Sync
  Changes). Always say when commits are unpushed.
- Git identity (repo-local, both devices): Michael Sharpnack <sharpnackm7@gmail.com>. End commit messages with the
  `Co-Authored-By:` line for the Claude model in use. Line endings: LF everywhere (`.gitattributes`).
- Devices: home Intel Mac and a Windows 11 laptop (PowerShell 5.1: no `&&`; Git Bash available). One device at a time:
  pull before starting. New device: clone → `npm install` (Node 20.19+/22.12+) → `.env.local` from `.env.example`
  (Supabase URL + anon key; never the service_role key) → `npm test` → `npm run dev`.
- **Annual tax-law update:** `docs/annual-update.md`. Every yearly table is listed in `src/data/yearlyTables.js`;
  `tests/yearlyTables.test.js` fails from January 1 until each has the new year's figures.

## Code map
- `src/data/`: year-keyed tables: `taxBrackets`, `capitalGainsBrackets`, `ficaRates` (incl. the SS wage base),
  `ssBendPoints` (+ full retirement age by birth year), `contributionLimits` (catch-up 50+ and 60–63), `ageDeductions`
  (65+ and the 2025–2028 senior deduction), `irmaa`; fixed by law: `ssTaxThresholds`, `niitRates`, `rmdTable`;
  `yearlyTables.js` (the annual-update registry); `scenarioBatches.js` (Visualization page data).
- `src/lib/` tax engine: `yearTax.js` (`calculateYearTax`, the ONE engine: every income source, payroll tax, SS
  taxability, ordinary + capital-gains brackets, NIIT, age deductions, marginal rates, bracket room; options
  `thresholdScale`, `rateShift`, `calendarYear`, `qbi`; `calculateYearTaxTotals` = without the marginal probes) built from
  `taxCalculations`, `capitalGainsTax`, `ficaTax`, `socialSecurityTax`, `qbi.js` (the QBI deduction, basic rule);
  `retirementTaxStack.js` (`calculateRetirementTax`, a thin wrapper over the engine since 2026-10-07); `yearTaxRows.js`
  and `taxBreakdown.js` (the calculation as rows); `childTaxCredit.js` and `dependents.js` (the credit, and who counts each year); `rateProfile.js` (the tax page's two buckets: bracket and next-dollar rate
  up the income scale); `iraRules.js` (Roth IRA limits, IRA deduction phase-out, Roth catch-up).
  The preview turns QBI on through `household.assumptions.qualifiedBusinessIncome` (version 2 households).
- `src/lib/` Roth comparison: `compare.js` (orchestrator, every number on the Roth page; optional
  inputs `earners`, `contributors`, `retirementTaxRules`, `taxSavedAcrossContribution`, `skipBlend`), `sideAwareRates.js`
  (the rate comparison; identity (X − e) × W = the exact after-tax difference), `portfolioTax.js`, `blend.js`,
  `rateSteps.js`, `growthCalculations.js`, `contributionLimits.js`, `socialSecurity.js`, `risingIncome.js`, `scenarios.js`; `formInputs.js`/`shareInputs.js` (the old calculator's v1 values and links, still read).
- `src/lib/` version 2 household (phase 0): `householdValues.js` (v2 form values: people, income/contribution/
  account/liability rows, linked age/birthdate; `cleanHouseholdValues`, the allow-list for saves and links),
  `householdV2.js` (`toHouseholdV2`: v2 values → the same household object the calculators read),
  `householdUpgrade.js` (v1 → v2), `employerContributions.js` (the employer 401(k) match or flat amount), `householdInputs.js` (the inputs page's sections and summaries, and
  `CALCULATOR_INPUTS`: the sections and fields each calculator reads). The preview's form, saves (schema_version 2)
  and links (`?hh=2`) are v2 since step (b); v1 saves and links open converted. v1 pins:
  `tests/householdV1Pins.test.js` + `tests/fixtures/`.
- `src/lib/` calculators: `household.js` (v1 form values → household → compare inputs), `householdLink.js`
  (share links), `householdText.js`, `savedHousehold.js`, `taxCalculator.js`, `conversionCalculator.js`,
  `pensionCalculator.js`, `irmaa.js`, `rmd.js`, `projection.js` (`runProjection`: the year loop, strategy seam),
  `strategies.js`, `projectionSummary.js` (sustainable spending, `projectionView`), `lifetimeComparison.js`, `suiteTiles.js`.
- UI: `src/App.jsx` (the shell: hash routes from `src/lib/route.js`, NextApp always mounted, Docs and Visualization
  lazy, the feedback footer), `src/components/` (`ResultsSummary.jsx` = the Roth page's blocks, `fields.jsx` = form
  inputs, `DocsPage.jsx`, `Feedback.jsx`, `charts/`), `src/next/` (`NextApp.jsx`: the home page, the inputs page
  and each calculator, computed only on its own page or the home tiles; `HouseholdInputs.jsx` = the v2 form;
  `Blocks.jsx` lays out results, headlines from `src/lib/blockHeadlines.js`), `src/services/` (Supabase).
- Backend: `supabase/migrations/` (saved households with forced RLS; an audit log; households open only through
  `open_saved_household`), `supabase/tests/` (self-check SQL the user runs), `docs/backend-setup.md`, `docs/security.md`.
- Tests: `tests/` mirrors `src/lib`, plus `components.smoke.test.jsx`.

## How the model works (short; full detail in docs/history.md)
- Today: income tax + payroll tax; the marginal rate is read before any Pre-tax deduction. Retirement income number =
  take-home pay − costs that end − savings, × lifestyle.
- Roth vs. Pre-tax: same take-home cost both ways; over the IRS limit the excess goes to a taxable "side
  account"; the effective rate is the extra tax Future Contributions' own 4% withdrawal causes on top of Social Security
  + Existing Accounts + the side account; taxable withdrawals split pro-rata into basis and gain.
- Social Security: per person, estimated from earnings or from an entered PIA; the spousal top-up from
  both.
- Also: inflation on fixed thresholds, 65+ deductions, tax saved across the whole contribution, a
  retirement rate what-if, IRMAA (two-year lookback), RMDs, a projection from today to the end age with strategies and
  conversions, sustainable spending, the lifetime comparison (headline = sustainable spending).
- Known gaps, planned additions and open questions: the plan doc.

## Checking the UI
Headless Chrome via the DevTools protocol (Node's built-in WebSocket; no puppeteer): launch with
`--remote-debugging-port`, navigate, evaluate, `Page.captureScreenshot`. Windows: `C:/Program Files/Google/Chrome/
Application/chrome.exe`. The calculators stay mounted (hidden) behind the Docs and Visualization routes, so scope selectors
(e.g. `.next-app`). Set React inputs with the native value setter + an input event.

## Change log (one line per step; older entries in docs/history.md, details in git and the plan doc)
- 2026-10-09 — Phase 2 (e): a return in retirement (assumptions.retirementReturnRate, default the same), in the
  projection once no one works and on the pension page. 810 tests.
- 2026-10-09 — Phase 2 (d): employer 401(k) contributions, a match or a flat amount per row (employerContributions.js),
  in the projection and the Roth comparison. 806 tests.
- 2026-10-09 — Phase 2 (c): tax drag, qualified dividends on taxable accounts (assumptions.dividendYield, 1.3%) in the
  projection and the Roth comparison (growTaxable). 795 tests.
- 2026-10-09 — Phase 2 (a)+(b): survivor years in the engine and on the projection page; the end named by year for
  a couple (whenLabel). 782 tests.
- 2026-10-09 — Before phase 2: inputs in four groups; Social Security and pensions as income rows (a pension counts in
  every calculator); plan-to age per person; saved-household widget; page fixes. 774 tests.
- 2026-10-08 (k) — The switchover: the calculators are the site at `#/`, old links redirect, the old calculator's code
  deleted, ARTICLE.md → `articles/roth.md` (updated to the Roth page). 759 tests (old-calculator tests removed).
- 2026-10-08 (j) — Phase 1 steps (d) and (e): Start a new household, who can contribute, Compare a change, Use in the plan
  (trial), snapshot at the last retirement; EMTR terms; Docs articles (tax, pension, rates). 781 tests.
- 2026-10-08 (i) — Phase 1 step (c): pension on SSA period life table (src/data/lifeTable.js); Docs rates article. 771 tests.
- 2026-10-08 (h) — Rates named marginal (bracket) / effective (next dollar) / average; the child tax credit. 764 tests.
- 2026-10-08 (g) — Phase 1 step (b): itemized deductions; tax rows rebuilt; the two buckets (rateProfile.js). 754 tests.
- 2026-10-08 (f) — Phase 1 step (a): QBI deduction in the preview; Roth IRA / IRA-deduction / Roth catch-up rules. 740 tests.
- 2026-10-08 (e) — Phase 0 done: the Docs section with the inputs article; Send feedback on every page. 724 tests.
- 2026-10-08 (d) — Phase 0 step (c): results as blocks with headlines on every calculator; the collapse bar. 714 tests.
- 2026-10-08 (c) — Plan doc caught up (queue written, "How the plan fits together" added); this file trimmed to pointers.
- 2026-10-08 (b) — Phase 0 step (b): inputs page, one inputs card per calculator, saves and links in v2. 709 tests.
- 2026-10-08 (a) — Phase 0 step (a): the v2 household, conversion from v1, v1 results pinned. 704 tests.
- 2026-10-07 — Code pass (LF, ESLint, one tax engine, annual-update registry, lazy pages), IRMAA, saved households on
  every page, the switchover decided, the round 2 plan reworked. 627 tests.
