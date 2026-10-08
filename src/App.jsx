// The site: the calculators (src/next/NextApp.jsx: the homepage, the inputs page and each
// calculator), the Docs and the Visualization page, and "Send feedback" at the foot of every page.
// Since the switchover at the end of round 2's phase 1, the calculators are the whole site; the
// earlier single Roth vs. Pre-tax calculator is gone, and its links open here (lib/route.js
// canonicalHash; its share links open as a one-person household, lib/householdLink.js).
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import NextApp from './next/NextApp.jsx';
import Feedback from './components/Feedback.jsx';
import { canonicalHash, routeFromHash } from './lib/route.js';
import { docsLocation } from './lib/docs.js';
import './App.css';

// Pages other than the calculators load when first opened.
const ScenariosPage = lazy(() => import('./components/ScenariosPage.jsx'));
const DocsPage = lazy(() => import('./components/DocsPage.jsx'));

// The page from the URL hash; an older address is rewritten in place first. Opening a Docs
// heading ("#/docs/<article>/<heading>") scrolls to it once the article has loaded; any other
// change of page starts at the top.
function useRoute() {
  const read = () => {
    if (typeof window === 'undefined') return '';
    const now = window.location.hash;
    const canonical = canonicalHash(now);
    if (canonical !== now) window.history.replaceState(null, '', canonical || window.location.pathname + window.location.search);
    return canonical;
  };
  const [hash, setHash] = useState(read);
  const route = routeFromHash(hash);
  const location = route === 'docs' ? docsLocation(hash) : null;
  const section = location?.section ?? null;
  const article = location?.article ?? '';
  const firstRender = useRef(true);

  useEffect(() => {
    const onHashChange = () => setHash(read());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const first = firstRender.current;
    firstRender.current = false;
    if (!section) {
      if (!first && route !== 'app') window.scrollTo(0, 0);
      return undefined;
    }
    // The article loads on demand: wait for the heading (about two seconds of frames), then scroll.
    let frame;
    let tries = 0;
    const scrollToHeading = () => {
      const heading = document.getElementById(section);
      if (heading) heading.scrollIntoView();
      else if (tries++ < 120) frame = requestAnimationFrame(scrollToHeading);
    };
    scrollToHeading();
    return () => cancelAnimationFrame(frame);
  }, [route, section, article]);

  return { route, hash };
}

export default function App() {
  const { route, hash } = useRoute();
  return (
    <div className={route === 'app' ? 'page calc-page' : 'page'}>
      {/* The calculators stay mounted (just hidden) while the Docs or the Visualization page is
          open, so the household on screen and the open sections are all still there on return. */}
      <div hidden={route !== 'app'}>
        <NextApp />
      </div>

      <Suspense fallback={<p className="hint">Loading&hellip;</p>}>
        {route === 'scenarios' && <ScenariosPage />}
        {route === 'docs' && <DocsPage hash={hash} />}
      </Suspense>

      {/* On every page. */}
      <footer className="site-footer">
        <Feedback />
      </footer>
    </div>
  );
}
