# Dev setup, devices and deployment details

`CLAUDE.md` has the rules; this file has the details.

## Devices
- Home Intel Mac and a Windows 11 laptop (PowerShell 5.1: no `&&`; Git Bash available). One device at a time: pull
  before starting.
- Pushing: on the Windows laptop Claude can push (`gh` signed in); on the home Mac the user pushes (VS Code Sync Changes).
- New device: clone → `npm install` (Node 20.19+/22.12+) → `.env.local` from `.env.example` (Supabase URL + anon key;
  never the service_role key) → `npm test` → `npm run dev`.
- Git identity (repo-local, both devices): Michael Sharpnack <sharpnackm7@gmail.com>. Line endings: LF everywhere
  (`.gitattributes`).
- `npm test` runs 4 vitest workers; more ran the Windows laptop out of memory.

## Netlify
- A production build costs 15 credits (free plan 300/month, about 20 builds). Skipped builds, branch deploys and form
  submissions are free.
- `netlify.toml`'s `ignore` rule skips builds when no site file changed (src, index.html, public, package files,
  vite.config.js, articles, netlify.toml). Add any new folder the site imports from.
- Feedback: "Send feedback" on every page goes through Netlify Forms (the hidden form in `index.html`; Netlify's form
  detection must be on).
- Dev server port 5173 is allowed in Supabase's redirect URLs.

## Annual tax-law update
`docs/annual-update.md`. Every yearly table is listed in `src/data/yearlyTables.js`; `tests/yearlyTables.test.js` fails
from January 1 until each has the new year's figures.

## Checking the UI
Headless Chrome via the DevTools protocol (Node's built-in WebSocket; no puppeteer): launch with
`--remote-debugging-port`, navigate, evaluate, `Page.captureScreenshot`. Windows: `C:/Program Files/Google/Chrome/
Application/chrome.exe`. The calculators stay mounted (hidden) behind the Docs and Visualization routes, so scope
selectors (e.g. `.next-app`). Set React inputs with the native value setter + an input event.

## Paused (the user, 2026-10-07/08)
Security launch items (`docs/security.md`), gating and free/simple versions (see `docs/ideas.md`).
