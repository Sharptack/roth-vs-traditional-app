# CLAUDE.md — project notes for Claude Code

Read this first in a new session. Keep it SHORT: it loads into every session. Current rules, structure, decisions
and state only. Detail and history (why each feature is built the way it is, every past decision, the change log
from 2026-09-19 to 2026-10-07) live in **`docs/history.md`**; search it before re-deciding something. Update this file
when behavior, decisions or workflow change, and add a line to the change log at the bottom.

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
- **Round 2 plan (current):** https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095. Phases: 0 inputs,
  calculators and blocks (inputs page in blocks with people side by side, income/contribution/liability rows, linked
  age/birthdate, biological sex for life tables, PIA input, one inputs card per calculator, collapse bar, blocks
  everywhere, version 2 household); 1 calculator updates (tax page vs. TaxClarity, pension on life tables, Roth merge);
  2 survivor years (+ engine additions, see the doc); 3 what resources allow you to spend (legacy goal); 4 Pre-retirement
  funding; 5 Social Security; 6 year-by-year planner; 7 Roth vs. Pre-tax with conversions (blocks on the Roth page);
  8 Monte Carlo; 9 guardrails; 10 household plans; 11 liabilities and debt pay-off. Throughout: a public Docs section,
  a Netlify Forms feedback link. Later / advanced rounds are listed in the doc. Decisions are recorded in its tables.
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
npm test          # vitest, 4 workers at a time (more ran the Windows laptop out of memory); 627 tests
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
- `src/lib/` preview: `household.js` (form values → household → compare inputs), `householdForm.js`, `householdLink.js`
  (share links), `householdText.js`, `savedHousehold.js`, `taxCalculator.js`, `conversionCalculator.js`,
  `pensionCalculator.js`, `irmaa.js`, `rmd.js`, `projection.js` (`runProjection`: the year loop, strategy seam),
  `strategies.js`, `projectionSummary.js` (sustainable spending, `projectionView`), `lifetimeComparison.js`, `suiteTiles.js`.
- UI: `src/App.jsx` (public page; the article, Visualization and preview load lazily), `src/components/` (public
  components; `ResultsSummary.jsx` is large and gets split per block in phase 0; `charts/`), `src/next/` (preview pages;
  `NextApp.jsx` computes each calculator only on its own page or the homepage tiles), `src/services/` (Supabase).
- Backend: `supabase/migrations/` (saved households with forced RLS; an audit log; households open only through
  `open_saved_household`), `supabase/tests/` (self-check SQL the user runs), `docs/backend-setup.md`, `docs/security.md`.
- Tests: `tests/` mirrors `src/lib`, plus `components.smoke.test.jsx`.

## How the model works (short; full detail in docs/history.md)
- Today: income tax + payroll tax; the marginal rate is read before any Pre-tax deduction. Retirement income number =
  take-home pay − costs that end − savings, × lifestyle.
- Roth vs. Pre-tax (public): same take-home cost both ways; over the IRS limit the excess goes to a taxable "side
  account"; the effective rate is the extra tax Future Contributions' own 4% withdrawal causes on top of Social Security
  + Existing Accounts + the side account; taxable withdrawals split pro-rata into basis and gain.
- Preview additions: inflation on fixed thresholds, 65+ deductions, tax saved across the whole contribution, a
  retirement rate what-if, IRMAA (two-year lookback), RMDs, a projection from today to the end age with strategies and
  conversions, sustainable spending, the lifetime comparison (headline = sustainable spending).
- Known gaps (planned or noted in the round 2 doc): tax drag on taxable accounts, employer contributions, Roth IRA
  income limits and the high-earner Roth catch-up rule, QBI, survivor years, separate pre/post-retirement returns,
  early-withdrawal penalties, tax-exempt interest, QCDs, state tax (out of scope).

## Checking the UI
Headless Chrome via the DevTools protocol (Node's built-in WebSocket; no puppeteer): launch with
`--remote-debugging-port`, navigate, evaluate, `Page.captureScreenshot`. Windows: `C:/Program Files/Google/Chrome/
Application/chrome.exe`. The public calculator stays mounted (hidden) behind other routes, so scope selectors (e.g.
`.next-app`). Set React inputs with the native value setter + an input event.

## Change log (recent; older entries in docs/history.md)
- 2026-10-07 (i) — Decided: the new version replaces the public calculator at the end of round 2's phase 1 (switchover
  steps in the plan doc). No code change. 627 tests.
- 2026-10-07 (h) — Code and efficiency pass (one commit each): LF line endings; tests capped at 4 workers; ESLint
  (`npm run lint`) and its fixes; one tax engine (`calculateRetirementTax` wraps `calculateYearTax`, public numbers
  unchanged); the annual-update registry, reminder test and checklist; `skipBlend` and per-page computing in the
  preview; lazy-loaded pages (main bundle 509 kB → 314 kB). CLAUDE.md slimmed; the full old file is
  `docs/history.md`. 627 tests.
- 2026-10-07 (g) — Round 2 plan reworked with the user's answers; Netlify ignore rule. 619 tests.
- 2026-10-07 (e) — Medicare IRMAA in the preview (projection, tax and conversion pages). 619 tests.
- 2026-10-07 (d) — Saved households on every preview calculator page, with an "Unsaved changes" marker. 603 tests.
