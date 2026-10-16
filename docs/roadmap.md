# Round 2 roadmap

The plan for round 2: the current status, the phases left, and how they fit together. Finished phases and settled decisions are in `docs/roadmap-archive.md`, ideas not scheduled in `docs/ideas.md`, round one in `docs/history.md`. Moved here from the plan doc (https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095, frozen) on 2026-10-09.

## Current status

*Rewritten (not appended to) at each `/closeout`. Last: 2026-10-16.*

**Done:** round one; round 2 phases 0 to 9, the switchover and the "Before phase" lists. 1,119 tests. Last closed: phase 9 (tag `phase-9-done`): Spending guardrails (#/guardrails, under Evaluations), risk-based only: the spending 80% of 200 paths sustain, today's cut (chance 50%) and raise (95%) portfolio values with the spending after each, the same each retired year from yearly tables, and 1,000 paths under the rule (cuts, raises, lowest spending). Also: Social Security counts this year without a retirement age, and an estimate for a retiree reads the work they left (Michael, 2026-10-16).

**In progress:** nothing. The three-scenario Visualization page (side task, 2026-10-16) is built, pushed and paused; Michael wants to come back to it (`docs/ideas.md`, "Three-scenario visualization").

**Next:** a default legacy goal (Michael, 2026-10-16: 20% of the balance at retirement, for a more conservative plan; an entered goal overrides it). To settle first: "at retirement" = the start of the last retirement year (today's balance if retired), the plan's projected balance as a fixed target, whether saved households keep "none", balance vs. after tax. A results change everywhere the legacy goal is held. Then phase 10 (household plans), first step: which inputs are household facts and which belong to a plan.

**Known gaps and open items:**
- Guardrails (open for Michael): the last-year rule (a path lasts if it pays every year before the last; on the default household 78% pay less than planned in the last year, by 11% in the middle) and whether 50%/95% stay (Income Lab: 25%/about 100%). The yearly tables start from the middle path's account mix and IRMAA history; a run takes about 75 s in a browser.
- Social Security claiming ages are whole years; month-level claiming, partial first years and SSA's January-1st birthday rule aren't modeled (in `docs/ideas.md`). The page doesn't rerun the plan at each claiming age (`claimingPlanEffect` kept).
- The Roth page's lifetime comparison doesn't hold the legacy goal in its sustainable spending; it sets the contributions itself, so the planner's contribution changes don't reach it. Its retirement snapshot leaves out other income rows such as rent.
- Tax-exempt income isn't yet in Social Security taxability or IRMAA. One contribution type per person (Open questions); the Roth catch-up rule is stated but not applied.
- Only the first death is modeled. "Currently receiving" Social Security has no known PIA, so no spousal top-up from it.
- Funding: extra savings earn no extra employer match; the savings-needed search scales the rows as entered.
- Monte Carlo: returns independent year to year, one volatility for every account, the plan's lifespans; the fan's scale follows the top paths.
- Staged spending is designed (`docs/staged-spending-design.md`) but not built (Later release).

**Decisions later phases build on** (details in the archive):
- Today's dollars everywhere; fixed thresholds shrink at the inflation input (2.5%) via `thresholdScale`. Results change only by a decided change; the v1 pins change by additions only.
- Rate terms: marginal = the bracket, average tax rate = tax ÷ income, effective marginal rate = the tax on the next dollar.
- Decision calculators vs. plan evaluators; "Use in the plan" writes a choice back. The Dashboard groups them as Decisions and Evaluations.
- The spending need: one function (`spendingNeed.js`), from today's income (default) or the budget; everyone retired = the budget.
- The legacy goal (none by default, until the change above) applies to every sustainable-spending figure on the evaluators; after-tax figures use `afterTaxEnding`.
- Funding: through retirement leads; the 4% measure is the projection's own year at the last retirement; about even = within 5%.
- Survivor years: single from the year after the first death, accounts roll to the survivor, spending 80%; Social Security on the SSA survivor rules.
- A retirement age at or below the age now = already retired. A claim "at retirement" follows the retirement age (62 to 70); whole years.
- Income above the need: spent while working, saved in retirement, by default. Employer money is Pre-tax, held to 415(c). Lifetime tax = federal income tax + IRMAA.
- A conversion's tax: once anyone has retired, from a taxable account, else held back; while everyone works, held back.
- The planner's changes are part of the plan (`household.plannerChanges`); phase 10 gives each plan its own set. Each projection row carries its parts (`row.detail`).
- Monte Carlo: the plan's returns are each year's median (lognormal); one fixed seed; `runProjection`'s `yearReturn`, `needIn`, `rescale` and `snapshotAt`/`resume` are the hooks (off = today's results).
- Guardrails (phase 9): risk-based only; target 80%, cut 50%, raise 95%, back to the target, under 5% skipped (settings saved with the household); values are order statistics of per-path clouds, so reruns land on target.
- Each phase ends with its Docs article (`articles/`, listed in `src/lib/docs.js`).


## Phases left

| Phase | What ships | Done when |
| --- | --- | --- |
| 10. Household plans | One household's facts with several saved plans, switching between them and comparing them in every calculator. | Two plans of one household open side by side with every difference marked. |
| 11. Liabilities and debt pay-off | A debt pay-off calculator for every debt (the mortgage included): pay off early or invest, the order to pay debts off, and payoff dates flowing into the retirement income number and the projection. | A hand-worked amortization matches, and the payoff year changes the spending need from that year on. |

The finished phases (0 to 9, the switchover and the "Before phase" lists) and the decision tables are in `docs/roadmap-archive.md`.

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
| The return each year | Constant | Random paths: Monte Carlo (phase 8, built) |

**Surplus income (decided 2026-10-08).** Some years bring in more than spending, tax and savings use: an RMD larger than the need, part-time work or rent in retirement, Social Security plus a pension. A setting in Assumptions decides what happens to it: **save it** (reinvested in a taxable account, as today; the default) or **spend it** (spending rises in those years). Built in phase 2; each year's surplus shows in the year table. The same rule covers income beyond the paycheck before retirement. Later, phase 11 may add sending it to extra debt payments.

### Year-by-year and Monte Carlo: one plan

Both run the same plan from the same inputs and assumptions; only the returns differ. The year-by-year projection is the plan at a constant return, readable line by line. Monte Carlo (phase 8) reruns that exact plan over many random return paths and reports how often it works. With no volatility, Monte Carlo reproduces the year-by-year exactly (a test). Both pages show the same plan (by name, once phase 10 exists) and link to each other; the guardrails (phase 9) are spending rules applied inside the same paths.

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

## Three-scenario visualization (side task, started 2026-10-16)

Michael asked for charts comparing (1) all Roth, (2) all Pre-tax and (3) all Pre-tax with Roth conversions, across starting ages, incomes and existing balances: first a broad view, then narrow it down. A new page (`#/scenarios/three-way`), linked from the Visualization page; it runs the existing `compareWithConversions` (no new financial math) over a grid of sample households, in background workers with a Run button.

- **The winner is after-tax wealth at the end age, spending the plan's need** (decided 2026-10-16). Reason: sustainable spending, the usual headline, can't show conversions: at the highest steady spending the withdrawals fill the low brackets, so phase 7's rule finds no room and scenario 3 ties Pre-tax exactly (checked on 4 sample households). Lifetime tax and sustainable spending are shown beside it.
- **Scenario 3 uses phase 7's rule** (decided 2026-10-16): in retired years, fill to the top of the bracket below today's contribution rate, RMD years included; the same rule as the Roth page's conversions block.
- Sample households: single, W-2 pay, 10% of pay saved, the existing balance all Pre-tax, retiring at 65, planning to 95, the default assumptions, no debt payments. Within 0.5% of the best is "about even" (the app's rule). The grid: starting ages 25/35/45/55 × pay $50k–$300k (6) × existing Pre-tax $0–$2M (6) = 144 households, about 85 seconds in 3 workers.
- **Where the money runs out, the savings rate goes up** (Michael, 2026-10-16): from 10% in steps (15, 20, 25, 30, 40, 50%) to the first at which all three scenarios last to 95 (marked ↑). On the first run 27 of 144 needed it and every one lasted by 50%. Raising savings also lowers the spending need (take-home pay after savings), so these households also spend less. Only if 50% doesn't last are they ranked by sustainable spending (marked †; none so far).
- **Heirs' rate 24%, 12% or 0%, and ranking by lifetime tax** (Michael, 2026-10-16): switches on the page, no rerun (each run keeps the wealth at all three heirs' rates). Lifetime tax: lower wins; the lead is how much less than the next best.
- **Built (2026-10-16):** the page (winner maps per starting age; "A closer look": any one variable across, the other two held, each scenario vs. all Pre-tax, with a table of wealth, lifetime tax, sustainable spending and the amount converted). No Docs article yet (the Visualization page has none either).
- **First read of the results (for narrowing down):** Roth wins most of the map for 25- and 35-year-olds, often by 5–19%; much of that lead is the heirs' rate (24%) on large leftover Pre-tax balances. Conversions win only scattered cells (largest at 55 with $250k–$1M saved and $75k pay, +12%). The "°" cells (no room to convert at the need) follow pay: at $50k, $100k and $200k the plan's own withdrawals already fill the bracket below today's rate. 
- **Second run (savings raised where needed), cells won of 36 per starting age (Roth / Pre-tax / conversions / even):** heirs at 24%: 25: 35/0/1/0; 35: 30/3/3/0; 45: 23/3/7/3; 55: 17/9/6/4. Heirs at 12%: 25: 33/0/1/2; 35: 29/4/2/1; 45: 21/6/3/6; 55: 16/13/4/3. Heirs at 0%: 25: 29/0/1/6; 35: 25/5/2/4; 45: 17/9/2/8; 55: 15/15/2/4. Lifetime tax: Roth wins all 108 cells at 25–45; at 55, Roth 27, conversions 6, even 3. So Roth's lead shrinks as the heirs' rate falls but mostly holds; Pre-tax gains ground with age (fewer years of tax-free growth); conversions win mainly where savings had to be raised (45 and 55 with little saved).

## Open questions

New ones go here as they come up.

**Open: more than one contribution type per person (noted 2026-10-07, phase 0 step a).** For now each person's contributions need one type (Roth or Pre-tax) and one account type, so a split such as a Roth 401(k) plus a Pre-tax IRA shows an error. The Roth comparison takes one type per person. To decide later: compare each row on its own, or the person's whole mix against all-Roth and all-Pre-tax; how a split shares the IRS limit (401(k) and IRA limits are separate; Roth and Pre-tax 401(k) share one); and how taxable contribution rows enter the comparison (today they are left out). Likely home: phase 7, or sooner if advisors need it.
