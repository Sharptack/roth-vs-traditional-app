// Monte Carlo's background worker (phase 8): runs one chunk of paths at a time, as asked by
// useMonteCarlo.js, so the page stays responsive. 'paths': each path at the spending need;
// 'income': the spending each path sustains.
import { simulatePaths, sustainableOnPaths } from '../lib/monteCarlo.js';

self.onmessage = ({ data }) => {
  const { id, kind, household, need, from, to, volatility, seed } = data;
  const out = kind === 'paths' ? simulatePaths(household, need, { from, to, volatility, seed }) : sustainableOnPaths(household, { from, to, volatility, seed });
  self.postMessage({ id, out });
};
