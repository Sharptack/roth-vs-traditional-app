# CLAUDE.md

Client-side React (Vite) app for financial advisors (owner: Michael Sharpnack): calculators on one household model
(tax, Roth vs. Pre-tax, Roth conversion, pension, IRMAA, a year-by-year projection), Supabase sign-in with saved
households, and Docs (`#/docs`, one article per feature in `articles/`; each must match actual behavior). Internal
advisor tool: advisor-level density is fine; desktop-first (phone must not break).

**Status and plan: the "Current status" section at the top of `docs/roadmap.md`.** Read it at the start of a task.
Record each decision the user makes in the roadmap (with the date and reason). Run `/closeout` to finish a phase.
Elsewhere: `docs/code-map.md` (file by file), `docs/dev-setup.md` (devices, Netlify, UI checks),
`docs/roadmap-archive.md` (finished phases and decisions: grep before re-deciding), `docs/ideas.md` (unscheduled ideas:
read when adding one or choosing what to build), `docs/history.md` (round one).

## Ground rules
1. **Math first:** data + pure functions in `src/lib` → unit tests with **hand-verified** arithmetic (worked out BEFORE
   running the code, kept in comments) → only then UI. When code and hand math disagree, find out which is wrong.
2. Financial logic is pure and framework-free in `src/lib/`; year-keyed data in `src/data/` (`getYearData` picks the
   latest year <= the one requested). Old hand-calc tests pin `year: 2025`/`2026`.
3. Results change only on purpose: a change to existing numbers is one the user decided (record it in the roadmap).
   New engine options default to today's results; `tests/householdV1Pins.test.js` changes by additions only.
4. Pages in `src/next/`, shared components in `src/components/`, math in `src/lib/`.
5. Don't push or publish without the user's say-so. Report failures and skipped steps plainly.
6. `npm test` and `npm run lint` before committing. One logical change per commit. End commit messages with the
   `Co-Authored-By:` line for the Claude model in use.

## Conventions
- Rate terms: **marginal rate** = the bracket; **average tax rate** = total tax ÷ total income (never "effective rate"
  alone for it); **effective marginal rate (EMTR)** = the real tax on the next dollar. See `articles/rates.md`.
- Everything in TODAY's dollars (real return; brackets indexed by law); fixed-dollar thresholds shrink at the inflation
  input via `thresholdScale`.
- Each phase ends with its Docs article (listed in `src/lib/docs.js`).

## Commands
```
npm run dev       # dev server, port 5173
npm test          # vitest (4 workers); 855 tests
npm run lint      # ESLint with the React hooks rules
npm run build     # static site -> dist/
```

## Code map (details: docs/code-map.md)
`src/lib/yearTax.js` = the ONE tax engine · `compare.js` = the Roth page · `projection.js` = the year loop ·
`householdV2.js` = form values → household · `src/next/NextApp.jsx` = the pages · `src/App.jsx` = routes ·
`supabase/` = backend.

## Deployment
- Repo https://github.com/Sharptack/roth-vs-traditional-app (**public**), branch `main`; Netlify builds each push to
  `main` (live: https://astonishing-sprite-b5d581.netlify.app/).
- **A build costs 15 Netlify credits (~20/month):** commit locally, push in batches only when the user asks, and say
  when commits are unpushed. Claude can push from the Windows laptop; on the Mac the user pushes.
- Windows: PowerShell 5.1 has no `&&`; Git Bash is available.
