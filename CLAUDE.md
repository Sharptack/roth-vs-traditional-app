# CLAUDE.md — project notes for Claude Code

Living document. **Update it whenever behavior, decisions, data or workflow change**, and add a line to
the change log at the bottom. Read this first in a new session.

## What this is
Client-side React (Vite) calculator: does a Roth or Pre-tax (Traditional) contribution leave more
after-tax wealth? Bracket-aware, budget-driven ("top-down") model. No backend. Owner: Michael Sharpnack.
Plain-language explainer in `ARTICLE.md` (must match actual behavior — update it when behavior changes).

## Commands
```
npm run dev       # dev server (occupies the terminal; Ctrl+C to stop, or use a second tab)
npm test          # vitest: calc layer + component smoke tests (203 tests at last count)
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
- `src/data/`: `taxBrackets.js` (2025, 2026), `ficaRates.js` (also owns the SS wage base),
  `ssBendPoints.js` (+ FRA table by birth year), `ssTaxThresholds.js` (fixed by law), `contributionLimits.js`.
- `src/lib/`: `taxCalculations` (progressive tax, marginal rate), `ficaTax`, `socialSecurityTax`
  (IRS combined-income formula), `socialSecurity` (simplified benefit estimator), `retirementTaxStack`
  (shared tax on a retirement income stack), `solver` (monotonic binary search), `incomeNeed`
  (gross-up for one account), `portfolioTax` (scale-factor solver across buckets), `growthCalculations`,
  `contributionLimits`, `compare` (orchestrator; single source of every UI number), `constants`
  (`WITHDRAWAL_RATE` 4%, `LTCG_RATE` 15%, 90% limit threshold), `format`, `formInputs`, `yearLookup`.
- `src/components/`: `InputForm.jsx`, `ResultsSummary.jsx`. `src/App.jsx` holds state and the
  "Future enhancements" comment block. `tests/` mirrors `src/lib` plus `components.smoke.test.jsx`.

## The model (as built)
1. Current tax: income tax on (gross − standard deduction) + **FICA** (employee share). Marginal rate =
   rate of the bracket the next dollar falls in (0% if income is below the standard deduction).
2. Retirement income number (after-tax need) = gross − income tax − FICA − debt payments ending −
   other expenses ending − retirement savings (as entered). Floored at 0. FICA is subtracted because it
   stops at retirement.
3. Social Security: user-entered benefit, or a simplified estimate (AIME = income capped at wage base / 12,
   bend-point PIA, claiming age = retirement age clamped to 62–70, FRA from birth year = year − age).
4. Other balances grow at the chosen return to retirement; 4% of each is withdrawn. Pre-tax = ordinary
   income; Roth = tax-free; taxable = flat 15% and counts toward SS "other income".
5. **Effective rate in retirement** (`incomeNeed`): binary-search the gross withdrawal G from *this* account
   so total after-tax income = need. Rate = (extra tax caused by G) / G, i.e. incremental blended rate
   including the Social Security phase-in. If other sources already cover the need (G = 0), the rate is
   read from a $1,000 probe withdrawal.
6. Paycheck equivalents: Roth R = P·(1−t); Pre-tax P = R/(1−t), t = current marginal rate.
7. Section 2 compares annuity FV of R vs P; Pre-tax after-tax value uses (1 − effective rate).
8. Section 3 (`portfolioTax`): per scenario (all-Roth / all-Pre-tax), 4% baseline per bucket, one scale
   factor k found by binary search so after-tax income (withdrawals + full SS − tax) = need.
   Taxable SS uses (pretax + taxable withdrawals) as "other income".
9. No inflation is modeled: treat the return as a real (after-inflation) return; all dollars are today's.
10. **Simple view** (`compare.js` -> `withoutSocialSecurity`): same comparison with Social Security set to
    $0, so accounts must supply the whole need. Retirement rate = **marginal** rate (bracket of the last
    dollar of the stack: other pre-tax draws + this account's gross-up − standard deduction; 0% if still
    sheltered), applied to the whole 4% withdrawal. The blended rate is returned too, for reference.
    PROPERTY (tested): when this account is needed (gross-up > 0), marginal later <= marginal now, so this
    view can only tie or favor Pre-tax. Roth can win only when other accounts' *forced* 4% draws already
    exceed the need (existing balances set the bracket).

## Decisions and deviations from the original spec (deliberate)
- **SS taxability:** the spec's "$6,000 (Single) / $12,000 (MFJ)" was wrong. The IRS worksheet uses half the
  band width: **$4,500 Single / $6,000 MFJ**. Implemented per IRS; a test documents the difference.
- **FICA** was added (spec omitted it). Couples' income is treated as one earner's (single wage base),
  same as the SS estimator.
- Section 3 has an extra **"Withdrawal rate needed"** row and a note: a higher tax bill is not a verdict
  (the Pre-tax scenario also got a deduction and starts larger). Section 2 has a one-line verdict.
- UI: retirement number is a standalone hero line; rates beneath; dropdowns ("How is this calculated?",
  "How is the effective rate calculated?", "Simple view: ... without Social Security", "Show the
  calculation") show the arithmetic. The effective-rate dropdown defines "this account" (the account the
  contributions build) vs "other income" (SS + other balances) and walks Steps 1–3.
- Form: expected return lives in a collapsed **Assumptions** section (default 7%; summary shows the current
  value). Savings hint reads "the amount you're currently contributing ... or considering". Account-type
  hint removed.
- The Pre-tax/Roth contribution amounts ("Current possible contribution") are a row in the Section 2
  table, with a note that they cost the same take-home pay; no longer in Section 1.
- Section 3 calculation dropdown labels total income "Gross income (withdrawals + Social Security)".
- Simple-view interpretation: "without Social Security" = benefit set to $0 (plan as if it isn't there),
  NOT "benefit received but untaxed". If the user meant the latter, change `withoutSocialSecurity`.
- Employer match in the article says "most plans" (SECURE 2.0 permits Roth match, few offer it).
- SS wage base lives only in `ficaRates.js`.

## Known limitations / open items
- The effective rate is measured on the *gap-filling* withdrawal G but Section 2 applies it to the account's
  full 4% withdrawal. For large accounts this overstates tax a bit (default MFJ case: 18.5% vs ~17.4%).
  Offered to the user as an optional refinement; not changed.
- Not modeled: state tax, 65+ additional standard deduction and the temporary senior deduction (both
  would lower retirement tax), RMDs, employer match, raises, tax-efficient withdrawal order, IRA phase-outs
  and catch-up contributions, self-employment tax, two-earner couples' separate wage bases.
- Simple view applies the *marginal* rate to the whole withdrawal (stricter than the blended rate); the
  blended figure is shown beside it.
- Full "maxing out" side-account comparison and a Roth/Traditional split are future features (the app warns
  at >= 90% of the contribution limit).

## Data provenance (checked 2026-09-19)
- Verified on irs.gov: 2025 and 2026 brackets, 2026 standard deduction, FICA rates, Additional Medicare
  thresholds ($200k / $250k MFJ), 2026 wage base $184,500, 2026 limits ($24,500 / $7,500).
- 2025 standard deduction ($15,750 / $31,500): confirmed via IRS search excerpts, not opened directly.
- **Not verified from SSA directly** (ssa.gov blocks Claude's fetcher; corroborated via excerpts): bend points
  2025 $1,226 / $7,391 and 2026 $1,286 / $7,749; 2025 wage base $176,100.
- SS taxability thresholds ($25k/$34k Single, $32k/$44k MFJ) are statutory; not fetched.
- Every data file names its sources in comments. Re-verify each January when new-year data is added.

## Checking the UI without a browser session
Headless Chrome works: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new
--virtual-time-budget=6000 --window-size=W,H --screenshot=out.png URL`. Window width has a minimum, so to
check true phone width, load the app in an iframe of width 390 inside a wrapper page and measure
`documentElement.scrollWidth`. Use `--dump-dom` to assert rendered text on the live site.

## Change log
- 2026-09-19 — Round 2 UI changes: reworded rate note; savings/account-type hints; return moved into an
  Assumptions dropdown; contribution amounts moved into the Section 2 table; "Gross income" label in
  Section 3; effective-rate dropdown rewritten (this account vs other income, Steps 1–3); new
  "Simple view" (no Social Security, marginal rate) with hand-verified tests + property test. 203 tests.
- 2026-09-19 — Initial build (data, lib, tests, UI, article). Added FICA; hero line + calculation
  dropdowns; Social Security shown in Section 3. Published to GitHub + Netlify. Added 2026 data verified
  against IRS pages; article examples moved to 2026 figures. Created this file.
