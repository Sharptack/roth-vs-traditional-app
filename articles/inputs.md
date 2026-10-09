# The household inputs

Every calculator reads one household: the people in it, their income and savings, what they own and owe, how they spend, and a few assumptions. You enter it once, and each calculator uses the parts it needs.

All dollar amounts are in today's dollars. The expected return is a return after inflation, and the tax brackets and contribution limits stay where they are today, since the law raises them with inflation.

## Two ways to work

- **Fill in everything first.** The inputs page (**Edit inputs** on the dashboard's Inputs card) holds every input in four blocks: **Household** (the people and dependents), **Income and expenses** (income, contributions, spending, deductions), **Assets and liabilities** (accounts and debts) and **Assumptions**. Closed, each block shows a line per section, so the whole household reads at a glance; open one and each section inside it is a smaller block of its own. Signed in, the **Clients** card sits at the top, to switch households. Fill it in, then open any calculator.
- **Start from one calculator.** Each calculator page has one inputs card on the left with only the inputs that calculator reads, its own section first. It edits the same household, so a change made there shows on the inputs page and in every other calculator. The **All inputs** link at the top of the card opens the full inputs page.

A closed section still shows a one-line summary of what's in it, so you can check the household at a glance. On a calculator page, the bar between the inputs and the results tucks the inputs away to the left and widens the results; click it again to bring them back.

## Household

**Filing status:** single, or married filing jointly. When filing jointly, you choose whether to enter your spouse separately:

- **Yes:** each spouse gets their own age, retirement age, plan-to age, Social Security and income. Payroll tax, Social Security and the IRS contribution limit are worked out per person, with a spousal benefit when it is larger than a spouse's own.
- **No, one combined income:** the household is treated as one earner, with the joint tax brackets.

If you switch the spouse off, their details are kept. Switch them back on and everything you entered returns. The spouse's own inputs show only while the spouse is entered.

Below the filing status are the people: you, and your spouse when entered, side by side.

### Age or birthdate

Enter either one. Typing a birthdate fills in the age; typing an age clears the birthdate, since an age alone doesn't give one. The calculators use the age a person reaches this calendar year, and a birthdate gives the exact birth year, which sets the full retirement age for Social Security and the age required minimum distributions start. A household saved with a birthdate has its ages brought up to date each time it is opened.

### Retirement age and plan-to age

**Retirement age:** when that person stops working. Each spouse's is set on its own. The Roth vs. Pre-tax comparison takes its retirement-year snapshot when the last of you retires; each of you contributes until your own retirement, and those savings keep growing until then.

Someone already retired keeps the age they retired at (65 for a 75-year-old who retired at 65): a retirement age at or below the age now means retired. They have no earnings or contributions from this year on, the return in retirement applies once no one works, and the Roth comparison's snapshot comes no earlier than today. With everyone retired and no earnings this year, the Roth vs. Pre-tax page has nothing to compare and says so; the Roth conversion calculator is the one for money already saved.

**Plan-to age** (each person, 95 by default): the projection runs until the last of you reaches their plan-to age. **Biological sex** is used only for life expectancy, by the pension calculator for now.

### Survivor years

For a married couple entered separately, the plan follows each of you to your own plan-to age. Each person is counted through the year they reach it. From the year after the first death, the survivor:

- files single, so the single brackets, standard deduction and thresholds apply (Social Security taxability, the Net Investment Income Tax, Medicare IRMAA). The year of death itself stays joint. Qualifying surviving spouse status, which needs a dependent child, is not modeled;
- keeps the larger of the two Social Security benefits: their own (with any spousal benefit) or the deceased's, the deceased's from age 60;
- receives the deceased's pensions at their survivor share, and their own in full; the deceased's earnings and contributions stop;
- spends a share of what the couple spent (**Spending after the first death** in Assumptions, 80% by default);
- owns the deceased's accounts. Pre-tax and Roth accounts roll over as the survivor's own, so required minimum distributions follow the survivor's age. Taxable accounts get a step-up in cost basis, so gains up to the death are never taxed.

Only the first death is modeled; the survivor lives to their plan-to age. Two people with the same plan-to year have no survivor years. With different ages, the projection names each year by the year and the ages of those living, for example "2071 (your spouse 95)".

## Children and dependents

For the child tax credit. Enter each child with their age this year: a child under 17 brings $2,200 off the tax in 2026, and up to $1,700 of it is paid out even when no tax is owed (15% of earned income over $2,500). Each other dependent brings $500, never paid out. The credit shrinks by $50 for each $1,000 of income over $200,000 ($400,000 joint), which adds 5 points to the rate on the next dollar in that range. Children count in every year of the projection until they turn 17; other dependents count this year only.

## Income

One row per source of income, added with **Add income**, each with whose it is and its type. Closed, a row is one line, its type and amount (with its ages, if set), so every source shows at a glance; click it to open it. A new row opens.

- **W-2 wages** and **1099 (self-employed)** income are earnings, a yearly amount. Earnings are what payroll tax, the retirement income number and the Social Security estimate are based on. Enter 1099 income as net earnings, after business expenses; self-employment tax replaces FICA on it, and half of that tax is deductible. 1099 income also gets the qualified business income (QBI) deduction: 20% of it (less half the self-employment tax), up to 20% of taxable income. Above $201,750 of taxable income ($403,500 joint) in 2026 it shrinks, and the app assumes a business with no employees or property, where it reaches $0 by $276,750 ($553,500 joint); from 2026 it is at least $400. Each 1099 row asks **Qualifies for the QBI deduction?** (yes by default): most self-employment income does; a 1099 paid by a former employer, or what is really investment income, doesn't. Only the qualifying rows count.
- **Social Security** (below): one row per person.
- **Pension** (below): a monthly amount.
- **Other**, a yearly amount, of one of four kinds: taxable as ordinary income (for example Pre-tax withdrawals); tax-exempt; interest, non-qualified dividends and short-term gains (ordinary rates, and investment income for the Net Investment Income Tax); or qualified dividends and long-term gains (the 0%, 15% and 20% rates, stacked on top of ordinary income).

A yearly row runs from now until its owner retires, or for life when it starts at or after retirement. To change that, **Set start/end ages**: the ages of the row's owner when it is received, both included (part-time work in early retirement, a rental that ends). A blank start age means from now; a blank end age means until retirement, or for life for a row that starts at or after it. For someone already retired, a row with blank ages counts for life (rent, interest, an annuity), except earnings: a retiree's part-time work needs an end age.

The tax and conversion calculators read the income received this year. The projection reads every row in the years its ages cover: earnings (taxed with payroll tax), ordinary income such as rent or an annuity, interest and qualified dividends, each taxed as its kind, and tax-exempt income as cash (it doesn't yet count toward Social Security taxability or IRMAA, as it does by law). Before retirement, income beyond today's paycheck is extra (see **Income above what is needed** in Assumptions); earnings that end before retirement are taken as lower spending, not drawn from savings. After the first death, the deceased's earnings stop and their other income goes on. Dividends from the taxable accounts are worked out from the accounts, not entered here.

### Social Security

One row per person. A person with no Social Security row has no benefit of their own (a spousal benefit can still come from the other spouse's). Three ways to set the benefit:

- **From earnings:** a simplified estimate from this year's earnings, treated as a lifetime average. It can overstate the benefit for someone who earned less earlier in their career. For a precise figure, use the person's statement from ssa.gov.
- **Enter the PIA:** the benefit at full retirement age (the primary insurance amount), the monthly amount on the SSA statement, in today's dollars. The benefit at the chosen claiming age is worked out from it: reduced for each month before full retirement age, increased for each month after it, up to 70.
- **Currently receiving:** for someone already collecting, the monthly check as received today (before any Medicare premium is taken out), in today's dollars. It counts as entered from this year on, at any age, with no adjustment for a claiming age. Because the PIA behind it isn't known, it adds no spousal benefit for the other spouse; it is taken to include any spousal benefit the person already receives.

With an estimate or a PIA, a married couple's spousal benefit is worked out from both people's benefits: up to half the other spouse's benefit at full retirement age, when that is more than their own.

**Claim at** (not asked when currently receiving): the age benefits start, 62 to 70. Left at "At retirement", benefits start at the retirement age (held within 62 to 70). Once claimed, the benefit counts in the tax and conversion calculators this year (up to 85% of it is taxable, depending on other income), and in every year of the projection.

### Pension

The **monthly benefit** as the plan states it at its start (for a pension already being paid, what is paid now), the **age it starts**, any **cost-of-living increase** each year, and, for a couple, the **survivor's share**. It counts in every calculator, as ordinary income:

- the tax and conversion calculators, once it has started;
- the projection, each year from its start;
- the Roth vs. Pre-tax comparison, at the retirement-year snapshot (or its first year, when it starts later): one more source under the withdrawal, like Social Security, so it can raise the effective rate on the withdrawal.

Like everything else, it is counted in today's dollars: a pension with no cost-of-living increase loses value each year at the inflation rate. For a couple, after the owner's death the survivor receives the survivor's share of it (see Survivor years).

The row also holds the **lump sum offered** instead, if any, and **In the plan**: the monthly benefit (the default) or the lump sum. Taken as a lump sum, the pension pays nothing in any calculator; the lump sum is rolled over to the owner's Pre-tax IRA in the year they reach the start age (or is a Pre-tax account today, when that age has passed). The Roth comparison counts a later rollover as Pre-tax money today, worth the lump sum discounted at the return to its start. The pension calculator weighs the first pension row's two options either way.

## Contributions

What is saved each year, or being considered: one row per contribution, with whose it is, Roth, Pre-tax or taxable, the account (401(k) or IRA) and the amount a year. These are the Future Contributions that the Roth vs. Pre-tax comparison is about (the Roth page keeps that name).

- Each person has their own IRS limit, including the catch-up from 50 (and the higher one at 60 to 63). Anything over the limit goes to a taxable account instead.
- A 401(k) row can carry the **employer's contribution**, entered one of two ways: a **match** (for example 100% of what is deferred, on deferrals up to 4% of W-2 pay; 50% up to 6% is another common formula) or a **flat amount** a year. The match is figured on the row's amount as entered, up to the IRS limit. Employer money goes into the person's Pre-tax 401(k) each year they work, even when their own savings are Roth, so it builds Pre-tax balances and future required minimum distributions. It is not taxed when paid in and doesn't come out of take-home pay. Employee deferrals (not counting the catch-up) plus the employer's contribution are held to the overall plan limit, $72,000 in 2026. Roth employer contributions, which some plans now allow, are not modeled.
- Pre-tax contributions are deducted from this year's income in the tax and conversion calculators.
- For now, each person's Roth and Pre-tax rows need to be one type and one account type (all Roth, or all Pre-tax, in one kind of account); a mix shows an error. Taxable contribution rows are kept but left out of the Roth vs. Pre-tax comparison.

## Existing Accounts

What is already saved today: one row per account, or per group of accounts, with its type and balance.

- **Pre-tax** (traditional 401(k), IRA): withdrawals are taxed as ordinary income, and required minimum distributions apply.
- **Roth:** withdrawals are tax-free.
- **Taxable** (a brokerage account): set its **cost basis**, the share of today's balance that is money put in rather than gains (50% by default). Only gains are taxed when money comes out, at the capital-gains rates. The account also pays dividends every year, which are taxed in the year they are paid; reinvested, they add to the cost basis. Set its **dividends a year** when you know them (a share of the balance), or leave it at the assumption (**Dividends on taxable accounts**, 1.3% by default). The accounts are the only source of these dividends: the tax calculator counts this year's, and the projection every year's. An **Other** income row of qualified dividends is for dividends from outside the listed accounts, so nothing is counted twice. Everything else the account earns from here on is gain.

When the spouse isn't entered separately, accounts marked as theirs count as yours.

## Liabilities

Debts as they stand today: a mortgage, car loan, student loan, credit card or other debt, each with its balance, interest rate (as a percent, like 6.5) and monthly payment.

No calculator reads these yet. A debt pay-off calculator, and each debt's payments running to its payoff date in the projection, come in a later phase. Until then, debt payments that will end before retirement go under Spending.

## Deductions

**Itemized deductions:** one yearly total of mortgage interest, state and local taxes (up to the cap), charitable gifts and any other itemized deductions. When it is larger than the standard deduction, it is used instead, this year and in every year of the projection, in today's dollars. Someone who itemizes loses the extra standard deduction at 65 but keeps the senior deduction. Left blank, the standard deduction applies.

## Spending

- **Debt payments that will end by retirement** and **other expenses that will end by retirement** (for example private school or college), each a year.
- **Expected retirement lifestyle:** spending in retirement compared with today, from 40% lower to twice as much.

Together they set the **retirement income number**, the after-tax income the household is planning to live on: today's take-home pay, minus the costs that end, minus what is being saved, times the lifestyle setting.

## Assumptions

- **Expected annual investment return,** after inflation, the same for every account.
- **Return in retirement:** the return once no one in the household works (for a couple, from the year the last one retires), for example for a more conservative mix; by default the same as before. The projection uses each return in its own years, and the pension calculator compares the pension with the return in retirement, since a lump sum is invested then. The Roth comparison grows savings only up to that point, so it uses the return before retirement.
- **Inflation** (2.5% by default). Brackets and limits rise with inflation by law, so in today's dollars they stay put. Some thresholds are fixed dollar amounts in the law and don't rise: Social Security taxability, the Net Investment Income Tax, the Additional Medicare Tax and the senior deduction's phase-out. At this rate they shrink, in today's dollars, the further ahead the year.
- **Age 65+ deductions in retirement:** the additional standard deduction at 65, and the senior deduction ($6,000 each, phased out above $75,000 of income, $150,000 joint), which is law for 2025 to 2028 only.
- **Medicare IRMAA surcharges:** from 65, Medicare Part B and Part D premiums carry a surcharge when income two years earlier was above a threshold. The projection charges it each year; the tax and conversion calculators show the effect of this year's income.
- **Tax rates in retirement (what-if):** points added to every ordinary bracket in retirement years. Current law has no scheduled change.
- **Tax a Pre-tax contribution saves today:** across the whole contribution (a deduction that crosses a bracket edge saves the higher rate only on the part above it), or at the marginal rate.

- **Income above what is needed:** some years bring in more than spending, tax and savings use (an RMD larger than the need, rent or part-time work in retirement, Social Security plus a pension; before retirement, income beyond today's paycheck). **Save it** (the default) reinvests it in a taxable account; **spend it** raises spending in those years. The projection's year table shows each year's amount.
- **Spending after the first death** (a couple only): the survivor's spending as a share of the couple's, 80% by default (see Survivor years).
- **Dividends on taxable accounts:** the qualified dividends a taxable account pays each year, as a share of its balance, 1.3% by default (about what a broad stock index fund pays). They are part of the expected return, not added to it, and they are taxed every year rather than only when shares are sold, at the capital-gains rates (plus the Net Investment Income Tax at higher incomes). This "tax drag" is why a taxable account grows more slowly than a Roth or Pre-tax account at the same return. Until anyone in the household retires, the account pays the tax out of the dividends and reinvests the rest. Once anyone has retired, the year's withdrawals cover the tax, and the dividends count toward Social Security taxability, MAGI and IRMAA. The Roth comparison taxes them while saving at today's rate on the next dollar of dividends, and treats the dividends inside each retirement withdrawal as fully taxable. Stock funds only for now: bond interest, taxed as ordinary income, comes with a later setting for the portfolio's mix.
- **Withdrawal strategy in retirement:** which accounts pay for spending each year (and any Roth conversions), in the projection and the Roth page's lifetime comparison.
- **Tax rate for heirs** on inherited Pre-tax money, used only for the after-tax ending balance.

## Each calculator's own inputs

Two calculators have an input only they read, shown first on their own page:

- **Roth conversion:** the amount to convert this year.
- **Pension:** the household's first pension income row, with its lump sum and which one the plan takes; a change there changes it everywhere. A household without a pension gets an **Add a pension** button.

## Saving and sharing

- **Clear inputs** (on the Clients card when signed in, else on the dashboard's Inputs card and the inputs page) empties the form for a new client: no people's ages, income, savings or spending; the assumptions keep their defaults. **Undo** brings the household back. A saved household is never changed by it until it is saved over.
- **Saved households:** signed-in advisors can save the household under a short name, open it later, save changes over it, or save it as a new one. An "Unsaved changes" marker shows when the household on screen differs from the saved one. During testing, name households with initials or a nickname rather than a client's name.
- **Copy link to this household** puts every input into a link. Tick **View only** and the link opens locked, with an **Edit a copy** button.
- **Copy summary** copies the inputs and every calculator's headline, with the link, as plain text for an email or a note.

## Older households and links

Households saved, and links made, before the inputs page are converted when opened, and every calculator gives the same results as before, with one exception. A Social Security benefit entered as a known yearly amount becomes the benefit at full retirement age that gives that amount at its claiming age. Because that figure now also counts toward a spouse's spousal benefit, a couple can see a spousal benefit the older version never gave.

Households saved before the inputs were regrouped (October 2026) are converted too: each person's Social Security becomes their Social Security row; "Social Security already received" becomes that person's benefit, claimed at their age now; interest and qualified dividends become Other income of that kind; the projection's end age becomes your plan-to age; and a pension offer that was filled in becomes a pension row. A pension now counts in every calculator, so a household with one sees different numbers.

Links to the original public calculator open as a one-person household.
