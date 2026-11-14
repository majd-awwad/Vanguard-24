const isCell = (cell) =>
  Array.isArray(cell) && cell.length === 2 && Number.isInteger(cell[0]) && Number.isInteger(cell[1]);
const keyOf = ([row, col]) => `${row},${col}`;

function unique(cells) {
  const seen = new Map();
  if (!Array.isArray(cells)) return [];
  for (const cell of cells) if (isCell(cell)) seen.set(keyOf(cell), [cell[0], cell[1]]);
  return [...seen.values()];
}

const ratio = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);

/**
 * Grades guesses against the truth cells of one level.
 *
 * - hits: distinct guesses that are truth cells.
 * - nearHits: distinct non-hit guesses within `tolerance` cells (Chebyshev distance) of a truth cell.
 *   They are forgiven (not false alarms) but not credited as hits.
 * - misses: truth cells that were not guessed exactly.
 * - falseAlarms: distinct guesses that are neither hits nor near hits.
 * Duplicates and malformed pairs are ignored. No field is ever NaN: a zero denominator gives 0,
 * except that empty truth with empty guesses is a perfect score (precision = recall = f1 = 1).
 */
export function scoreGuesses(truth, guesses, { tolerance = 0 } = {}) {
  const radius = Number.isFinite(tolerance) && tolerance > 0 ? Math.floor(tolerance) : 0;
  const present = unique(truth?.present);
  const guessed = unique(guesses);
  const presentKeys = new Set(present.map(keyOf));
  let hits = 0;
  let nearHits = 0;
  for (const guess of guessed) {
    if (presentKeys.has(keyOf(guess))) {
      hits++;
    } else if (radius > 0 && present.some(([row, col]) =>
      Math.max(Math.abs(row - guess[0]), Math.abs(col - guess[1])) <= radius)) {
      nearHits++;
    }
  }
  const misses = present.length - hits;
  const falseAlarms = guessed.length - hits - nearHits;
  const bothEmpty = present.length === 0 && guessed.length === 0;
  const precision = bothEmpty ? 1 : ratio(hits, hits + falseAlarms);
  const recall = bothEmpty ? 1 : ratio(hits, hits + misses);
  const f1 = ratio(2 * precision * recall, precision + recall);
  return { hits, misses, falseAlarms, precision, recall, f1, nearHits };
}
