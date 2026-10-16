# Round 2 roadmap

The plan for round 2: the current status, the phases left, and how they fit together. Finished phases and settled decisions are in `docs/roadmap-archive.md`, ideas not scheduled in `docs/ideas.md`, round one in `docs/history.md`. Moved here from the plan doc (https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095, frozen) on 2026-10-09.

## Current status

*Rewritten (not appended to) at each `/closeout`. Last: 2026-10-16.*

**Done:** round one; round 2 phases 0 to 8, the switchover and the "Before phase" lists. 1,048 tests. Last closed: phase 8 (tag `phase-8-done`): Monte Carlo (#/monte-carlo, under Evaluations): 1,000 seeded random return paths around the plan's returns (their median; volatility 20% to start, a slider saved with the household), run in background workers with a Run button; the chance of success, the portfolio's fan and its spread at an age, the spending each of 200 paths sustains, when failing paths run out. Before it: the Social Security rework and phase 7 (closed 2026-10-16).

**In progress:** phase 9, spending with guardrails: the method and default thresholds settled (2026-10-16, below); steps (a) to (e) done; waiting on Michael to check the page and confirm the open points before `/closeout`. Fixed 2026-10-16 (Michael found it): with any retirement age blank, Social Security counted as $0 this year (the tax and conversion calculators), though the tax page asks only for the age; now a retirement age is needed only for a claim "at retirement", so a benefit received or claimed at a set age counts. A results change only for households with a blank retirement age (his case: $315 to $2,445 of tax). Decided 2026-10-16 (Michael): for someone already retired, a Social Security estimate from earnings reads the W-2 and 1099 rows of the work they left (rows that ended; a blank last age ends at retirement), not this year's (none, or part-time pay); with no such row, $0 as before. Reason: a retiree on the estimate got $0 on every page. A results change for retirees on the estimate only (a $100,000 job left at 65: $0 to $36,224 a year); still-working people unchanged. The three-scenario Visualization page (a side task, 2026-10-16) is built and pushed, and paused; Michael wants to come back to it (other angles, sustainable income: `docs/ideas.md`, "Three-scenario visualization").

**Next:** Michael checks the Spending guardrails page (`#/guardrails`) and settles the open points under phase 9's step (d): the last-year rule, and whether the 50%/95% guardrails stay (against Income Lab's 25%/about 100%). Then `/closeout`.

**Known gaps and open items:**
- Social Security claiming ages are whole years; month-level claiming, partial first years and SSA's January-1st birthday rule aren't modeled (in `docs/ideas.md`).
- The Social Security page no longer reruns the plan at each claiming age (removed 2026-10-16; `claimingPlanEffect` kept, tested, if wanted back).
- The Roth page's lifetime comparison doesn't hold the legacy goal in its sustainable spending; it sets the contributions itself, so the planner's contribution changes don't reach it (its conversions do).
- The Roth comparison's retirement snapshot leaves out other income rows such as rent (the pension is in).
- Tax-exempt income isn't yet in Social Security taxability or IRMAA.
- One contribution type per person (see Open questions). The Roth catch-up rule is stated on the Roth page but not applied to the numbers.
- Only the first death is modeled; the survivor lives to their life expectancy. "Currently receiving" Social Security has no known PIA, so it gives a spouse no spousal top-up.
- Funding: extra savings earn no extra employer match, and the savings-needed search scales the rows as entered (not the planner's contribution changes).
- Monte Carlo: each year's return is independent of the last, one volatility covers every account (no stocks/bonds split, no glide path), lifespans are the plan's; its fan chart's scale follows the top paths, so the median can look flat late in a long plan.
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
- Monte Carlo (phase 8): the plan's return inputs are each year's median (lognormal; zero volatility = the projection exactly); one fixed seed, so reruns show an input's effect; `runProjection`'s `yearReturn` is the hook; the spending a path sustains is searched to 0.5% (`sustainableSpending`'s `tolerance`). Phase 9's spending rules run inside the same paths.
- Each phase ends with its Docs article (`articles/`, listed in `src/lib/docs.js`).


## Phases left

| Phase | What ships | Done when |
| --- | --- | --- |
| 9. Spending with guardrails | The spending that succeeds in 80% of paths, and when to raise or cut it (risk-based). | Each guardrail, rerun, lands on its target. |
| 10. Household plans | One household's facts with several saved plans, switching between them and comparing them in every calculator. | Two plans of one household open side by side with every difference marked. |
| 11. Liabilities and debt pay-off | A debt pay-off calculator for every debt (the mortgage included): pay off early or invest, the order to pay debts off, and payoff dates flowing into the retirement income number and the projection. | A hand-worked amortization matches, and the payoff year changes the spending need from that year on. |

The finished phases (0 to 8, the switchover and the "Before phase" lists) and the decision tables are in `docs/roadmap-archive.md`.

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

## Phase 9: Spending with guardrails

A spending number with rules for changing it: start at the spending that succeeds in 80% of the Monte Carlo paths, then know in advance at what portfolio value to raise it and at what value to cut it.

**Decided with Michael (2026-10-16):**

- **Risk-based guardrails only; no Guyton-Klinger beside them.** Reason: Michael prefers Income Lab's approach and doesn't want the two side by side. (Supersedes the proposal below and the archive's "Guardrails" line.)
- **The target: 80% chance of success**, adjustable (Income Lab's default: the spending 80% of paths sustain). Replaces the 50% starting point.
- **The guardrails: cut when the chance falls to 50%, raise when it reaches 95%**, both adjustable. Michael's leaning, not firm: he likes Income Lab (cut at 25%, raise at about 100%) and isn't sure. Revisit once the page shows how often cuts come and how large they are under each.
- **The change: back to the target both ways** (the spending whose chance is 80% at that portfolio), **skipped when under 5%** (Income Lab's minimum change).
- Sources: Income Lab's methodology help page (incomelab.helpjuice.com, "How are the retirement paycheck and guardrails calculated?"); Kitces, Fitzpatrick and Tharp, "Improving Retirement Distribution With Risk-Based Guardrails" (2021: a 90% target, cut at 70%, raise at 99%).

**How it works.** The spending the plan sustains differs path by path (phase 8's "spending each path sustains", Income Lab's "spending cloud"). The chance of success at a spending is the share of paths that sustain it, so the target spending is that cloud's 20th percentile. A guardrail is a portfolio value: the value at which today's spending's chance falls to 50% (cut) or rises to 95% (raise), with the whole plan (Social Security, pensions, other income, the years left) in every path. At a guardrail, spending moves to the target spending at that portfolio value.

**Outputs:**

- The target spending (80% of paths sustain it) and today's chance at the plan's spending.
- Today's guardrails: "if the portfolio falls to $X, cut spending to $Y; if it rises to $Z, raise it to $W", and the same levels for the next several years.
- Spending under the rule across the paths: its range by year, how often a cut comes, the largest cut.

**Steps:**

- (a) Today's guardrails (`src/lib/guardrails.js`): the spending cloud with today's balances scaled, the chance at a spending, the target spending, the cut and raise portfolio values and the spending at each, the 5% minimum. Tests on hand-made return paths; with no volatility the chance is 0 or 1. **Done (2026-10-16):** every value is an order statistic of a per-path cloud (target: the ⌈0.8n⌉-th largest spending; cut: the ⌊0.5n⌋-th smallest needed portfolio; raise: the ⌈0.95n⌉-th), so a rerun lands on its target exactly; 200 paths (`GUARDRAIL_PATHS`), each search to 0.5%. About 14,000 projections on the default household (≈ 65 s on one thread at 4.6 ms each), so the page needs the workers.
- (b) The plan from a later year at a given portfolio: the projection replayed to year t, its balances scaled there, random returns after. Gives the guardrails for the next several years. Test: scaled by 1, it is the projection. **Done (2026-10-16):** `runProjection` takes `needIn` (spending by year) and `rescale` ({ t, scale }); `guardrails(…, { start })` runs the plan to year t at its own returns and spending (the median path), scales the balances there, then each path's returns from its first draw. Success counts the years from t.
- (c) The rule inside each path: measure the cost first (it needs the chance at every year of every path); likely a table of the spending cloud by year and portfolio value, built once from (b). Spending becomes a per-year amount in the projection. Tests: with no volatility nothing triggers; a hand-made path cuts where (a) says. **Done (2026-10-16):**
  - Each path checks its spending at the start of each retired year against a table for that year, built along the plan at the target spending: 50 inner paths (seed 2, apart from the outer paths), each one's sustainable spending from that year at 0.5, 1 and 1.5 times the plan's portfolio then, joined by straight lines. Accuracy: within 0.4% of a direct search between the points (median; 1% at worst). The outer paths start at the target spending.
  - Cost: one table about 5 s on one thread (the default household, 31 retired years: about 2.5 minutes on one thread, under a minute in the workers), after `runProjection` gained `snapshotAt`/`resume` (a run resumed from a later year's state is the whole run, row for row; it was 21 s a table replaying the early years).
  - The years after today: each year's guardrails come from the same table (`tableGuardrails`), not a rerun; today's are the exact ones of step (a).
  - "With no volatility nothing triggers" holds when spending starts at the sustainable spending; below it, the rule raises spending once to it (with no risk, the risk-based rule spends what the plan sustains).
  - The page computes today's guardrails at the target spending (the recommended one), and shows the plan's own spending's chance beside it.
- (d) The page (`#/guardrails`, under Evaluations): the four settings saved with the household, run in background workers with a Run button, as Monte Carlo. **Done (2026-10-16):** "Spending guardrails": the recommended spending (and the plan's need's chance), today's guardrails, the guardrails year by year (chart and table), spending under the rule (its fan and figures). Volatility is Monte Carlo's (one setting). The work runs in three stages; today's guardrails come first. In a browser on the Windows laptop: today's in about 30 s, all in about 75 s (the default household, 31 retired years; headless Chrome runs workers on the slow cores and took 2 to 3 times longer).
  - Changes to step (c) found running it: the tables' points are 0, 0.25, 1 and 4 times the plan's portfolio (the 0.5/1/1.5 points erred badly far from them, which made the last years overspend); a table every second retired year and every one of the last 10, the years between from the two either side; each search starts from a guess (the same answers, faster).
  - **For Michael to confirm (proposed 2026-10-16):** in the plan's last year the rule spends what is left, so a path counts as lasting when it pays its spending every year before the last; the page reports the last year apart (on the default household 78% of paths pay less than planned then, by 11% in the middle one: the tables, built from the middle path's account mix and IRMAA history, overstate what a path that has spent a lot can pay at the end). Spending figures are what was paid.
  - For a household still working, today's cut value can be $0 (the savings to come carry the plan); the page says "no cut today" then.
- (e) The Docs article. **Done (2026-10-16):** `articles/guardrails.md`, listed after Monte Carlo; Monte Carlo's article now links to it.

**Done when:** each guardrail, rerun, lands on its target (the chance at the cut value is 50%, at the raise value 95%, and the new spending's chance there is 80%, within the paths' sampling).

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
