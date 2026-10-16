// The guardrails' background worker (phase 9): one piece of the work at a time, as asked by
// useGuardrails.js. 'cloud': the spending each path sustains at a scale of today's balances;
// 'scales': each path's needed scale at a spending; 'table': one year's table for the rule;
// 'rule': paths under the rule.
import { requiredScales, rulePaths, ruleTableYear, spendingCloud } from '../lib/guardrails.js';

self.onmessage = ({ data }) => {
  const { id, kind, household, from, to, volatility } = data;
  let out;
  if (kind === 'cloud') out = spendingCloud(household, data.scale, { from, to, volatility, guesses: data.guesses });
  else if (kind === 'scales') out = requiredScales(household, data.spending, { from, to, volatility, guesses: data.guesses });
  else if (kind === 'table') out = ruleTableYear(household, data.spending, data.t, { volatility });
  else out = rulePaths(household, data.spending, data.tables, { from, to, volatility, settings: data.settings });
  self.postMessage({ id, out });
};
