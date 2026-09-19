// Resolves a requested year against a year-keyed data table (see src/data/*).
//
// Returns the entry for the latest year <= the requested year. If the requested
// year is earlier than anything in the table, the earliest entry is used. This
// means the app keeps working (using the newest data on file) after the calendar
// rolls over but before a new year's data has been added.
//
// Returns { year, data } where `year` is the year the data actually belongs to,
// so callers can show the user which year's rules were applied.
export function getYearData(table, requestedYear) {
  const years = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (years.length === 0) throw new Error('Data table is empty');
  if (!Number.isFinite(requestedYear)) {
    throw new Error(`Invalid year: ${requestedYear}`);
  }
  let resolved = years[0];
  for (const y of years) {
    if (y <= requestedYear) resolved = y;
  }
  return { year: resolved, data: table[resolved] };
}
