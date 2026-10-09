# The tax calculator

This year's federal income tax for the household, from every kind of income at once, and what the next dollar would cost. It reads the household's inputs: this year's income rows, the dividends the taxable accounts pay this year (each account's balance times its dividend yield, shown in the qualified-dividends line), each person's age, Pre-tax contributions (deducted), itemized deductions, children and dependents, and whether Medicare IRMAA is included.

## The three rates

The page leads with three rates (see [Tax rates: marginal, average and effective marginal](#/docs/rates)):

- **Marginal rate:** the tax bracket of the last dollar of ordinary income.
- **Effective marginal rate (EMTR):** the real federal income tax on the next $100 of the household's main kind of income (wages while working, Pre-tax withdrawals in retirement), with everything that dollar sets off. With children, it is measured over the next $1,000, because the child tax credit shrinks in $50 steps.
- **Average tax rate:** the year's income tax ÷ total income, with the figure including payroll tax beside it.

## Rates as income rises

Two buckets on one income scale, filled to today's income and drawn on through the two brackets above today's.

- **The marginal rate bucket** shows the bracket at each level of income, the part sheltered by deductions in grey at the bottom, the edge of each bracket to the dollar, and the room left in today's bracket.
- **The effective marginal rate bucket** shows the real tax on the next dollar at each level, worked out by the tax engine: the Social Security "tax torpedo", gains pushed out of the 0% rate, deductions and credits phasing out, the 3.8% Net Investment Income Tax. Labels mark where it changes. Red lines are Medicare IRMAA cliffs, each with the yearly premium increase it brings two years later.

Below today's line the buckets are the household's own income built up from $0 (a Pre-tax 401(k) stays at its full amount); above it, more of one kind of income. The switch chooses which: **ordinary income** (a Pre-tax withdrawal, a pension, a Roth conversion, more pay; payroll tax left out) or **capital gains** (a house sale, a taxable account sold off; the marginal bucket then shows the 0%, 15% and 20% capital-gains brackets).

## The next dollar of other income

The effective marginal rate on $100 more of each other kind of income, alone: they differ because each is taxed differently. The next Pre-tax dollar can pull Social Security into tax with it; gains can sit in the 0% bracket.

## Medicare premiums (IRMAA)

For anyone 65 or older two years from now: this year's modified AGI sets the Part B and Part D surcharges then, by tier. The page shows the tier, the surcharge at this year's amounts, and the room before the next tier. Each tier is a cliff: one dollar over costs the whole step.

## The calculation

The return, line by line, showing only the lines that apply:

1. Each income, with the payroll tax on earned income beside it (FICA, or self-employment tax on 1099 income).
2. Social Security: provisional income (other income plus half the benefits), and how much of the benefits is taxable (Form 1040 line 6b).
3. Adjusted gross income (line 11), modified AGI, and net investment income.
4. The deductions: the standard deduction or the itemized total, the extra standard deduction at 65, the senior deduction (2025–2028), the QBI deduction on 1099 income. Then taxable income (line 15).
5. Taxable ordinary income after deductions, its tax bracket by bracket (folded into "By bracket"), and the ordinary income tax.
6. Long-term gains and qualified dividends at 0%, 15% and 20%, stacked on top of ordinary income.
7. The Net Investment Income Tax, the child tax credit, federal income tax (negative when the refundable part of the credit is more than the tax), payroll tax and the total.

## What it covers, and what it doesn't

Covered: the ordinary and capital-gains brackets, payroll tax, Social Security taxability, the standard deduction or itemized deductions as one total, the 65+ and senior deductions, the QBI deduction (basic rule: above the income threshold it assumes a business with no employees or property), the child tax credit and the credit for other dependents, the Net Investment Income Tax, Medicare IRMAA. Not covered: the alternative minimum tax, other credits (the earned income credit among them), head of household filing status, and state tax. Everything is federal, for this year, under current law.
