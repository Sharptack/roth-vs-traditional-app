# Round 2 roadmap

The plan for round 2: the current status, the phases left, and how they fit together. Finished phases and settled decisions are in `docs/roadmap-archive.md`, ideas not scheduled in `docs/ideas.md`, round one in `docs/history.md`. Moved here from the plan doc (https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095, frozen) on 2026-10-09.

## Current status

*Rewritten (not appended to) at each `/closeout`. Last: 2026-10-09.*

**Done:** round one; round 2 phases 0 (inputs, calculators, blocks), 1 (calculator updates), the switchover, phase 2 (survivor years and engine additions) and both "Before phase" lists. 837 tests. Last closed: "Before phase 3: adjustments" (tag `phase-before-3-done`).

**In progress:** "Before phase 3: adjustments (2)", Michael's list of 2026-10-09 (below). Then phase 3.

### Before phase 3: adjustments (2) (2026-10-09)

Tax calculator:
- [x] The calculation block moves below the tax bracket visual (reverses the 2026-10-09 "above the chart").
- [x] The "next $100" block becomes a short worked calculation of the effective marginal rate for the headline source (the $100, what it sets off, the extra tax, ÷ 100); the other sources' one-line rates stay below it (decided 2026-10-09).
- [x] The bracket visual's "Total income" header larger, in line with the marginal and average rate headers.
- [x] Social Security "Currently receiving": a third choice beside the PIA and the estimate. The monthly check as received today, in today's dollars, with no claiming adjustment, from this year on (decided 2026-10-09). Its PIA isn't known, so it gives the spouse no spousal top-up. Why: a PIA entered for someone already receiving was adjusted for a claiming age, inflating the benefit.

Inputs:
- [ ] The clients card starts collapsed and is renamed "Households".
- [ ] Accounts collapse to one line like income rows.
- [ ] The cost basis field lines up on the calculators' input cards.
- [ ] No "Retirement age must be after your current age" error: a retirement age at or below the current age means already retired (no earnings or contributions from this year, the retirement return, the Roth snapshot today); the age stays as entered (decided 2026-10-09).
- [ ] "a year" in labels becomes "per year".

Roth vs. Pre-tax:
- [ ] The start/end ages link closes again after opening.
- [ ] "Federal income tax on that" opens to show its calculation.

Pension: "In the plan" lines up. Roth conversion: the "Tax paid each year" chart moves to its own block at the bottom (more charts may join it).

**Next: phase 3, retirement spending.** Steps not yet set (set them here first). It must start with a spending input for a household already retired: the projection, the Roth comparison and the conversion page's lifetime view all need it.

**Known gaps and open items:**
- No lifetime view for a household past its retirement age (no retirement income number); phase 3's spending input fixes it.
- The Roth comparison's retirement snapshot leaves out other income rows such as rent (the pension is in).
- Tax-exempt income isn't yet in Social Security taxability or IRMAA.
- One contribution type per person (see Open questions). The Roth catch-up rule is stated on the Roth page but not applied to the numbers.
- Only the first death is modeled; the survivor lives to the end age.

**Decisions later phases build on** (details in the archive):
- Today's dollars everywhere; fixed thresholds shrink at the inflation input (2.5%) via `thresholdScale`. Results change only by a decided change; the v1 pins change by additions only.
- Rate terms: marginal = the bracket, average tax rate = tax ÷ income, effective marginal rate = the tax on the next dollar. The Roth comparison pairs marginal today with the effective rate on the withdrawal.
- Decision calculators vs. plan evaluators (below); "Use in the plan" writes a choice back (Roth/Pre-tax trial, pension lump sum). The Dashboard groups them as Decisions and Evaluations.
- Survivor years: single from the year after the first death, the larger Social Security benefit, accounts roll to the survivor, spending 80% (an input).
- Income above the need: save it (default) or spend it. Each taxable account is the only source of its dividends (1.3% qualified by default); an "Other: qualified dividends" row is outside money.
- Employer money is always Pre-tax, held to the 415(c) limit. The return in retirement applies once no one works; the Roth comparison's snapshot is at the last retirement.
- A pension lump sum rolls to the owner's Pre-tax IRA at the pension's start age. A conversion's tax while anyone works comes out of the conversion; once retired, from withdrawals. Lifetime tax = federal income tax + IRMAA.
- Each phase ends with its Docs article (`articles/`, listed in `src/lib/docs.js`).

## Phases left

| Phase | What ships | Done when |
| --- | --- | --- |
| 3. What your resources allow you to spend | Sustainable spending with a legacy goal; spending flat for now; a written design for staged spending. | A hand-worked case spends down to exactly the legacy goal. |
| 4. Pre-retirement funding | The spending need against the assets' first-year 4% income and against sustainable spending; savings needed; retirement age. | Each solved savings amount, rerun, lands on its target. |
| 5. Social Security | Benefits by claiming age from each full-retirement-age benefit, lifetime totals, break-even ages, the spouse-by-spouse grid, a discount rate, the chance of being alive by age. | Hand-worked reductions, credits and survivor benefits match. |
| 6. Year-by-year planner | A new page: click a year to add a Roth conversion or change a contribution, and see what that change is worth. | A change alters only that year and later; its value matches a full rerun. |
| 7. Roth vs. Pre-tax with later conversions | New blocks on the Roth vs. Pre-tax calculator: the tax bracket each year, and the answer again with conversions in the years taxed lower. | Each block's figures reconcile with separate full runs. |
| 8. Monte Carlo | Random return paths from the S&P 500's return and volatility after inflation (adjustable), chance of success, distribution charts for income and portfolio value. | No volatility reproduces the projection; a fixed seed repeats. |
| 9. Spending with guardrails | The spending that succeeds in 50% of paths, and when to raise or cut it. | Each guardrail, rerun, lands on its target. |
| 10. Household plans | One household's facts with several saved plans, switching between them and comparing them in every calculator. | Two plans of one household open side by side with every difference marked. |
| 11. Liabilities and debt pay-off | A debt pay-off calculator for every debt (the mortgage included): pay off early or invest, the order to pay debts off, and payoff dates flowing into the retirement income number and the projection. | A hand-worked amortization matches, and the payoff year changes the spending need from that year on. |

The finished phases (0, 1, 2, the switchover and the two "Before phase" lists) and the decision tables are in `docs/roadmap-archive.md`.

## How the plan fits together

The household's plan is one set of facts plus the decisions made about them, and one projection runs it. Two kinds of tools read that projection (proposed 2026-10-08; Michael decides once he can see it working, so the first "Use in the plan" button is built as a trial):

- **Decision calculators** weigh one choice: Roth or Pre-tax, when to claim Social Security, how much to convert, lump sum or monthly pension, pay off a debt or invest, when to retire. Each runs the plan once per option, with every other decision held as it stands, so the answer accounts for the rest of the plan. Each starts from the plan's current choice and has a **Use in the plan** button that writes the chosen option back into the household.
- **Plan evaluators** judge the whole plan with every decision made: the year-by-year projection, Monte Carlo, what the resources allow you to spend, pre-retirement funding and guardrails. They change no decision; they show whether the plan works.

Household plans (phase 10) are then named sets of decisions over the same facts, compared with the plan evaluators.

A decision calculator runs the plan once per option and writes the chosen one back; every evaluator reads the same plan with all decisions in place.

### The decisions in the plan

| Decision | Weighed by | In the plan today | "Use in the plan" lands in |
| --- | --- | --- | --- |
| Retirement age, each person | Pre-retirement funding (phase 4) | Yes, an input | Phase 4 |
| Roth or Pre-tax contributions | Roth vs. Pre-tax (phases 1 and 7) | Yes, the contribution rows | Built as a trial (phase 1) |
| Social Security claiming age, each person | Social Security (phase 5) | Yes, an input | Phase 5 |
| Roth conversions | Roth conversion (this year), the planner (phase 6), Roth vs. Pre-tax with conversions (phase 7) | Only as a whole-plan withdrawal strategy | Phase 6 (year by year), phase 7 (its rule) |
| Pension: lump sum or monthly | Pension (phase 1) | Yes, the pension row | Built (before phase 3) |
| Debts: pay off early or invest | Debt pay-off (phase 11) | No | Phase 11 |
| Which accounts to draw first | The projection's strategy comparison | Yes, an input | Already there |
| How much to spend, and the legacy goal | Retirement spending (phase 3), guardrails (phase 9) | The flat retirement income number | Phases 3 and 9 |

### What the projection includes

The projection has to carry every part of the household, so the plan evaluators judge the real plan. Phase 2 filled in most of it; the rest lands in the phases below.

| Part of the plan | In the projection today | Added in |
| --- | --- | --- |
| Earnings (W-2, 1099) to each person's retirement | Yes, flat (no raises) | — |
| Other income rows over their ages (part-time work, rental, an annuity) | Yes | Phase 2 (done) |
| Contributions, with the IRS limit and catch-up | Yes, with employer contributions | — |
| Social Security at the chosen claiming ages, with the spousal top-up | Yes, with survivor benefits | SSA survivor rules: phase 5 |
| Pension, monthly or as a lump-sum rollover | Yes | — |
| RMDs and IRMAA | Yes | — |
| Roth conversions | As whole-plan strategies | Year by year: phase 6 |
| Debt payments | Only "payments that end", before retirement | Each debt to its payoff date, before and after retirement: phase 11 |
| Spending | The flat retirement income number | Legacy goal: phase 3; guardrails: phase 9; staged spending: later |
| Survivor years | Yes | — |
| Tax drag on taxable accounts; returns before and after retirement | Yes | — |
| The return each year | Constant | Random paths: phase 8 |

**Surplus income (decided 2026-10-08).** Some years bring in more than spending, tax and savings use: an RMD larger than the need, part-time work or rent in retirement, Social Security plus a pension. A setting in Assumptions decides what happens to it: **save it** (reinvested in a taxable account, as today; the default) or **spend it** (spending rises in those years). Built in phase 2; each year's surplus shows in the year table. The same rule covers income beyond the paycheck before retirement. Later, phase 11 may add sending it to extra debt payments.

### Year-by-year and Monte Carlo: one plan

Both run the same plan from the same inputs and assumptions; only the returns differ. The year-by-year projection is the plan at a constant return, readable line by line. Monte Carlo (phase 8) reruns that exact plan over many random return paths and reports how often it works. With no volatility, Monte Carlo reproduces the year-by-year exactly (a test). Both pages show the same plan (by name, once phase 10 exists) and link to each other; the guardrails (phase 9) are spending rules applied inside the same paths.

## Phase 3: What your resources allow you to spend

The question is less "how much do I spend?" than "how much do my resources allow me to spend?" The projection already answers a version of it (sustainable spending); phase 3 adds a legacy goal and gives the answer its own calculator page, Retirement spending.

**The legacy goal:** the household spends the most it can while still leaving at least the goal at the second death. Options for setting it: a dollar amount in today's dollars, a share of today's portfolio, or none. Both measures are offered, starting with the balance itself; the after-tax amount (Pre-tax money taxed at the heirs' rate) follows for more robust planning.

**The page shows:**

- What the resources allow: sustainable spending through the plan, with the legacy goal met.
- Against today's lifestyle: that figure beside the retirement income number, and the difference.
- The trade-off: a chart of spending against legacy (for example, each $100,000 more for heirs costs $X a year of spending), so the goal can be adjusted with the cost in view.

**Spending stays flat to start** (with phase 2's 80% after the first death). Staged spending is designed in this phase and built later: the design write-up covers spending that falls with age (the research on the "retirement spending smile"), one-off and repeating extra expenses, health care before Medicare and long-term care, health costs rising faster than prices, and a bottom-up budget feeding the base. It is agreed with Michael before anything is built.

**Engine:** the sustainable-spending search gains the legacy goal as a second condition: no shortfall in any year and at least the goal left at the end.

**A charitable legacy.** The legacy goal can be split between heirs and charity. A charity owes no tax on Pre-tax money it inherits, so Pre-tax money is worth its full balance there, while heirs pay tax on it. The larger the charitable share, the more Pre-tax is favored, both in the Roth vs. Pre-tax comparison and in deciding which accounts to spend first. The page shows that effect in a sentence and in the wealth figures.

**Tests:** a hand-worked case with no tax and only Roth money, where spending with a legacy goal follows the annuity formula with a final balance.

## Phase 4: Pre-retirement funding

Is the household on track? The calculator sets the spending its current income supports against what its future assets can pay, two ways, says which of three it is, and shows what closes the gap.

**Two measures, side by side:**

1. **At retirement (a threshold):** the retirement income number against the after-tax income from a 4% first-year withdrawal of the assets at retirement, with Social Security (the Roth calculator's total portfolio card already computes this).
2. **Through retirement:** the retirement income number against what the resources allow through the plan (phase 3's sustainable spending, legacy goal included).

For each: funded level = what the assets pay ÷ the need. Within 5% = about even (to tune), below = underfunded, above = overfunded.

**What closes the gap:**

- **Savings needed:** one household figure a year that brings each measure to its target (100% by default, adjustable), shown as dollars and as a share of household pay. It is spread across the contribution rows in proportion to today's amounts; amounts over the IRS limit go to a taxable account, as today.
- **Retirement age:** the funded level and the savings needed for retirement earlier or later, with each spouse's retirement age moved on its own (their own income and contributions stop then); the household is retired once the last spouse retires.
- **Overfunded:** how much more could be spent, how much less saved, or how much earlier retirement could come.

**Speed:** measure 2 costs a sustainable-spending search per point (about 25 projections) and the savings solve searches over that; a few secant steps plus a final check should keep each solve under a second, to be measured.

**Tests:** a hand-worked case with no tax and no Social Security; every solved amount, rerun, lands on its target.

## Phase 5: Social Security calculator

When should each spouse claim? From each person's benefit at full retirement age (PIA, entered in phase 0) and birthdate, the calculator totals gross lifetime benefits for every claiming age from 62 to 70, finds the break-even ages, and lays out every pair of a couple's claiming ages as a grid.

**Rules (monthly, in today's dollars, since benefits rise with prices):**

- Own benefit: reduced 5/9 of 1% a month for the first 36 months before full retirement age, 5/12 of 1% beyond; delayed credits of 2/3 of 1% a month to 70. Full retirement age by birth year (round one has the table); the birth month sets the exact months.
- Spousal benefit: up to half the other's PIA, reduced if claimed early, no delayed credits (round one has this).
- Survivor benefit: the deceased's benefit including delayed credits (at least 82.5% of their PIA if they claimed early), reduced if the survivor claims before their survivor full retirement age. Phase 2's survivor years switch to these rules.
- Not modeled: the earnings test, benefits for children or ex-spouses.

**Outputs:**

1. Gross lifetime benefits by claiming age, to each person's plan-to age; a discount rate input, 0% by default.
2. Break-even ages between claiming ages (e.g. 62 vs. 67 vs. 70).
3. For a couple: one spouse's claiming age across, the other's down; each cell = the household's lifetime benefits (own, spousal, survivor), the best cell marked.
4. A chart of the chance of being alive at each age (from the SSA period life table, by sex), beside the plan-to ages, so the advisor can judge how likely the break-even ages are to be reached.

Taxes on benefits stay in the other calculators.

**Tests:** hand-worked reductions and credits at each claiming age, one break-even age, a survivor benefit after an early claim, one grid cell rebuilt from its three streams.

**Benefit estimator (asked 2026-10-08):** estimate future benefits from the earnings record, with quick options: a range of years and an average income over it, instead of every year's amount.

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
