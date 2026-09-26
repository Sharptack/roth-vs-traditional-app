import { useEffect, useMemo, useRef, useState } from 'react';
import ArticlePage from './components/ArticlePage.jsx';
import InputForm from './components/InputForm.jsx';
import ResultsSummary from './components/ResultsSummary.jsx';
import ScenarioCompare from './components/ScenarioCompare.jsx';
import ScenariosPage from './components/ScenariosPage.jsx';
import ShareInputs from './components/ShareInputs.jsx';
import { compareRothVsTraditional } from './lib/compare.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from './lib/formInputs.js';
import { valuesFromSearch } from './lib/shareInputs.js';
import { ARTICLE_HASH, SCENARIOS_HASH, routeFromHash } from './lib/route.js';
import './App.css';

/*
 * Future enhancements (explicitly out of scope for this version)
 *
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
 * - A wider range of pre-set scenarios on the "Visualization" page (#/scenarios) —
 *   it currently covers income, savings rate, existing balances, age, and
 *   retirement lifestyle, each swept one at a time; married filing jointly and
 *   1099 income aren't represented there yet.
 * - Taxable-account "tax drag": ongoing tax on dividends/interest and any
 *   turnover-driven gains during the GROWTH phase (distinct from the capital-
 *   gains tax already modeled at withdrawal), which lowers the account's
 *   effective compounding rate. Discussed with the user 2026-09-22 and
 *   explicitly deferred — highly holding-dependent (roughly 0.1-0.5%/year for
 *   a low-turnover index fund, 1%+ for higher-turnover or bond-heavy
 *   holdings), so if built, keep it as its own adjustable, clearly-labeled
 *   assumption on the taxable bucket only — never folded into returnRate.
 * - PDF client report export.
 * - A backend (saved scenarios, client database, user accounts).
 * - A Simple/Advanced mode split.
 * - Access control for any future internal-only features.
 */

const CURRENT_YEAR = new Date().getFullYear();

// A shared link ("Copy inputs to share") carries the inputs in its query string.
const FROM_LINK =
  typeof window === 'undefined' ? { values: null, compareValues: null } : valuesFromSearch(window.location.search);

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
      if (next !== 'calculator') calculatorScroll.current = window.scrollY;
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
    window.scrollTo(0, route === 'calculator' ? calculatorScroll.current : 0);
  }, [route]);

  return route;
}

export default function App() {
  const [values, setValues] = useState(FROM_LINK.values ?? DEFAULT_FORM_VALUES);
  // "Compare a change": a second copy of the inputs to edit (null = not comparing). The main
  // inputs are the baseline. Kept in memory only, so a reload clears it.
  const [compareValues, setCompareValues] = useState(FROM_LINK.compareValues);
  const route = useRoute();

  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));
  const handleCompareChange = (name, value) => setCompareValues((prev) => ({ ...prev, [name]: value }));

  // Results update live: recomputed on every input change, no submit button.
  const current = useMemo(() => {
    const inputs = toCompareInputs(values, CURRENT_YEAR);
    return { inputs, result: compareRothVsTraditional(inputs) };
  }, [values]);
  const changed = useMemo(() => {
    if (!compareValues) return null;
    const inputs = toCompareInputs(compareValues, CURRENT_YEAR);
    return { inputs, result: compareRothVsTraditional(inputs) };
  }, [compareValues]);

  return (
    <div className={compareValues ? 'page wide' : 'page'}>
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
          <p className="header-links">
            <a href={SCENARIOS_HASH}>Visualization &rarr;</a> See the rate gap charted across a
            range of income, savings, and balance scenarios.
          </p>
          <p className="disclaimer">Estimates only — not tax or financial advice.</p>
        </header>

        <main>
          <div className={compareValues ? 'input-columns' : undefined}>
            <InputForm
              values={values}
              onChange={handleChange}
              title={compareValues ? 'Your inputs (baseline)' : undefined}
            />
            {compareValues && (
              <InputForm
                values={compareValues}
                onChange={handleCompareChange}
                title="With a change"
                baseValues={values}
                namePrefix="compare-"
              />
            )}
          </div>
          <ScenarioCompare
            baseline={current}
            current={changed}
            onStart={() => setCompareValues({ ...values })}
            onReset={() => setCompareValues({ ...values })}
            onAdopt={() => {
              setValues(compareValues);
              setCompareValues(null);
            }}
            onStop={() => setCompareValues(null)}
            share={<ShareInputs values={values} compareValues={compareValues} year={CURRENT_YEAR} />}
          />
          <ResultsSummary result={current.result} />
        </main>

        <footer className="page-footer">
          <a href={ARTICLE_HASH}>How this works</a>
          {' · '}
          <a href={SCENARIOS_HASH}>Visualization</a>
        </footer>
      </div>

      {route === 'article' && <ArticlePage />}
      {route === 'scenarios' && <ScenariosPage />}
    </div>
  );
}
