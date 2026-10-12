# The year-by-year planner

The planner shows the whole plan one row per year and lets you change single years: convert $40,000 to Roth in 2029, nothing in 2031, stop the 401(k) from 2030 on. Each change goes straight into the plan. For each year it shows what is left in the tax bracket and before the next Medicare IRMAA tier, what a conversion would cost that year, and what it is worth over the whole plan. The [year-by-year projection](#/docs/projection) stays the quick view; its whole-plan withdrawal strategies are unchanged. Everything is in today's dollars.

## Using it

**Your changes** leads the page: each change in words, with Remove, and all of them together against the plan with none (the household's inputs as entered). Below it, **Year by year** is the projection's table, with the conversions, contributions, the bracket and MAGI in view, and a ● on each year with a change. Click a year to open it:

- **The year in brief:** the bracket it is in and the room left before the next one; the IRMAA tier this year's income sets (for the premium two years on) and the room before the next tier; the most Pre-tax money that can be converted that year.
- **Add a Roth conversion:** the amount (and, for a couple, whose Pre-tax money). As you type, the page shows its cost that year and what it is worth over the plan; **Add to the plan** puts it in.
- **Suggested:** the conversions that fill the year's bracket, fill the next bracket too, or go up to just under the next IRMAA tier, each with its cost and value, and an **Add** button.
- **Change a contribution:** any contribution row of someone still working that year, to a new amount, for that year only or from that year on.
- **Changes in this year,** each with its value and Remove.
- **What makes up the year:** the year's income, withdrawals, taxes and accounts, line by line (as on the projection page).

The figures for a year come from whole runs of the plan, so they take about a second after the click; the page shows "Working out…" until then.

## The room in a year

**The bracket.** The room is how much more ordinary taxable income fits before the next bracket starts. The conversion that fills it is found on the year itself, by running the year with more and more converted: a conversion can pull Social Security into tax with it (up to 85 cents of benefits per dollar converted), so filling $10,000 of room can take less than $10,000 of conversion.

**Medicare IRMAA.** The surcharge on Medicare Part B and D premiums is set by income two years earlier, so a year's income matters for IRMAA when someone will be 65 or older two years on (and IRMAA is included in Assumptions). The room is how much more MAGI fits in the tier that year's income is in. The tiers are cliffs: one dollar over costs the whole step, for every person on Medicare.

An example. A 66-year-old, single, with $500,000 in Pre-tax money and no Social Security yet, spends $30,000 a year after tax. To net $30,000 they withdraw $31,613.64: taxable income is $31,613.64 − $16,100 = $15,513.64, tax $1,613.64. That is in the 12% bracket, which runs to $50,400 of taxable income, so the room is **$34,886.36**, and with no Social Security to pull in, converting exactly that fills it. The 22% bracket runs to $105,700: filling it too takes $90,186.36.

## A conversion's cost

**Cost that year** is the year's federal income tax with the conversion minus without it, so everything it pulls along counts: Social Security made taxable, gains pushed out of the 0% rate, the Net Investment Income Tax, the senior deduction phasing out. Then add the IRMAA surcharge it adds two years on. The rate shown is that tax ÷ the amount converted.

In the example, converting $34,800 (the room, rounded down to $100) costs 12% × $34,800 = **$4,176**. Converting $90,100 costs 12% × $34,886.36 + 22% × $55,213.64 = **$16,333.36**, 18.1% of the amount.

At 70 with $1,000,000 Pre-tax and IRMAA included, the same $31,613.64 of income leaves $109,000 − $31,613.64 = **$77,386.36** before the first IRMAA tier (single, 2026 amounts). Converting $80,000 crosses it: the premium two years on carries the first tier's surcharge, ($81.20 + $14.50) × 12 = **$1,148.40** for one person, on top of $14,111.36 of tax.

**Who pays the tax.** Once anyone has retired, a taxable account pays it: more is withdrawn from it (and any gain on that is taxed too). When there is no taxable account, or it runs short, the rest is held back from the conversion, so less reaches Roth. While everyone still works, it is held back from the conversion. The withdrawals for spending are the same with and without the conversion. This is the rule for every conversion in the app (decided 2026-10-12). In the first example there is no taxable account, so the $4,176 is held back and $30,624 reaches Roth.

## What a change is worth

Three figures, each the plan with the change minus the plan without it, every other change kept:

- **Sustainable spending:** the highest steady after-tax spending the plan supports to its end, leaving any legacy goal (as on [Retirement spending](#/docs/spending)).
- **Lifetime tax:** federal income tax plus IRMAA, every year.
- **For heirs, after tax:** what is left at the end, with Pre-tax money at the heirs' rate (and a charity's share, if any, taken from Pre-tax first).

A conversion usually raises the tax now and lowers it later; whether it pays shows in all three together. A conversion taxed at 12% that heirs would have paid 24% on adds about 12% of it for them. **All of them, against the plan with none** is the same three figures for every change together.

## The suggestions

Up to three for the year, each worked out on that year alone, rounded down to $100 (so it stays inside the edge), smallest first:

- **Fill the bracket** the year is in.
- **Fill the next bracket too.**
- **Up to the next IRMAA tier** (when IRMAA applies): the most that keeps this year's income in its tier.

Each shows its cost that year and its three lifetime figures. Once one is added, the year's room and suggestions are worked out again from there.

## Changing a contribution

A change sets one contribution row's amount for one year, or from that year on. For the same row, the change from the latest year wins; in its own year, a one-year change wins over one from that year on. The employer's match follows the changed amount, so cutting a 401(k) to $0 gives up the match too. Only rows of someone still working that year can change. Removing a contribution row on the inputs page removes its changes.

## Where the changes count

The changes are part of the plan: they are saved with the household and carried by share links, and every page that runs the plan includes them, saying so at the top: the projection, Retirement spending, Pre-retirement funding, the Roth conversion calculator's lifetime view, Social Security's plan effect and the Roth vs. Pre-tax lifetime comparison. Two exceptions: the Roth vs. Pre-tax comparison sets the contributions itself, so only the conversions count there; and Pre-retirement funding's savings-needed search scales the contribution rows as entered (its two funded levels include every change).

## Not modeled

- **A conversion in the plan's first year and IRMAA:** the projection takes the two years before it to have the first year's income, so a conversion this year also raises this year's and next year's surcharge there, though those premiums were set by tax returns already filed. The cost shown (the surcharge two years on) is right; the lifetime tax counts the two earlier years too.
- The five-year rules on withdrawing converted money, and the 10% penalty before 59½ on tax held back from a conversion.
- State tax.
- Other changes for a year (an extra withdrawal, an extra expense, a different retirement year) are candidates for later.
