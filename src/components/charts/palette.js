// Fixed categorical color + shape order, assigned by series identity (never by
// rank), matching the app's light/dark CSS custom properties in App.css.
export const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
];

// Secondary (non-color) identity channel for the scatter, whose points can sit
// next to any other point (not just an adjacent series in a legend order).
export const SERIES_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross'];
