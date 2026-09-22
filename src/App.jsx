import { useEffect, useMemo, useRef, useState } from 'react';
import ArticlePage from './components/ArticlePage.jsx';
import InputForm from './components/InputForm.jsx';
import ResultsSummary from './components/ResultsSummary.jsx';
import { compareRothVsTraditional } from './lib/compare.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from './lib/formInputs.js';
import { ARTICLE_HASH, routeFromHash } from './lib/route.js';
import './App.css';

/*
 * Future enhancements (explicitly out of scope for this version)
 *
 * - "Maxing out" side-account comparison, the subtler half of the limit story:
 *   when contributing AT the IRS limit (no excess), model the after-tax value
 *   of (Traditional contribution + the tax SAVINGS from that deduction invested
 *   in a taxable side account) against a Roth contribution at the same limit.
 *   (Contributing MORE than the limit is now handled: the excess is modeled as
 *   flowing into a taxable account automatically — see compare.js's
 *   contributionSplit / splitAtContributionLimit.)
 * - Optimal split between Roth and Traditional ("straddling brackets"), rather
 *   than only comparing the pure extremes.
 * - Tax-efficient withdrawal sequencing across accounts (vs. the simplified
 *   proportional withdrawal used in the total portfolio comparison).
 * - State income tax.
 * - Full SSA benefit calculation (35-year indexed earnings history).
 * - RMD age rules.
 * - Employer match modeling: the match amount, and the match-optimization math
 *   when Roth contributions alone can't capture the full match.
 * - Contributions that change over time (e.g. raises).
 * - Graphs / charts.
 * - PDF client report export.
 * - A backend (saved scenarios, client database, user accounts).
 * - A Simple/Advanced mode split.
 * - Access control for any future internal-only features.
 */

const CURRENT_YEAR = new Date().getFullYear();

// Which page to show, from the URL hash ("#/how-it-works" = the article). Remembers the
// calculator's scroll position so coming back from the article puts you where you were.
function useRoute() {
  const [route, setRoute] = useState(() =>
    typeof window === 'undefined' ? 'calculator' : routeFromHash(window.location.hash),
  );
  const calculatorScroll = useRef(0);
  const firstRender = useRef(true);

  useEffect(() => {
    const onHashChange = () => {
      const next = routeFromHash(window.location.hash);
      if (next === 'article') calculatorScroll.current = window.scrollY;
      setRoute(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, route === 'article' ? 0 : calculatorScroll.current);
  }, [route]);

  return route;
}

export default function App() {
  const [values, setValues] = useState(DEFAULT_FORM_VALUES);
  const route = useRoute();

  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  // Results update live: recomputed on every input change, no submit button.
  const result = useMemo(
    () => compareRothVsTraditional(toCompareInputs(values, CURRENT_YEAR)),
    [values],
  );

  return (
    <div className="page">
      {/* The calculator stays mounted (just hidden) while the article is open, so your
          inputs, open dropdowns and scroll position are all still there when you return. */}
      <div hidden={route !== 'calculator'}>
        <header className="page-header">
          <h1>Roth vs. Pre-Tax Calculator</h1>
          <p>
            Which retirement contribution leaves you with more after-tax wealth? Change any number
            below and the results update right away.
          </p>
          <p className="header-links">
            <a href={ARTICLE_HASH}>How this works &rarr;</a> The reasoning behind the numbers, in
            plain language.
          </p>
          <p className="disclaimer">Estimates only — not tax or financial advice.</p>
        </header>

        <main>
          <InputForm values={values} onChange={handleChange} />
          <ResultsSummary result={result} />
        </main>

        <footer className="page-footer">
          <a href={ARTICLE_HASH}>How this works</a>
        </footer>
      </div>

      {route === 'article' && <ArticlePage />}
    </div>
  );
}
