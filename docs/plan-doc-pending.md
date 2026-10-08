# Plan doc updates waiting to be written

Updates for the Round 2 plan doc (https://claude.ai/artifact/DQyr9BcgMUKAkxpue1SmNU) that couldn't be written
because the Claude Docs connector was unavailable. When it's back: write each item into the doc, then delete it
from this file (delete the file when it's empty). Newest last.

## 2026-10-08: Phase 0 step (a) done; decisions from 2026-10-07 and 2026-10-08

Where: the Phase 0 section (status line), and a new table "Decisions, fourth set (Michael, 2026-10-07/08)" after the
third set, before the open items.

Phase 0 status line, under "Size":
- Step (a) done 2026-10-08: the version 2 household and the conversion. The preview's calculators run on the
  version 2 household; version 1 households, saves and links open with the same results (one decided change,
  Social Security, below). The form, saving and links switch to version 2 in step (b).

Decisions, fourth set:

| Question | Decision |
| --- | --- |
| Social Security input | Each person: "estimate from earnings" (needs no PIA) or enter the PIA (monthly, at full retirement age). The spousal top-up is worked out from both PIAs either way. |
| Version 1 "known benefit" | Converts to the PIA that gives the same benefit at its claiming age. Because a PIA counts for the spousal top-up, a couple with a known benefit can gain a top-up version 1 never gave (example: $42,000 → $59,062.50). |
| Debt payments that end | Stay a spending field for the retirement income number. Liabilities (balance, rate, payment) are separate rows; converted households start with none. |
| Age or birthdate | Either can be entered; typing a birthdate sets the age, typing an age clears the birthdate. A birthdate gives the exact birth year; the calculators use the age reached this calendar year. |
| Income rows' ages | First and last age received, both included. Blank first age = from now; blank last age = until the owner retires. |
| The tax calculator's other income | Converts to income rows for this year only, so the projection is unchanged until a later phase reads them. |
| Snapshot retirement year | Stays "when the first person retires" for now; switching to the last is a phase 1 change. |
