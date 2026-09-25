// Display formatting. Pure functions; no React.

// Whole dollars by default ("$12,345"); pass decimals = 1 for "$12,345.6".
export function formatCurrency(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Number(Math.abs(value).toFixed(decimals));
  const text = rounded.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  // Avoid "-$0" for tiny negatives that round to zero.
  return value < 0 && rounded !== 0 ? `-$${text}` : `$${text}`;
}

// 0.1219 -> "12.2%"
export function formatPercent(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

// 2.3073 -> "2.31×"
export function formatMultiple(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)}×`;
}

// A value by kind: 'currency' | 'percent' | 'bracket' (whole-number rate) | 'text'.
export function formatValue(value, format) {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return formatPercent(value);
  if (format === 'bracket') return formatPercent(value, 0);
  return value ?? '';
}

// A change between two values: "+$14,070", "−$500", "+2.0 pts", "+2 pts".
// Rates change by percentage points. Zero shows as "no change".
export function formatDelta(delta, format) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return '';
  const points = format === 'percent' || format === 'bracket';
  const decimals = format === 'bracket' ? 0 : 1;
  const size = points ? Math.abs(delta * 100).toFixed(decimals) : Math.abs(delta).toFixed(0);
  if (Number(size) === 0) return 'no change';
  const sign = delta > 0 ? '+' : '−';
  return points ? `${sign}${size} pts` : `${sign}${formatCurrency(Math.abs(delta))}`;
}
