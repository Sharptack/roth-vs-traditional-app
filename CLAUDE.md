# CLAUDE.md — project notes for Claude Code

Living document. **Update it whenever behavior, decisions, data or workflow change**, and add a line to
the change log at the bottom. Read this first in a new session.

## What this is
Client-side React (Vite) calculator: does a Roth or Pre-tax (Traditional) contribution leave more
after-tax wealth? Bracket-aware, budget-driven ("top-down") model. No backend. Owner: Michael Sharpnack.
Plain-language explainer in `ARTICLE.md`: must match actual behavior (update it when behavior changes), and it
is **also the public "How this works" page** — see "Article page" below.

## Commands
```
npm run dev       # dev server (occupies the terminal; Ctrl+C to stop, or use a second tab)
npm test          # vitest: calc layer + component smoke tests (355 tests at last count)
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
  `ficaRates.js` (also owns the SS wage base),
  `ssBendPoints.js` (+ FRA table by birth year), `ssTaxThresholds.js` (fixed by law), `contributionLimits.js`.
- `src/lib/`: `taxCalculations` (progressive tax, marginal rate; accepts above-the-line adjustments), `contributionLimits`
  (`checkContributionLimit` = the UI warning; `splitAtContributionLimit` = caps a contribution at the IRS
  limit and returns the excess; both take an optional `age` for catch-up contributions; shared `getLimit`
  lookup so the two never disagree), `capitalGainsTax` (`calculateCapitalGainsTax`: real 0%/15%/20% brackets, gains stacked on top of ordinary income — see the model section below), `ficaTax` (`calculateEmploymentTaxes`: FICA + 1099 self-employment tax; `calculateFica` = W-2 only), `socialSecurityTax`
  (IRS combined-income formula), `socialSecurity` (simplified benefit estimator), `retirementTaxStack`
  (shared tax on a retirement income stack), `solver` (monotonic binary search), `incomeNeed`
  (gross-up for one account), `portfolioTax` (scale-factor solver across buckets), `growthCalculations`,
  `contributionLimits`, `compare` (orchestrator; single source of every UI number), `constants`
  (`WITHDRAWAL_RATE` 4%, `LTCG_RATE` 15%, 90% limit threshold), `format`, `formInputs`, `yearLookup`,
  `scenarios` (runs `src/data/scenarioBatches.js` through `compare.js` for the scenarios page — see below),
  `chartScale` (linear scale + nice-tick axis helper, framework-free), `regression` (OLS trend line).
- `src/data/scenarioBatches.js`: the hand-picked scenario batches charted on the scenarios page (income,
  savings-rate, balance, age-50, and lifestyle sweeps) — plain data, no compare.js calls.
- `src/components/`: `InputForm.jsx`, `ResultsSummary.jsx`, `ArticlePage.jsx` (renders ARTICLE.md),
  `ScenariosPage.jsx` (the scenario charts — see below), `charts/LineChart.jsx`, `charts/ScatterChart.jsx`,
  `charts/palette.js` (fixed categorical color + shape order, assigned by series identity). `src/lib/route.js`:
  hash routing helper. `src/App.jsx` holds state and the "Future enhancements" comment block. `tests/`
  mirrors `src/lib` plus `components.smoke.test.jsx`.

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
- What it's for: charts the calculator's core theory — that the **rate gap** (`rates.marginalNow −
  rates.effectiveRetirement`, i.e. marginal rate while working minus "Effective rate on these withdrawals")
  predicts which side wins — across a set of hand-picked scenarios, so the relationship can be eyeballed
  instead of taken on faith.
- Data flow: `src/data/scenarioBatches.js` (plain data: a `base` input object per batch + one or more
  `series`, each a list of `{x, overrides}` points) → `src/lib/scenarios.js`'s `runAllBatches` merges
  `base + overrides` and calls `compareRothVsTraditional` per point, extracting `gap` and `advantagePct`
  (Roth's after-tax annuity withdrawal vs. Pre-tax's, as a % — the Section-2 "this account only" lens) →
  `ScenariosPage.jsx` renders one `LineChart` per batch (x = the swept variable, y = gap) plus one combined
  `ScatterChart` (x = gap, y = advantagePct, color+shape by batch, an OLS trend line from `src/lib/regression.js`).
  No new financial logic: `scenarios.js` only merges inputs and reads fields already on `compare.js`'s result.
- The five batches (single filer, W-2 only, no self-employment income, 0 debt/other-expenses, 7% return,
  estimated Social Security, 401(k) — the limit never binds at these income/savings levels): income sweep
  at a fixed 10% savings rate (age 35→65, 12 incomes from $40k to $300k); the same income sweep at 5%/10%/20% savings
  rates; the same income sweep with an existing Pre-tax balance of $0/$20k/$100k/$250k; the same income
  sweep at age 50→65 with a balance of $0/$100k/$500k/$1M; and a lifestyle sweep (1×→2× in 0.1 steps, i.e. "spending
  20/40/60/80/100% more in retirement") at incomes $30k/$50k/$75k/$100k/$150k. Extending or adding a batch
  is a data-only change in `scenarioBatches.js` — no chart code changes needed.
- Charts are hand-rolled inline SVG (`src/components/charts/`), not a charting library — the app has no chart
  dependency, and these are simple line/scatter plots. `LineChart`/`ScatterChart` are generic (series/points
  in, chart out); `chartScale.js` (linear scale + "nice" tick axis rounding) and `regression.js` (OLS) are the
  only new pure-function additions, both hand-verified in tests. Category color + shape are assigned by fixed
  order (`charts/palette.js`, CSS vars `--series-1..5` in `App.css`, light/dark), never by rank; the scatter
  layers shape on top of color since a 5th categorical color isn't guaranteed distinguishable against every
  other color once every point can be adjacent to every other point (see the dataviz skill's "all-pairs" note).
  Every chart has a hover/focus tooltip and a "Show the numbers" `<details>` table underneath as the
  non-interactive fallback.

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
   it stops at retirement. Then × `retirementLifestyle` (default 1; UI offers 0.8–2): a single multiplier
   for people who expect to spend more/less in retirement (e.g. rising earnings). Higher lifestyle raises
   the retirement bracket and can favor Roth.
3. Social Security: user-entered benefit, or a simplified estimate (AIME = income capped at wage base / 12,
   bend-point PIA, claiming age = retirement age clamped to 62–70, FRA from birth year = year − age).
4. Other balances grow at the chosen return to retirement; 4% of each is withdrawn. Pre-tax = ordinary
   income; Roth = tax-free; taxable = treated as long-term capital gain, taxed via the REAL 0%/15%/20%
   LTCG brackets (capitalGainsTax.js), stacked ON TOP of ordinary taxable income (grossOrdinaryIncome =
   pretax withdrawal + taxable SS; unused standard-deduction room shelters gains too — see the function's
   doc comment for the derivation). Counts toward SS "other income". NOT a flat rate: a modest-income
   retiree can pay 0% on some or all of a taxable-account withdrawal, and a bigger Pre-tax withdrawal can
   push a FIXED taxable-account withdrawal into a higher LTCG bracket (a real, correct cross-account
   effect — see incomeNeed.test.js's "capital gains stack on top of ordinary income" tests for a clean,
   isolated, hand-verified example). NIIT (3.8%) is not modeled.
5. **Effective rate on these withdrawals** (`rates.effectiveRetirement`; `incomeNeed`): binary-search the gross withdrawal G from *this* account
   so total after-tax income = need. Rate = (extra tax caused by G) / G, i.e. incremental blended rate
   including the Social Security phase-in. If other sources already cover the need (G = 0), the rate is
   read from a **probe withdrawal sized to this account's own natural 4% withdrawal**
   (`compare.js` computes the account's annuity FV *before* calling `solveGrossWithdrawal` and passes it
   in as `probeSize`, specifically so the rate reported matches the size of withdrawal it actually gets
   applied to elsewhere — see "Effective-rate probe size" below; `solveGrossWithdrawal` falls back to a
   fixed $1,000 probe only if no `probeSize` is given). The result also exposes `probeSize`, `probeStack`
   and `probeExtraTax` (the actual arithmetic behind the G = 0 rate) so the UI can show real numbers
   instead of a misleading "$0 ÷ $0" — `solutionStack`/`totalTaxPaid` correctly stay at $0 when G = 0
   (nothing is actually withdrawn); the probe fields are a separate, explicitly-hypothetical calculation.
   Also `rates.overallEffectiveRetirement` = total tax on the whole
   first-year retirement stack / total gross income (Social Security + every withdrawal incl. Roth) —
   labelled "Overall effective rate in retirement"; `retirementOverall` holds the two amounts.
   `result.rateDrivers` (and `withoutSocialSecurity.rateDrivers`) = `explainWithdrawalRate` in incomeNeed.js:
   start/end ordinary bracket of the withdrawal the rate was measured on (G or the probe), how much of the
   standard deduction other income (other Pre-tax draws + taxable SS) uses first, extra taxable SS, and the
   extra tax split into ordinary vs. capital-gains (gains stacked on top get pushed up a bracket). The rate
   ALREADY included the capital-gains push (totalTax includes it); this only exposes it for the UI.
   `rates.lean` = `leanFromRates(marginalNow, effectiveRetirement)`: pretax/roth, "even" within 0.5 points —
   the rule-of-thumb line under the rates (not the dollar verdict; the contribution cap can make them differ).
6. Paycheck equivalents: Roth R = P·(1−t); Pre-tax P = R/(1−t), t = current marginal rate. R and P
   (`result.contribution`) stay the UNCAPPED equivalents for display. Each is then independently run
   through `splitAtContributionLimit(amount, accountType, year, currentAge)` — `currentAge` (a snapshot,
   not projected forward) unlocks any IRS catch-up contribution the saver already qualifies for (same
   numeric limit for either tax treatment) -> `result.contributionSplit.{roth,pretax}.{toAccount,excessToTaxable}`. Everything that
   COMPOUNDS (lump sum, annuity, Section 3 buckets) uses `toAccount`; `excessToTaxable` becomes its
   own annuity stream added to that scenario's TAXABLE bucket only (Roth's excess and Pre-tax's excess
   differ, since R ≠ P, so each scenario spills over independently — realistic, since a real saver
   contributing 100% Roth hits the same dollar limit as one contributing 100% Pre-tax). The excess money
   is then taxed like any other taxable-account money at withdrawal (real LTCG brackets, step 4/8 below).
7. Section 2 compares annuity FV of capped-R vs capped-P; Pre-tax after-tax value uses (1 − effective
   rate). Section 2 is deliberately the "this account only" lens — it does NOT show the taxable
   spillover; that lives in Section 3's portfolio buckets (already visible via the existing bucket
   breakdown, no new UI needed there). When capping applies, the "Current possible contribution" row
   gets a small sub-note ("$X to the account, rest to taxable"), and `limitCheck.message` (Section 7,
   shown as an alert above the table) names the exact excess and explains where it goes.
8. Section 3 (`portfolioTax`): per scenario (all-Roth / all-Pre-tax), 4% baseline per bucket, one scale
   factor k found by binary search so after-tax income (withdrawals + full SS − tax) = need.
   Taxable SS uses (pretax + taxable withdrawals) as "other income".
9. No inflation is modeled: treat the return as a real (after-inflation) return; all dollars are today's.
10. **Retirement years without Social Security** (`compare.js` -> `withoutSocialSecurity`; UI dropdown
    under the Section 2 table): same comparison with Social Security set to $0 (e.g. years before benefits
    start), so accounts must supply the whole need. **Headline rate = the blended effective rate on this
    account's withdrawals with no SS phase-in** (same method as the main comparison). The marginal bracket of
    the last dollar (other pre-tax draws + gross-up − standard deduction; 0% if sheltered) and the
    after-tax figure at that rate (`afterTaxWithdrawalAtMarginal`) are reference only.
    PROPERTY (tested): when this account is needed (gross-up > 0) and lifestyle <= 1, effective <= marginal
    later <= marginal now, so this view can only tie or favor Pre-tax. Roth can win when (a) other accounts'
    *forced* 4% draws already exceed the need (existing balances set the bracket), or (b) lifestyle > 1.

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

## Effective-rate probe size (2026-09-23)
Bug report: lowering the retirement need (e.g. an expense going away) made the reported "Effective rate
on these withdrawals" go UP, which looked backwards. Root cause: whenever other income already covers
the target (gross-up G = 0), the OLD code read the rate from a fixed, arbitrary $1,000 probe withdrawal
— completely unrelated to the size of the withdrawal that rate then gets APPLIED to elsewhere (the
account's own 4% annual withdrawal, often tens of thousands of dollars). Right near a Social Security
phase-in threshold this $1,000 sliver can land in a completely different, sometimes much CALMER (lower-
rate) part of the stack than a realistically-sized withdrawal would — see incomeNeed.test.js's "a tiny
$1,000 (default) probe reads 0%... a $20,000 probe... correctly reads 7.12%" for a hand-verified,
side-by-side demonstration of exactly this gap. So crossing G = 0 didn't change the rate smoothly; it
just swapped which arbitrary thing was being measured.
Fix: `solveGrossWithdrawal` now accepts an optional `probeSize` (falls back to $1,000 if omitted, so
callers that don't supply it — e.g. isolated `incomeNeed.test.js` calls — are unaffected). `compare.js`
hoists the account's own annuity FV computation to BEFORE the gross-up solve (it never depended on the
solve's result anyway) and passes `WITHDRAWAL_RATE * annuityPretaxFV` in as `probeSize` for both the
main `grossUp` and the `withoutSocialSecurity` `noSsGrossUp` calls. PROPERTY (tested): the reported rate
is now provably STABLE — it cannot change just because the target dropped further, as long as G stays 0
(only a change in other income or the account's own size can move it); see compare.test.js's "the rate
stays IDENTICAL as the target need drops further."
Also fixed a related DISPLAY bug surfaced while investigating: the "How are the retirement rates
calculated?" and "Retirement years without Social Security" dropdowns showed a literal "$0 ÷ $0" style
formula next to the G = 0 rate, because `solutionStack`/`extraTax` correctly stay at $0 (nothing is
really withdrawn) while the rate itself came from the invisible probe. `solveGrossWithdrawal` now always
returns `probeSize`, `probeStack` and `probeExtraTax` too, and both dropdowns branch on `withdrawalNeeded`
to show the REAL probe arithmetic ("$14,126 ÷ $56,676") instead. This did NOT touch the separate, still-
open "Known limitations" item about the G > 0 case (rate measured on the gap-filling withdrawal, applied
to the account's full 4% withdrawal) — that's a different mechanism and remains unresolved.

## Contribution limits: excess now defaults to taxable (2026-09-22)
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
- **Page layout (3 sections):** (1) "Retirement income number" alone — hero value, note "the after-tax
  amount you need each year in retirement to keep the same lifestyle you have while working; the amount you
  actually spend", "How is this calculated?" dropdown; (2) "Roth vs. Traditional" (contribution-limit
  alert, table, dropdown "Retirement years without Social Security"), which **opens with "The comparison: your
  tax rate now vs. later"** (rate pair, then a one-line "Tends to favor …" lean + rule-of-thumb hint — re-added
  2026-09-25 at the user's request after Round 4 had removed a lean sentence), then **"The trade-off in dollars"**:
  one table with Roth / Pre-tax / Difference columns and three row groups ("What you put in", "What it grows
  to", "What you keep after tax") so the layout shows "Pre-tax puts in more, but is taxed later". Before that:
  (marginal now; effective rate on these withdrawals; overall effective rate; SS benefit used; and the "How are
  the retirement rates calculated?" dropdown, which begins with the "How the rates fit together" note) — the user clarified the rates go at the top of the Roth vs.
  Traditional section, i.e. the section right below the retirement number; (3) "Total portfolio tax
  comparison" (table + "Show the calculation" dropdown), no rates. The effective-rate dropdown defines "this account" (the account the contributions build)
  vs "other income" (SS + other balances) and walks Steps 1–3.
- Rate naming: "Effective rate on these withdrawals" = extra tax caused by this account's withdrawals ÷
  those withdrawals (the number that drives the comparison). "Overall effective rate" = total tax ÷ gross
  income. Do not call the former just "effective rate in retirement".
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
- The effective rate is measured on the *gap-filling* withdrawal G but Section 2 applies it to the account's
  full 4% withdrawal (this is the G > 0 case; the separate G = 0 probe-size issue was fixed 2026-09-23 —
  see "Effective-rate probe size" above). For large accounts this overstates tax a bit (default MFJ case:
  18.5% vs ~17.4%). Offered to the user as an optional refinement; not changed.
- Not modeled: state tax, 65+ additional standard deduction and the temporary senior deduction (both
  would lower retirement tax), RMDs, employer match, raises, tax-efficient withdrawal order, IRA phase-outs,
  self-employment tax, two-earner couples' separate wage bases. (Catch-up contributions ARE now modeled —
  see "Catch-up contributions" above — but only as a snapshot at today's age, not aging into a tier over
  a multi-decade projection.)
- The lifestyle factor is one multiplier on the need. It does not model contributions made at a *higher
  future* marginal rate when earnings rise (marginal-now stays today's), which would offset it toward
  Pre-tax; time-varying contributions are a future feature.
- The PROPERTY test in compare.test.js ("no-SS retirement bracket never exceeds today's") no longer
  asserts effective <= marginal — capital-gains bracket-stacking can push the blended effective rate
  above the ordinary marginal rate when a taxable balance is present (real effect, see above). The
  "Roth (almost) never wins" half of the property is checked empirically over a grid, not proven.
- NIIT (3.8% on investment income above $200k/$250k MFJ) is not modeled.
- 1099: income entered is *net* earnings; QBI deduction, solo-401(k)/SEP not modeled; MFJ couples treated as
  one earner (single wage base).
- Full "maxing out" side-account comparison and a Roth/Traditional split are future features (the app warns
  at >= 90% of the contribution limit).

## Data provenance (checked 2026-09-19)
- Verified on irs.gov: 2025 and 2026 brackets, 2026 standard deduction, FICA rates, Additional Medicare
  thresholds ($200k / $250k MFJ), 2026 wage base $184,500, 2026 limits ($24,500 / $7,500).
- 2025 standard deduction ($15,750 / $31,500): confirmed via IRS search excerpts, not opened directly.
- **Not verified from SSA directly** (ssa.gov blocks Claude's fetcher; corroborated via excerpts): bend points
  2025 $1,226 / $7,391 and 2026 $1,286 / $7,749; 2025 wage base $176,100.
- SS taxability thresholds ($25k/$34k Single, $32k/$44k MFJ) are statutory; not fetched.
- Self-employment tax (12.4% + 2.9%, 92.35%, $400 minimum, half deductible): IRS Topic 554, checked 2026-09-20.
- Catch-up contributions (401(k) $7,500/2025, $8,000/2026; 60-63 enhanced tier $11,250 both years; IRA
  $1,000/2025, $1,100/2026): IRS Notice 2024-80 and the 2026 401(k)/IRA newsroom announcement, checked 2026-09-23.
- Every data file names its sources in comments. Re-verify each January when new-year data is added.

## Checking the UI without a browser session
Headless Chrome works: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new
--virtual-time-budget=6000 --window-size=W,H --screenshot=out.png URL`. Window width has a minimum, so to
check true phone width, load the app in an iframe of width 390 inside a wrapper page and measure
`documentElement.scrollWidth`. Use `--dump-dom` to assert rendered text on the live site.

## Change log
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
