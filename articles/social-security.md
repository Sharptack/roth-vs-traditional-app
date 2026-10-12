# The Social Security calculator

When should each person claim? The calculator lays out every claiming age from 62 to 70: the monthly benefit, the benefits over a lifetime, and for a couple every pair of ages in a grid, with spousal and survivor benefits counted. Choose cells to compare strategies year by year and on a break-even graph. It also reruns the whole plan at each age, so the answer accounts for taxes, withdrawals and the portfolio.

Everything is in today's dollars: benefits rise with prices each year, so a benefit in today's dollars stays the same. The benefit totals are before tax; tax on the benefits is in the other calculators and in the plan's figures below.

## The benefit at each claiming age

Each person's benefit starts from their **benefit at full retirement age** (the PIA), entered on the inputs page or, with no Social Security row, estimated from earnings (a rough estimate; ssa.gov has the real figure). Full retirement age is 66 to 67, by birth year (67 for anyone born in 1960 or later).

- **Claiming early** reduces the benefit for good: 5/9 of 1% a month for the first 36 months before full retirement age, 5/12 of 1% a month beyond. At 62 with a full retirement age of 67 that is 30% off: a $2,000 benefit becomes $1,400.
- **Waiting past full retirement age** adds delayed credits of 2/3 of 1% a month (8% a year) up to 70: the same $2,000 becomes $2,480 at 70.

Claiming ages are whole years, as the inputs page stores them. Ages already past are not offered: someone 66 now chooses from 66 to 70. Someone **already receiving** benefits keeps the check as it is, so only the other spouse's age varies.

## Spousal benefits

A spouse whose own benefit is less than half the other's gets a **spousal top-up**: half the other's benefit at full retirement age, less their own. It starts when both have filed: the later of their own claim and the other's. It is reduced if it starts before their full retirement age (25/36 of 1% a month for the first 36 months, 5/12 of 1% beyond) and earns no delayed credits. For example, half of $2,000 less an own benefit of $600 is a $400 top-up; started two years early, it is $333 a month. Someone already receiving has no known PIA, so they give the spouse no top-up.

## Survivor benefits

After the first death, the survivor's spousal top-up stops and they receive the larger of their own benefit and the **survivor benefit**:

- The survivor benefit is the deceased's benefit, with any delayed credits. If the deceased claimed early, it is at least 82.5% of their benefit at full retirement age. If they died before claiming, it is that benefit plus any credits earned by then.
- It starts the year after the death, but no earlier than the survivor's own claiming age in the plan, and never before 60.
- It is reduced if it starts before the survivor's full retirement age for survivor benefits (66 to 67 by birth year): 71.5% at 60, rising evenly to 100%.

For example, someone who claimed a $2,000 benefit at 62 (receiving $1,400) leaves a survivor benefit of $1,650, 82.5% of $2,000. Had they waited to 70, it would be $2,480.

The plan follows the same rules in its survivor years (see [Survivor years](#/docs/inputs/survivor-years)).

## Lifetime benefits

Each person counts through the year they reach their life expectancy on the inputs page, as the plan does (95 when none is entered). For a couple, the first to reach theirs dies that year and the survivor years begin the next; two deaths in the same year leave no survivor years.

**Lifetime Social Security** adds up the household's benefits under the plan's claiming ages: each person's own, and the spousal and survivor benefits on top. It names the claiming ages that pay the most, with a **Use these claiming ages in the plan** button when they differ from the plan's.

A **discount rate** (on the page's inputs, 0% by default) weighs money sooner more: each year's benefits are divided by (1 + rate) for each year from today. At 0% the totals are simply added up.

## When to claim, person by person

Each person's table shows every open claiming age with the other spouse held at the plan's age: the monthly benefit, their own benefits to their life expectancy, and for a couple the household total (spousal and survivor included). ★ marks the age that pays the household the most. **Use in the plan** on a row writes that claiming age into the person's Social Security row; with no row (estimated from earnings), it adds one.

## What each age does to the plan

Two more columns rerun the whole plan at each claiming age:

- **Spending the plan supports:** the steady spending after tax the plan supports through life expectancy, with the legacy goal if there is one, as on Retirement spending. ▲ marks the most.
- **Lifetime tax:** federal income tax plus IRMAA over the plan, at the spending need.

These can disagree with the benefit totals. A later claim pays more in total, but the years before it starts are paid from the portfolio. For a household short of money, that can cost more than the larger checks bring in later. Rerunning the plan takes a moment, so these columns follow the inputs a beat behind.

## Break-even ages

For each person, the age at which claiming later has paid as much as claiming earlier: the earliest open age against full retirement age (rounded up to a whole year), full retirement age against 70, and the earliest against 70. The comparison uses the person's own benefit, assuming they live throughout, and counts within the year it crosses. With a full retirement age of 67, at a 0% discount rate:

- 67 instead of 62 has paid more by about 78 and 8 months;
- 70 instead of 67 by about 82 and 6 months;
- 70 instead of 62 by about 80 and 4 months.

These ages don't depend on the size of the benefit. A discount rate pushes them later, sometimes past any age (shown as never).

## Every pair of claiming ages

The grid leads the page. Your claiming age runs down the side and your spouse's across the top, and each heading shows that person's own benefit a month at that age. Each cell is the household's lifetime benefits (own, spousal and survivor, at the discount rate), shaded darker for more. ★ marks the most, and the dashed cell is the plan. For one person, the grid is a single row of claiming ages.

Choose a cell to see its benefit options: each person's own, spousal and survivor benefit a month, each person's lifetime total, and how the cell compares with the plan and with the most. From there you can use that pair in the plan. Choosing a cell also adds it to the strategies compared below; a colored dot in the grid marks each one, in its line color on the graph.

## The strategies compared

The strategies are the most plus the cells you choose, starting with the plan's ages (up to four chosen cells; choosing a fifth drops the oldest). Remove one from the cell's panel.

**Year by year:** a dropdown picks one strategy and a table shows each year from the first benefit to the second death: both ages, each person's own, spousal and survivor benefit (columns that are always zero are left out), the household total, and the running total. Survivor years are shaded. The table is in today's dollars by default. Switch to future dollars to see each year grown at the inflation input, the way cost-of-living adjustments raise the checks; the running total then adds dollars of different years. The table is not discounted.

**Break-even graph:** each strategy's running total by your age, in today's dollars at the discount rate. A strategy that starts later pays off where its line crosses an earlier one. Dashed lines mark the crossings with the strategy picked in the dropdown, and a table lists every crossing, at your age and your spouse's. Example, with no discount: you born 1960 with a full-retirement benefit of $2,000, plan-to 80; your spouse born 1962 with $600, claiming at 64, plan-to 90. If you claim at 70 instead of 67, the household falls $84,000 behind by your 70th birthday. It gains $6,560 a year while you're both alive (your larger check and the spousal top-up) and $5,760 a year after, as your spouse's survivor benefit includes your delayed credits. It passes at your age 83 and 1 month, with your spouse 81. The graph stays in today's dollars, because growing later years works like a negative discount rate and would move the crossings.

## The chance of being alive

Break-even ages matter only if someone lives to them. A chart shows each person's chance of being alive at each age, from their age now, using SSA's period life table (Period Life Table, 2023, as used in the 2026 Trustees Report) by biological sex. Without a sex entered, the men's and women's tables are averaged. Dashed lines mark each person's life expectancy in the plan and their widest break-even age. A table gives the chance of reaching each break-even age and each life expectancy. For a couple, a later claim can pay off even after the earner dies, because the larger benefit carries on as the survivor benefit.

## What it leaves out

Not modeled: the earnings test (benefits withheld while working before full retirement age), benefits for children or ex-spouses, and disabled-survivor benefits from 50. Claiming ages are whole years. A death counts at the start of that year of age, so delayed credits run to then.
