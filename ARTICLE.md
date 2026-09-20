# Roth or Traditional? How to Think About It, and How This Calculator Does

*Educational only. This is not personalized tax or financial advice. See the disclaimer at the end.*

Every retirement saver eventually hits the same fork. You can put money into a **Traditional (Pre-tax)** account, where you get a tax break now and pay tax when you withdraw. Or you can use a **Roth** account, where you pay tax now and withdraw tax-free later.

The two are more alike than they look. In a simplified world, the decision comes down to one comparison:

> **Is your tax rate today higher or lower than your tax rate in retirement?**

If it's higher today, the Traditional deduction is worth more than the tax you'll pay later, so Traditional wins. If it's lower today, paying tax now is the bargain, so Roth wins. If they're the same, it's a wash.

The tricky part is knowing which "tax rate" to compare. This calculator's answer is *marginal now, effective later*. It is a specific choice, so here is why.

## Marginal now, effective later

**Marginal rate** is the tax on your *next* dollar of income. When you make a Pre-tax contribution, that dollar comes off the top of your income, the last dollar you'd have been taxed on. So the deduction saves you tax at your marginal rate. A saver in the 22% bracket saves 22 cents per dollar contributed. That's why the calculator uses the marginal rate for "now."

**Effective rate** is the blended rate across a whole chunk of income. In retirement you don't withdraw one dollar; you withdraw enough to live on, and that amount gets taxed across several brackets.

### Why a blended rate later isn't a contradiction

Federal income tax is *progressive*. Your first dollars of taxable income are taxed at 10%, the next slice at 12%, the next at 22%, and so on. No one pays their top rate on everything.

So the calculator uses two kinds of rate on purpose:

- Today, we ask what one more dollar of deduction saves. That's a marginal question, answered with the marginal rate.
- In retirement, the withdrawal from this account is a block of income stacked on top of your other retirement income. We ask what that whole block costs in tax. That's an average across the block, answered with an effective rate.

These fit together. The effective rate in retirement is the extra tax caused by this account's withdrawal, divided by the size of the withdrawal. It is still an incremental measure, since it counts only the tax that wouldn't exist without this withdrawal. It just averages over the whole block instead of looking at its last dollar.

**A simple example.** Take a single filer earning $100,000 (2026 rules). After the $16,100 standard deduction, their top bracket is 22%, so a Pre-tax dollar saves 22 cents. Take-home pay is about $79,200 after $13,200 of income tax and $7,650 of FICA, and they save $10,000 of that, so they need about $69,200 a year after tax in retirement. Suppose that all comes from one Traditional account and nothing else. That takes a withdrawal of roughly $77,400. After the standard deduction, that income is spread across the 10%, 12% and 22% brackets, so the tax works out to about $8,200, or **10.6%** of the withdrawal. It's a lot less than 22%. Here Traditional wins, because deducting at 22% and paying back at 10.6% is a good trade.

## How the calculator estimates your retirement tax rate

Many tools ask you to guess your retirement tax bracket. Guessing is hard, and small guesses swing the answer. This calculator builds the estimate from a budget instead, working top-down:

1. Start with your take-home pay today: gross income minus federal income tax **and FICA** (the Social Security and Medicare payroll taxes). FICA comes out of every paycheck but stops when you stop working, so it isn't part of the lifestyle you need to replace.
2. Subtract costs that will end before you retire: debt payments, kids' college or private school.
3. Subtract what you save for retirement.
4. What's left is your **retirement income number**, the after-tax lifestyle you're already living without those costs.

Then it asks what it would take to produce that much after-tax income in retirement:

- Your other accounts (Pre-tax, Roth, taxable) are grown to your retirement age at your expected return, and 4% of each is drawn as income. Pre-tax money is taxed as ordinary income, Roth is tax-free, and taxable-account withdrawals are taxed at a flat assumed 15% capital gains rate.
- Social Security comes next, either the benefit you enter or a simplified estimate.
- Finally, a search finds how much has to come out of *this* account to fill the remaining gap. The tax on that withdrawal, stacked on everything else, gives the effective rate.

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

This is also why the "effective rate in retirement" can look surprisingly high, even higher than your bracket, when your other retirement income puts you just past a threshold. The **"How is the effective rate calculated?"** dropdown in the calculator shows the arithmetic step by step, including how much Social Security the withdrawal pulls into taxable income. One caveat: the rate is measured on the withdrawal needed to close the gap between your other income and your target, and then applied to the whole account. If your account is much larger than that gap, part of it would be taxed outside the phase-in range, at a lower blended rate, so the calculator can lean a little toward Roth in those cases.

## Why maxing out changes the math

Everything above assumes Roth and Traditional cost you the same out of your paycheck. The calculator handles that by converting between them. At a 22% marginal rate, a $10,000 Pre-tax contribution costs the same take-home pay as a $7,800 Roth contribution.

But the IRS limit is a limit on *dollars in the account*, not on take-home cost. In 2026 the 401(k) limit is $24,500 for both types. At that limit:

- A Roth contribution puts $24,500 of after-tax money to work.
- A Traditional contribution puts $24,500 of pre-tax money to work, and at 22% that is only worth about $19,110 after tax.

Roth shelters more real value at the limit. The Traditional saver does keep about $5,390 in take-home pay that the Roth saver didn't, and they could invest it in a regular taxable account, but the growth there is taxed along the way and the tax-free treatment is lost.

The calculator **warns you when your savings are at or near the limit** (90% or more) but does not yet model the fuller comparison, which would pit "Traditional plus a taxable side account" against a Roth at the same limit. That's a planned future feature. Until then, treat the Roth-vs-Traditional result as leaning too Traditional-friendly at the limit.

## Why your existing balances matter (Section 3)

Deciding where to put *new* contributions is only half the story. You may already have a large Pre-tax balance from earlier years or from an employer, and that balance is already shaping your retirement tax bracket, whatever you decide today.

That's why Section 3 compares your whole portfolio. It builds two versions of your future:

- **All-Roth**: this account's future contributions go to Roth.
- **All-Pre-tax**: they go to Traditional.

Both versions include your other balances grown to retirement. For each, the calculator finds the withdrawals needed to deliver your retirement income number after tax, drawing from every account in proportion to its size, and reports the total tax.

Two things to keep in mind when reading it:

1. **The tax difference is the cost of the same lifestyle, not a verdict.** The Pre-tax scenario also got a deduction along the way, so it starts with a bigger balance. A higher tax bill can still leave you better off if you're drawing a smaller share of your portfolio to get there. That's why the table shows the withdrawal rate needed. A lower rate means your money is under less strain.
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
