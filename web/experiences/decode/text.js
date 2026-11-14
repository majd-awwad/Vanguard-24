const LEVEL_WORDS = { none: "none", low: "low", moderate: "moderate", high: "high" };

/**
 * Text-only stand-in for the audio channel. It states only the overall level and a broad region,
 * never a reading, a count or a cell, so it contains no digits. `level` and `region` are stable
 * keys the interface layer can translate; `text` is the English rendering.
 */
export function describeCase(data, level) {
  const grid = data.levels[level];
  const present = grid.truth.present;
  const measured = grid.cells.filter((cell) => cell.status !== "missing").length;
  const share = measured > 0 ? present.length / measured : 0;
  const overall = present.length === 0 ? "none" : share < 1 / 3 ? "low" : share < 2 / 3 ? "moderate" : "high";
  if (overall === "none") {
    return { level: "none", region: "none", text: "No activity stands out in this area." };
  }
  const lean = (negative, positive) => {
    const difference = positive - negative;
    return Math.abs(difference) * 5 > present.length ? (difference > 0 ? 1 : -1) : 0;
  };
  let north = 0, south = 0, west = 0, east = 0;
  for (const [row, col] of present) {
    if (row * 2 + 1 < grid.rows) north++; else if (row * 2 + 1 > grid.rows) south++;
    if (col * 2 + 1 < grid.cols) west++; else if (col * 2 + 1 > grid.cols) east++;
  }
  const vertical = lean(north, south) === 0 ? "" : lean(north, south) > 0 ? "south" : "north";
  const horizontal = lean(west, east) === 0 ? "" : lean(west, east) > 0 ? "east" : "west";
  const region = [vertical, horizontal].filter(Boolean).join("-") || "across";
  const where = region === "across" ? "spread across the whole area" : `strongest in the ${region}`;
  return { level: overall, region, text: `Overall activity is ${LEVEL_WORDS[overall]}, ${where}.` };
}
