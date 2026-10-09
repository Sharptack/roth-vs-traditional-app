# Future ideas

Ideas not in the current roadmap. Read it when adding an idea or choosing what to build next; when one is scheduled, move it into a phase in `docs/roadmap.md`. New ideas go at the bottom of the matching list, with the date and who asked.

## Later release

- **Inherited accounts, both sides:** accounts the client has inherited (the 10-year rule, yearly minimums when the original owner had started RMDs, the stretch for eligible beneficiaries, the IRS Single Life Table), and heirs taxed over 10 years on what the household leaves in place of today's flat heirs' rate.
- **Staged spending, built:** from phase 3's design.
- **Life tables in the projection:** random lifespans, once Monte Carlo exists.
- **Simplified free versions** of each calculator, sharing `src/lib` and the household shape, storing nothing on a server; with round one's two questions (does the full version move behind the login; one site or two). The public calculator is replaced at the switchover (end of phase 1); simplified versions are built from the new version.
- **The simplified Roth calculator (Michael's vision, 2026-10-09):** standalone, not tied to households, one vertical column of collapsible blocks: the inputs (one block, a dropdown per category), the rates, the breakdown, then the charts and the year-by-year table.
- **Launch checklist** (docs/security.md): invitation links without tokens in the address, MFA, firm-domain sign-in, custom email sending, the compliance check, a private GitHub repo.
- **A designed PDF report** for the signed-in version.
- **A bottom-up budget calculator** feeding base spending: itemized lines (mortgage, utilities, groceries…) that fill the "Baseline expenses per year" input from phase 3, and the top-down figure (take-home minus savings) beside the budget with the gap and where it likely comes from (irregular costs: travel, car replacement, home repairs, gifts). Michael, 2026-10-09.
- **Optional:** TypeScript for new files.
- **An advanced options page** (its own round, later): see Advanced features below.

- **Today's or future dollars:** a switch on every output between today's dollars (the default) and future, nominal dollars at the inflation assumption.
- **Real estate (asked 2026-10-08):** a real estate option under assets and liabilities; a mortgage pay-off calculator that compares the home equity too; a calculator to compare buying a rental property.
- **An itemized deductions calculator (asked 2026-10-09):** charitable donations first (the tax calculator should count them), then mortgage interest, state and local taxes with the SALT cap, medical costs over the floor; it adds up to the itemized total the inputs take today, compares it with the standard deduction, and shows when bunching gifts (or a donor-advised fund) pays. Pairs with QCDs and the charitable legacy goal.

## Advanced features (a later round)

The main rollout covers the common 90% of cases and stays simple; these cover the rest, on an advanced options page with its own phased plan.

- **Early-withdrawal penalties:** the 10% penalty before 59½, and the ways around it (the rule of 55, 72(t) payments), plus the Roth five-year rules on earnings and conversions. Not modeled today: the projection lets anyone draw any account at any age.
- **Qualified charitable distributions (QCDs):** from 70½, giving straight from an IRA counts toward the RMD and is never taxed. Definitely wanted; pairs with the charitable legacy goal (phase 3).
- **Tax-exempt interest:** untaxed itself, but it counts in the Social Security taxability formula and in IRMAA's MAGI.
- **QBI above the income threshold:** the wage, property and business-type limits.
- Head of household filing status: its brackets, standard deduction and the thresholds that depend on filing status (asked 2026-10-08).
- The Earned Income Tax Credit and its phase-out: earning more reduces the credit, so a dollar is taxed and loses credit at once, a high effective marginal rate for lower earners (asked 2026-10-08).
- Others noted along the way: HSAs, itemized deductions in detail (mortgage interest, charitable gifts, state and local taxes and the SALT cap, line by line; phase 1 adds one total), state tax.

## From the "Before phase 3" review (2026-10-09)

- A left sidebar with icons: Dashboard at the top, then Inputs, Decisions, Evaluations, each with its pages under it; Settings at the bottom (settings to be worked out). A UI step after this list.
- Net worth statement, and net worth over time: a new phase after phase 11 (it needs liabilities).
- Conversions in later years on the conversion calculator (today: one conversion this year).
- Non-qualified pensions on the pension calculator (rare; not planned).
- The simplified Roth calculator: see Later release.
