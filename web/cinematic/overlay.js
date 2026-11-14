// What the globe may draw, derived from the public session snapshot only.
//
// Allowed inputs: snapshot.grid (dimensions), snapshot.phase, snapshot.activeCell (the playhead),
// snapshot.guesses (the player's selections) and the per-cell outcomes the integration layer hands to the
// reveal callback. Nothing here reads cell readings, plans, event ids or transport state.

const OUTCOMES = new Set(["correct", "incorrect", "missed"]);

const inGrid = (cell, rows, cols) => Array.isArray(cell) && cell.length === 2 &&
  Number.isInteger(cell[0]) && Number.isInteger(cell[1]) &&
  cell[0] >= 0 && cell[0] < rows && cell[1] >= 0 && cell[1] < cols;

/** Accept a reveal batch only if every entry is valid and unique; otherwise draw none of it. */
export function sanitizeOutcomes(outcomes, rows, cols) {
  if (!Array.isArray(outcomes)) return [];
  const seen = new Set();
  const clean = [];
  for (const entry of outcomes) {
    const { row, col, outcome } = entry ?? {};
    if (!inGrid([row, col], rows, cols) || !OUTCOMES.has(outcome)) return [];
    const key = row * cols + col;
    if (seen.has(key)) return [];
    seen.add(key);
    clean.push({ row, col, outcome });
  }
  return clean;
}

export function overlayModel(snapshot, outcomes = []) {
  const { rows = 0, cols = 0 } = snapshot?.grid ?? {};
  const revealed = snapshot?.phase === "reveal";
  return {
    rows,
    cols,
    active: inGrid(snapshot?.activeCell, rows, cols) ? [snapshot.activeCell[0], snapshot.activeCell[1]] : null,
    selected: (snapshot?.guesses ?? []).filter((cell) => inGrid(cell, rows, cols)).map(([row, col]) => [row, col]),
    // Outcomes exist only after Reveal; before it nothing is tinted, whatever the caller passes.
    outcomes: revealed ? sanitizeOutcomes(outcomes, rows, cols) : [],
  };
}
