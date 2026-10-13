# Round 2 roadmap

The plan for round 2: the current status, the phases left, and how they fit together. Finished phases and settled decisions are in `docs/roadmap-archive.md`, ideas not scheduled in `docs/ideas.md`, round one in `docs/history.md`. Moved here from the plan doc (https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095, frozen) on 2026-10-09.

## Current status

*Rewritten (not appended to) at each `/closeout`. Last: 2026-10-12.*

**Done:** round one; round 2 phases 0 to 4, the switchover, the "Before phase" lists, and phase 5 (Social Security). 959 tests. Last closed: phase 5 (tag `phase-5-done`): the Social Security page (#/social-security): each person's benefit and lifetime total by claiming age 62 to 70 (own, spousal, survivor), a discount rate, break-even ages, the couple's grid with the best cell, the plan effect of each claiming age (sustainable spending, lifetime tax), the chance of being alive at each age, and "Use in the plan" for claiming ages. Also: the projection's survivor years follow the SSA survivor rules.

**In progress:** Before phase 6: Social Security planner additions (the grid, year by year per strategy, the break-even graph; asked 2026-10-12). Steps (a) to (e) done, 972 tests; waiting on Michael's look at the page, then `/closeout`.

**Also in progress: phase 6, the year-by-year planner** (started 2026-10-12; decisions and steps under Phase 6 below). Steps (a) to (f) done 2026-10-12, and the first-year IRMAA fix 2026-10-13 (1,012 tests, local, unpushed): every step built; waiting on Michael's look at the planner page, then `/closeout`.

**Known gaps and open items:**
- Social Security claiming ages are whole years (full retirement age from the birth year); month-level claiming, partial first years and SSA's January-1st birthday rule aren't modeled (in `docs/ideas.md`).
- The Roth page's lifetime comparison doesn't hold the legacy goal in its sustainable spending (it counts the charity in after-tax wealth).
- The Roth comparison's retirement snapshot leaves out other income rows such as rent (the pension is in).
- Tax-exempt income isn't yet in Social Security taxability or IRMAA.
- One contribution type per person (see Open questions). The Roth catch-up rule is stated on the Roth page but not applied to the numbers.
- Only the first death is modeled; the survivor lives to their life expectancy. Social Security "Currently receiving" has no known PIA, so it gives a spouse no spousal top-up.
- Extra savings on the funding page earn no extra employer match (the match stays on the rows as entered).
- Staged spending is designed (`docs/staged-spending-design.md`) but not built (Later release).

**Decisions later phases build on** (details in the archive):
- Today's dollars everywhere; fixed thresholds shrink at the inflation input (2.5%) via `thresholdScale`. Results change only by a decided change; the v1 pins change by additions only.
- Rate terms: marginal = the bracket, average tax rate = tax ÷ income, effective marginal rate = the tax on the next dollar. The Roth comparison pairs marginal today with the effective rate on the withdrawal. Bracket charts show total income with the taxable figure beside it.
- Decision calculators vs. plan evaluators (below); "Use in the plan" writes a choice back (Roth/Pre-tax trial, pension lump sum, retirement spending, savings, retirement age). The Dashboard groups them as Decisions and Evaluations.
- The spending need: one function (`spendingNeed.js`), from today's income (default) or the budget; everyone retired = the budget. Solves that change savings hold it fixed.
- The legacy goal (none by default) applies to every sustainable-spending figure on the evaluators; after-tax figures for what is left use `afterTaxEnding` (heirs' rate; a charity's share from Pre-tax first).
- Funding: through retirement leads; the 4% measure is the projection's own year at the last retirement; about even = within 5%. Extra savings spread over the rows in proportion (none: taxable, by pay); one retirement age moves at a time (`funding.js`).
- Survivor years: single from the year after the first death, accounts roll to the survivor, spending 80% (an input). Social Security on the SSA survivor rules: the deceased's benefit with credits (at least 82.5% of PIA after an early claim), reduced before the survivor's full retirement age, from the later of the year after the death and the survivor's claiming age (never before 60).
- A retirement age at or below the age now = already retired: no earnings or contributions from this year; a retiree's income row with no ages counts for life (earnings excepted). A Social Security claim "at retirement" follows the retirement age (62 to 70).
- Social Security: no row = estimated from earnings (a PIA of $0 = none); "Currently receiving" = the monthly check, as is, from now. Claiming ages are whole years; the Social Security grid is gross benefits, the plan effect is per person (the other held as in the plan).
- Income above the need: spent while working, saved in retirement, by default (two settings). Taxable contribution rows are savings (in the top-down need and the projection), outside the Roth vs. Pre-tax comparison. Each taxable account is the only source of its dividends (1.3% by default).
- Employer money is always Pre-tax, held to the 415(c) limit. The return in retirement applies once no one works; the Roth comparison's snapshot is at the last retirement (no earlier than today).
- A pension lump sum rolls to the owner's Pre-tax IRA at the pension's start age. A conversion's tax while anyone works comes out of the conversion; once retired, from withdrawals. Lifetime tax = federal income tax + IRMAA.
- Each phase ends with its Docs article (`articles/`, listed in `src/lib/docs.js`).

## Phases left

| Phase | What ships | Done when |
| --- | --- | --- |
| 6. Year-by-year planner | A new page: click a year to add a Roth conversion or change a contribution, and see what that change is worth. | A change alters only that year and later; its value matches a full rerun. |
| 7. Roth vs. Pre-tax with later conversions | New blocks on the Roth vs. Pre-tax calculator: the tax bracket each year, and the answer again with conversions in the years taxed lower. | Each block's figures reconcile with separate full runs. |
| 8. Monte Carlo | Random return paths from the S&P 500's return and volatility after inflation (adjustable), chance of success, distribution charts for income and portfolio value. | No volatility reproduces the projection; a fixed seed repeats. |
| 9. Spending with guardrails | The spending that succeeds in 50% of paths, and when to raise or cut it. | Each guardrail, rerun, lands on its target. |
| 10. Household plans | One household's facts with several saved plans, switching between them and comparing them in every calculator. | Two plans of one household open side by side with every difference marked. |
| 11. Liabilities and debt pay-off | A debt pay-off calculator for every debt (the mortgage included): pay off early or invest, the order to pay debts off, and payoff dates flowing into the retirement income number and the projection. | A hand-worked amortization matches, and the payoff year changes the spending need from that year on. |

The finished phases (0, 1, 2, 3, 4, 5, the switchover and the "Before phase" lists) and the decision tables are in `docs/roadmap-archive.md`.

## How the plan fits together

The household's plan is one set of facts plus the decisions made about them, and one projection runs it. Two kinds of tools read that projection (proposed 2026-10-08; Michael decides once he can see it working, so the first "Use in the plan" button is built as a trial):

- **Decision calculators** weigh one choice: Roth or Pre-tax, when to claim Social Security, how much to convert, lump sum or monthly pension, pay off a debt or invest, when to retire. Each runs the plan once per option, with every other decision held as it stands, so the answer accounts for the rest of the plan. Each starts from the plan's current choice and has a **Use in the plan** button that writes the chosen option back into the household.
- **Plan evaluators** judge the whole plan with every decision made: the year-by-year projection, Monte Carlo, what the resources allow you to spend, pre-retirement funding and guardrails. They change no decision; they show whether the plan works.

Household plans (phase 10) are then named sets of decisions over the same facts, compared with the plan evaluators.

A decision calculator runs the plan once per option and writes the chosen one back; every evaluator reads the same plan with all decisions in place.

### The decisions in the plan

| Decision | Weighed by | In the plan today | "Use in the plan" lands in |
| --- | --- | --- | --- |
| Retirement age, each person | Pre-retirement funding (phase 4) | Yes, an input | Built (phase 4) |
| Roth or Pre-tax contributions | Roth vs. Pre-tax (phases 1 and 7) | Yes, the contribution rows | Built as a trial (phase 1) |
| Social Security claiming age, each person | Social Security (phase 5) | Yes, an input | Built (phase 5) |
| Roth conversions | Roth conversion (this year), the planner (phase 6), Roth vs. Pre-tax with conversions (phase 7) | Only as a whole-plan withdrawal strategy | Phase 6 (year by year), phase 7 (its rule) |
| Pension: lump sum or monthly | Pension (phase 1) | Yes, the pension row | Built (before phase 3) |
| Debts: pay off early or invest | Debt pay-off (phase 11) | No | Phase 11 |
| Which accounts to draw first | The projection's strategy comparison | Yes, an input | Already there |
| How much to spend, and the legacy goal | Retirement spending (phase 3), guardrails (phase 9) | Yes: spending from income or the budget, and the legacy goal | Built (phase 3); guardrails phase 9 |

### What the projection includes

The projection has to carry every part of the household, so the plan evaluators judge the real plan. Phase 2 filled in most of it; the rest lands in the phases below.

| Part of the plan | In the projection today | Added in |
| --- | --- | --- |
| Earnings (W-2, 1099) to each person's retirement | Yes, flat (no raises) | — |
| Other income rows over their ages (part-time work, rental, an annuity) | Yes | Phase 2 (done) |
| Contributions, with the IRS limit and catch-up | Yes, with employer contributions | — |
| Social Security at the chosen claiming ages, with the spousal top-up | Yes, with SSA survivor benefits (phase 5) | — |
| Pension, monthly or as a lump-sum rollover | Yes | — |
| RMDs and IRMAA | Yes | — |
| Roth conversions | As whole-plan strategies | Year by year: phase 6 |
| Debt payments | Only "payments that end", before retirement | Each debt to its payoff date, before and after retirement: phase 11 |
| Spending | Flat, from income or the budget, with the legacy goal (phase 3) | Guardrails: phase 9; staged spending: later (designed) |
| Survivor years | Yes | — |
| Tax drag on taxable accounts; returns before and after retirement | Yes | — |
| The return each year | Constant | Random paths: phase 8 |

**Surplus income (decided 2026-10-08).** Some years bring in more than spending, tax and savings use: an RMD larger than the need, part-time work or rent in retirement, Social Security plus a pension. A setting in Assumptions decides what happens to it: **save it** (reinvested in a taxable account, as today; the default) or **spend it** (spending rises in those years). Built in phase 2; each year's surplus shows in the year table. The same rule covers income beyond the paycheck before retirement. Later, phase 11 may add sending it to extra debt payments.

### Year-by-year and Monte Carlo: one plan

Both run the same plan from the same inputs and assumptions; only the returns differ. The year-by-year projection is the plan at a constant return, readable line by line. Monte Carlo (phase 8) reruns that exact plan over many random return paths and reports how often it works. With no volatility, Monte Carlo reproduces the year-by-year exactly (a test). Both pages show the same plan (by name, once phase 10 exists) and link to each other; the guardrails (phase 9) are spending rules applied inside the same paths.

## Before phase 6: Social Security planner additions

Asked by Michael on 2026-10-12, after phase 5: the claiming grid, a year-by-year view of each strategy, and a break-even graph are "the main piece of the calc." The phase 5 grid was on the page (the third block for a couple), but as a plain table of "$1,5xxk" links with no benefit amounts or shading, so it didn't read as the grid he meant.

**Decisions (2026-10-12, Michael):**
- **The grid:** your claiming age down the side, your spouse's across the top; each header shows the age and that person's monthly benefit. Cells shaded by the household lifetime total; ★ the best, outlined the plan's. Clicking a cell shows its benefit options (each person's own, spousal and survivor benefit a month and over the lifetime, the difference from the plan and the best) with "Use in the plan." A single person (or a spouse already receiving) gets one row. Reason: the grid is how an advisor reads the couple's choice at a glance.
- **Strategies = the best cell plus the cells clicked; the plan is in by default.** A dropdown picks one strategy for the year-by-year table; the break-even graph draws them all. Reason: compare what the advisor is weighing, not a fixed set.
- **Year by year:** each year to the second death: both ages, each person's own, spousal and survivor benefit, the household total, and the running total.
- **Dollars: today's by default, with a switch to future dollars** (benefits growing at the inflation input, as COLAs). Reason: the app's convention, with the figures a client sees on SSA statements one switch away. The switch is on the year-by-year table only.
- **The break-even graph:** cumulative household benefits by your age, one line per strategy, in today's dollars at the page's discount rate, with each crossing marked and labeled. Not in future dollars: growing later years works like a negative discount rate, so it would move the break-even ages (and add 2060 dollars to 2027 ones).

**Steps:**
- (a) The math (`src/lib/socialSecurityLifetime.js` / `socialSecurityCalculator.js`): a strategy's year-by-year rows (today's or future dollars, cumulative, discounted) and the crossing ages between two strategies' cumulative totals. Hand-worked: one couple's rows across the first death, one crossing age, the future-dollar rows.
- (b) The grid: headers with monthly benefits, shading, the cell panel, one row for a single person.
- (c) The strategies, the dropdown and the year-by-year table, with the dollars switch.
- (d) The break-even graph.
- (e) The Social Security article updated.

## Phase 6: Year-by-year planner

A new page with the whole plan, one row per year, where clicking a year opens it for changes. The point is Roth conversions decided year by year (convert $40,000 in 2029, nothing in 2031) rather than one rule across the plan. The projection page stays the quick view, and its whole-plan strategies stay as they are.

**Changes a year can take (first version):**

- Add a Roth conversion: the amount, and whose Pre-tax account it comes from.
- Change a contribution, per contribution row, for that year or from that year on.

Later candidates: an extra withdrawal from a chosen account, an extra expense, a different retirement year.

**For the selected year:**

- The conversion's cost: the tax with it minus the tax without, inside the projection's own year (Social Security made taxable, gains pushed up, NIIT, the senior deduction), plus the IRMAA it adds two years later.
- The room left in the current bracket and before the next IRMAA tier.
- Its lifetime value: the change in sustainable spending, lifetime tax and after-tax wealth for heirs against the same plan without it.
- Suggestions: the conversions that fill this year to the top of the bracket or the IRMAA tier, each with its lifetime value.

**Breakdowns in the year table (asked 2026-10-08).** Each total in the year-by-year table opens to show what makes it up, for that year and across the years:

- Taxes: federal ordinary tax, capital gains tax, NIIT, payroll tax, taxable Social Security and the deductions, the same rows the tax calculator shows (it already builds them for one year), plus IRMAA.
- Income: each source by its row (wages, 1099, Social Security for each person, pension, other income rows).
- Withdrawals and conversions: by account and owner, with the RMD part marked.
- Balances: each account, and contributions in.
- Spending: the base need, debt payments, and the surplus saved or spent.

The projection page's year table gets these first (they need no planner), so they can come earlier than the rest of this phase.

**Engine:** a list of per-year changes (year, kind, row, amount) applied on top of the chosen withdrawal strategy; the strategy still meets the spending need. The changes are saved with the household (phase 10 gives each plan its own set).

**Tests:** a change in one year leaves every earlier row identical; each lifetime value equals the difference of two full runs.

**Click a year (asked 2026-10-08):** in the year-by-year planner, click a year to add a Roth conversion there. The planner may differ from the evaluator's year-by-year table; Michael will try both.

**Decided 2026-10-12 (Michael, the recommended options unless noted):**

1. Changes made in the planner go straight into the plan (saved with the household, each removable); no trial step and no "Use in the plan" button, since building the plan is the page's job. Michael's view of plans: the household's inputs are the default plan, and plans with changes are comparisons against it (phase 10 saves several). So the planner also shows all its changes together against the plan without any (the base), beside each change's own value.
2. Every evaluator reads the changes (the projection, Retirement spending, Funding, the Social Security plan effect), each noting "includes N planned changes"; decision calculators hold them as part of the rest of the plan.
3. With a whole-plan conversion strategy chosen, the planner's conversions are added on top of it, with a note.
4. Contribution changes, first version: the amount only, for that year or from that year on (no Roth/Pre-tax switch per year: one contribution type per person).
5. Breakdowns: both a year's detail (click a row: the tax calculator's rows and each group's parts), first, and total columns that open into their parts across the years.
6. A conversion's tax (Michael's rule, not the recommendation): in retirement, paid from a taxable account if there is one; otherwise from Pre-tax (held back from the conversion). While everyone still works (no one retired), held back from the conversion, as today. **It applies to every conversion (Michael, 2026-10-12): the planner's, the whole-plan conversion strategies and the conversion page's lifetime view**, each page saying so briefly. A decided change to existing results: the conversion strategies' figures, and every figure of a household whose chosen strategy is a conversion one (in the v1 pins: mfjOlderKnown's Roth-page lifetime verdict moves from even to Pre-tax); the conversion page's one-year hand case: +$2,400 for heirs (was +$2,727.27). Built 2026-10-12: the strategy draws for spending only, then more from the taxable accounts until the cash meets the need, the rest held back.

**Steps:**

- (a) Breakdowns in the projection's year table: each row carries its parts (income by row and person, withdrawals by account with the RMD part, each account's balance and contributions, spending's parts, the year's tax inputs so `yearTaxRows` rebuilds the tax calculator's rows, IRMAA). Parts add up to their totals (tested); results unchanged.
  **Done 2026-10-12.** Each projection row has a `detail` (projection.js; read by `src/lib/projectionDetail.js`); results unchanged (no number moved; the pins don't hold rows). In the year table (the projection page and the Roth page's lifetime table): click a year to open its income by source and person (Social Security as own, spousal top-up and survivor parts), withdrawals and conversions by account with the RMD part, spending, the tax calculator's rows for the year plus IRMAA, and each account from start to end (an empty flow column hidden). Withdrawn, Income tax and End balance (and other totals with more than one source) open into part columns across the years. The accounts the projection opens are named by what goes in ("Pre-tax, new contributions"). Not in spending's parts: debt payments, which the projection doesn't carry yet (phase 11). Tests: hand-worked conversion, RMD, survivor and working years; the parts add up to every total on two richer households. Seen: the strategy table already overflows a phone screen by 19 px (not this step).
- (b) Engine: `yearChanges` on `runProjection` (`convert`: year, owner, amount; `contribution`: year, row, amount, this year or onward), on top of the strategy; none = today's results. Tests: earlier rows identical; a hand-worked conversion year; the tax rule of decision 6.
  **Done 2026-10-12.** Part 1: decision 6's rule, for every conversion (above). Part 2: `yearChanges` on `runProjection` (default `household.plannerChanges`). A conversion comes from its owner's Pre-tax accounts pro rata by balance (the survivor's after a death), on top of the strategy's. A contribution change sets a row's amount for that year or from it on; for a row the latest year's change wins, and in its own year a one-year change wins over a from-that-year-on one; the employer's match follows the changed amount (unlike the funding page's extra savings, which earn none). Not applied where a caller overrides the contributions (the Roth page's two scenarios). Tests (hand-worked): a planned conversion matches the conversion page's; a later-year one leaves the earlier rows identical; contribution changes for a year, from a year on, overlapping, to $0 (no match), and a taxable savings row; no changes = identical results.
- (c) Saved with the household (`plannerChanges`, empty for older households; saves and share links carry it); every evaluator reads it.
  **Done 2026-10-12.** `values.plannerChanges` (numbers; ids pc1, pc2, ...): cleaned from an allow-list like every value (known kinds and owners, whole years 1900 to 2200, amounts 0 to $1 billion, at most 200), so saves and share links carry it; a contribution change follows its row when cleaning renumbers the rows, and removing a contribution row removes its changes (a new row can take the freed id). `toHouseholdV2` passes them on as `household.plannerChanges`, which runProjection reads by default, so every page that runs the plan includes them; each of those pages (Roth, Retirement spending, Funding, Projection, Conversion, Social Security) says so in a note at the top (`plannerChangesNote`, `src/lib/planner.js`). Where they don't reach: the Roth page's comparison sets the contributions itself (its note says only the conversions count), and the funding page's savings-needed search scales the rows as entered (its headline measures include them).
- (d) The selected year (`src/lib/planner.js`): the cost (tax with minus without in the year, plus IRMAA two years later), the room in the bracket and before the next IRMAA tier, the lifetime value (against the plan without the change; and all changes against the base), suggestions (fill the bracket, the next bracket, up to the IRMAA tier). Each value equals the difference of two full runs (tested).
  **Done 2026-10-12.** `plannerYear` (the year's row, bracket and room, IRMAA room for the premium two years on when anyone will be on Medicare then, the most the owner can convert, and the conversions that reach each edge: bisection on the year itself, so Social Security pulled into tax counts), `conversionCost` (income tax with minus without in the year, IRMAA two years on, the effective rate, how much was held back or paid from taxable), `changeValue` (against the plan without the change, the other changes kept), `allChangesValue` (against no changes), `suggestions` (rounded down to $100, in order of size, each with cost and lifetime value). All run the plan as the projection page does (its strategy and end age). Hand-worked: the 12% and 22% fills and costs, a taxable account paying the cost, the IRMAA room ($77,386.36) and a tier crossed ($1,148.40 two years on). About 1 second for a year's view with its suggestions' lifetime values on the default household. Found in building: a conversion in the plan's first year also raised IRMAA in that year and the next, because the projection took the two years before it to have the first year's MAGI. **Decided 2026-10-13 (Michael): keep the first-year assumption, but without any conversions** (a conversion made now can't have set past premiums). Built 2026-10-13: the first year's MAGI with its spending withdrawals and no conversions (none of the taxable withdrawal that pays a conversion's tax either). A decided change, for first-year conversions with someone on Medicare in the first two years only (the conversion page's lifetime view, the planner, a conversion strategy for a household already retired); no v1 pin moved. Hand-worked: $80,000 converted at 70 now first costs IRMAA two years on ($1,148.40), not in years 0 and 1.
- (e) The planner page (`#/planner`, under Decisions): the year table, the list of changes, a year's panel to add or change, with cost, room, value and suggestions.
  **Done 2026-10-12.** `src/next/PlannerResult.jsx`. "Your changes" leads: each change in words with Remove, all of them against the plan with none (sustainable spending, lifetime tax, after tax for heirs), and the note on who pays a conversion's tax (Michael: say it briefly in the planner). "Year by year": the projection's table (with Converted, Contributed, the bracket and MAGI shown, ● on a year with a change); clicking a year opens its panel: the bracket and the room left, the IRMAA tier for the premium two years on and the room before the next, the most that can be converted; add a conversion (whose Pre-tax money, for a couple; the amount, with its cost and lifetime value shown as it is typed); the suggestions with cost and value, each with Add; change a contribution (the rows of the people working that year; that year only or from it on); the year's changes with their value and Remove; "What makes up the year" (step a's breakdown). The figures are worked out just after the click (about a second), showing "Working out…" first. Dashboard tile: the number of changes and the dollars converted. Checked in the browser at desktop and phone widths (no sideways scroll), adding a suggestion, and a contribution change from 2030 on.
- (f) The Docs article; code map and the projection article updated.
  **Done 2026-10-12.** `articles/planner.md` ("The year-by-year planner"), listed in Docs and linked from the page; its examples are the hand-worked tests (the $34,886.36 of room, $4,176 and $16,333.36 of cost, the $77,386.36 IRMAA room and $1,148.40 surcharge). The projection and conversion articles point to it.

## Phase 7: Roth vs. Pre-tax with conversions in low-income years

The question: if the household converts Pre-tax money to Roth in the years after retirement when its tax bracket is low, does that change the Roth vs. Pre-tax decision today? The Roth vs. Pre-tax calculator keeps its layout; this phase adds blocks to it.

**New block: your tax bracket over time.** The bracket each year of the plan (from the projection), with today's rate on contributions as a line across it. The years below the line are the low-income years, typically between retirement and the start of Social Security and RMDs.

**New block: with conversions in the lower years.** One choice, not a list of strategies: convert in the years taxed below a chosen rate (today's contribution rate by default, or a bracket), filling each such year up to it. The block shows:

- The conversions year by year, with each year's IRMAA room.
- The Roth vs. Pre-tax answer again with those conversions, beside the answer without them (sustainable spending, lifetime tax, after-tax wealth for heirs). For example: "Without conversions Roth leads by $1,200 a year; converting in the years below 22%, Pre-tax leads by $900."

**Behind the blocks:** four lifetime runs, contributing Roth or Pre-tax, each with and without the conversions (the Roth side's existing Pre-tax money converts too, so the comparison is fair). The page shows only the two answers; that pairing is what "four-way" meant. Later, the planner's per-year conversions (phase 6) can stand in for the rule.

**Tests:** each figure equals a separate full run; with no years below the chosen rate the blocks reduce to today's lifetime comparison.

## Phase 8: Monte Carlo

The projection assumes the same return every year, which hides sequence risk: bad years early in retirement do far more damage than the same years late. Phase 8 runs the same projection over many random return paths. The engine is shared with phase 9.

**Return model:** the S&P 500's historical return and standard deviation, after inflation, to start (NYU Stern's yearly S&P 500 returns from 1928, less inflation; cited in the docs), both adjustable on the page (sliders, so the effect shows as they move). Later: different settings at different ages (a glide path toward lower risk) and more robust return options.

**Engine:** the projection takes an optional return for each year; without it nothing changes. A seeded random number generator, so the same inputs always give the same answer. Dollars stay in today's terms.

**Outputs:**

- Chance of success: the share of paths that meet spending every year through the plan-to ages.
- Distribution charts, for income and for total portfolio value: the spread of outcomes as a bell-shaped histogram, with the likely range marked (e.g. the middle 50% and 80% of paths) and the median. Income = the spending each path can sustain; portfolio value at a chosen age and at the end.
- A fan chart of the portfolio over time (10th to 90th percentiles).
- When the failing paths run out.

**Speed:** about 8 ms a projection, so 1,000 paths take about 8 seconds. The runs move to a background worker so the page stays responsive and fills in as paths finish; the path count is to be set (500 to 1,000).

**Tests:** zero volatility reproduces the projection exactly; a fixed seed repeats exactly; a hand-made three-year path; the drawn returns' average and spread match the inputs within a set tolerance.

## Phase 9: Spending with guardrails

A spending number with rules for changing it: start at the spending that succeeds in 50% of the Monte Carlo paths, then know in advance at what portfolio value to raise it and at what value to cut it.

**The two guardrail methods:**

|  | Guyton-Klinger | Risk-based (Income Lab) |
| --- | --- | --- |
| What it watches | The withdrawal rate: this year's spending ÷ the portfolio | The plan's chance of success, recomputed with everything else in the plan |
| When it acts | The rate drifts 20% above the starting rate (cut 10%) or 20% below (raise 10%) | The chance falls below a lower guardrail (cut) or rises above an upper one (raise) |
| How much it changes | A fixed 10% | Back to the target chance of success, so the size fits the situation |
| What it ignores | Social Security starting later, other income, the years left | Little: it uses the whole plan |
| Shown as | Portfolio values that trigger the 10% steps | Portfolio values that trigger a change, and the new spending |

Proposed: risk-based as the main method, since it is Income Lab's approach and it accounts for Social Security, other income and the years left; Guyton-Klinger beside it for comparison, since it is the familiar one. Default thresholds are set when built, starting from published examples, and adjustable.

**Outputs:**

- Starting spending (50% of paths succeed).
- Today's guardrails: "if the portfolio falls to $X, cut spending to $Y; if it rises to $Z, raise it to $W", and the same levels for the next several years.
- How spending behaves under each rule across the paths: its range by year, how often a cut comes, the largest cut.

**Engine:** spending becomes a rule applied inside each Monte Carlo path. Guyton-Klinger is cheap. Risk-based needs the chance of success at every point on every path; a precomputed table of chance of success by age and withdrawal rate keeps that fast, to be measured.

**Tests:** a hand-made path under Guyton-Klinger; each risk-based guardrail, rerun, lands on its target chance of success; with no volatility no rule triggers.

## Phase 10: Household plans and comparison

One household, several plans. The household's facts (people, birthdates, accounts as they stand today) are entered once; each plan is a saved set of the inputs that can differ (retirement ages, contributions, claiming ages, spending, the legacy goal, the planner's per-year changes), with a name: "Base", "Retire at 62", "Convert $50k a year to 2032", "Both claim at 70".

**Working with plans:**

- A plan switcher on the inputs page and in every calculator; new plans start as a copy of the current one.
- Every calculator shows the plan that is selected.

**Comparing plans:** pick two or more and see them side by side:

- What changed: the inputs that differ.
- Each calculator's headline figures for every plan, with the differences: funded level, what the resources allow, lifetime tax, IRMAA, wealth for heirs, chance of success.
- The key charts overlaid: portfolio over time, tax per year, spending.

**Storage:** plans live under the saved household; a database change with its own row-level security, audit log entries and self-check, like round one's. Which inputs count as household facts and which belong to a plan is settled at the start of the phase (phase 0's input list makes that a short exercise).

## Phase 11: Liabilities and a debt pay-off calculator

The app has nothing for liabilities today beyond "debt payments that end". Phase 0 adds a Liabilities block with every debt as a row (mortgage, car, student loan, credit card, other: balance, rate, monthly payment); phase 11 adds the calculator and wires each payoff into the plan. It depends only on phase 0 and the projection, so it can move earlier if wanted.

**The debt pay-off calculator:**

- Each debt's schedule: payment, interest and principal each year, and its payoff date; all debts together on one timeline.
- Extra payments: monthly, yearly or a lump sum, and the order to apply them across debts: highest rate first (the "avalanche") or smallest balance first (the "snowball"), with the interest each order costs.
- Pay off or invest: the same extra money invested at the household's return in a taxable account, taxed as the rest of the app taxes it. Shows payoff dates both ways, interest saved, the invested balance, net worth both ways over time, and the break-even return for each debt (its rate, since itemized deductions are not modeled). The mortgage is the main case.

**Into the plan:** each payment stops at its payoff date. Before retirement that lowers the retirement income number (as debts that end do today); after retirement it lowers spending from that year on, so the projection's need steps down. Payoff dates that move with extra payments flow through to every calculator.

**Tests:** a hand-worked amortization; avalanche and snowball on a hand-made pair of debts; the break-even return; the spending need stepping down in a payoff year.

## Open questions

New ones go here as they come up.

**Open: more than one contribution type per person (noted 2026-10-07, phase 0 step a).** For now each person's contributions need one type (Roth or Pre-tax) and one account type, so a split such as a Roth 401(k) plus a Pre-tax IRA shows an error. The Roth comparison takes one type per person. To decide later: compare each row on its own, or the person's whole mix against all-Roth and all-Pre-tax; how a split shares the IRS limit (401(k) and IRA limits are separate; Roth and Pre-tax 401(k) share one); and how taxable contribution rows enter the comparison (today they are left out). Likely home: phase 7, or sooner if advisors need it.
