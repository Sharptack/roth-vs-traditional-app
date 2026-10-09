# Roth or Traditional? How to Think About It, and How This Calculator Does

*Educational only. This is not personalized tax or financial advice. See the disclaimer at the end.*

Every retirement saver eventually hits the same fork. You can put money into a **Traditional (Pre-tax)** account, where you get a tax break now and pay tax when you withdraw. Or you can use a **Roth** account, where you pay tax now and withdraw tax-free later.

The two are more alike than they look. In a simplified world, the decision comes down to one comparison:

> **Is your tax rate today higher or lower than your tax rate in retirement?**

If it's higher today, the Traditional deduction is worth more than the tax you'll pay later, so Traditional wins. If it's lower today, paying tax now is the bargain, so Roth wins. If they're the same, it's a wash.

The tricky part is knowing which "tax rate" to compare. This calculator's answer is *marginal now, effective later*. It is a specific choice, so here is why. (The [tax rates article](#/docs/rates) sets out the three rates the calculators use: the marginal rate, the average tax rate and the effective marginal rate.)

Two terms come up throughout. Your **Future Contributions** are the savings you'll make from now until retirement: the money this decision is about. Your **Existing Accounts** are the retirement and investment balances you already have. The calculator grows both to retirement and keeps them separate, because the Roth-or-Traditional choice only changes the first, while the second shapes the tax bracket your withdrawals land in. Your total portfolio at retirement is the two added together.

## Tax saved now, effective rate later

**Marginal rate** is the tax bracket your last dollar of income falls in. When you make a Pre-tax contribution, that dollar comes off the top of your income, so the deduction saves you tax at your marginal rate: a saver in the 22% bracket saves 22 cents per dollar contributed. That's the "now" side of the comparison, **tax saved now**.

By default the calculator goes one step further and measures the tax saved **across the whole contribution**: the tax with the contribution deducted, against the tax without it. That is the marginal rate while the whole contribution sits inside one bracket, and a little less when a large contribution crosses into the bracket below (a $20,000 deduction with $10,000 of it in the 22% bracket saves 22% on that part and 12% on the rest, about 17%). It also counts anything else the deduction changes, such as a larger qualified business income deduction. An assumption switches back to the plain marginal rate. (If your savings don't all fit under the IRS contribution limit, see "Why maxing out changes the math" below: the leftover money builds a taxable account of its own, and tax saved now nets out whatever that account will owe later.)

**Effective rate** is the blended rate across a whole chunk of income, not one dollar. In retirement, your Future Contributions come out as one withdrawal — 4% of the account's projected value each year — and that withdrawal is taxed across whatever brackets it lands in, on top of everything else you already have coming in. The **effective rate on the account withdrawal** is the extra tax that withdrawal causes, divided by the withdrawal itself. That's the rate this decision actually turns on.

### Why a blended rate later isn't a contradiction

Federal income tax is *progressive*. Your first dollars of taxable income are taxed at 10%, the next slice at 12%, the next at 22%, and so on. No one pays their top rate on everything.

So the calculator uses two kinds of rate on purpose:

- Today, we ask what the contribution's deduction saves. That's a marginal question, answered at the marginal rate.
- In retirement, the withdrawal from your Future Contributions is a block of income stacked on top of Social Security, your Existing Accounts, and — once the IRS limit is exceeded — the taxable account each scenario built along the way. We ask what that whole block costs in tax. That's an average across the block, answered with an effective rate.

These fit together. The effective rate on the account withdrawal is the extra tax caused by that withdrawal, divided by its size. It is still an incremental measure, since it counts only the tax that wouldn't exist without this withdrawal, everything it sets off included (Social Security made taxable, gains pushed into a higher rate). It just averages over the whole block instead of looking at its next dollar.

**A simple example.** Take a single filer earning $100,000 (2026 rules), with no Social Security and no other accounts, retiring at 65. After the $16,100 standard deduction, their top bracket is 22%, so a Pre-tax dollar saves 22 cents; they save $10,000 Pre-tax. Grown at 7% for 30 years, that becomes about $944,600, and a 4% withdrawal from it is about $37,800 a year. After the standard deduction and the extra $2,050 for being 65, that withdrawal is spread across the 10% and 12% brackets, so the tax on it works out to about $2,110, or **5.6%** of the withdrawal. That's a lot less than 22%. Here Traditional wins, because deducting at 22% and paying back at 5.6% is a good trade.

## How the calculator estimates your retirement tax rate

Many tools ask you to guess your retirement tax bracket. Guessing is hard, and small guesses swing the answer. This calculator builds the estimate from a budget instead, working top-down:

1. Start with your household's take-home pay today: gross income minus federal income tax **and payroll tax**. For W-2 income that's FICA (Social Security and Medicare). For 1099 income it's self-employment tax, which is roughly double because you pay both halves, though half of it is deductible before income tax (and 1099 income also gets the qualified business income deduction). Payroll tax comes out of every paycheck but stops when you stop working, so it isn't part of the lifestyle you need to replace. If your savings are Pre-tax, they come off your income before income tax is figured (up to the IRS limit); itemized deductions, when they're more than the standard deduction, and the child tax credit count too.
2. Subtract costs that will end before you retire: debt payments, kids' college or private school.
3. Subtract what you save for retirement.
4. What's left is your **retirement income number**, the after-tax lifestyle you're already living without those costs.

For a couple, "retirement" is the year the **last** of you retires. Each of you contributes until your own retirement; the savings of whoever retires first keep growing, untouched, until then.

Then it works out your retirement tax rate in three steps, always on the withdrawal that will actually happen — never on a hypothetical amount sized to hit some target:

1. **What's already there.** Social Security (estimated from earnings, or worked out from the benefit at full retirement age you enter, with any spousal benefit) plus your Existing Accounts, each grown to retirement at your expected return and drawn at 4% a year. Pre-tax money is taxed as ordinary income, Roth is tax-free, and a taxable-account withdrawal is part cost basis (the money you put in, which comes back tax-free) and part gain, in proportion to the account. You set how much of today's taxable balance is basis (50% by default); everything it earns from here on is gain. Only the gain is taxed, as long-term capital gain at the real 0% / 15% / 20% capital-gains rates — not a flat rate. Those rates stack on top of your ordinary income, the same way tax brackets do, so a withdrawal can be partly or fully tax-free when your other retirement income is modest, and a bigger withdrawal can push a taxable-account withdrawal into a higher capital-gains bracket. At higher incomes the gain also owes the 3.8% Net Investment Income Tax, on whichever is smaller: the gain, or the amount your modified adjusted gross income is over $200,000 ($250,000 filing jointly). Pre-tax withdrawals and taxable Social Security aren't investment income themselves, but they count toward that threshold, so they can expose more of your gains to it. This is the income your Future Contributions' withdrawal will land on top of.
2. **The difference between the two scenarios.** If your Future Contributions fit entirely under the IRS contribution limit, there's nothing to add here: a Roth saver and a Traditional saver cost the same take-home pay and end up with no separate taxable account. If they don't, the money that wouldn't fit builds a taxable account of its own (see "Why maxing out changes the math" below), and the Roth and Traditional scenarios end up holding *different amounts* there, taxed the same way as any other taxable-account gain. This step works out the tax rate on that difference.
3. **Add the Traditional account's own withdrawal, and re-do the tax.** Your Future Contributions, grown to retirement and drawn at 4% a year, are added on top of everything above, and the tax is calculated again. The extra tax this withdrawal causes, divided by the withdrawal itself, is the effective rate on the account withdrawal. (The Roth account's own withdrawal never enters this calculation, because it's tax-free — it only ever affects Step 2, by changing how much smaller the Roth scenario's taxable account is.)

The retirement year is taxed under today's law, in today's dollars, with three assumptions you can change: the extra standard deduction at 65 (and the senior deduction while it lasts, through 2028), the fixed-dollar thresholds the law never raises for inflation (Social Security taxability, the Net Investment Income Tax) shrinking at the inflation rate until then, and an optional what-if that moves every bracket up or down.

The result is a retirement tax rate that comes from your own numbers, moves as you change them, and is always measured on the size of withdrawal your Future Contributions will actually produce.

## The Social Security phase-in

This is the least intuitive part of retirement taxes. Some retirees face a higher marginal rate than their nominal bracket suggests.

Social Security benefits are only partly taxable. Whether they're taxed depends on your "combined income," which is your other income plus half of your Social Security benefit. For a single filer:

- Below $25,000 of combined income, none of your benefit is taxed.
- Between $25,000 and $34,000, up to 50% of it can be taxed.
- Above $34,000, up to 85% can be taxed.

(For married couples filing jointly the lines are $32,000 and $44,000. These thresholds are set by law and haven't been adjusted for inflation since the 1980s and 1990s, so more retirees cross them every year.)

The catch is what happens inside those ranges. Every extra dollar you withdraw from a Traditional account also pulls 50 cents, and then 85 cents, of your Social Security benefit into taxable income. One dollar of withdrawal becomes $1.50, or $1.85, of income to be taxed.

**Example.** A single retiree collects $50,000 in Social Security and already has $30,000 of other taxable income. They are in the 12% bracket. Now they withdraw another $1,000 from a Traditional account. That $1,000 pulls an extra $850 of benefits into taxable income, so $1,850 is taxed at 12%. That comes to $222, an effective marginal rate of **22.2% on a dollar that "should" have been taxed at 12%.**

The calculator doesn't use a lookup table for this. It runs the actual IRS combined-income formula every time, so the bump appears wherever it belongs in your situation, and it disappears once the 85% cap is reached. (The tax calculator's two buckets show the same bump across every level of income.)

This is also why the "effective rate on the account withdrawal" can look surprisingly high, even higher than your bracket, when your other retirement income puts you just past a threshold. The **"How are these rates calculated?"** dropdown on the Roth page shows the three-step arithmetic behind it: how much Social Security the withdrawal pulls into taxable income, how your Existing Accounts (and any taxable account from exceeding the IRS limit) are taxed first, and how much capital-gains tax the withdrawal adds by pushing gains into a higher bracket. The rate is always measured on the withdrawal that actually happens — 4% of your Future Contributions' projected value — never on a hypothetical amount sized to some target, so it stays the same no matter how your retirement income number changes.

## Years without Social Security

You may have years in retirement without Social Security, for example if you retire before you claim benefits, or you may simply want to plan without it. The Roth page shows that case in a dropdown under the after-tax comparison table. It sets Social Security to zero and re-runs the same three-step calculation, so the comparison uses exactly the same measure as the main result: the effective rate on the account withdrawal, just without the Social Security phase-in.

Removing Social Security can only remove tax, never add it, so this rate is never higher than the rate in the main result — the difference between the two is the effect of Social Security itself. Without that phase-in pulling the rate up, this view usually favors Traditional a little more strongly than the main result does. The main way it can still favor Roth is a large Traditional balance in your Existing Accounts: if that balance's own 4% withdrawal already lands in a high bracket, it sets the floor everything else stacks on top of, whether or not Social Security is in the picture.

## If you expect to spend more, or less, in retirement

The retirement income number assumes you'll live in retirement the way you live now. That won't always be right. If you're early in your career and expect your earnings, and your spending, to rise, your retirement budget may be well above today's. The reverse happens too: a paid-off home or a planned downsize can mean spending less in retirement. Under **Spending**, the expected retirement lifestyle runs from 40% lower to 100% higher than today's, and the calculator scales the retirement income number to match.

This changes how much you need in retirement, and — further down the page — how much the *total portfolio* comparison has to draw and tax from your whole portfolio (Existing Accounts included) to deliver it, since that comparison scales its withdrawals to your target. It does **not** change the rate comparison at the top of the page: that rate is measured on your Future Contributions' own natural 4% withdrawal, a fixed dollar amount that doesn't grow or shrink with your chosen lifestyle.

That is the general point: **a spending plan on its own doesn't decide Roth vs. Traditional. How much taxable income you'll have in retirement does.** Spending more only matters when something pays for it. If you expect to earn more later, that shows up in retirement in two ways: bigger savings from the higher-earning years and a bigger Social Security benefit. Both sit underneath today's contributions when they're withdrawn, so today's contributions can land in a higher bracket than your current income suggests, which favors Roth now. One condition: this only happens if those later savings are Pre-tax. If they go to Roth, they come out tax-free, Social Security alone rarely fills the low brackets, and today's contributions are still better off Traditional. The Visualization page charts both cases. Anything else that adds taxable retirement income works the same way, most of all a large existing Pre-tax balance.

Something else the calculator doesn't model: if your earnings rise, the contributions you make in those later years would be deducted at a higher marginal rate than today's, which would tilt further toward Traditional for that income. Contributions are level from now until retirement.

## Why maxing out changes the math

Everything above assumes Roth and Traditional cost you the same out of your paycheck. The calculator handles that by converting between them. At a 22% marginal rate, a $10,000 Pre-tax contribution costs the same take-home pay as a $7,800 Roth contribution.

But the IRS limit is a limit on *dollars in the account*, not on take-home cost. In 2026 the 401(k) limit is $24,500 for both types. At that limit:

- A Roth contribution puts $24,500 of after-tax money to work.
- A Traditional contribution puts $24,500 of pre-tax money to work, and at 22% that is only worth about $19,110 after tax.

The Traditional saver keeps about $5,390 in take-home pay that the Roth saver didn't: the tax the deduction saved. The fair comparison is the Traditional contribution *plus* that $5,390 invested in a regular taxable account, against the Roth contribution alone. That's what the calculator does. The taxable money earns the same return, but its dividends are taxed every year while it grows (1.3% a year by default, at your capital-gains rate today; see **Dividends on taxable accounts** in the inputs), so it grows a little more slowly. Everything put in is cost basis, and so are the reinvested dividends after their tax, so only the rest of its growth is taxed when it comes out, at the real capital-gains rates stacked on top of your other retirement income; the dividends in each year's withdrawal are taxed whole. It counts as part of your Future Contributions everywhere in the results. Even so, Roth tends to hold up better at the limit than the plain rate comparison suggests, because the taxable account gives up the tax-free (or tax-deferred) treatment.

If you're 50 or older, your limit is higher than the base figure above: the IRS lets you add a catch-up contribution on top, and if you're 60 through 63 specifically, an even bigger one under a newer rule. The calculator applies whichever one you qualify for automatically, based on your current age. Each spouse has their own limit and catch-up.

The calculator **warns you when your savings are at or near the limit** (90% or more). The same rule covers every case: both sides cost the same take-home pay, only the amount under the limit goes into the account, and whatever that take-home pay would have bought beyond the limit goes to a taxable account instead. That applies when you enter more than the limit allows (the extra can't legally go into the account), and when you're at the limit with Roth savings and the Traditional equivalent won't fit (the tax it saves is invested instead). The results show how much of your Future Contributions ends up in that taxable account.

## Who can contribute to what

The comparison assumes both choices are open to you. Sometimes one isn't, and the Roth page says so in a **Who can contribute** note:

- **Roth IRA income limits.** Above a modified AGI range ($153,000 to $168,000 single, $242,000 to $252,000 joint, in 2026), a direct Roth IRA contribution shrinks, then isn't allowed. (A "backdoor" Roth, a nondeductible Traditional IRA contribution converted to Roth, is outside this calculator.)
- **Traditional IRA deductions.** For someone covered by a workplace retirement plan (or whose spouse is), the deduction phases out with income ($81,000 to $91,000 single and $129,000 to $149,000 joint when covered, $242,000 to $252,000 when only the spouse is). A contribution that can't be deducted isn't Pre-tax.
- **The Roth catch-up rule.** From 2026, someone whose wages last year were over $150,000 must make 401(k) catch-up contributions as Roth, so only the base limit can be Pre-tax. The note says so; the comparison doesn't apply it to the numbers yet.

## Why your Existing Accounts matter

Deciding where to put *new* contributions is only half the story. You may already have a large Pre-tax balance from earlier years or from an employer, and that balance is already shaping your retirement tax bracket, whatever you decide today.

That's why the calculator's total future portfolio comparison looks at your whole portfolio. It builds two versions of your future:

- **All-Roth**: your Future Contributions go to Roth.
- **All-Pre-tax**: they go to Traditional.

Both versions include your Existing Accounts grown to retirement. For each, the calculator finds the withdrawals needed to deliver your retirement income number after tax, drawing from every account in proportion to its size, and reports what share of each portfolio that takes each year.

Two things to keep in mind when reading it:

1. **Bigger portfolio vs. higher tax is the whole question.** The Pre-tax scenario invests the tax it saves today, so it ends up with a bigger portfolio, and pays tax on the way out. The table holds your lifestyle fixed and shows the withdrawal rate each portfolio needs to fund it. The lower rate wins: that portfolio does the same job with less strain on your money. This can differ from a comparison at a flat 4% withdrawal. If your lifestyle only needs you to draw about 2% a year, those smaller withdrawals land in lower tax brackets than a 4% draw would, which can favor the Pre-tax portfolio.
2. **The withdrawal method is simplified.** Real retirees often choose *which* accounts to draw from first to keep taxes low. This comparison draws proportionally from all of them (the year-by-year projection compares other orders).

## Over a lifetime, year by year

The comparisons above look at one retirement year. Below them, the Roth page runs both choices through the year-by-year projection, from today to the end age: Social Security starting at its claiming ages, required minimum distributions, Medicare IRMAA, and the withdrawal strategy the projection page uses. It reports how much steady after-tax spending each choice supports, lifetime tax, and what's left for heirs (with Pre-tax money taxed at their rate), and finds how far tax rates in retirement would have to move to change the answer. Because RMDs can push later withdrawals into higher brackets, the lifetime answer can differ from the first-year one; the first-year rates still lead the page.

## The likely answer is often "some of each"

We compared the two as pure extremes: all Roth or all Traditional. For many people the best answer is a **split**, taking the deduction at high current rates while filling up low retirement brackets with Roth money, so no bracket is over-used in either period. The reason a split can win is that the effective rate on the Traditional part rises as that part grows, because a bigger withdrawal climbs further through the brackets. The best mix is where the rate on the next Traditional dollar would reach, or jump past, the tax it saves today. The **Splitting your contribution** card on the Roth page works that mix out for you, at the same take-home cost. A split is also a sensible hedge when the result is close or you're unsure.

## Working with the answer

- **Compare a change** opens a second copy of the household beside the first. Change anything in it, and the page shows what changed and every result side by side; "Use these as my inputs" keeps the change.
- **In the plan** shows what the household's plan saves today and which way the comparison leans, with a button that switches the plan's Future Contributions to the other type at the same take-home cost (for example $10,000 Pre-tax to $7,800 Roth). Every other calculator reads the plan, so they follow the choice. Pressing it again switches back.

## What this calculator doesn't capture

These matter, and a good decision should weigh them.

**You can convert later, but only in one direction.** Traditional money can be converted to Roth in a low-income year, such as after you retire and before Social Security or required withdrawals begin. You pay tax on the converted amount at that low rate. There's no equivalent move from Roth back to Traditional. That flexibility is a real point in Traditional's favor. The Roth conversion calculator and the projection's conversion strategies look at it; this comparison doesn't build it in.

**The risks of guessing wrong are lopsided.** If you choose Traditional and your retirement rate turns out higher than expected, you overpay some tax, but you're holding a larger pile that conversions can help manage. If you choose Roth at a fixed budget, your account is smaller, because the same paycheck buys fewer Roth dollars than Traditional ones. If your retirement rate turns out lower than you guessed, you've paid tax at a higher rate on a smaller pile, and the shortfall is hard to make up. This isn't a math result, just something to weigh alongside the estimate.

**Estates.** Roth accounts have no required withdrawals for the original owner, and heirs generally receive Roth money tax-free while inherited Traditional money is taxable to them. The lifetime comparison counts heirs' tax at a flat rate; the 10-year rule for inherited accounts isn't modeled.

**Employer matching.** In most plans, the employer match goes into a Traditional account regardless of whether your own contributions are Roth or Traditional. (Recent law lets plans offer a Roth match, but few do.) So even a committed Roth saver often builds a Traditional balance without meaning to. This calculator doesn't model the match yet.

**Other simplifications.** Federal tax only, no state income tax. Dollars are today's, and the expected return is a return after inflation. A simplified Social Security estimate unless you enter the benefit from your SSA statement. Each person's Roth and Pre-tax savings must be one type in one kind of account for now. Contributions are level from now until retirement, with no raises.

## Disclaimer

This article and the accompanying calculators are for **educational purposes only**. They are **not tax, legal, or financial advice** and don't account for your full situation. Tax law changes, the calculators rely on simplifying assumptions, and their results are estimates, not predictions. Before making decisions about your retirement accounts, consider talking with a qualified tax professional or financial advisor.
