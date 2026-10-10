# Round 2 roadmap archive

Finished phases and settled decisions from the round 2 plan, moved here word for word from the plan doc (https://claude.ai/code/artifact/6486cdd2-db58-4f96-96ff-b3e06515a095) on 2026-10-09. Not loaded by default: search it (grep) before re-deciding something. Round one is in `docs/history.md`. `/closeout` appends each finished phase at the end.

## Phase log

| Date | Phase | Tests |
| --- | --- | --- |
| 2026-10-10 | Phase 3: what your resources allow you to spend | 893 |
| 2026-10-09 | Before phase 3: adjustments (2) and (3) | 855 |
| 2026-10-09 | Before phase 3: adjustments | 837 |
| 2026-10-09 | Phase 2: survivor years and engine additions | 821 |
| 2026-10-09 | Before phase 2: inputs and page fixes | 774 |
| 2026-10-08 | Switchover | 759 |
| 2026-10-08 | Phase 1: calculator updates | 781 |
| 2026-10-08 | Phase 0: inputs, calculators and blocks | 724 |

## The plan's original intro and summary

Round 2 rebuilds the inputs around one household page and calculators made of blocks, updates the current calculators, makes the projection true to life (survivor years, a legacy goal), then adds four calculators, a combined Roth and conversion analysis, Monte Carlo and household plans to compare. It follows [round one](https://claude.ai/code/artifact/ed0d4357-5d25-4fb8-bc21-5a5514be1fc2), now finished.

Twelve phases, with the switchover to the new version (replacing the public calculator) at the end of phase 1. The new inputs come first because every later phase adds inputs to them; the engine changes come before the calculators that read the projection; household plans and the mortgage calculator come last.

| Phase | What ships | Done when |
| --- | --- | --- |
| 0. Inputs, calculators, blocks | A dedicated inputs page (blocks for people, income, assets and liabilities; spouses side by side; income sources and contributions as add-a-row lists; age or birthdate; sex for the life tables; Social Security as the full-retirement-age benefit). Each calculator gets one inputs card holding only what it uses, a link to the inputs page, a collapsible inputs column, and the block layout. | Every calculator gives the same numbers whether filled from the inputs page or its own card; saved households and old links still open. |
| 1. Calculator updates | Tax calculator rebuilt around a fuller calculation and a larger chart showing both rates; pension calculator on actuarial life expectancy; Roth vs. Pre-tax merged with the best of the public version. | Each updated page is checked against hand-worked cases and the merge list is worked through. |
| 2. Survivor years and engine additions | The survivor files single, keeps the larger benefit, inherits the accounts, spends 80% of the couple's amount. Plus tax drag on taxable accounts, employer contributions, and separate returns before and after retirement. | A hand-worked couple matches to the cent. |
| 3. What your resources allow you to spend | Sustainable spending with a legacy goal; spending flat for now; a written design for staged spending. | A hand-worked case spends down to exactly the legacy goal. |
| 4. Pre-retirement funding | The spending need against the assets' first-year 4% income and against sustainable spending; savings needed; retirement age. | Each solved savings amount, rerun, lands on its target. |
| 5. Social Security | Benefits by claiming age from each full-retirement-age benefit, lifetime totals, break-even ages, the spouse-by-spouse grid, a discount rate, the chance of being alive by age. | Hand-worked reductions, credits and survivor benefits match. |
| 6. Year-by-year planner | A new page: click a year to add a Roth conversion or change a contribution, and see what that change is worth. | A change alters only that year and later; its value matches a full rerun. |
| 7. Roth vs. Pre-tax with later conversions | New blocks on the Roth vs. Pre-tax calculator: the tax bracket each year, and the answer again with conversions in the years taxed lower. | Each block's figures reconcile with separate full runs. |
| 8. Monte Carlo | Random return paths from the S&P 500's return and volatility after inflation (adjustable), chance of success, distribution charts for income and portfolio value. | No volatility reproduces the projection; a fixed seed repeats. |
| 9. Spending with guardrails | The spending that succeeds in 50% of paths, and when to raise or cut it. | Each guardrail, rerun, lands on its target. |
| 10. Household plans | One household's facts with several saved plans, switching between them and comparing them in every calculator. | Two plans of one household open side by side with every difference marked. |
| 11. Liabilities and debt pay-off | A debt pay-off calculator for every debt (the mortgage included): pay off early or invest, the order to pay debts off, and payoff dates flowing into the retirement income number and the projection. | A hand-worked amortization matches, and the payoff year changes the spending need from that year on. |

## Decisions (Michael, 2026-10-07)

The first round of open questions, answered.

| Question | Decision |
| --- | --- |
| Where the adjustments go | Placed where they fit: the inputs rebuild first (phase 0), the calculator updates next (phase 1), the rest inside their phases. |
| Household plans earlier? | No, last. |
| Docs | Public. Start now. ARTICLE.md stays as the Roth calculator's article; the other articles are new. |
| Feedback | Anyone can send it, no sign-in; make it as easy as possible. |
| Survivor years | One plan-to age per person to start. Spending after the first death defaults to 80%. |
| Spending | Starts from the retirement income number. The real question is how much the household's resources allow it to spend, with a legacy goal that can be adjusted. Spending stays flat to start; staged spending is designed now, built later. |
| Funding calculator | Named Pre-retirement funding. Shows both measures: the first-year 4% withdrawal against the retirement income number, and sustainable spending through the plan. "About even" = within 5%, to tune. Savings needed is one household figure. |
| Social Security | Inputs become each person's benefit at full retirement age (PIA); benefits at other ages are calculated from it. Lifetime totals to the plan-to ages, plus a chart of the chance of being alive each year. Gross benefits; discount rate 0 by default. |
| Monte Carlo | One return and volatility to start, adjustable (perhaps with a slider); later, different settings at different ages. |
| Guardrails | Starting spending = what succeeds in 50% of paths. The idea comes from Income Lab (risk-based); Guyton-Klinger is the familiar method. See phase 9. |
| Planner | A new page. |
| Inherited accounts | Left out of round 2; both sides wanted later. |
| Household plans | One household's facts, two or more saved sets of plan inputs, switch between them and compare them across the calculators. |

## Carried over from round one

| Round one item | Where it lands |
| --- | --- |
| Survivor years | Phase 2 |
| Flat spending in today's dollars | Phase 3 (stays flat; staged spending designed) |
| Constant returns, no sequence risk | Phase 8 |
| Named saved scenarios | Phase 10 |
| ARTICLE.md section for the tax calculator | The docs section, starting now |
| Feedback link on every page | Throughout, early |
| Strategies that steer around the IRMAA cliffs | Phase 6 (each year shows its IRMAA room) |
| 10-year rule for heirs; inherited accounts | Later release |
| Simplified free versions | Later release |
| Designed PDF report; bottom-up budget | Later release |
| RMD still-working exception, joint-life table | Not planned; noted in the docs |
| State tax | Out of scope |
| Making the GitHub repo private | Before any real client data |

## Throughout every phase

**Docs section (public, starting now).** One article per feature, each explaining how the calculation works and how to use it; the calculators link to the article and heading behind each number. Started 2026-10-08: #/docs, with the household inputs article (articles/inputs.md); a test checks every Docs link points to a real article and heading.

- Articles are markdown files in one folder, rendered the way ARTICLE.md is today, with an index page and addresses like `#/docs/<article>/<heading>`.
- ARTICLE.md stays as it is and becomes the Roth vs. Pre-tax article; the public calculator's existing links keep working.
- First new articles: the inputs, the tax calculator, the projection and withdrawal strategies, RMDs, IRMAA, the Roth conversion and pension calculators.
- From then on, each phase is done only when its article is written.

**Feedback link (early, ideally with phase 0).** A "Send feedback" link on every page: a short form with the message, an optional name or email, and the page it came from, filled in automatically. No sign-in. Decided: Netlify Forms. It needs no code on our side, emails each submission to you, keeps a list in the Netlify dashboard, and form submissions cost no Netlify credits. Built 2026-10-08: a "Send feedback" link at the foot of every page (message, optional name or email, the page sent automatically, a spam honeypot). Netlify's form detection must be switched on once in its dashboard.

**Ground rules, unchanged:**

- Math first, pure and in `src/lib`, with tests worked out by hand before the UI.
- Until the switchover, the public calculator stays untouched: shared functions change only by adding optional inputs whose defaults keep today's numbers. After it, that rule ends with the old calculator (done 2026-10-08: results change only by a decided change).
- New pages live under `#/next`; everything is in today's dollars.
- Each step writes its status and decisions into this plan, the one record of what and why. CLAUDE.md keeps only how to work and a one-line pointer to the current step; git history holds what changed in the code. Each phase ends with its docs article.

**Netlify credits.** Each production deploy (a push to `main`) costs 15 credits, and the free plan has 300 a month, about 20 deploys. Branch deploys, deploy previews, skipped builds and form submissions cost nothing ([Netlify: how credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)). So:

1. Commits stay local and go out in batches, when a step is ready for you or the advisors to try live, not after every change. Testing happens locally first.
2. A push that changes only notes, plans, tests or database scripts skips the build automatically (an ignore rule in `netlify.toml`, free).
3. Optional: build on a `dev` branch pushed freely to a free branch deploy for testing, and merge to `main` only to release. It needs branch deploys switched on in Netlify and the branch's address added to Supabase's redirect URLs.

**Annual tax-law update (built 2026-10-07).** Every table that changes each year is listed in one place in the code; a test fails from January 1 until each has the new year's figures, and a checklist in the repo (`docs/annual-update.md`) walks through the update.

## Phase 0: Inputs, calculators and blocks

The app becomes three parts: **inputs** (one set of household facts), **calculators** (each one = the inputs it reads + its blocks), and **blocks** (collapsible cards, each self-contained, reusable later, e.g. in the plan comparison). Two ways to work: fill everything on the inputs page and then pick calculators, or open one calculator and fill only what it asks.

**The inputs page** (`#/next/inputs`, every possible input), itself laid out in blocks:

- **People:** you and your spouse side by side. Age and birthdate as one linked pair (type either; the other follows). Biological sex (male or female), with a note that it is used only for life expectancy. Retirement age each (moved independently everywhere), plan-to age each (phase 2), Social Security benefit at full retirement age (PIA) and claiming age.
- **Income:** a list of rows, like Existing Accounts. Each row: whose it is, the type (W-2, 1099, or Other with a tax treatment: ordinary income or tax-exempt), the amount, and the ages it runs. An "Add other income types" menu offers the rest when a calculator needs them: interest and non-qualified dividends, qualified dividends and long-term gains, Social Security already being received. This replaces the separate spouse income fields and the tax calculator's own income section.
- **Contributions:** a list of rows. Each row: whose it is, Roth, Pre-tax or taxable, and the account type (401(k), IRA, …), and the amount. Amounts over the IRS limit still go to a taxable account.
- **Assets:** Existing Accounts, as today.
- **Liabilities (new):** debts as rows (mortgage, car, student loan, credit card, other), each with its balance, rate and monthly payment. Kept but not used yet: payments that end by retirement stay a Spending field (fourth decision set); phase 11 adds the calculator and feeds each payoff into the plan.
- **Spending and assumptions:** costs that end, lifestyle, the legacy goal (phase 3), return, inflation.

**Each calculator:**

- One inputs card holding only the inputs that calculator reads (each calculator declares its list), editing the same household, with a link to the full inputs page.
- A collapse bar on the inputs column: one button tucks the inputs away to the left and widens the results; the same button brings them back.
- Its results as blocks, in the Roth page's format.

**Moving the data:** a version 2 household; version 1 saved households and share links convert when opened (tested for every input). The public calculator keeps its own inputs and is untouched.

**Size:** the largest phase, shipped in three steps: (a) the version 2 household and the conversion; (b) the inputs page and the per-calculator cards; (c) blocks everywhere and the collapse bar.

**Status:** steps (a), (b) and (c) done 2026-10-08 (live on the site 2026-10-08). (a): the version 2 household and the conversion; version 1 households, saves and links open with the same results (one decided change, Social Security, in the fourth decision set). (b): the inputs page (`#/next/inputs`, every section its own card, people side by side, row lists for income, contributions, accounts and debts); each calculator page has one inputs card with only what it reads and an "All inputs" link; the homepage shows the household in brief; saves and share links are version 2. (c): every calculator's results are blocks with a headline on each (the Roth page's format), and a collapse bar between inputs and results. Phase 0 is done: the Docs section (#/docs) is up with its first article, the household inputs, and "Send feedback" is on every page. Next: phase 1.

**Done when:** each calculator gives the same numbers from the inputs page or its own card, version 1 households open unchanged, and every page has a smoke test.

## Phase 1: Updates to the current calculators

**Steps (set 2026-10-08):** (a) tax engine additions: basic QBI, Roth IRA income limits, the Traditional IRA deduction phase-out, the SECURE 2.0 Roth catch-up rule; (b) the tax calculator rebuilt as rows, with the new rate chart (the two buckets, decided 2026-10-08; see the decision tables), and itemized deductions as one input line (asked 2026-10-08: a Deductions section on the inputs page; the engine takes the larger of the standard deduction and the itemized total, and an itemizer keeps the senior deduction but not the extra standard deduction at 65; applied this year and every year of the projection; phase 11 can later end mortgage interest at payoff); (c) the pension on life tables; (d) the Roth page merge, the retirement year moved to the last spouse's, and the first "Use in the plan" button as a trial; (e) the Docs articles for each; then the switchover.

**Status:** started 2026-10-08. Merge decisions so far are in the fourth decision set (Compare a change, the headline, Start a new household). Step (a) done 2026-10-08 (local): the QBI deduction (basic rule; above the threshold it assumes a business with no employees or property, where it phases to $0; the $400 minimum from 2026), now in the preview's tax, conversion, projection and Roth comparison (version 2 households only; the public calculator unchanged); the Roth IRA income limits, the Traditional IRA deduction phase-out and the Roth catch-up rule as tested functions, put to use on the Roth page in step (d). 2026 figures from Rev. Proc. 2025-32 and IRS IR-2025-111. Step (b) done 2026-10-08 (local): itemized deductions as one total on the inputs page (used by every calculator when larger than the standard deduction); the tax page's calculation rebuilt as rows that appear only when they apply (payroll tax beside each earned income, provisional income and taxable Social Security, AGI, MAGI, net investment income, every deduction, Form 1040 lines, brackets folded into a dropdown); the two buckets in place of the bracket bar, with exact bracket edges on the income scale, the room left, the next dollar, IRMAA cliffs and the capital-gains switch. Below today the buckets build the household's own income up from $0 (a Pre-tax 401(k) stays fixed); above it, more of the chosen income through the two brackets above today's. Checked 2026-10-08 against two TaxClarity breakdowns from Michael: every TaxClarity line has a row (AGI, MAGI, net investment income, the deductions, provisional income, taxable Social Security, the senior deduction, taxable ordinary income after deductions, 0% long-term gains, ordinary income tax, total tax), plus rows TaxClarity doesn't show; the order follows the calculation (provisional income before AGI). The tax page now leads with three rates in a fixed card (the marginal rate, the effective marginal rate and the average tax rate), the buckets under it, the calculation collapsible at the bottom. The child tax credit is built (2026-10-08, local): a Children and dependents section on the inputs page; children count until they turn 17 (so they age out in the projection), other dependents this year only; in the tax and conversion calculators, the projection and the Roth comparison; the next-dollar rate is measured over $1,000 when the credit applies, since it phases out in $50 steps per $1,000. The Roth comparison keeps its own, correct pairing (Michael, 2026-10-08): the marginal rate today (the bracket) against the effective rate on the withdrawal from the contributions in retirement; its definitions don't change. QBI and the credit lower today's tax, and the tax saved across the whole contribution counts them through the real tax. Head of household filing status: moved to the advanced round (Michael, 2026-10-08: the common cases first). Step (c) done 2026-10-08 (local): SSA's period life table, pasted by Michael (SSA's site refuses this machine) and checked against SSA's own lives and life-expectancy columns; the pension page leads with the expected return on life expectancy by each person's sex (the average of the two tables when not entered), shows life expectancy, keeps the 'how long you live' table (a survivor share runs to the spouse's life expectancy), and no longer asks for end ages. Default offer: 3.1% a year on life expectancy (5.4% under the old fixed age 90). The table: SSA's Period Life Table, 2023, as used in the 2026 Trustees Report. Also added: the Docs article 'Tax rates: marginal, average and effective marginal', linked from the tax page. Step (d) done 2026-10-08 (local): Start a new household (with Undo) on the inputs page; "Who can contribute" on the Roth page (the Roth IRA income limit, the Traditional IRA deduction phase-out read from the household's 401(k) rows, and the Roth catch-up rule, which the page states but the numbers don't apply yet: the catch-up as Roth inside the Pre-tax side joins the open item on more than one contribution type); Compare a change ported to the version 2 household (the sections a change touches marked); the first "Use in the plan" button as a trial (switches the plan's Future Contributions to Roth or Pre-tax at the same take-home cost, e.g. $10,000 Pre-tax to $7,800 Roth, and back); the comparison's snapshot at the last spouse's retirement, each person saving until their own (version 2 households; hand-worked couple: $919,982 against $614,932 under the first-retirement rule). The merge list: the blend explorer, the lifetime comparison and the retirement tax rules stay as the preview has them; the results component is shared already; Compare a change and Start a new household came over; the first-year rates lead. Step (e) done 2026-10-08 (local): Docs articles for the tax calculator and the pension calculator (each linked from its page), with the rates article. Phase 1's steps are done; the switchover followed (Michael's go-ahead, 2026-10-08; local, unpushed at writing): the calculators are the site at #/ (home, inputs and each calculator; no preview banner); old links still work (#/next/... opens the same page, #/how-it-works opens the Roth article, an old ?grossIncome= link opens as a one-person household); the old calculator's code and its tests are deleted; ARTICLE.md became the Roth article in Docs, rewritten to match the Roth page (tax saved across the whole contribution, couples per person, the last spouse's retirement, Who can contribute, Compare a change, Use in the plan, the lifetime comparison); the page title is now 'Retirement Tax Calculators'. Gating and free simple versions come later (Michael, 2026-10-08: the product's UI and functionality first). Next: phase 2.

**Tax calculator.** The calculation is rebuilt as rows that appear only when they apply, checked line by line against TaxClarity's breakdown so nothing is missing:

1. Income: each income source, with its payroll tax (FICA or self-employment tax) shown in the income block.
2. AGI (Form 1040, line 11).
3. MAGI (for IRMAA).
4. Net investment income, when there is any.
5. Provisional income and taxable Social Security (line 6b), when there is Social Security.
6. Deductions: standard, the additional 65+ amount, the temporary senior deduction.
7. Taxable ordinary income after deductions.
8. Long-term gains and qualified dividends at 0%, 15% and 20%, when there are any.
9. Ordinary income tax, with the bracket-by-bracket breakdown as a dropdown inside it.
10. Capital gains tax, NIIT, then total tax.

On top: one larger chart carrying both rates. The bracket bar stays, with the marginal bracket highlighted, plus a second marker for the effective rate (for example a rate scale beside the bar with pointers at both rates). The layout is mocked up and agreed before it is built. The confusing case today (the calculator's own inputs all $0 yet taxable income shows) goes away with phase 0's single inputs card.

**Pension calculator.** Payments run to actuarial life expectancy from the SSA period life table (by sex), not the household's plan-to age: the value of the monthly option weights each year's payment by the chance of being alive to receive it. The table of results by age ("if you live to 80, 85, 90…") stays, since it shows how age changes the answer.

**Roth vs. Pre-tax.** Merge in what the public calculator does better. First a compare-and-contrast list of the two, decided item by item; known differences to start it:

- Splitting your contribution (the blend explorer): removed from the public page, still on the preview.
- The lifetime comparison: preview only.
- Retirement tax rules: the preview counts inflation on fixed thresholds, the 65+ deductions, IRMAA and tax saved across the whole contribution; the public page does not.
- Results copy: the public page was trimmed to numbers plus links to the article (2026-10-02); the preview shares that component.
- Inputs: the public page's Compare a change and Copy inputs; the preview's household form, share links and saved households.

**Who can contribute to what.** The Roth vs. Pre-tax answer should only compare choices the client actually has. Rules to add (figures checked against the IRS when built):

- Roth IRA income limits: above them a direct Roth IRA contribution is reduced, then not allowed.
- Traditional IRA deduction phase-out for someone (or whose spouse is) covered by a workplace plan.
- SECURE 2.0, from 2026: catch-up contributions by higher earners (prior-year wages above a threshold) must be Roth, so the Pre-tax side can't include them.

The calculator then says when a choice isn't available (e.g. "above the income limit, a Roth IRA contribution isn't allowed; a backdoor Roth is outside this calculator").

**QBI deduction (basic).** Owners of a business that passes its income through (most 1099 earners, sole proprietors, many partnerships and S corporations) can deduct up to 20% of their qualified business income, limited to 20% of taxable income before it (less capital gains). It lowers taxable income and often the marginal rate, which tilts toward Roth. The basic rule covers most people below an income threshold; above it, limits based on wages paid, property and the type of business apply, and those go to the advanced round. Built with the tax calculator update, so every calculator picks it up through the engine.

**Retirement year for the snapshot.** The Roth comparison's retirement-year snapshot moves from the first spouse's retirement to the last's (fourth decision set).

**Tests:** hand-worked tax cases for each conditional row (Social Security, gains, NIIT, the senior deduction); the pension's survival-weighted value on a short hand-made table.

## Switchover: the new version replaces the public calculator (end of phase 1; done 2026-10-08)

Decided 2026-10-07: the public calculator at `#/` is removed and the new version becomes the whole site. It happens at the end of phase 1, the first point where the new version does everything the public one does: phase 0 gives it the inputs page and blocks, and phase 1 merges the public Roth vs. Pre-tax page's strengths into the new one.

**Steps:**

1. The new homepage moves from `#/next` to `#/`; the calculator pages move from `#/next/...` to their own addresses, and old `#/next` links redirect.
2. The "Preview, not finished" banner goes. Every calculator stays open to anyone; signing in is only for saving households.
3. Old public share links (`?grossIncome=…`) keep opening, as a one-person household in the new version (this conversion already exists and is tested).
4. ARTICLE.md becomes the Roth vs. Pre-tax article in the Docs section; the "How this works" address redirects to it.
5. The Visualization page stays, linked from Docs, running on the new calculation.
6. The old calculator's code is deleted by a written checklist: its page and components, the code paths only it used, and the tests that only pinned its numbers. Every hand-worked test of shared math stays.
7. The rule that shared math may only change by adding options (to keep the public numbers fixed) ends with it.

**Done when:** the new version is live at the main address, old links of both kinds open, the Docs section carries the Roth article, and nothing imports the old calculator's code.

## Before phase 2: inputs and page fixes (set 2026-10-08)

Michael's review after the switchover. These belong to phases 0 and 1, so they come before phase 2. Status: done 2026-10-09. The inputs page step also brought: Social Security already received becomes that person's PIA, claimed at their age now; the projection's end age becomes person 1's plan-to age; the default household has no pension (the pension page offers "Add a pension"); households in the first version 2 layout convert on opening. 774 tests.

**Inputs page**

- Four groups, each holding its expandable blocks across the page: **Household** (filing status, the people side by side, each person's plan-to-age, dependents), **Income and expenses** (income, contributions, spending, deductions), **Assets and liabilities** (accounts, liabilities), **Assumptions** (the return, inflation and the rest, plus the projection's withdrawal strategy and heirs' tax rate).
- Household and people merge into one block; the second person's inputs open only when a second person is chosen.
- Plan-to-age moves from the projection into each person.
- Income: one "Add income" button and a type on each row; the less common kinds sit inside an "Other" type. Social Security becomes an income type (one row per person: claiming age, estimate from earnings or an entered benefit). A pension becomes an income type (monthly amount, start age, cost-of-living increase, survivor share), counted by every calculator: the projection, the tax and conversion calculators, and the Roth comparison, where it is one more floor under the withdrawal and can raise the effective rate (decided by Michael, 2026-10-08; numbers change for households with a pension). The pension calculator reads that row and adds only the lump-sum offer on its own card.
- "Future Contributions" is called "Contributions" on the inputs page only; the Roth page and article keep the Future Contributions / Existing Accounts pair.
- The Roth conversion amount leaves the inputs page; it stays on the conversion calculator's own card.

**Saved households**

- Every calculator page shows a small widget with only the household on screen (and its plans once phase 10 adds them): save, save as new, and re-open the saved version. Re-opening is the way back to the saved household; no separate revert button (Michael, 2026-10-08).
- The home page lists all clients in a dropdown; a search comes later.

**Pages**

- Roth page: the disclaimer moves to the bottom; the lifetime section splits into two dropdowns, the full table behind a "Show full table" dropdown that holds the Roth and Pre-tax buttons; "Tax each year in retirement" becomes a bar chart.
- Tax page: "Rates as income rises" is renamed "Tax bracket visual"; the next-dollar line no longer overlaps the IRMAA lines, nor the room-left number the rates; the "Ordinary income tax" subtotal shows only when capital-gains tax, the Net Investment Income Tax or a credit sits between it and federal income tax.
- Pension page: the "how long you live" table's column reads "If payments stop at age" (it is a what-if; the result uses life expectancy).
- Share: "View only" reads "Link opens view-only".

**Added to later phases:** a Social Security estimator from the earnings record with quick entry (a range of years and an average income) in phase 5; clicking a year in the year-by-year planner to add a Roth conversion in phase 6; real estate as an asset, a mortgage pay-off calculator that compares home equity, and a rental-property comparison under Later release.

## Phase 2: Survivor years and engine additions

Today a couple stays married filing jointly, with both Social Security benefits, to the end age. In real life the survivor files single on much the same income, which pushes them into higher brackets and IRMAA tiers (the "widow's penalty"). That changes the Roth vs. Pre-tax answer for every couple, usually toward Roth.

**Input:** a plan-to age per person (default 95), on the inputs page beside each birthdate. The plan runs until the second death.

**From the year after the first death:**

1. Filing status becomes single (the year of death stays joint). Qualifying surviving spouse status, which needs a dependent child, is not modeled.
2. Social Security: the survivor keeps the larger of their own benefit and the deceased's (phase 5's survivor rules refine this).
3. Accounts: the deceased's Pre-tax and Roth accounts become the survivor's own (spousal rollover), so RMDs follow the survivor's age; the deceased's taxable accounts get a step-up in basis.
4. The deceased's income sources and contributions stop (a pension's survivor share continues, when one is entered).
5. Spending drops to 80% of the couple's (an input).
6. Single thresholds everywhere: brackets, deductions, Social Security taxability, NIIT, IRMAA.

**Tests:** a hand-worked couple across the first death; with both plan-to ages at the end age, today's results come back unchanged.

**Shows:** a marker at the first death on the projection's charts, survivor years shaded in the year table; the lifetime Roth vs. Pre-tax comparison picks it up with no change of its own.

**Engine additions, in the same phase** (they change the projection every calculator reads):

- **Tax drag on taxable accounts.** Dividends and interest are taxed every year, not only at withdrawal. Inputs: a yearly yield split into qualified dividends and interest (default decided 2026-10-09 by Michael: a stocks-only portfolio, a broad stock index fund's yield, mostly qualified dividends and almost no interest). Later, kept simple: a portfolio scale from aggressive to conservative, where more conservative mixes yield more interest. Each year the engine taxes that yield through the main tax engine, so it counts in brackets, Social Security taxability, NIIT and IRMAA. The tax is paid from the year's cash, so at the same budget less is left to invest, the same way a Roth contribution costs more take-home pay than a Pre-tax one. Applies everywhere a taxable account appears: the Roth comparison's side account, Existing Accounts, the projection's reinvested surplus.
- **Employer contributions.** Per contribution row, the employer's contribution entered one of two ways (decided 2026-10-09 by Michael): a match percentage (a share of pay matched up to a share of pay, e.g. 100% of the first 4%) or a flat dollar amount a year. Pre-tax by default, Roth when the plan allows it. It counts toward the overall plan limit, not the employee's own limit. It builds Pre-tax balances and future RMDs even for a Roth saver, which is exactly why it matters to the Roth decision.
- **Returns before and after retirement.** Two return inputs in Assumptions; the projection uses each in its years, and Monte Carlo (phase 8) can later vary them by age.
- **The rest of the household in the projection.** Every income row over its ages (part-time work, rent, an annuity), the pension's monthly benefit when that option is chosen, and the surplus setting in Assumptions (save it or spend it).

**Steps (set 2026-10-09):** (a) survivor years in the engine, with the survivor spending input; (b) survivor years on screen: the first-death marker, shaded survivor rows, the survivor spending input, the article; (c) tax drag on taxable accounts; (d) employer contributions; (e) returns before and after retirement; (f) the rest of the household in the projection (income rows over their ages, the surplus setting).

**Status:** started 2026-10-09. Step (a) done 2026-10-09 (780 tests). Rules as built: each person lives through the year they reach their plan-to age; only the first death is modeled (the survivor lives to the end age); a household without plan-to ages (version 1) never has one. The survivor's Social Security is the larger of their own (with any spousal top-up) and the deceased's own, the deceased's from the survivor's age 60. The deceased's accounts become the survivor's at the end of the year of death. A survivor still working draws nothing from the portfolio (the paycheck covers spending), as a working couple does. Step (b) done 2026-10-09 (782 tests): survivor years shaded on the charts and in the year table (who died and when, filing status and pension columns), pensions in the income chart, "Spending after the first death" in Assumptions for a couple, the inputs article. Also fixed: the end of the plan was named by person 1's age ("to age 105" after they died); it is now named by the year and the ages of those living, "2071 (your spouse 95)", and by age for one person. Steps (a) and (b) committed but not pushed (Michael, 2026-10-09: push in a batch with the next steps). Step (c) done 2026-10-09 (795 tests, local, unpushed): tax drag on taxable accounts. "Dividends on taxable accounts" in Assumptions, 1.3% qualified dividends by default (None to 3%); qualified dividends only for now, with interest arriving with the later portfolio scale. Rules as built: the dividends are part of the return, not added to it. The projection taxes them each year through the engine (capital-gains rates, NIIT, SS taxability, MAGI, IRMAA) and reinvests them as basis. While everyone works, the account pays the tax (less is reinvested, the paycheck untouched); once anyone has retired, the year's withdrawals cover it. The Roth comparison grows the side account, Existing Accounts' taxable balance and the lump-sum side with the drag, taxed at today's rate on the next dollar of qualified dividends; in retirement the dividends inside the 4% withdrawal are taxed whole. Version 1 households (and the v1 pins) are unchanged; version 1 saves opened in version 2 get the 1.3% like any version 2 household. Effect: a household with a $500,000 taxable account and $30,000 of Roth savings a year: Roth's lead widens from $6,919 to $7,610 a year after tax; the default household (a Pre-tax account only) is unchanged in the Roth comparison. Open for step (f): an "Other" income row of qualified dividends would count the same dividends twice once income rows enter the projection. Michael asked (2026-10-09) whether taxable accounts could add a qualified-dividends income row automatically, adjustable. Decided 2026-10-09 (Michael, the proposal): each taxable account is the only source of its own dividends. The tax calculator shows a read-only line "Dividends from taxable accounts" (yield x balance), each taxable account row gets an optional dividend yield (blank = the assumption), and an "Other: qualified dividends" row means dividends from outside the listed accounts (e.g. a K-1). Reason: an editable row copied from a balance goes stale when the balance changes, and the projection must grow it each year anyway. Effect: the tax calculator's numbers rise for households with a taxable account. Step (d) done 2026-10-09 (806 tests, local, unpushed): employer contributions. A 401(k) contribution row offers "Employer contribution": none (the default; older saves open with none), a match (25% to 100% of the deferral, on deferrals up to 3% to 10% of W-2 pay) or a flat amount a year. Rules as built: the match is figured on the row's amount as entered, capped at the IRS deferral limit; deferrals (catch-up not counted) plus employer money are held to the overall 415(c) limit ($72,000 in 2026); employer money is always Pre-tax (Roth employer contributions not modeled). The projection pays it into the person's Pre-tax account each working year (not income, not out of the paycheck). The Roth comparison counts it the same in both scenarios, as Pre-tax money grown under the Future Contributions' withdrawal. Simplification: a Pre-tax deferral at the same take-home cost is larger and could earn more match while under the match's cap; not modeled. Effect on the default household (single, $100,000, $10,000 Pre-tax): a 100%-of-4% match raises the effective rate on the withdrawal from 19.8% to 22.0%, today's marginal rate, so the comparison goes from Pre-tax by $834 a year to even. Step (e) done 2026-10-09 (810 tests, local, unpushed): returns before and after retirement. "Return in retirement" in Assumptions: "Same as before retirement" by default (so no results change) or 3% to 9%. Rules as built: the projection uses the return after retirement once no one in the household works (for a couple, from the year the last retires), the return before while anyone works. That matches the Roth comparison's snapshot at the last retirement, so the comparison (which grows savings only until then) keeps using the return before retirement. The pension calculator now compares the pension with the return in retirement, since a lump sum is invested then. Step (f) done 2026-10-09 (821 tests, local, unpushed): the rest of the household in the projection. (1) The dividends decision as built: a taxable account row has an optional "Dividends a year" (blank = the assumption); the tax calculator counts this year's account dividends (the qualified-dividends line names them), so its numbers rise for households with a taxable account; the projection uses each account's own yield; the Roth comparison grows today's taxable balance at the accounts' balance-weighted yield and the side account at the assumption. (2) Income rows over their ages in the projection: a blank first age is from now; a blank last age is until the owner's retirement, or for life for a row that starts at or after retirement (part-time work, an annuity). Earnings carry payroll tax; ordinary income (rent, an annuity), interest and qualified dividends are taxed as their kind; tax-exempt income is cash only (not yet in Social Security taxability or IRMAA, as the law counts it). After the first death the deceased's earnings stop and their other income goes on. (3) "Income above what is needed" in Assumptions, save it (the default) or spend it: once anyone has retired, cash above the need; while everyone works, cash above what today's paycheck alone leaves (an RMD, income beyond the paycheck, after tax). A drop in earnings before retirement is taken as lower spending, not drawn from savings. The year table shows other income, reinvested and spent amounts. The pension's monthly benefit was already in the projection (before phase 2). Phase 2's article: "The year-by-year projection" in Docs, linked from the projection page. Phase 2 is done (2026-10-09). Not yet in the Roth comparison's retirement snapshot: other income rows such as rent (the pension is); open item. Next: phase 3, retirement spending.

## Before phase 3: adjustments (2026-10-09)

Michael's list after phase 2, sorted 2026-10-09: the items below are built before phase 3; the rest went into later phases or Later release.

**Navigation and names**

- The main page is the **Dashboard**; the household card's header says **Inputs**.
- Calculators split into two groups, on the dashboard and later in the sidebar: **Decisions** (Roth vs. Pre-tax, Roth conversion, Pension; later Social Security, debt pay-off) and **Evaluations** (the projection; the tax calculator as a single-year evaluator; IRMAA with it; later spending, Monte Carlo, net worth).

**Inputs page**

- The clients card (switch households, later plans) at the top, collapsible like every block.
- Each section (Household, Income, Assets and liabilities, ...) its own collapsible block, with the row blocks inside; Assumptions stays one block.
- Each income row collapses to one line: type and amount (also on the tax calculator's inputs card).
- First/last age on an income row hidden behind a "Set start/end ages" link (kept: they stop or start an income at an age).
- Fix: "Enter your spouse separately?" offset with white space to its left, on every calculator.
- "Clear inputs" on the clients card: blanks the form; the saved household is untouched until saved.
- Self-employment income: "Qualifies for the QBI deduction?" yes/no (default yes).

**Tax calculator**

- AGI and total tax added beside the three rates at the top.
- The calculation moved above the chart.
- IRMAA on the chart as plain lines with a key below, not labels.
- Wording stays marginal / average / effective marginal; under "average tax rate" a note: (also called the effective tax rate).

**Roth conversion calculator**

- The effective rate of the conversion: its added tax ÷ the amount converted.
- A lifetime view: one conversion this year, run through the projection with and without it; taxes paid each year as bars (both runs), with the totals. The three key figures: total lifetime taxes, the legacy portfolio value, and total retirement income (everything withdrawn and received).
- The "fill the bracket" table removed; the bracket room shown on the chart instead.

**Roth vs. Pre-tax**

- Income and tax rates year by year over the whole lifetime (today to the end), not just retirement. Moved up from phase 7's "tax bracket each year" block.

**Pension calculator**

- The lump sum entered on the pension row, not before it.
- "Take the lump sum in the plan": the pension's payments are dropped and the lump sum is rolled over to a pre-tax IRA.

**Feedback**

- The form closes itself after a submission; a Feedback tab fixed on the right edge of every page.

**Later (not built now)**

- A left sidebar with icons: Dashboard at the top, then Inputs, Decisions, Evaluations, each with its pages under it; Settings at the bottom (settings to be worked out). A UI step after this list.
- Net worth statement, and net worth over time: a new phase after phase 11 (it needs liabilities).
- Conversions in later years on the conversion calculator (today: one conversion this year).
- Non-qualified pensions on the pension calculator (rare; not planned).
- The simplified Roth calculator: see Later release.

**Status:** done 2026-10-09 (13 commits, 837 tests; not yet pushed). Decided while building, open to change:

- **The conversion's tax while everyone still works:** held back from the conversion, so less reaches Roth (there is no withdrawal to pay it from). Once anyone has retired, the year's withdrawals pay it, as for the projection's conversion strategies.
- **Lifetime tax** on the conversion page is federal income tax plus IRMAA; payroll tax is the same both ways, so it is left out. **Total retirement income** counts withdrawals, Social Security, pensions, other income and any earnings in the years anyone is retired; conversions are not income.
- **No lifetime view without a retirement income number:** a household past its retirement age has none yet (it comes from today's pay), so the conversion page explains the gap. The projection page has the same limit today.
- **A pension taken as a lump sum** is rolled over to the owner's Pre-tax IRA at the start of the year they reach the pension's start age (today, if that has passed). The Roth comparison counts a later rollover as Pre-tax money today, discounted at the return.
- **QBI yes/no:** a person's qualifying share of 1099 income counts, with that share of the self-employment tax deduction.
- **Clear inputs** empties the client's facts and keeps the assumptions at their defaults. On the inputs page, the group blocks start closed.

**For phase 3:** a spending input for a household already retired. The projection, the Roth comparison and the conversion page's lifetime view all need it.

## Decisions, second set (Michael, 2026-10-07)

| Question | Decision |
| --- | --- |
| Inputs page layout | Blocks: people, income, assets, liabilities (new), and the rest. |
| Liabilities | New: a Liabilities block and a mortgage calculator (pay off or invest), its payoff flowing into the plan (phase 11). |
| Phase 7 | Added as blocks on the Roth vs. Pre-tax calculator, which keeps its layout. |
| Feedback | Netlify Forms (submissions cost no credits). |
| Netlify credits | Keep deploys down: batch pushes, skip builds for non-site changes. |
| Age and birthdate | One linked pair per person: type either, the other follows. |
| Contributions | Each row: whose, Roth / Pre-tax / taxable, account type. |
| Income | W-2, 1099, and Other with a tax treatment (ordinary or tax-exempt); the tax calculator's extra types behind an "Add other income types" menu. An advanced options page is a later round. |
| Retirement ages | Each spouse's moves independently; retirement starts when the last spouse retires. |
| Legacy goal | Both measures, starting with the balance; after-tax for more robust planning. |
| Sex | Superseded by the third set: "Biological sex", male or female, with a note. |
| Monte Carlo returns | The S&P 500's return and standard deviation after inflation; more options later. |
| Conversions | Start from the brackets over time; convert in the years taxed lower; few options. |
| Docs | Called Docs. |

## Decisions, third set (Michael, 2026-10-07)

| Question | Decision |
| --- | --- |
| Inflation | 2.5% by default, adjustable in Assumptions (as today). |
| Today's or future dollars | Everything stays in today's dollars (after inflation, for a real comparison) by default; a switch to view future (nominal) dollars comes later. |
| S&P 500 figures | NYU Stern's (Damodaran) yearly S&P 500 returns from 1928, less inflation. |
| Sex input | "Biological sex", male or female, with a note that it is used only for life expectancy. |
| Liabilities | All debts, not just a mortgage, with a debt pay-off calculator (phase 11). |
| Netlify | Batch pushes for now; no dev branch. |

## Decisions, fourth set (Michael, 2026-10-07/08)

| Question | Decision |
| --- | --- |
| Social Security input | Each person: "estimate from earnings" (needs no PIA) or enter the PIA (monthly, at full retirement age). The spousal top-up is worked out from both PIAs either way. |
| Version 1 "known benefit" | Converts to the PIA that gives the same benefit at its claiming age. Because a PIA counts for the spousal top-up, a couple with a known benefit can gain a top-up version 1 never gave (example: $42,000 → $59,062.50). |
| Debt payments that end | Stay a spending field for the retirement income number. Liabilities (balance, rate, payment) are separate rows; converted households start with none. |
| Age or birthdate | Either can be entered; typing a birthdate sets the age, typing an age clears the birthdate. A birthdate gives the exact birth year; the calculators use the age reached this calendar year. |
| Income rows' ages | First and last age received, both included. Blank first age = from now; blank last age = until the owner retires. |
| The tax calculator's other income | Converts to income rows for this year only, so the projection is unchanged until a later phase reads them. |
| Snapshot retirement year | Stays "when the first person retires" for now; switching to the last is a phase 1 change. |
| Fields on a calculator's card | Only the sections and fields that calculator reads (the tax calculator shows ages and IRMAA only). Biological sex and plan-to age are on the inputs page only until a calculator reads them (phase 2). |
| A debt's interest rate | Typed as a percent (6.5). |
| Surplus income | A setting in Assumptions: save it (reinvest in a taxable account, the default) or spend it. Phase 2. |
| Decision calculators vs. plan evaluators | Decided once Michael can see it working; the first "Use in the plan" button is built as a trial. |
| Compare a change (phase 1 merge) | Brought to the preview's Roth page on the version 2 household before the switchover; household plans (phase 10) can absorb it later. |
| The Roth page's headline (phase 1 merge) | The first-year rate comparison leads, as on the public page; the lifetime comparison stays a block below. |
| Clear all (phase 1 merge) | Yes: "Start a new household" on the inputs page, back to the defaults, with an Undo; a saved household is left untouched. |
| The tax page's rate chart (phase 1) | Two buckets side by side on one vertical income scale (the income figures larger, set off from the buckets), running up through the next two brackets. Marginal rate bucket: the brackets as steps, the sheltered part grey at the bottom, the room left in today's bracket marked. Effective rate bucket: the real tax on the next dollar at every income level from the tax engine (the Social Security torpedo, gains pushed out of 0%, deduction phase-outs, NIIT), labelled at the big change points; IRMAA cliffs as lines with the yearly premium jump. Today's income is a line across both, with the rate on the next dollar. The next dollar is ordinary income by default, with a switch for other income types, capital gains first (a house sale, a taxable account sell-off). Payroll tax left out of the chart for now (it is in the calculation rows). The average rate is not in the chart; the page shows it elsewhere. Drawn options: https://claude.ai/artifact/S7qSZyoyAKDTUT7RhqVoEE |
| What the rates are called | Standard terms (Michael, 2026-10-08): marginal rate = the tax bracket; average tax rate = total tax ÷ total income (what most sources call the "effective tax rate", so "effective rate" is never used alone for it); effective marginal rate (EMTR) = the real tax on the next dollar, with everything it sets off. Used across the preview and in the Docs article on rates. The Roth comparison keeps its pairing and its wording: the marginal rate today against the effective rate on the withdrawal. |
| Child tax credit (asked 2026-10-08) | Added to phase 1: $2,200 per child under 17 in 2026 (up to $1,700 refundable, 15% of earned income over $2,500), phased out by $50 per $1,000 of MAGI over $200,000 ($400,000 joint); $500 for other dependents. Children entered with their ages, so they age out in the projection. Rev. Proc. 2025-32 §3.05. |

## Before phase 3: adjustments (2) and (3) (2026-10-09)

*Done 2026-10-09, 855 tests (tag `phase-before-3b-done`). Michael's two lists after the first adjustments, archived as written.*

### Adjustments (2)

Tax calculator:
- [x] The calculation block moves below the tax bracket visual (reverses the 2026-10-09 "above the chart").
- [x] The "next $100" block becomes a short worked calculation of the effective marginal rate for the headline source (the $100, what it sets off, the extra tax, ÷ 100); the other sources' one-line rates stay below it (decided 2026-10-09).
- [x] The bracket visual's "Total income" header larger, in line with the marginal and average rate headers.
- [x] Social Security "Currently receiving": a third choice beside the PIA and the estimate. The monthly check as received today, in today's dollars, with no claiming adjustment, from this year on (decided 2026-10-09). Its PIA isn't known, so it gives the spouse no spousal top-up. Why: a PIA entered for someone already receiving was adjusted for a claiming age, inflating the benefit.

Inputs:
- [x] The clients card starts collapsed and is renamed "Households".
- [x] Accounts collapse to one line like income rows.
- [x] The cost basis field lines up on the calculators' input cards (one hint under both taxable fields).
- [x] No "Retirement age must be after your current age" error: a retirement age at or below the current age means already retired (no earnings or contributions from this year, the retirement return, the Roth snapshot today); the age stays as entered (decided 2026-10-09). Follow-ons: this year's earnings and contributions follow the same rule (a 75-year-old's W-2 row with no end age no longer counts in the tax calculator); for someone retired, an Other income row with no ages counts for life; with everyone retired and no earnings, the Roth page says there is nothing to compare.
- [x] "a year" in labels becomes "per year" (and "a month" "per month", to match; 38 places in the app, comments and the Visualization prose left).

Roth vs. Pre-tax:
- [x] The start/end ages link closes again after opening ("Hide start/end ages").
- [x] "Federal income tax on that" opens to show its calculation (bracket by bracket, then any child tax credit).

Pension: [x] "In the plan" lines up (the lump-sum hint moved under the row). Roth conversion: [x] the "Tax paid each year" chart moves to its own block at the bottom (more charts may join it).

### Adjustments (3)

- [x] Tax bracket visual (decided 2026-10-09): each bracket edge shows total income with the taxable-income figure beside it; a line under the chart bridges today's total income to taxable income (each deduction); the room label in total-income dollars, with the taxable room beside it. Why: the 22% edge at $177,065 of total income read as wrong next to the $100,800 + $32,200 a joint filer knows. The caption's "calculation above" fixed (it is below now).
- [x] "Plan to age" renamed "Life expectancy" (decided 2026-10-09); retirement age gets a one-line hint.
- [x] Social Security estimated from earnings when a person has no Social Security row, in every calculator (decided 2026-10-09; reverses "no row = no benefit"). A PIA of $0 means no benefit. Changes results for saved households without a row.
- [x] Copy summary: a blank retirement age said "retires at NaN" (now "retirement age not entered"; it also says retired at, and the life expectancy).
- Charitable donations: an itemized deductions calculator, in docs/ideas.md (Later release).

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

**The spending need, top-down or bottom-up (decided 2026-10-09, Michael).** Both methods estimate what the household spends today, after tax. Top-down (today's method): take-home pay minus savings. Bottom-up: a budget, for now one number, "Baseline expenses per year" (later an itemized budget calculator fills it). Retirement spending follows from either the same way: today's spending, minus the costs that end by retirement, times the lifestyle factor; for a household already retired it is the budget as is. A select, "Base retirement spending on: Today's income / My budget", picks the method: today's income by default (so no results change); fixed to the budget, which is then required, when everyone is retired. Explicit rather than "a budget, if entered, wins", so a budget can be entered without changing the plan. One pure function, `spendingNeed(household)`, returns the need, its method and both estimates where they can be worked out; every calculator reads it (the projection, the conversion lifetime view, the Roth comparison's retirement income number, the Retirement spending page) instead of working it out itself. Reason: a household already retired has no top-down figure, and some households only have a budget number. The Retirement spending page compares the spending need with what the assets can generate as income; the gap between the top-down figure and the budget belongs to the budget calculator (Michael, 2026-10-09; in `docs/ideas.md`). "Use in the plan" on the page writes the sustainable figure into the plan's spending (Michael, 2026-10-09). How it is written (decided 2026-10-10, Michael): it sets the budget method; for a household still working the budget is worked back from the retirement figure (sustainable ÷ lifestyle + the costs that end), since the budget is today's spending; for a household already retired it is the sustainable figure as is. The spending that succeeds in 50% of Monte Carlo paths is phase 9 (after phase 8), not this phase; phase 3's figure is the same search at the constant return.

**Steps (set 2026-10-09):**
- (a) The spending need: the baseline-expenses input and the method select; `spendingNeed(household)` read by every calculator; a household already retired gets its projection and conversion lifetime view.
- (b) The legacy goal in the engine: a dollar amount, a share of today's portfolio, or none; the balance measure, then after tax (Pre-tax at the heirs' rate). The hand-worked annuity test.
- (c) The Retirement spending page (an Evaluation): what the resources allow beside the spending need, and the difference; "Use in the plan".
- (d) The trade-off chart: spending against legacy ("each $100,000 more for heirs costs $X per year").
- (e) A charitable legacy: the goal split between heirs and charity, Pre-tax at full value to charity; the effect in a sentence and in the wealth figures.
- (f) The staged-spending design write-up, agreed with Michael before anything is built.
- (g) The Docs article.

**Status:** started 2026-10-09. Step (a) done 2026-10-09 (868 tests, local, unpushed). Spending in the inputs: "Base retirement spending on" Today's income / The budget, and "Baseline expenses per year (after tax)" shown for the budget. With everyone retired, the method choice, the costs that end and the lifestyle are hidden, and the budget is the spending as entered. `src/lib/spendingNeed.js` (`spendingNeed`, `budgetNeed`); the Roth comparison takes `baselineExpenses` in place of take-home minus savings and returns `retirementNeed.method` and `.topDown` (v1 pins: those two keys added, nothing else changed). The projection and the conversion lifetime view read the spending need, not the Roth result, so a household already retired gets both once its budget is entered; until then they ask for it. The Roth page's "How is this calculated?" walks from the budget under that method. Articles updated: inputs (Spending), roth, conversion. Step (b) done 2026-10-10 (873 tests, local, unpushed): the legacy goal in the engine (`projectionSummary.js`). `sustainableSpending` takes `legacy: { target, measure, heirTaxRate }` and requires no shortfall in any year and at least the target left at the end of the plan (the second death); `legacyValue` measures the end as the balance or after tax (Pre-tax at the heirs' rate); `legacyTarget` turns a dollar amount or a share of today's portfolio into dollars; `meetsPlan` says whether a spending level works (a goal out of reach even at $0 of spending gives 0). Hand-worked: Roth only, $1,000,000 at 5% for 3 years, a $500,000 goal: $198,670.73 a year, ending at $500,000; no goal $349,722.44; each $100,000 for heirs costs $30,210.36 a year. Nothing reads the goal yet (the page and its inputs are step c), so no results change. Step (c) done 2026-10-10 (881 tests, local, unpushed): the Retirement spending page (#/spending, an Evaluation; `src/lib/retirementSpending.js`, `src/next/RetirementSpendingResult.jsx`). A "Legacy goal" section in Income and expenses (after Spending): nothing set (the default), an amount, or a share of today's portfolio (10% to 200%), measured as the balance or after tax (the heirs' rate under Withdrawals). The page leads with what the resources allow (per year after tax, to the end of the plan, leaving the goal) beside the spending need and the difference; a second block gives what the goal costs a year (against spending with no goal) and what is left; a goal out of reach even at $0 of spending says so. "Use in the plan" sets the budget method with the budget worked back (as decided), rounded down to the dollar, so the plan's need lands at or just under the figure (tested). Also decided in building (Claude, following "every evaluator reads the same plan"): the projection's sustainable spending and funded status leave the goal too, and say so; with no goal (the default) nothing changes (v1 pins: `legacy: null` added only). Example: the default household with a $1,000,000 goal: $126,442 a year against a $65,380 need; the goal costs $6,959 a year. Articles: inputs (Legacy goal), projection; the page's own article is step (g). Step (d) done 2026-10-10 (885 tests, local, unpushed): the trade-off block, "Spending against legacy" (`legacyTradeoff`): each $100,000 more for heirs costs $X a year at the household's goal; what the plan leaves spending the planned amount, and the most it can leave (spending nothing); a line of spending against the goal (round steps from $0 to just past the larger of what is left spending the need and the goal; the goal is a point of its own), with the figures in a table below. The range was first 90% of the most that can be left, which for a 35-year-old ($13.8 million) hid every plausible goal in one corner. Hand-worked: the Roth case, a straight line at $30,210.34 per $100,000. About 0.3 s for the default household. LineChart gained `formatXTick`. Step (e) done 2026-10-10 (893 tests, local, unpushed): a charitable legacy. Decided 2026-10-10 (Michael, the recommended options): the charity's part is a share of what is left ("To charity" in the Legacy goal section: none, 10%, 25%, 50%, 75%, all), taken from Pre-tax money first (the charity named beneficiary of the Pre-tax accounts), not a slice of every account. One function, `afterTaxEnding` (`projectionSummary.js`): total − heirs' rate × max(0, Pre-tax − share × total); with no share it is the old formula exactly (v1 pins: `charityShare: 0` added only). Used by every after-tax figure for what is left: the projection's lifetime summary and strategy comparison, the Roth page's lifetime comparison, the conversion's legacy after tax, the legacy goal measured after tax. The Retirement spending page says it in a sentence (the charity's dollars, the Pre-tax money passing untaxed, the heirs' tax spared, and that Pre-tax money is favored); the wealth labels name it. Hand-worked: $600,000 / $300,000 / $100,000 at 24%: $856,000; 25% to charity $916,000; 75% $1,000,000; and a spending case ($98,000 Pre-tax, a $38,000 after-tax goal: $16,000 a year, $19,610 with all to charity). Open: the Roth page's lifetime comparison doesn't hold the legacy goal in its sustainable-spending figures (it does count the charity in after-tax wealth). Step (f) written 2026-10-10: `docs/staged-spending-design.md` (spending = the base × its shape at that age + the extra expenses; three editable phases with a research setting from Blanchett 2014; one-off and repeating expenses; health care before Medicare; long-term care; health costs rising faster than prices; the budget feeding the base; how each fits the engine and pages; a build order), with seven decisions for Michael at its end. Decided 2026-10-10 (Michael): two options, flat (the default) or the smile, a smooth curve with one adjustment (how strongly spending falls: half, the research, one and a half); the youngest living person's age drives it (the youngest sets the length of the plan); the survivor share scales the curve, extras kept whole; health care is not modeled separately (the smile's late rise covers it); health care before Medicare and long-term care go to a later rollout (`docs/ideas.md`); extra expenses while anyone works come from that year's paycheck surplus first, then the portfolio. The curve is Blanchett's 2013 equation 1 (Morningstar, "Estimating the True Cost of Retirement", p. 15), read from the paper itself: change = 0.00008 × age² − 0.0125 × age − 0.0066 × ln(target) + 0.546; at $100,000 it reaches 74.6% by 85, close to his 2014 article's $74,146 at 84. The curve starts at retirement, at whatever age, and applies only in retirement; working years keep the other methods (Michael, 2026-10-10). The formula uses the actual age, so a retirement before about 63 rises a little at first (+2.5% a year at 55). The design is updated to match; nothing built (staged spending stays in Later release until scheduled). Step (g) done 2026-10-10: the Docs article "Retirement spending" (`articles/spending.md`), linked from the page.

**Closed:** 2026-10-10, 893 tests (tag `phase-3-done`).
