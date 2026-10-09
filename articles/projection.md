# The year-by-year projection

The projection follows the household from this year to the end of the plan, one year at a time: income, contributions, withdrawals, every tax, and the balance of every account. It answers whether the money lasts, how much the plan can support, and how the choice of withdrawal strategy changes the tax paid along the way. Everything is in today's dollars (see [The household inputs](#/docs/inputs)).

## What the page shows

- **Funded status:** the highest steady after-tax income the plan supports every year to the end of the plan (**sustainable spending**), against the retirement income number from the household's spending inputs. Above 100% the plan is overfunded; below, the money runs out early at the planned spending.
- **Compare withdrawal strategies:** every strategy run at the retirement income number, with its lifetime income tax, Medicare IRMAA surcharges, after-tax ending wealth and how long the money lasts.
- **Lifetime summary:** total tax, the average tax rate over the whole plan, the year with the highest tax, and the ending balances. After-tax ending wealth counts Pre-tax money at the heirs' tax rate (an assumption) and Roth and taxable money in full, since heirs get a step-up in basis on taxable accounts.
- **Income by source in retirement** and **balances over time**, as charts.
- **Year by year:** a table with every year's figures; "Show all columns" opens the rest (withdrawals by account type, dividends, employer contributions, Medicare IRMAA, the marginal and effective marginal rates, bracket room, cost basis and more).

## How each year is worked out

1. **Ages and who is working.** A person works until their retirement age. For a couple, each person is followed to their own plan-to age (see [Survivor years](#/docs/inputs/survivor-years)).
2. **Income.** Earnings and other income from the income rows, in the years their ages cover; Social Security once each person claims; pensions from their start age.
3. **Contributions** from each person still working, each capped at their own IRS limit for that year's age (so the catch-up starts at 50). Anything over the limit goes to a taxable account. Employer 401(k) contributions go into the person's Pre-tax account.
4. **Required minimum distributions** from each owner's Pre-tax accounts, on the balance at the start of the year.
5. **Withdrawals.** Once anyone has retired, the withdrawal strategy decides which accounts pay for spending, so that after-tax income meets the retirement income number. While everyone works, the paycheck is the budget: only RMDs come out.
6. **Tax** on the whole year through the same tax engine as the tax calculator: ordinary brackets, capital-gains rates, Social Security taxability, payroll tax, the Net Investment Income Tax, deductions and credits. Medicare IRMAA surcharges follow from income two years earlier.
7. **Growth.** What is left grows at the year's return; contributions and anything reinvested are added at the end of the year.

## Income over the years

Each income row counts in the years its ages cover. A blank first age means from now. A blank last age means until the owner retires, or for life for a row that starts at or after retirement, such as part-time work or an annuity. Earnings are taxed with payroll tax; rent and annuities as ordinary income; interest and qualified dividends at their own rates; tax-exempt income counts as cash.

Before retirement, the household lives on today's paycheck, so income beyond it is extra (see Income above what is needed, below). Earnings that end before retirement are taken as lower spending, not drawn from savings.

## Taxable accounts and dividends

Taxable accounts pay qualified dividends every year: each account's own yield, or the assumption (1.3% by default, about what a broad stock index fund pays). The dividends are part of the return, not added to it. They are taxed in the year they are paid, so they count toward Social Security taxability, MAGI and IRMAA, and they are reinvested, adding to cost basis. Until anyone in the household retires, the account pays the tax and reinvests the rest. Once anyone has retired, the year's withdrawals cover it.

A withdrawal from a taxable account is part cost basis, which comes back untaxed, and part gain, taxed at the capital-gains rates; basis falls in step with the balance.

## Returns

The expected return applies while anyone in the household works. The **return in retirement** applies once no one does: for a couple, from the year the last one retires. By default the two are the same.

## Withdrawal strategies

The engine always takes at least the RMD and never more than an account holds, whatever the strategy asks for.

- **Proportional:** the same share of every account each year.
- **Taxable, then Pre-tax, then Roth:** the common default order.
- **Fill the 12% (or 22%) bracket from Pre-tax:** each year, Pre-tax money up to the top of the bracket, then taxable, then Roth. Anything above the need is reinvested.
- **Roth conversions to the top of 12%, 22% or 24%:** in retirement, before each owner's RMDs start, convert Pre-tax money to Roth up to the top of the bracket. Spending comes in the default order, and the conversion's tax is paid from that year's withdrawals.

## Required minimum distributions

RMDs start at 72, 73 or 75, by birth year (75 for anyone born in 1960 or later), and use the IRS Uniform Lifetime Table on the balance at the end of the year before. After a death, the survivor takes over the accounts as their own, so RMDs follow the survivor's age.

## Income above what is needed

Some years bring in more than spending, tax and savings use: an RMD larger than the need, rent or part-time work, Social Security plus a pension. Before retirement it is income beyond today's paycheck, after its tax. The **Income above what is needed** assumption decides what happens to it: **save it** (the default) reinvests it in a taxable account; **spend it** raises spending in those years. The year table shows each year's amount.

## What it leaves out

- Spending is flat in today's dollars; it doesn't fall with age or change for health care.
- Earnings are flat in today's dollars: no raises.
- Each return is the same every year (Monte Carlo comes in a later phase).
- Only the first death is modeled; the survivor lives to their plan-to age.
- No state income tax.
- Social Security's earnings test before full retirement age is not applied to work in retirement.
