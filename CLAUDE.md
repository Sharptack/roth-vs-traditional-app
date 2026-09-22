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
npm test          # vitest: calc layer + component smoke tests (286 tests at last count)
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
  limit and returns the excess, shared `getLimit` lookup so the two never disagree), `capitalGainsTax` (`calculateCapitalGainsTax`: real 0%/15%/20% brackets, gains stacked on top of ordinary income — see the model section below), `ficaTax` (`calculateEmploymentTaxes`: FICA + 1099 self-employment tax; `calculateFica` = W-2 only), `socialSecurityTax`
  (IRS combined-income formula), `socialSecurity` (simplified benefit estimator), `retirementTaxStack`
  (shared tax on a retirement income stack), `solver` (monotonic binary search), `incomeNeed`
  (gross-up for one account), `portfolioTax` (scale-factor solver across buckets), `growthCalculations`,
  `contributionLimits`, `compare` (orchestrator; single source of every UI number), `constants`
  (`WITHDRAWAL_RATE` 4%, `LTCG_RATE` 15%, 90% limit threshold), `format`, `formInputs`, `yearLookup`.
- `src/components/`: `InputForm.jsx`, `ResultsSummary.jsx`, `ArticlePage.jsx` (renders ARTICLE.md). `src/lib/route.js`: hash routing helper. `src/App.jsx` holds state and the
  "Future enhancements" comment block. `tests/` mirrors `src/lib` plus `components.smoke.test.jsx`.

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

## The model (as built)
1. Current tax: income tax on (gross − half of any self-employment tax − standard deduction) + payroll tax:
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
   read from a $1,000 probe withdrawal. Also `rates.overallEffectiveRetirement` = total tax on the whole
   first-year retirement stack / total gross income (Social Security + every withdrawal incl. Roth) —
   labelled "Overall effective rate in retirement"; `retirementOverall` holds the two amounts.
6. Paycheck equivalents: Roth R = P·(1−t); Pre-tax P = R/(1−t), t = current marginal rate. R and P
   (`result.contribution`) stay the UNCAPPED equivalents for display. Each is then independently run
   through `splitAtContributionLimit` (same account type, same numeric limit for either tax
   treatment) -> `result.contributionSplit.{roth,pretax}.{toAccount,excessToTaxable}`. Everything that
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
  actually spend", "How is this calculated?" dropdown; (2) "Roth vs. Traditional" (verdict, contribution-limit
  alert, table, dropdown "Retirement years without Social Security"), which **opens with "Your tax rates"**
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
  full 4% withdrawal. For large accounts this overstates tax a bit (default MFJ case: 18.5% vs ~17.4%).
  Offered to the user as an optional refinement; not changed.
- Not modeled: state tax, 65+ additional standard deduction and the temporary senior deduction (both
  would lower retirement tax), RMDs, employer match, raises, tax-efficient withdrawal order, IRA phase-outs
  and catch-up contributions, self-employment tax, two-earner couples' separate wage bases.
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
- Every data file names its sources in comments. Re-verify each January when new-year data is added.

## Checking the UI without a browser session
Headless Chrome works: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new
--virtual-time-budget=6000 --window-size=W,H --screenshot=out.png URL`. Window width has a minimum, so to
check true phone width, load the app in an iframe of width 390 inside a wrapper page and measure
`documentElement.scrollWidth`. Use `--dump-dom` to assert rendered text on the live site.

## Change log
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
