// The only module in the 3D layer that reads cell readings (`value`), and only for a revealed snapshot.
//
// Before Reveal the session withholds every reading, and this module refuses to build anything unless
// snapshot.phase === "reveal", so nothing here can leak a reading early. After Reveal the amber particles are
// the measured values made visible: each cell receives a particle count proportional to its reading, normalised
// to the largest reading of the displayed level. Where a particle sits inside its cell is artistic (seeded
// noise); how many sit in each cell is data.

export const MAX_PARTICLES = 20000;
export const HAZE_SHARE = 0.22; // extra large, faint sprites per cell for the volumetric look; counted in the budget

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const EMPTY = Object.freeze({
  count: 0, haze: 0, vmax: 0, perCell: [], lonLat: new Float32Array(0), altitude: new Float32Array(0),
  seed: new Float32Array(0), size: new Float32Array(0), alpha: new Float32Array(0),
});

/** Counts per cell, proportional to the reading, within the particle budget. Pure and testable. */
export function particleCounts(values, budget = MAX_PARTICLES) {
  const readings = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const vmax = Math.max(0, ...readings);
  if (!(vmax > 0) || readings.length === 0) return { counts: readings.map(() => 0), vmax: 0 };
  // Leave one particle per cell of headroom for the rounding of each cell's haze sprites.
  const allowed = Math.floor(budget / (1 + HAZE_SHARE)) - readings.length;
  const perCell = Math.max(8, Math.min(1800, Math.floor(allowed / readings.length)));
  const counts = readings.map((value) => Math.round((perCell * value) / vmax));
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total > allowed) {
    const scale = allowed / total;
    return { counts: counts.map((count) => Math.floor(count * scale)), vmax };
  }
  return { counts, vmax };
}

/**
 * Particle attributes for a revealed snapshot, or null before Reveal.
 * bounds are the case's geographic bounds, so each cell's particles stay inside its own rectangle.
 */
export function buildDustParticles(snapshot, bounds) {
  if (snapshot?.phase !== "reveal") return null;
  const { rows, cols, cells } = snapshot.grid ?? {};
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || !Array.isArray(cells) || cells.length !== rows * cols) return EMPTY;
  const { counts, vmax } = particleCounts(cells.map((cell) => cell.value));
  if (!(vmax > 0)) return EMPTY;

  const dLon = (bounds.east - bounds.west) / cols;
  const dLat = (bounds.north - bounds.south) / rows;
  const lonLat = [];
  const altitude = [];
  const seed = [];
  const size = [];
  const alpha = [];
  const perCell = [];
  cells.forEach((cell, index) => {
    const count = counts[index];
    const haze = Math.round(count * HAZE_SHARE);
    perCell.push({ row: cell.row, col: cell.col, particles: count, haze });
    const random = seededRandom((cell.row * 131 + cell.col * 17 + 1) * 2654435761);
    const share = Math.min(1, cell.value / vmax);
    for (let k = 0; k < count + haze; k++) {
      const isHaze = k >= count;
      lonLat.push(bounds.west + (cell.col + random()) * dLon, bounds.north - (cell.row + random()) * dLat);
      altitude.push(random());
      seed.push(random(), random(), random());
      // Sizes are world units (the unrolled map is about 0.5 units tall); alpha is low because sprites add up.
      size.push(isHaze ? 0.022 + random() * 0.03 : 0.004 + random() * 0.005);
      alpha.push(isHaze ? 0.04 + 0.11 * share : 0.35 + 0.55 * share);
    }
  });
  return {
    count: lonLat.length / 2,
    haze: perCell.reduce((sum, entry) => sum + entry.haze, 0),
    vmax,
    perCell,
    lonLat: new Float32Array(lonLat),
    altitude: new Float32Array(altitude),
    seed: new Float32Array(seed),
    size: new Float32Array(size),
    alpha: new Float32Array(alpha),
  };
}
