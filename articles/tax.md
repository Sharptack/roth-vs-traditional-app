# The tax calculator

This year's federal income tax for the household, from every kind of income at once, and what the next dollar would cost. It reads the household's inputs: this year's income rows, the dividends the taxable accounts pay this year (each account's balance times its dividend yield, shown in the qualified-dividends line), each person's age, Pre-tax contributions (deducted), itemized deductions, children and dependents, and whether Medicare IRMAA is included.

## The three rates

The page leads with three rates (see [Tax rates: marginal, average and effective marginal](#/docs/rates)):

- **Marginal rate:** the tax bracket of the last dollar of ordinary income.
- **Effective marginal rate (EMTR):** the real federal income tax on the next $100 of the household's main kind of income (wages while working, Pre-tax withdrawals in retirement), with everything that dollar sets off. With children, it is measured over the next $1,000, because the child tax credit shrinks in $50 steps.
- **Average tax rate** (also called the effective tax rate): the year's income tax ÷ total income, with the figure including payroll tax beside it.

Under them: adjusted gross income (AGI), taxable income, the federal income tax, the payroll tax, and the total tax paid. The buckets come next, then the full calculation, then the next $100 worked out.

## Rates as income rises

Two buckets on one income scale, filled to today's income and drawn on through the two brackets above today's.

- **The marginal rate bucket** shows the bracket at each level of income, the part sheltered by deductions in grey at the bottom, the edge of each bracket to the dollar, and the room left in today's bracket.
- **The effective marginal rate bucket** shows the real tax on the next dollar at each level, worked out by the tax engine: the Social Security "tax torpedo", gains pushed out of the 0% rate, deductions and credits phasing out, the 3.8% Net Investment Income Tax. Labels mark where it changes. Red lines are Medicare IRMAA tiers; the key under the chart gives each one's income and the yearly premium increase it brings two years later.

The scale on the left is total income: everything received, before any deduction. The brackets themselves apply to taxable income, so each bracket edge also shows the taxable income it is at (for a married couple, the 22% bracket starts at $100,800 of taxable income, which can be well over $133,000 of total income once Pre-tax contributions, half of self-employment tax and the QBI deduction come off too). The room left in today's bracket is given both ways, and a line under the chart walks today's total income down to taxable income, deduction by deduction.

Below today's line the buckets are the household's own income built up from $0 (a Pre-tax 401(k) stays at its full amount); above it, more of one kind of income. The switch chooses which: **ordinary income** (a Pre-tax withdrawal, a pension, a Roth conversion, more pay; payroll tax left out) or **capital gains** (a house sale, a taxable account sold off; the marginal bucket then shows the 0%, 15% and 20% capital-gains brackets).

## The calculation

The return, line by line, showing only the lines that apply:

1. Each income, with the payroll tax on earned income beside it (FICA, or self-employment tax on 1099 income).
2. Social Security: provisional income (other income plus half the benefits), and how much of the benefits is taxable (Form 1040 line 6b).
3. Adjusted gross income (line 11), modified AGI, and net investment income.
4. The deductions: the standard deduction or the itemized total, the extra standard deduction at 65, the senior deduction (2025–2028), the QBI deduction on 1099 income. Then taxable income (line 15).
5. Taxable ordinary income after deductions, its tax bracket by bracket (folded into "By bracket"), and the ordinary income tax.
6. Long-term gains and qualified dividends at 0%, 15% and 20%, stacked on top of ordinary income.
7. The Net Investment Income Tax, the child tax credit, federal income tax (negative when the refundable part of the credit is more than the tax), payroll tax and the total.

## The next $100: the effective marginal rate

The headline effective marginal rate, worked out in a few lines: the next $100 of the household's main kind of income, what it sets off (Social Security made taxable, deductions lost as the senior deduction phases out, a change in the QBI deduction or the deductible half of self-employment tax), how much taxable income rises, the extra tax on it (by bracket, on gains pushed into a higher rate, the 3.8% Net Investment Income Tax, child tax credit lost), and the extra tax ÷ $100. Only the lines that change show. For example, a 70-year-old with $30,000 of Pre-tax withdrawals and $30,000 of Social Security: $100 more makes $85 more of the benefits taxable, so taxable income rises $185, taxed at 12%: $22.20, an effective marginal rate of 22.2%. With earnings, the payroll tax on the $100 is added on a separate line.

Under it, the same rate for $100 more of each other kind of income, alone: they differ because each is taxed differently. The next Pre-tax dollar can pull Social Security into tax with it; gains can sit in the 0% bracket.

## Medicare premiums (IRMAA)

For anyone 65 or older two years from now: this year's modified AGI sets the Part B and Part D surcharges then, by tier. The page shows the tier, the surcharge at this year's amounts, and the room before the next tier. Each tier is a cliff: one dollar over costs the whole step.

## What it covers, and what it doesn't

Covered: the ordinary and capital-gains brackets, payroll tax, Social Security taxability, the standard deduction or itemized deductions as one total, the 65+ and senior deductions, the QBI deduction (basic rule: above the income threshold it assumes a business with no employees or property), the child tax credit and the credit for other dependents, the Net Investment Income Tax, Medicare IRMAA. Not covered: the alternative minimum tax, other credits (the earned income credit among them), head of household filing status, and state tax. Everything is federal, for this year, under current law.
