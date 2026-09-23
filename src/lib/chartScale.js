// Small, framework-free helpers for hand-rolled SVG charts. No React, no data
// knowledge — just numbers in, numbers/pixels out.

// Maps a domain [d0, d1] onto a pixel range [r0, r1]. Works for reversed ranges
// (e.g. y domains, where r0 > r1 because SVG y grows downward).
export function linearScale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1; // avoid divide-by-zero when every value is equal
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

// "Nice" round numbers a human would put on an axis, spanning at least [min, max].
// Standard nice-number tick algorithm (as used by D3 and most charting libraries).
function niceNumber(range, round) {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let niceFraction;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }
  return niceFraction * 10 ** exponent;
}

export function niceTicks(min, max, count = 5) {
  if (min === max) return [min];
  const step = niceNumber((max - min) / Math.max(count - 1, 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    // Round away binary-floating-point noise (e.g. 0.6000000000000001).
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}
