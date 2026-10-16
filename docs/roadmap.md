# Round 2 roadmap

The plan for round 2: the current status, the phases left, and how they fit together. Finished phases and settled decisions are in `docs/roadmap-archive.md`, ideas not scheduled in `docs/ideas.md`, round one in `docs/history.md`. Moved here from the plan doc (https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095, frozen) on 2026-10-09.

## Current status

*Rewritten (not appended to) at each `/closeout`. Last: 2026-10-16.*

**Done:** round one; round 2 phases 0 to 7, the switchover and the "Before phase" lists. 1,025 tests. Last closed: phase 7 (tag `phase-7-done`): on the Roth page under "Over a lifetime", the bracket each year against a chosen rate and the Roth vs. Pre-tax answer again with conversions in the years taxed below it (four full runs; conversions year by year with IRMAA room). With it: the "Before phase 7" input and page items, and the Social Security page rework (claiming strategy grid with the selected beside the most, year-by-year stacked bars, two freely chosen strategies on the break-even graph, a couple's joint odds).

**In progress:** nothing.

**Next:** phase 8, Monte Carlo. First step: the projection takes an optional return for each year (none = today's results), with a seeded random number generator and the zero-volatility test.

**Known gaps and open items:**
- Social Security claiming ages are whole years; month-level claiming, partial first years and SSA's January-1st birthday rule aren't modeled (in `docs/ideas.md`).
- The Social Security page no longer reruns the plan at each claiming age (removed 2026-10-16; `claimingPlanEffect` kept, tested, if wanted back).
- The Roth page's lifetime comparison doesn't hold the legacy goal in its sustainable spending; it sets the contributions itself, so the planner's contribution changes don't reach it (its conversions do).
- The Roth comparison's retirement snapshot leaves out other income rows such as rent (the pension is in).
- Tax-exempt income isn't yet in Social Security taxability or IRMAA.
- One contribution type per person (see Open questions). The Roth catch-up rule is stated on the Roth page but not applied to the numbers.
- Only the first death is modeled; the survivor lives to their life expectancy. "Currently receiving" Social Security has no known PIA, so it gives a spouse no spousal top-up.
- Funding: extra savings earn no extra employer match, and the savings-needed search scales the rows as entered (not the planner's contribution changes).
- Staged spending is designed (`docs/staged-spending-design.md`) but not built (Later release).

**Decisions later phases build on** (details in the archive):
- Today's dollars everywhere; fixed thresholds shrink at the inflation input (2.5%) via `thresholdScale`. Results change only by a decided change; the v1 pins change by additions only.
- Rate terms: marginal = the bracket, average tax rate = tax ÷ income, effective marginal rate = the tax on the next dollar. The Roth comparison pairs marginal today with the effective rate on the withdrawal.
- Decision calculators vs. plan evaluators (below); "Use in the plan" writes a choice back. The Dashboard groups them as Decisions and Evaluations.
- The spending need: one function (`spendingNeed.js`), from today's income (default) or the budget; everyone retired = the budget. Solves that change savings hold it fixed.
- The legacy goal (none by default) applies to every sustainable-spending figure on the evaluators; after-tax figures for what is left use `afterTaxEnding` (heirs' rate; a charity's share from Pre-tax first).
- Funding: through retirement leads; the 4% measure is the projection's own year at the last retirement; about even = within 5%.
- Survivor years: single from the year after the first death, accounts roll to the survivor, spending 80% (an input); Social Security on the SSA survivor rules.
- A retirement age at or below the age now = already retired. A Social Security claim "at retirement" follows the retirement age (62 to 70). Claiming ages are whole years.
- Income above the need: spent while working, saved in retirement, by default. Taxable contribution rows are savings, outside the Roth vs. Pre-tax comparison.
- Employer money is always Pre-tax, held to the 415(c) limit. A pension lump sum rolls to the owner's Pre-tax IRA at its start age. Lifetime tax = federal income tax + IRMAA.
- A conversion's tax (every conversion, decided 2026-10-12): once anyone has retired, from a taxable account, else held back from the conversion; while everyone works, held back. IRMAA for the two years before the projection: the first year's MAGI without conversions (2026-10-13).
- The planner's changes are part of the plan (`household.plannerChanges`, runProjection's `yearChanges`): every page that runs the plan includes them and says so; phase 10 gives each plan its own set. Each projection row carries its parts (`row.detail`).
- Conversions in the lower years (phase 7): fill to the top of the bracket under the chosen rate, in any retired year (RMD years too), on top of the plan's strategy and the planner's changes; "below" compares the marginal bracket. No "Use in the plan"; the planner puts conversions in the plan.
- Each phase ends with its Docs article (`articles/`, listed in `src/lib/docs.js`).


## Phases left

| Phase | What ships | Done when |
| --- | --- | --- |
| 8. Monte Carlo | Random return paths from the S&P 500's return and volatility after inflation (adjustable), chance of success, distribution charts for income and portfolio value. | No volatility reproduces the projection; a fixed seed repeats. |
| 9. Spending with guardrails | The spending that succeeds in 50% of paths, and when to raise or cut it. | Each guardrail, rerun, lands on its target. |
| 10. Household plans | One household's facts with several saved plans, switching between them and comparing them in every calculator. | Two plans of one household open side by side with every difference marked. |
| 11. Liabilities and debt pay-off | A debt pay-off calculator for every debt (the mortgage included): pay off early or invest, the order to pay debts off, and payoff dates flowing into the retirement income number and the projection. | A hand-worked amortization matches, and the payoff year changes the spending need from that year on. |

The finished phases (0 to 7, the switchover and the "Before phase" lists) and the decision tables are in `docs/roadmap-archive.md`.

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
| Roth conversions | Roth conversion (this year), the planner (phase 6), Roth vs. Pre-tax with conversions (phase 7) | Yes: a whole-plan withdrawal strategy, and year by year in the planner | The planner writes straight into the plan (phase 6); phase 7 has no button (decided 2026-10-15) |
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
| Roth conversions | As whole-plan strategies, and year by year (the planner, phase 6) | — |
| Debt payments | Only "payments that end", before retirement | Each debt to its payoff date, before and after retirement: phase 11 |
| Spending | Flat, from income or the budget, with the legacy goal (phase 3) | Guardrails: phase 9; staged spending: later (designed) |
| Survivor years | Yes | — |
| Tax drag on taxable accounts; returns before and after retirement | Yes | — |
| The return each year | Constant | Random paths: phase 8 |

**Surplus income (decided 2026-10-08).** Some years bring in more than spending, tax and savings use: an RMD larger than the need, part-time work or rent in retirement, Social Security plus a pension. A setting in Assumptions decides what happens to it: **save it** (reinvested in a taxable account, as today; the default) or **spend it** (spending rises in those years). Built in phase 2; each year's surplus shows in the year table. The same rule covers income beyond the paycheck before retirement. Later, phase 11 may add sending it to extra debt payments.

### Year-by-year and Monte Carlo: one plan

Both run the same plan from the same inputs and assumptions; only the returns differ. The year-by-year projection is the plan at a constant return, readable line by line. Monte Carlo (phase 8) reruns that exact plan over many random return paths and reports how often it works. With no volatility, Monte Carlo reproduces the year-by-year exactly (a test). Both pages show the same plan (by name, once phase 10 exists) and link to each other; the guardrails (phase 9) are spending rules applied inside the same paths.

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

**Decisions (Michael, 2026-10-16):**

| Question | Decision |
| --- | --- |
| The average return | The plan's two return inputs (before and after retirement), read as the long-run compound growth: the median path lands near the projection. Each year's draw is set higher to match (lognormal: the average yearly return is above the compound rate by about half the variance). |
| Volatility | The S&P 500's own yearly swing after inflation, about 20% (NYU Stern's yearly returns from 1928, figure cited in the docs); a slider on the page. |
| Paths | 1,000. |
| The income chart | The spending each path sustains, from the first 200 paths (a search per path), filling in after the rest; its median is the spending that succeeds in half the paths (phase 9 builds on it). Chance of success and the portfolio charts use all 1,000. |
| When it runs | A Run button (Michael asked whether one is needed: yes, a run takes 8 to 30 seconds). Progress shows while it runs; results stay after an input changes, marked out of date until run again. |

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
