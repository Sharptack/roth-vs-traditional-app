# Staged spending: design (phase 3 step f)

Written 2026-10-10. Michael's decisions the same day are folded in below; nothing is left open.
Today spending in retirement is one flat figure in today's dollars (80% of it after the first death). This is how it
changes with age and events, and how that fits the engine, the inputs and the pages already built.

## The idea in one line

Spending each year = **the base** × **the spending curve at that age** + **the extra expenses that year**, all after
tax, in today's dollars. The base is today's retirement income number (from income or the budget, phase 3 step a).
Every page that reads spending reads this schedule. Sustainable spending, and later the guardrails, search for **the
base**, so "what the resources allow" stays one number an advisor can quote: the first-year spending the plan supports,
with the curve and the extras on top of it.

## 1. The spending curve: flat or the smile (decided 2026-10-10)

Two options under Spending:

- **Flat:** today's model and the default, so no results change until someone picks the smile.
- **The smile:** a smooth curve from the research, with one adjustment, how strongly spending falls.

**The research.** David Blanchett, "Estimating the True Cost of Retirement" (Morningstar, 2013), equation 1 on page 15,
gives the change in real spending from one year to the next by age and by the after-tax spending target:

  change = 0.00008 × age² − 0.0125 × age − 0.0066 × ln(spending target) + 0.546

The target is the base, in dollars. The change is negative through the seventies and eighties: about −0.4% at 65,
falling fastest (about −1.8% a year) near 78. It turns up only in the nineties, the late rise as health costs grow.
Higher spending falls faster (the ln term), since more of it is discretionary. His later article ("Exploring the
Retirement Consumption Puzzle", *Journal of Financial Planning*, May 2014, other data) describes the same "smile":
real spending down about 1% a year on average, a $100,000 household reaching about $74,146 at 84 (about 26% lower).
Equation 1 gives nearly the same depth, 74.6% at 85 for $100,000; it puts the low point later, near 93.

**The adjustment: how strongly spending falls,** as a multiple of the research curve's yearly change: **half**, **the
research** (the default once the smile is chosen) and **one and a half**. One number an advisor can explain: "we
assume spending falls half as fast as the average retiree's". The level as a share of the base, from equation 1, the
change applied each year from retirement at 65:

| Base | Strength | 70 | 75 | 80 | 85 | 90 | 95 on |
| --- | --- | --- | --- | --- | --- | --- | --- |
| $50,000 | the research | 98% | 93% | 87% | 82% | 79% | 80% |
| $100,000 | half | 98% | 94% | 90% | 86% | 84% | 83% |
| $100,000 | the research | 96% | 89% | 81% | 75% | 70% | 69% |
| $100,000 | one and a half | 94% | 84% | 73% | 64% | 59% | 58% |
| $200,000 | the research | 94% | 85% | 76% | 68% | 63% | 60% |

**Rules:**
- **Whose age:** the youngest living person's (decided 2026-10-10: the youngest sets the length of the plan). After
  the first death, the survivor's.
- **When it starts** (decided 2026-10-10): at retirement, the first year anyone is retired, at whatever age. The
  curve applies only in retirement; working years keep the other methods (the paycheck is the budget). The formula
  uses the actual age, so someone retiring before about 63 sees spending rise a little at first (+2.5% a year at 55,
  +0.8% at 60), which is equation 1 below the study's 60-to-90 data; the page's chart will show it.
- **When it stops:** at 95 the level holds, as in the study (too little data beyond).
- **The spending target** in the formula is the base, fixed for the plan, as in the study.
- **Survivor share** (decided 2026-10-10: as proposed): the 80% after the first death scales the curve's result.
  Extra expenses keep their full amount.

## 2. Extra expenses: one-off and repeating

Rows under Spending, each in today's dollars and after tax:

- **One-off:** an amount at an age or in a year, for example a wedding at 68 ($40,000) or a new roof in 2031 ($25,000).
- **Repeating:** an amount every N years, from one age to another, for example a car every 8 years from 66 to 82
  ($35,000), or travel of $15,000 a year from 65 to 74. Gifts to family fit as either kind.

**While anyone works** (decided 2026-10-10): an extra expense comes out of the paycheck first, from that year's income
above what the plan already spends and saves (the surplus the year table shows). Only what is left comes from the
portfolio, by the withdrawal strategy. Once everyone has retired, it comes out of the portfolio with the rest of spending.

## 3. Left out (decided 2026-10-10)

- **Health care costs are not modeled separately.** The smile's late rise is the research's own allowance for them.
  No health line and no "health costs rise faster than prices" assumption.
- **Health care before Medicare** (insurance from retirement to 65, with ACA premium credits that depend on MAGI) and
  **long-term care** (and long-term care insurance) are a later rollout, listed in `docs/ideas.md`.

## 4. The budget feeding the base

Already in place: "Baseline expenses per year" is the base under the budget method (step a). The itemized budget
calculator on the ideas list fills that one number. Its lines could later be tagged "ends at retirement" or "travel
(active years)" to feed the extra expenses directly. That stays with the budget calculator.

## How it fits what is built

- **Engine:** `runProjection` takes the need as a number today. It would take a schedule, a function of the year and
  ages that returns that year's need, and the extra expenses with the paycheck-first rule. The flat model is a
  schedule that always returns the base, so the v1 pins stay put.
- **Sustainable spending and the legacy goal:** the bisection searches the base. The curve's own target is the base,
  so each step of the search recomputes the curve. The goal condition and the trade-off chart are unchanged.
- **Retirement spending page:** "What the resources allow" becomes the base, labelled as first-year spending. A new
  block charts the schedule year by year: the base after the curve, with the extras stacked on it.
- **Use in the plan:** writes the base back, as now.
- **Year-by-year projection:** spending columns for the base after the curve and the extras.
- **The Roth comparison's retirement snapshot:** uses the schedule's value in the snapshot year (the last retirement).
  Its first-year rates stay as they are.
- **Monte Carlo and guardrails (phases 8 and 9):** they run the same schedule; the guardrails raise or cut the base.

**Tests:**
- Equation 1 by hand at a few ages (−0.4485% at 65 for $100,000: 0.338 − 0.8125 − 0.07599 + 0.546).
- The Roth-only, no-tax case with a schedule: sustainable base = (the balance − the present value of the extras − the
  goal's present value) ÷ the present value of the curve.
- A one-off expense in a retirement year changes that year's withdrawal by exactly its amount after tax. In a working
  year it comes from the surplus first.
- The flat schedule reproduces today's numbers to the cent.

## Build order (when it is scheduled)

1. The schedule in the engine (flat by default, no change) and the smile with its strength setting.
2. Extra expenses (one-off, repeating), paycheck first while working.
3. The spending chart on the Retirement spending page, the projection's spending columns, and the article.

Sources: Blanchett, "Estimating the True Cost of Retirement", Morningstar, 2013 (equation 1, page 15);
Blanchett, "Exploring the Retirement Consumption Puzzle", *Journal of Financial Planning*, May 2014.
