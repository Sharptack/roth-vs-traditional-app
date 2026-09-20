# Roth vs. Pre-Tax Retirement Contribution Calculator

A client-side React (Vite) app that estimates whether a Roth or Pre-tax (Traditional) contribution
leaves you with more after-tax wealth, using a bracket-aware, budget-driven tax model. There is no
backend: `npm run build` produces static files that any static host can serve.

Estimates only — not tax or financial advice. See [ARTICLE.md](ARTICLE.md) for how the calculator
works, in plain language. The app serves that same file as its own "How this works" page
(`#/how-it-works`), so edit ARTICLE.md to change it.

## Commands

```bash
npm install      # once
npm run dev      # local dev server with live reload
npm test         # unit tests (calculation layer + component smoke tests)
npm run build    # static site in dist/
npm run preview  # serve the built dist/ locally
```

## Layout

- `src/data/` — tax brackets, FICA, Social Security and contribution-limit data, keyed by year.
  To add a year, copy the 2025 object in each file and edit the numbers.
- `src/lib/` — all financial logic as pure functions, with no React. `compare.js` orchestrates.
- `src/components/`, `src/App.jsx` — the UI.
- `tests/` — unit tests; hand-verified scenarios are commented with their arithmetic.

## Deploying

Build command `npm run build`, output directory `dist`. The build uses relative asset paths, so it
works from any URL or sub-path. `netlify.toml` already contains these settings.
