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
