# Pre-retirement funding

Is the household on track? This page sets what the household's assets will pay against its spending need, two ways, says whether it is underfunded, about even or overfunded, and shows what closes the gap: saving more or less, or retiring earlier or later. Everything is in today's dollars (see [The household inputs](#/docs/inputs)).

## The two measures

- **Through retirement** (it leads the page): the highest steady after-tax spending the plan supports every year to the end of the plan without falling short, leaving any legacy goal. It is the same figure as [Retirement spending](#/docs/spending), from the same plan as the [year-by-year projection](#/docs/projection): income, Social Security, the withdrawal strategy, required minimum distributions, every tax, Medicare IRMAA and survivor years.
- **At retirement (4%)**, the familiar rule of thumb: in the year the last person retires, 4% of every account's balance at the start of that year, plus that year's Social Security, pensions and other income (rent, an annuity), less all the tax on it and IRMAA. The years before it run exactly as the plan does. It is set against that year's need.

Each one's **funded level** is what the assets pay ÷ the spending need. Within 5% of 100% is **about even**, below that **underfunded**, above it **overfunded**. The spending need is the retirement income number from **Spending** on the inputs page.

A simple check, with no tax at all. A 60-year-old saves $10,000 a year in Roth on top of a $500,000 Roth account, earns 5% a year, retires at 62, and the plan runs to 64:

- At 62 the account holds 500,000 × 1.05 + 10,000 = 535,000, then 535,000 × 1.05 + 10,000 = **$571,750**.
- At retirement: 4% of it is **$22,870** a year. Against a $40,000 need that is 57%, underfunded.
- Through retirement: drawn at the start of each of three years, it allows 571,750 ÷ (1 + 1/1.05 + 1/1.05²) = **$199,953.81** a year, 500% of the need, overfunded.

The two can disagree, as here: the 4% rule is meant for a retirement of about 30 years, so it says little about a short plan or a very long one. Through retirement reads the household's own plan to its end.

## Savings needed

For each measure, the savings a year that bring it to the **target funded level**: 100% by default, set under **Funding target** on the page (80% to 150%; above 100% is a cushion, since the plan assumes the same return every year). It is shown as dollars a year, the change from today's savings, and as shares of this year's household pay (W-2 and 1099 earnings).

- **The need stays fixed.** Under the "Today's income" method, saving more would also lower take-home spending and so the need. The page holds the need where it is, so the answer is the savings that fund today's retirement income number.
- **Where the change goes.** It is spread across the contribution rows in proportion to today's amounts, taxable rows included, each person saving until their own retirement. Amounts over a person's IRS limit go to a taxable account, as always. With no savings in the rows, it goes to a taxable account, split between the people by their pay.
- **The employer match** stays on the contributions as entered, so extra savings earn no extra match (a conservative choice).
- **Below zero.** When the target is met saving less, the change is negative: the household could save that much less. "Met even saving nothing" means the target is reached with no savings at all.
- **Out of reach.** With no working years left, saving more can't help, and the page says so.

The page finds the amount by trying one, running the plan, and narrowing in, to the dollar (rounded up). In the example above, with a $25,000 need, the 4% at retirement needs a balance of $625,000 at 62: 551,250 + 2.05 × savings = 625,000, so **$35,976 a year**, $25,976 more than today.

## Use in the plan

- **For the savings:** one button per measure. It writes the savings into the contribution rows, each row of a person still working scaled in proportion and rounded up to the dollar, so the plan then lands at or just above the target. With no savings in the rows, it adds a taxable row for each person with pay, split by pay.
- **For a retirement age:** sets that person's retirement age and nothing else (see below).

## Retirement age

A table for each person still working: their retirement age moved on its own, from 5 years before the plan's age (but after this year) to 5 years after, with the other person's age held. Their earnings and savings stop at that age, and a Social Security claim set to start at retirement moves with it (never before 62 or after 70). Each row shows both funded levels. Pick an age to see the savings needed there for both measures, and **Use in the plan** to make it the plan's age.

The 4% measure can jump between two ages. Social Security claimed at retirement can't start before 62, so a retirement at 61 has no Social Security in its first year, and one at 62 does.

## Room to spare

When either measure is overfunded, a block gives three ways to use the room:

- **Spend more:** through retirement, what the resources allow above the need. [Retirement spending](#/docs/spending) can put it into the plan.
- **Save less:** how much less a year still reaches the target, on each measure (from the savings needed).
- **Retire earlier:** each person's earliest retirement age that still reaches the target on each measure, the other person's age held. It isn't limited to the table's 5 years, and each age has a Use in the plan button.

## Already retired

With everyone retired there are no working years to save in, so the page points to [Retirement spending](#/docs/spending) instead.

## What it leaves out

- Returns are constant, the same every year. Random return paths and the chance of success come with Monte Carlo, later.
- Spending is flat in today's dollars (lower after the first death for a couple, by the survivor assumption).
- Earlier retirement is assumed never to fund the plan better than later retirement, which holds when working years add savings and Social Security credits.
- Federal tax only; no state tax.
