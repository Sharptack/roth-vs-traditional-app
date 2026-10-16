# Monte Carlo

The [year-by-year projection](#/docs/projection) earns the same return every year. Real markets don't, and the order of good and bad years matters: a crash in the first years of retirement, while withdrawals are coming out, does far more damage than the same crash twenty years later. Monte Carlo runs the same plan 1,000 times, each time with its own random returns, and shows how often the money lasts and how widely the results spread. Everything else is the plan as it stands: the household, its spending need, its withdrawal strategy, taxes every year, and the planner's changes. Everything is in today's dollars.

## Running it

Monte Carlo has its own page under Evaluations. Press **Run the simulation**: the paths run in the background (the page stays usable), with a progress bar, and the results appear in about ten seconds. **Stop** ends a run.

The run stays on the page while you move around the app. Change an input and the results are marked out of date until you press **Run again**. Every run uses the same random draws (a fixed seed), so running again with an input changed shows that input's effect, not new luck, and running twice with nothing changed gives the same answer.

## The returns

Each year's return is drawn at random around the plan's own return: the return before retirement while anyone still works, and the return in retirement once everyone has retired (Assumptions). The plan's return is the **middle path**, the median: half the years do better, half worse, and a path made of median years is the projection. With the volatility at 0%, every path is the projection exactly.

**Volatility** is how far a year strays: the standard deviation of the yearly returns. It is the slider on the page, saved with the household, 20% to start.

For reference, from NYU Stern's yearly returns, 1928 to 2023, after inflation:

| | Average year | Standard deviation | Compound growth |
| --- | --- | --- | --- |
| S&P 500 (dividends included) | 8.40% | 19.4% | 6.55% |
| 60% S&P 500, 40% 10-year Treasuries, rebalanced yearly | 5.79% | 12.5% | 5.03% |

The 20% default is the S&P 500's own swing, rounded. A household holding bonds can bring it down: about 12% for a 60/40 mix. One volatility covers every account and every year.

**Average and middle are not the same.** Ups and downs cost growth: +50% then −50% leaves you at 75%, not 100%. Over many years a portfolio compounds at roughly its average year less half the variance (19.4% squared is 3.8%, so 8.40% − 1.9% ≈ 6.5%, as in the table). The page holds the plan's return as the compound growth, so each year's draw is set a little higher on average: at 7% and 20% volatility the average year is 8.79%.

The draws are lognormal: one plus the return is (1 + the plan's return) × e^(σz), where z is a standard normal draw and σ is set so the returns' standard deviation is the volatility. At 7% and 20%, σ = 0.1823; a year one standard deviation up (z = 1) returns 1.07 × e^0.1823 − 1 = 28.4%, and the median year (z = 0) returns 7%.

## Chance of success

The share of paths that pay the full spending need after tax every year of the plan, and leave the legacy goal if there is one (the same test as Retirement spending's). The need is the plan's retirement income number, the same as on the projection page.

## The portfolio over time

Every account together at the end of each year, by your age. The line is the middle path; the darker band holds the middle 50% of paths in each year, the lighter band the middle 80%. One path in ten ends a year below the lighter band. The bands are taken year by year, so they don't follow any single path.

## The portfolio at an age

The spread of the portfolio at one age, the end of the plan to start (choose another age above the chart): how many paths end the year in each range, with the middle 50% shaded and the median marked. The figures under it give the 10th percentile, the median and the 90th, and the share of paths with nothing left. The spread is lopsided, with a few paths far above the rest, so the top 10% share the last bar.

## Spending the paths sustain

For each of the first 200 paths, the highest steady spending after tax that path supports to the end of the plan (leaving the legacy goal, if any), found the way Retirement spending finds it, to within half a percent. The chart shows their spread with the spending need and the median marked, and the figures give the spending that succeeds in 9 paths in 10, in 3 in 4, and in half. The median is the spending with a 50% chance of success, the starting point for spending with guardrails, a later phase. Each path is its own search of about a dozen runs of the plan, so this part finishes after the rest.

## When the failing paths run out

For the paths that fall short, your age in the first year they can't pay the full need, as a bar per age, with the median marked. A path that pays every year but misses the legacy goal counts as a failure in the chance of success but isn't counted here.

## What it leaves out

- Each year's return is independent of the last: no momentum, no recovery after a crash, no market cycles.
- One return and volatility for every account; no separate stocks, bonds and cash, and no glide path toward lower risk with age.
- Inflation is the input's, every year; lifespans are the plan's life expectancies (random lifespans are a later idea).
- Spending stays fixed at the need whatever the markets do; spending rules that cut or raise it come with guardrails.
