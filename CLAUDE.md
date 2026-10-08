# CLAUDE.md — project notes for Claude Code

Read this first in a new session. Keep it SHORT: it loads into every session. It holds only what a session needs to
work: ground rules, commands, code map, the current step, and pointers. **Where things are written:** the round 2 plan
doc (below) holds the plan, each step's status and every decision with its reason, the single source of truth;
git history holds what changed in the code; `docs/history.md` is the frozen archive of round one (search it before
re-deciding something old). Don't copy decisions into this file. Add one change-log line per step at the bottom.

## What this is
Client-side React (Vite) app for financial advisors (owner: Michael Sharpnack). Two parts on one site:
- **The public calculator** (`#/`): Roth vs. Pre-tax contributions, no backend. The user still edits it directly.
  **It is REPLACED at the switchover (user, 2026-10-07), at the end of round 2's phase 1:** the new version moves to
  `#/`, old public links open as a one-person household, ARTICLE.md becomes the Roth Docs article, the old code is
  deleted by a checklist (see the plan doc's "Switchover" section). Until then it stays intact.
- **The `#/next` preview**: the new suite: a household model, a tax calculator, the Roth comparison, a year-by-year
  projection with withdrawal strategies, Roth conversion and pension calculators, Medicare IRMAA, and Supabase sign-in
  with saved households. Not linked from the public page; "Preview, not finished" banner.
- `ARTICLE.md` is the public "How this works" page for the public calculator (rendered by `ArticlePage.jsx`); it must
  match actual behavior. It becomes the Roth article of the planned Docs section.

## Direction and roadmap
- Audience: internal advisor tool; advisor-level density is fine. Desktop-first (phone must not break, no polish goal).
- **Round 2 plan (current):** https://claude.ai/artifact/DQyr9BcgMUKAkxpue1SmNU (same doc as
  https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095; a Claude Doc, edited only through the Claude
  Docs connector). **Keep it updated:** at the end of each step, and whenever the user decides something, write the
  status and decisions into it. If the connector is unavailable, say so and queue the text in
  `docs/plan-doc-pending.md`; write the queue into the doc as soon as the connector is back. Its sections: the phases
  (0 to 11), "How the plan fits together" (decision calculators vs. the plan evaluators; what the projection must
  include), the decision tables and the open questions.
- **Current step:** phase 0, step (c): blocks everywhere and the collapse bar.
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
3. **Until the switchover, the public calculator's numbers must not change** unless the user asks: shared `src/lib` changes are additive
   (new optional inputs whose defaults reproduce today's results), and every existing test must pass unchanged.
   When a preview page reuses a public component, check the public page still renders the same.
4. New preview UI goes in `src/next/`; new math in `src/lib` (shared).
5. Don't push or publish without the user's say-so. Report failures and skipped steps plainly.
6. Run `npm test` and `npm run lint` before committing. One logical change per commit, so history stays clean.

## Commands
```
npm run dev       # dev server (port 5173 is allowed in Supabase's redirect URLs)
npm test          # vitest, 4 workers at a time (more ran the Windows laptop out of memory); 709 tests
npm run lint      # ESLint with the React hooks rules
npm run build     # static site -> dist/ (base './')
```

## Deployment / git
- Repo https://github.com/Sharptack/roth-vs-traditional-app (**public**), branch `main`. Live:
  https://astonishing-sprite-b5d581.netlify.app/ (Netlify builds on push to `main`).
- **Netlify credits: keep production deploys down.** A build costs 15 credits (free plan 300/month, about 20). Commit
  locally and push in BATCHES, only when the user asks. `netlify.toml`'s `ignore` rule skips builds when no site file
  changed (src, index.html, public, package files, vite.config.js, ARTICLE.md, netlify.toml); add any new folder the site
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
  `thresholdScale`, `rateShift`, `calendarYear`; `calculateYearTaxTotals` = without the marginal probes) built from
  `taxCalculations`, `capitalGainsTax`, `ficaTax`, `socialSecurityTax`; `retirementTaxStack.js` (`calculateRetirementTax`,
  a thin wrapper over the engine since 2026-10-07); `yearTaxRows.js` and `taxBreakdown.js` (the calculation as rows).
- `src/lib/` Roth comparison (public + preview): `compare.js` (orchestrator, every number on the Roth page; optional
  inputs `earners`, `contributors`, `retirementTaxRules`, `taxSavedAcrossContribution`, `skipBlend`), `sideAwareRates.js`
  (the rate comparison; identity (X − e) × W = the exact after-tax difference), `portfolioTax.js`, `blend.js`,
  `rateSteps.js`, `growthCalculations.js`, `contributionLimits.js`, `socialSecurity.js`, `risingIncome.js`, `scenarios.js`.
- `src/lib/` version 2 household (phase 0): `householdValues.js` (v2 form values: people, income/contribution/
  account/liability rows, linked age/birthdate; `cleanHouseholdValues`, the allow-list for saves and links),
  `householdV2.js` (`toHouseholdV2`: v2 values → the same household object the calculators read),
  `householdUpgrade.js` (v1 → v2), `householdInputs.js` (the inputs page's sections and summaries, and
  `CALCULATOR_INPUTS`: the sections and fields each calculator reads). The preview's form, saves (schema_version 2)
  and links (`?hh=2`) are v2 since step (b); v1 saves and links open converted. v1 pins:
  `tests/householdV1Pins.test.js` + `tests/fixtures/`.
- `src/lib/` preview: `household.js` (v1 form values → household → compare inputs), `householdLink.js`
  (share links), `householdText.js`, `savedHousehold.js`, `taxCalculator.js`, `conversionCalculator.js`,
  `pensionCalculator.js`, `irmaa.js`, `rmd.js`, `projection.js` (`runProjection`: the year loop, strategy seam),
  `strategies.js`, `projectionSummary.js` (sustainable spending, `projectionView`), `lifetimeComparison.js`, `suiteTiles.js`.
- UI: `src/App.jsx` (public page; the article, Visualization and preview load lazily), `src/components/` (public
  components; `ResultsSummary.jsx` is large and gets split per block in phase 0; `charts/`), `src/next/` (preview pages;
  `NextApp.jsx` computes each calculator only on its own page or the homepage tiles; `HouseholdInputs.jsx` is the v2
  form: the inputs page `#/next/inputs` and each calculator's inputs card), `src/services/` (Supabase).
- Backend: `supabase/migrations/` (saved households with forced RLS; an audit log; households open only through
  `open_saved_household`), `supabase/tests/` (self-check SQL the user runs), `docs/backend-setup.md`, `docs/security.md`.
- Tests: `tests/` mirrors `src/lib`, plus `components.smoke.test.jsx`.

## How the model works (short; full detail in docs/history.md)
- Today: income tax + payroll tax; the marginal rate is read before any Pre-tax deduction. Retirement income number =
  take-home pay − costs that end − savings, × lifestyle.
- Roth vs. Pre-tax (public): same take-home cost both ways; over the IRS limit the excess goes to a taxable "side
  account"; the effective rate is the extra tax Future Contributions' own 4% withdrawal causes on top of Social Security
  + Existing Accounts + the side account; taxable withdrawals split pro-rata into basis and gain.
- Social Security (preview, v2): per person, estimated from earnings or from an entered PIA; the spousal top-up from
  both.
- Preview additions: inflation on fixed thresholds, 65+ deductions, tax saved across the whole contribution, a
  retirement rate what-if, IRMAA (two-year lookback), RMDs, a projection from today to the end age with strategies and
  conversions, sustainable spending, the lifetime comparison (headline = sustainable spending).
- Known gaps, planned additions and open questions: the plan doc.

## Checking the UI
Headless Chrome via the DevTools protocol (Node's built-in WebSocket; no puppeteer): launch with
`--remote-debugging-port`, navigate, evaluate, `Page.captureScreenshot`. Windows: `C:/Program Files/Google/Chrome/
Application/chrome.exe`. The public calculator stays mounted (hidden) behind other routes, so scope selectors (e.g.
`.next-app`). Set React inputs with the native value setter + an input event.

## Change log (one line per step; older entries in docs/history.md, details in git and the plan doc)
- 2026-10-08 (c) — Plan doc caught up (queue written, "How the plan fits together" added); this file trimmed to pointers.
- 2026-10-08 (b) — Phase 0 step (b): inputs page, one inputs card per calculator, saves and links in v2. 709 tests.
- 2026-10-08 (a) — Phase 0 step (a): the v2 household, conversion from v1, v1 results pinned. 704 tests.
- 2026-10-07 — Code pass (LF, ESLint, one tax engine, annual-update registry, lazy pages), IRMAA, saved households on
  every page, the switchover decided, the round 2 plan reworked. 627 tests.
