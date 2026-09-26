# Roth or Traditional? How to Think About It, and How This Calculator Does

*Educational only. This is not personalized tax or financial advice. See the disclaimer at the end.*

Every retirement saver eventually hits the same fork. You can put money into a **Traditional (Pre-tax)** account, where you get a tax break now and pay tax when you withdraw. Or you can use a **Roth** account, where you pay tax now and withdraw tax-free later.

The two are more alike than they look. In a simplified world, the decision comes down to one comparison:

> **Is your tax rate today higher or lower than your tax rate in retirement?**

If it's higher today, the Traditional deduction is worth more than the tax you'll pay later, so Traditional wins. If it's lower today, paying tax now is the bargain, so Roth wins. If they're the same, it's a wash.

The tricky part is knowing which "tax rate" to compare. This calculator's answer is *marginal now, effective later*. It is a specific choice, so here is why.

Two terms come up throughout. Your **Future Contributions** are the savings you'll make from now until retirement: the money this decision is about. Your **Existing Accounts** are the retirement and investment balances you already have. The calculator grows both to retirement and keeps them separate, because the Roth-or-Traditional choice only changes the first, while the second shapes the tax bracket your withdrawals land in. Your total portfolio at retirement is the two added together.

## Marginal now, effective later

**Marginal rate** is the tax on your *next* dollar of income. When you make a Pre-tax contribution, that dollar comes off the top of your income, the last dollar you'd have been taxed on. So the deduction saves you tax at your marginal rate. A saver in the 22% bracket saves 22 cents per dollar contributed. That's why the calculator uses the marginal rate for "now."

**Effective rate** is the blended rate across a whole chunk of income. In retirement you don't withdraw one dollar; you withdraw enough to live on, and that amount gets taxed across several brackets.

The calculator shows two effective rates, and it's worth keeping them apart. The **effective rate on these withdrawals** is the extra tax caused by withdrawals from your Future Contributions, divided by those withdrawals. That's the rate that matters for the Roth-versus-Traditional decision. Your **overall effective rate** is simply all the tax you owe in retirement divided by all the gross income you receive, Social Security and every account included. It's usually lower, because it averages in income that's untaxed or lightly taxed.

### Why a blended rate later isn't a contradiction

Federal income tax is *progressive*. Your first dollars of taxable income are taxed at 10%, the next slice at 12%, the next at 22%, and so on. No one pays their top rate on everything.

So the calculator uses two kinds of rate on purpose:

- Today, we ask what one more dollar of deduction saves. That's a marginal question, answered with the marginal rate.
- In retirement, the withdrawal from your Future Contributions is a block of income stacked on top of Social Security and your Existing Accounts. We ask what that whole block costs in tax. That's an average across the block, answered with an effective rate.

These fit together. The effective rate on these withdrawals is the extra tax caused by the Future Contributions withdrawal, divided by the size of the withdrawal. It is still an incremental measure, since it counts only the tax that wouldn't exist without this withdrawal. It just averages over the whole block instead of looking at its last dollar.

**A simple example.** Take a single filer earning $100,000 (2026 rules). After the $16,100 standard deduction, their top bracket is 22%, so a Pre-tax dollar saves 22 cents. They save $10,000 Pre-tax, which comes off their income before income tax, so they owe about $11,000 of income tax (instead of $13,200) plus $7,650 of FICA. Take-home pay is about $81,400, and after the $10,000 they save, they live on about $71,400 a year. That's what they need after tax in retirement. Suppose that all comes from one Traditional account and nothing else. That takes a withdrawal of roughly $80,200. After the standard deduction, that income is spread across the 10%, 12% and 22% brackets, so the tax works out to about $8,800, or **11.0%** of the withdrawal. It's a lot less than 22%. Here Traditional wins, because deducting at 22% and paying back at 11.0% is a good trade.

## How the calculator estimates your retirement tax rate

Many tools ask you to guess your retirement tax bracket. Guessing is hard, and small guesses swing the answer. This calculator builds the estimate from a budget instead, working top-down:

1. Start with your take-home pay today: gross income minus federal income tax **and payroll tax**. For W-2 income that's FICA (Social Security and Medicare). For 1099 income it's self-employment tax, which is roughly double because you pay both halves, though half of it is deductible before income tax. Either way it comes out of every paycheck but stops when you stop working, so it isn't part of the lifestyle you need to replace. If your savings are Pre-tax, they come off your income before income tax is figured (up to the IRS limit), so your income tax, and the take-home pay you actually live on, reflect that.
2. Subtract costs that will end before you retire: debt payments, kids' college or private school.
3. Subtract what you save for retirement.
4. What's left is your **retirement income number**, the after-tax lifestyle you're already living without those costs.

Then it asks what it would take to produce that much after-tax income in retirement:

- Your Existing Accounts (Pre-tax, Roth, taxable) are grown to your retirement age at your expected return, and 4% of each is drawn as income. Pre-tax money is taxed as ordinary income, Roth is tax-free, and taxable-account withdrawals are treated as long-term capital gain and taxed at the real 0% / 15% / 20% capital-gains rates — not a flat rate. Those rates stack on top of your ordinary income, the same way tax brackets do, so a withdrawal can be partly or fully tax-free when your other retirement income is modest, and a bigger withdrawal from a Pre-tax account can push a taxable-account withdrawal into a higher capital-gains bracket.
- Social Security comes next, either the benefit you enter or a simplified estimate.
- Finally, a search finds how much has to come out of your *Future Contributions* to fill the remaining gap. The tax on that withdrawal, stacked on everything else, gives the effective rate.

The result is a retirement tax rate that comes from your own numbers and moves as you change them.

## The Social Security phase-in

This is the least intuitive part of retirement taxes. Some retirees face a higher marginal rate than their nominal bracket suggests.

Social Security benefits are only partly taxable. Whether they're taxed depends on your "combined income," which is your other income plus half of your Social Security benefit. For a single filer:

- Below $25,000 of combined income, none of your benefit is taxed.
- Between $25,000 and $34,000, up to 50% of it can be taxed.
- Above $34,000, up to 85% can be taxed.

(For married couples filing jointly the lines are $32,000 and $44,000. These thresholds are set by law and haven't been adjusted for inflation since the 1980s and 1990s, so more retirees cross them every year.)

The catch is what happens inside those ranges. Every extra dollar you withdraw from a Traditional account also pulls 50 cents, and then 85 cents, of your Social Security benefit into taxable income. One dollar of withdrawal becomes $1.50, or $1.85, of income to be taxed.

**Example.** A single retiree collects $50,000 in Social Security and already has $30,000 of other taxable income. They are in the 12% bracket. Now they withdraw another $1,000 from a Traditional account. That $1,000 pulls an extra $850 of benefits into taxable income, so $1,850 is taxed at 12%. That comes to $222, an effective rate of **22.2% on a dollar that "should" have been taxed at 12%.**

The calculator doesn't use a lookup table for this. It runs the actual IRS combined-income formula every time, so the bump appears wherever it belongs in your situation, and it disappears once the 85% cap is reached.

This is also why the "effective rate on these withdrawals" can look surprisingly high, even higher than your bracket, when your other retirement income puts you just past a threshold. The **"How are the retirement rates calculated?"** dropdown in the calculator shows the arithmetic step by step, and lists what sets the rate in your case: how much Social Security the withdrawal pulls into taxable income, how your Pre-tax Existing Accounts are taxed first (using up the standard deduction and the low brackets, so withdrawals from your Future Contributions start higher), and how much capital-gains tax the withdrawal adds by pushing taxable-account gains into a higher bracket. One caveat: the rate is measured on the withdrawal needed to close the gap between your target and what Social Security and your Existing Accounts provide, and then applied to all of your Future Contributions. If they are much larger than that gap, part of it would be taxed outside the phase-in range, at a lower blended rate, so the calculator can lean a little toward Roth in those cases.

## Years without Social Security

You may have years in retirement without Social Security, for example if you retire before you claim benefits, or you may simply want to plan without it. The calculator shows that case in a dropdown under the main table. It sets Social Security to zero, so your whole retirement income number has to come from your accounts. With nothing to phase in, the tax is plain brackets, and the comparison uses the same measure as the main result: the blended effective rate on withdrawals from your Future Contributions. The bracket that the last dollar falls in is shown for reference.

There's a pattern to watch for. When your Future Contributions are needed to fill the gap, your retirement income is lower than your income today, so your bracket in retirement can't be higher than your bracket now. In that case this view can only tie or favor Traditional, and the gap between it and the main result is the effect of Social Security. There are two ways Roth can come out ahead here. One is a very large Traditional balance in your Existing Accounts: if they already produce more taxable income than you need, that balance sets your bracket. The other is a higher retirement lifestyle, covered next.

## If you expect to spend more, or less, in retirement

The retirement income number assumes you'll live in retirement the way you live now. That won't always be right. If you're early in your career and expect your earnings, and your spending, to rise, your retirement budget may be well above today's, and with it your retirement bracket. That is one of the most common ways Roth wins. The reverse happens too: a paid-off home or a planned downsize can mean spending less in retirement, which lowers your retirement bracket and favors Traditional. Under **"Will you earn more or less later?"** you can choose a retirement lifestyle from 40% lower to 100% higher than today's, and the calculator scales the retirement income number to match.

One thing it doesn't do: if your earnings rise, the contributions you make in those later years will be deducted at a higher rate than today's marginal rate. That pushes toward Traditional and partly offsets the higher retirement bracket. Modeling contributions that change over time is a planned feature.

## Why maxing out changes the math

Everything above assumes Roth and Traditional cost you the same out of your paycheck. The calculator handles that by converting between them. At a 22% marginal rate, a $10,000 Pre-tax contribution costs the same take-home pay as a $7,800 Roth contribution.

But the IRS limit is a limit on *dollars in the account*, not on take-home cost. In 2026 the 401(k) limit is $24,500 for both types. At that limit:

- A Roth contribution puts $24,500 of after-tax money to work.
- A Traditional contribution puts $24,500 of pre-tax money to work, and at 22% that is only worth about $19,110 after tax.

The Traditional saver keeps about $5,390 in take-home pay that the Roth saver didn't: the tax the deduction saved. The fair comparison is the Traditional contribution *plus* that $5,390 invested in a regular taxable account, against the Roth contribution alone. That's what the calculator does. The taxable money grows at the same return, and its withdrawals are taxed at the real capital-gains rates, stacked on top of your other retirement income. It counts as part of your Future Contributions everywhere in the results. Even so, Roth tends to hold up better at the limit than the plain rate comparison suggests, because the taxable account gives up the tax-free (or tax-deferred) treatment.

If you're 50 or older, your limit is higher than the base figure above: the IRS lets you add a catch-up contribution on top, and if you're 60 through 63 specifically, an even bigger one under a newer rule. The calculator applies whichever one you qualify for automatically, based on your current age.

The calculator **warns you when your savings are at or near the limit** (90% or more). The same rule covers every case: both sides cost the same take-home pay, only the amount under the limit goes into the account, and whatever that take-home pay would have bought beyond the limit goes to a taxable account instead. That applies when you enter more than the limit allows (the extra can't legally go into the account), and when you're at the limit with Roth savings and the Traditional equivalent won't fit (the tax it saves is invested instead). The results show how much of your Future Contributions ends up in that taxable account.

## Why your Existing Accounts matter

Deciding where to put *new* contributions is only half the story. You may already have a large Pre-tax balance from earlier years or from an employer, and that balance is already shaping your retirement tax bracket, whatever you decide today.

That's why the calculator's total portfolio tax comparison looks at your whole portfolio. It builds two versions of your future:

- **All-Roth**: your Future Contributions go to Roth.
- **All-Pre-tax**: they go to Traditional.

Both versions include your Existing Accounts grown to retirement. For each, the calculator finds the withdrawals needed to deliver your retirement income number after tax, drawing from every account in proportion to its size, and reports the total tax.

Two things to keep in mind when reading it:

1. **Bigger portfolio vs. higher tax is the whole question.** The Pre-tax scenario invests the tax it saves today, so it ends up with a bigger portfolio, and pays tax on the way out. The table answers it two ways. Holding your lifestyle fixed, it shows the tax and the withdrawal rate each portfolio needs (a lower rate means less strain on your money). Holding the withdrawal fixed at 4% of every account, it shows the after-tax income each portfolio actually delivers. Whichever portfolio buys more income after tax is the one that came out ahead.
2. **The withdrawal method is simplified.** Real retirees often choose *which* accounts to draw from first to keep taxes low. This calculator draws proportionally from all of them.

## What this calculator doesn't capture

These matter, and a good decision should weigh them.

**You can convert later, but only in one direction.** Traditional money can be converted to Roth in a low-income year, such as after you retire and before Social Security or required withdrawals begin. You pay tax on the converted amount at that low rate. There's no equivalent move from Roth back to Traditional. That flexibility is a real point in Traditional's favor and it isn't in the numbers.

**The risks of guessing wrong are lopsided.** If you choose Traditional and your retirement rate turns out higher than expected, you overpay some tax, but you're holding a larger pile that conversions can help manage. If you choose Roth at a fixed budget, your account is smaller, because the same paycheck buys fewer Roth dollars than Traditional ones. If your retirement rate turns out lower than you guessed, you've paid tax at a higher rate on a smaller pile, and the shortfall is hard to make up. This isn't a math result, just something to weigh alongside the estimate.

**Required Minimum Distributions and estate planning.** Traditional accounts eventually force withdrawals at a set age, whether you need the money or not. For larger balances, that can push you into higher brackets. Roth accounts have no such requirement for the original owner, and heirs generally receive Roth money tax-free while inherited Traditional money is taxable to them. This calculator doesn't model RMD rules or estates.

**Employer matching.** In most plans, the employer match goes into a Traditional account regardless of whether your own contributions are Roth or Traditional. (Recent law lets plans offer a Roth match, but few do.) So even a committed Roth saver often builds a Traditional balance without meaning to. This calculator doesn't model the match itself or how to capture all of it.

**Other simplifications.** Federal tax only, no state income tax. FICA is the employee share on W-2 wages, and for couples the income is treated as one earner's.  No inflation: dollars are today's, and the expected return should be read as a return after inflation. A simplified Social Security estimate rather than the full SSA calculation with 35 years of earnings history. Extra standard deductions for people 65 and older aren't included. Contributions are level from now until retirement, with no raises.

## The likely answer is often "some of each"

We compared the two as pure extremes: all Roth or all Traditional. For many people the best answer is a **split**, taking the deduction at high current rates while filling up low retirement brackets with Roth money, so no bracket is over-used in either period. Finding the best mix is a planned future feature. In the meantime, the calculator's rate comparison tells you which direction to lean, and a split is a sensible hedge when the result is close or you're unsure.

## Disclaimer

This article and the accompanying calculator are for **educational purposes only**. They are **not tax, legal, or financial advice** and don't account for your full situation. Tax law changes, the calculator relies on simplifying assumptions, and its results are estimates, not predictions. Before making decisions about your retirement accounts, consider talking with a qualified tax professional or financial advisor.
