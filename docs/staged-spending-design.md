# Staged spending: design (phase 3 step f)

Written 2026-10-10 for Michael to agree before anything is built (roadmap phase 3). Today spending in retirement is one flat
figure in today's dollars (80% of it after the first death). This is how it could change with age and events, and how
that fits the engine, the inputs and the pages already built. The open decisions are listed at the end.

## The idea in one line

Spending each year = **the base** × **its shape at that age** + **the extra expenses that year**, all after tax, in
today's dollars. The base is today's retirement income number (from income or the budget, phase 3 step a). Every page
that reads spending reads this schedule. Sustainable spending, and later the guardrails, search for **the base**, so
"what the resources allow" stays one number an advisor can quote: the first-year spending the plan supports, with the
shape and the extras on top of it.

## 1. Spending that falls with age (the "retirement spending smile")

**What the research says.** David Blanchett's study ("Exploring the Retirement Consumption Puzzle", *Journal of
Financial Planning*, May 2014) found that retirees' real spending falls during retirement, by about 1% a year on
average. It falls faster early on and slows, and late in life it rises again with medical costs. For a household that
starts at $100,000, real spending reaches a low of about $74,146 at 84 (about 26% lower), rises after that, and is
back near where it started only in the mid-nineties. The path is called the "spending smile". The drop is larger for
households that spend more. A plan that holds spending flat therefore tends to overstate what late retirement costs
and understate what early retirement can afford.

**Proposal: three phases an advisor can explain and change,** with a research setting that fills them in:

| Phase | Ages (editable) | Spending, % of the base (editable) |
| --- | --- | --- |
| Active ("go-go") | retirement to 74 | 100% |
| Slower ("slow-go") | 75 to 84 | 85% |
| Late ("no-go") | 85 on | 80%, with health care added separately (section 4) |

- **Flat** (today's model) stays the default, so no results change until someone picks a shape.
- **"Follow the research"** fills the phases to match the smile above: about 100%, then 88%, then 78%. The percentages
  would be fixed when built, from the study's own curve.
- Steps rather than the study's smooth curve: they're easier to explain to a client and to change. Is a smooth curve
  worth offering beside them (decision 1)?
- **Whose age?** Person 1's while both are alive, then the survivor's. The 80% after the first death still applies on
  top: the shape scales the base, then the survivor share scales the result.

## 2. Extra expenses: one-off and repeating

Rows under Spending, each in today's dollars and after tax:

- **One-off:** an amount at an age or in a year, for example a wedding at 68 ($40,000) or a new roof in 2031 ($25,000).
- **Repeating:** an amount every N years, from one age to another, for example a car every 8 years from 66 to 82
  ($35,000), or travel of $15,000 a year from 65 to 74.
- Gifts to family fit as either kind.
- **Before retirement:** an extra expense in a working year comes out of the portfolio the same way, since the paycheck
  is the budget. The year table shows it.
- **Survivor share:** extras keep their full amount after the first death; the survivor share scales only the base.
  Decision 4 asks whether that's right.

## 3. Health care before Medicare

Someone retiring before 65 buys their own health insurance until Medicare starts. Proposal: a yearly amount per person,
from their retirement to 65. Blank means none, which is today's model.

Later, not now: ACA premium tax credits depend on MAGI, so Roth conversions and withdrawals change the real premium.
That's a large interaction with the conversion planner (phase 6) and is noted in `docs/ideas.md`, not built here.

## 4. Long-term care

An optional late-life cost: **$X a year for the last N years of each person's life** (for example $100,000 a year for 3
years), at the end of each life expectancy. The survivor's care comes last in the plan, and the first person's care
falls in the years just before their death. Off by default.

A long-term care insurance policy (its premiums, and benefits that offset this cost) is not modeled now; it goes on the
ideas list.

## 5. Health costs rising faster than prices

Everything is in today's dollars, so a cost that rises faster than inflation grows at the difference. Health costs
have long risen faster than prices. For example, in 2025 the Medicare Part B premium rose 5.9% against a 2.5% Social
Security COLA.

Proposal: one assumption, **"Health costs rise faster than prices by"**: 0%, 1%, 2% or 3% a year. It applies to the
health lines only: health care before Medicare, long-term care, and the late phase's health share if one is added. The
default is decision 5.

IRMAA is already charged separately, at its thresholds, and is not changed by this.

## 6. The budget feeding the base

Already in place: "Baseline expenses per year" is the base under the budget method (step a). The itemized budget
calculator on the ideas list fills that one number. Its lines could later be tagged "ends at retirement", "health" or
"travel (active years)" so they feed sections 1 to 5 directly. That stays with the budget calculator.

## How it fits what is built

- **Engine:** `runProjection` takes the need as a number today. It would take a schedule, a function of the year and
  ages that returns that year's need. The flat model is a schedule that always returns the base, so the v1 pins stay
  put.
- **Sustainable spending and the legacy goal:** the bisection searches the base instead of a flat figure. The goal
  condition and the trade-off chart are unchanged.
- **Retirement spending page:** "What the resources allow" becomes the base, labelled as first-year spending. A new
  block charts the schedule year by year: the base after its shape, with the extras and health lines stacked.
- **Use in the plan:** writes the base back, as now.
- **Year-by-year projection:** a spending column split into base, extras and health.
- **The Roth comparison's retirement snapshot:** uses the schedule's value in the snapshot year (the last retirement).
  Its first-year rates stay as they are.
- **Monte Carlo and guardrails (phases 8 and 9):** they run the same schedule; the guardrails raise or cut the base.

**Test plan:**
- The Roth-only, no-tax case with a schedule. Sustainable base = (the balance − the present value of the extras − the
  goal's present value) ÷ the present value of the shape. Worked out by hand, like step b.
- A one-off expense in a single year changes that year's withdrawal by exactly its amount.
- The flat schedule reproduces today's numbers to the cent.

## Build order (when it is scheduled)

1. The schedule in the engine, with the flat default (no change); the phases.
2. Extra expenses (one-off, repeating).
3. Health care before Medicare, long-term care, and health costs rising faster than prices.
4. The spending chart on the Retirement spending page, the projection's spending columns, and the article.

## Decisions for Michael

1. **Shape of the decline:** three editable phases with a research setting, as proposed? Or also the study's smooth
   curve?
2. **Phase defaults:** the ages (to 74, 75–84, 85 on) and the percentages for the research setting.
3. **Whose age** drives the phases for a couple: person 1's, then the survivor's (proposed), or the older person's?
4. **Survivor share:** applies to the base only, with extras kept whole (proposed), or to everything?
5. **Health costs rising faster than prices:** the default, 0% (so no results change) or 1% to 2% (more realistic,
   but every household's numbers move once health lines are entered)?
6. **Long-term care default:** off (proposed), or a standard assumption (for example 3 years at $X) for every plan?
7. **Before retirement:** extra expenses in working years come from the portfolio (proposed), or from the paycheck
   (spending above it)?
