# Spending guardrails

A spending number with rules for changing it. [Monte Carlo](#/docs/monte-carlo) says how often the plan's spending lasts. Guardrails turn that around: they recommend the spending that lasts on a chosen share of the random return paths, then say in advance at what portfolio value to cut it and at what value to raise it. This is the risk-based approach Income Lab uses (decided 2026-10-16, in place of Guyton-Klinger's withdrawal-rate rules): every figure comes from the chance of success, worked out with the whole plan, Social Security, pensions, other income and the years left included. Everything is in today's dollars.

## Running it

Spending guardrails has its own page under Evaluations. Press **Work out the guardrails**: the work runs in the background with a progress bar. Today's guardrails come first, in about half a minute, and the year-by-year parts follow, about a minute and a quarter in all for a plan with thirty retired years. **Stop** ends a run. As with Monte Carlo, the run stays while you move around the app, an input change marks it out of date, and the random draws are fixed, so running again shows an input's effect, not new luck. The paths are the Monte Carlo page's, at its volatility (one setting, on both pages).

## The settings

Four settings, saved with the household:

| Setting | Default | What it does |
| --- | --- | --- |
| Target chance of success | 80% | The recommended spending lasts on this share of paths, and every change goes back to it. |
| Cut when the chance falls to | 50% | The lower guardrail. |
| Raise when the chance reaches | 95% | The upper guardrail. |
| Smallest change made | 5% | A change smaller than this is skipped. |

The target is Income Lab's default. Its guardrails are wider, cutting at 25% and raising at about 100%; Kitces, Fitzpatrick and Tharp's 2021 example uses a 90% target with guardrails at 70% and 99%. The target has to lie between the two guardrails.

## Recommended spending

For each of 200 paths, the highest steady spending after tax that path supports to the end of the plan (leaving the legacy goal, if any), found as Retirement spending finds it, to within half a percent. The recommended spending is the one at least 80% of them sustain: line them up from highest to lowest and take the 160th. The page also gives the share of paths that sustain the plan's own spending need.

## Today's guardrails

How far today's portfolio can fall or rise, every account together, before the recommended spending should change:

- For each path, the smallest multiple of today's balances at which it still sustains the recommended spending (to within half a percent).
- The **lower guardrail** is the portfolio at which only 50% of paths do: the 100th of those 200 values from the smallest.
- The **upper guardrail** is the portfolio at which 95% do: the 190th.
- At each, the new spending is again the amount 80% of paths sustain with that portfolio, and a change under 5% is skipped.

Because each value is taken from the same paths it is checked on, a rerun lands on its target exactly: at the lower guardrail exactly half the paths sustain the spending, and at the new spending 80% do.

For a household still saving, today's portfolio can matter less than the savings to come: if even an empty portfolio today leaves more than half the paths sustaining the spending, there is no lower guardrail today, and the page says so.

## The guardrails year by year

The same two values for later years, if spending is still the recommended amount: for each retired year, the portfolio at its start below which to cut and above which to raise, beside the plan's own portfolio then (at its own returns, the middle path), with the spending after each change. They come from the yearly tables below rather than a full rerun, so they are a little rougher than today's.

## Spending under the guardrails

What happens to spending if the rule is followed: 1,000 paths, each starting at the recommended spending and checking once a year, at the start of each retired year, whether its chance has fallen to the lower guardrail or reached the upper one; if so it moves to the spending with the target chance there. The chart shows the spending each path paid, year by year (the middle path, and the middle 50% and 80% of paths). The figures give the share of paths that ever cut and that ever raise, the deepest single cut, the lowest spending, and the share that pay their spending every year before the plan's last.

Working out the chance afresh at every year of every path would take millions of runs of the plan, so a table stands in for it, built once for each retired year:

- 50 paths of their own, each starting that year from the plan's middle path at the recommended spending.
- For each, the spending it sustains from that year at four portfolio values: none, a quarter of the plan's portfolio then, the same, and four times. Straight lines join them.
- The four values span the portfolios the paths reach: after thirty years at 20% volatility, the middle 80% lie between about a quarter and four times the middle path's. Checked against direct searches, the lines are within 0.4% in the middle case and 7% at worst.
- A table is built every second retired year, and for each of the last ten; a year between two tables takes the spending from both, weighted by nearness.

**The plan's last year.** With no years after it, the rule's target in the last year is simply what the portfolio can pay, so the rule spends what is left. A path that pays less than planned in that year has spent its portfolio down, not run out early, so the page counts a path as lasting when it pays its spending every year before the last, and reports the last year apart: how often it pays less than planned, and by how much in the middle case. The tables start from the middle path's account mix and IRMAA history, so for a path that has spent a lot (more Pre-tax withdrawals at high rates, IRMAA from large withdrawals) they can overstate what it can pay at the end.

## What it leaves out

- Every account rises and falls together when the guardrails scale the portfolio; the mix between Pre-tax, Roth and taxable stays the plan's.
- The yearly tables start from the plan's middle path: its account mix, its survivor years, its IRMAA history. A path far from it is approximated.
- Spending is checked once a year (Income Lab checks monthly); a change applies from the year it is made, to every later year until the next change.
- Everything Monte Carlo leaves out: returns independent from year to year, one volatility for every account, the plan's lifespans.
