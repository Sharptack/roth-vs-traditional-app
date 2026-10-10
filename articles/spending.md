# Retirement spending

The question isn't only "how much do we plan to spend?" but "how much do our resources allow us to spend?" This page answers the second one. It finds the most the household can spend each year, after tax, without ever running short and while still leaving its legacy goal, and sets that beside what it plans to spend. Everything is in today's dollars (see [The household inputs](#/docs/inputs)).

## What the page shows

- **What the resources allow:** the highest steady after-tax spending the plan supports every year to the end of the plan (the second death, for a couple), leaving the legacy goal. The spending need (the retirement income number) and the difference sit beside it. A positive difference is room to spend more; a negative one means the plan as it stands runs short or misses the goal.
- **Use in the plan:** writes that figure back as the plan's retirement spending (see below).
- **The legacy goal:** what leaving it costs a year, measured against what the resources would allow with no goal, and what is actually left at the end. With a share going to charity, a sentence gives the charity's dollars, the Pre-tax money passing to it untaxed, and the heirs' tax that spares.
- **Spending against legacy:** what each $100,000 more for heirs costs a year at the household's goal, what the plan leaves when spending the planned amount, and the most it could leave by spending nothing. A chart of spending against the goal follows, from no goal to a little past the larger of the planned amount's legacy and the goal, with the figures in a table below it.

## How it is worked out

The page runs the same plan as the [year-by-year projection](#/docs/projection): the household's income and Social Security, the withdrawal strategy, required minimum distributions, every tax, Medicare IRMAA surcharges and survivor years. It searches for the spending level by trying one, running the whole plan, and narrowing in, to the dollar. A spending level works when no year falls short and, with a goal, at least the goal is left at the end. Spending more can only run out sooner and leave less, so the search finds the one highest level that works.

A simple check, with no tax at all. A retiree has $1,000,000 in Roth, earns 5% a year, takes each year's spending at the start of the year, and the plan runs 3 years:

- With a $500,000 goal the resources allow **$198,670.73** a year. The balance runs 801,329.27 × 1.05 = 841,395.73, then 642,725.00 × 1.05 = 674,861.25, then 476,190.52 × 1.05 = 500,000.05.
- With no goal they allow $349,722.44 a year.
- So each $100,000 left costs $30,210.34 a year in this case.

## The spending need

The figure it is compared with is the retirement income number from **Spending** on the inputs page. It comes from today's take-home pay minus savings, or from the household's own budget, then less the costs that end by retirement, times the lifestyle setting. For a household already retired, it is the budget as entered. The page needs that number. Until a retired household enters its budget, the page says so.

## The legacy goal

Set on the inputs page (Legacy goal): nothing (spend it all), an amount in today's dollars, or a share of today's portfolio. It is measured as the balance itself, or after tax, with Pre-tax money at the heirs' tax rate (under Withdrawals). The goal applies on the projection page too: its sustainable spending and funded status leave the goal as well.

**To charity.** The share of what is left that goes to charity is taken from Pre-tax money first, as when a charity is named beneficiary of the Pre-tax accounts. A charity owes no tax on Pre-tax money, so that money counts in full, and heirs pay their rate only on the Pre-tax money beyond the charity's part. Every after-tax figure for what is left uses it: the goal measured after tax, the projection's after-tax ending wealth and its withdrawal strategies, the Roth page's lifetime comparison, the conversion's legacy. The larger the charity's share, the more Pre-tax money is favored, because Pre-tax money left to charity loses nothing to tax.

## Use in the plan

**Use in the plan** sets the plan's retirement spending to the figure the resources allow, so every calculator then reads it. It sets the spending to the budget method and enters the budget that gives that figure. The budget is today's spending, so for a household still working it is worked back through the costs that end and the lifestyle setting: the figure ÷ the lifestyle setting + the costs that end. For example, $87,739.50 at an 80% lifestyle with $6,000 of debt payments ending gives a budget of $115,674 today. For a household already retired the budget is the figure itself. The budget is rounded down to the dollar, so the plan's spending lands at or just under the figure.

## What it leaves out

- Spending is flat in today's dollars every year, lower after the first death for a couple by the survivor assumption. Spending that changes with age, one-off and repeating extra expenses, health care before Medicare, long-term care and health costs rising faster than prices are designed but not yet built.
- Returns are constant. Random return paths, the chance of success, and the spending that succeeds in half of them come with Monte Carlo and the guardrails, later.
- Federal tax only; no state tax.
