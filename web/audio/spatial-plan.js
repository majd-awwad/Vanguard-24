import { continuousVoice, crackleVoice, GAIN_CEILING } from "./voices.js";

export const mappingVersion = "decode-spatial-v1";
const dimensions = { quick: [3, 4], advanced: [6, 8] };
const modes = new Set(["legend", "sweep", "row", "cell", "contrast"]);
const waveforms = new Set(["sine", "triangle", "square", "sawtooth"]);
const slotS = 0.8;
const clamp = value => Math.max(0, Math.min(1, value));
const panFor = (col, cols) => 2 * col / (cols - 1) - 1;
const pitchFor = (row, rows) => 220 * 2 ** (2 * (1 - row / (rows - 1)));

function checkCase(data, level) {
  if (data?.schema !== "earthpulse.decode/2") throw new TypeError("Expected earthpulse.decode/2.");
  if (typeof data.id !== "string" || !data.id || typeof data.unit !== "string" ||
      !["continuous", "intermittent"].includes(data.behavior)) throw new TypeError("Invalid case metadata.");
  if (!Object.hasOwn(dimensions, level)) throw new RangeError("Unknown grid level.");
  return dimensions[level];
}

function coordinate(pair, rows, cols) {
  if (!Array.isArray(pair) || pair.length !== 2 ||
      !Number.isInteger(pair[0]) || !Number.isInteger(pair[1]) ||
      pair[0] < 0 || pair[0] >= rows || pair[1] < 0 || pair[1] >= cols) {
    throw new RangeError("Cell coordinates must be an in-bounds [row, col] pair.");
  }
  return pair;
}

function gridFor(data, level) {
  const [rows, cols] = checkCase(data, level);
  const grid = data.levels?.[level];
  if (grid?.rows !== rows || grid.cols !== cols || !Array.isArray(grid.cells) ||
      grid.cells.length !== rows * cols) throw new RangeError("Invalid grid dimensions or cell count.");
  const indexed = new Map();
  for (const cell of grid.cells) {
    coordinate([cell?.row, cell?.col], rows, cols);
    const key = cell.row * cols + cell.col;
    if (indexed.has(key)) throw new RangeError("Duplicate grid cell.");
    if (!["measured", "missing", "below_threshold"].includes(cell.status) ||
        (cell.status === "missing" ? cell.value !== null : !Number.isFinite(cell.value) || cell.value < 0) ||
        (cell.eventCount !== undefined && (!Number.isSafeInteger(cell.eventCount) || cell.eventCount < 0))) {
      throw new TypeError("Invalid cell value, status or eventCount.");
    }
    indexed.set(key, cell);
  }
  return { grid, indexed, rows, cols };
}

function rangeFor(grid) {
  // v2 has no range field. Optional owner-supplied calibration takes precedence;
  // otherwise use the whole level's finite sample extent, never a probe subset.
  if (grid.validRange !== undefined) {
    const range = grid.validRange;
    if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) ||
        range[0] < 0 || range[1] < range[0]) throw new RangeError("Invalid validRange [min, max].");
    return range;
  }
  const values = grid.cells.filter(cell => cell.status !== "missing").map(cell => cell.value);
  return values.length ? [Math.min(...values), Math.max(...values)] : [0, 0];
}

function intensity(cell, range, behavior) {
  if (cell.status !== "measured" || (behavior === "intermittent" && cell.eventCount === 0)) return 0;
  const [min, max] = range;
  // A constant range conveys no amplitude contrast. Zero remains silent.
  return max === min ? (cell.value > 0 ? 1 : 0) : clamp((cell.value - min) / (max - min));
}

function toneFor(data, cell, rows, cols, normalized, waveform) {
  if (normalized <= 0) return null;
  const parameters = {
    frequencyHz: pitchFor(cell.row, rows), pan: panFor(cell.col, cols),
    gain: GAIN_CEILING * Math.sqrt(normalized), waveform,
  };
  return data.behavior === "intermittent"
    ? crackleVoice({ ...parameters, eventCount: cell.eventCount }) : continuousVoice(parameters);
}

function legend(data, level, rows, cols, waveform) {
  const middleRow = Math.floor((rows - 1) / 2);
  const middleCol = Math.floor((cols - 1) / 2);
  const steps = [
    ["left", middleRow, 0, 0.64], ["right", middleRow, cols - 1, 0.64],
    ["low-pitch", rows - 1, middleCol, 0.64], ["high-pitch", 0, middleCol, 0.64],
    ["quiet", middleRow, middleCol, 0.04], ["loud", middleRow, middleCol, 0.81],
  ];
  return steps.map(([label, row, col, value], index) => {
    // Calibration parameters, explicitly synthetic; never dataset measurements.
    const cell = { row, col, lat: 0, lon: 0, value, status: "measured",
      ...(data.behavior === "intermittent" ? { eventCount: 4 } : {}) };
    return {
      id: `${data.id}:${level}:legend:${label}`, onsetS: index, row, col,
      tone: toneFor(data, cell, rows, cols, value, waveform),
      evidence: { ...cell, unit: "synthetic calibration (normalized)", mappingVersion,
        synthetic: true, calibration: label },
    };
  });
}

/** Pure SpatialPlan v2 generator. cells contains [row, col] tuples. */
export function makeSpatialPlan(data, { level = "quick", mode = "sweep", row, cells, waveform = "sine" } = {}) {
  const [rows, cols] = checkCase(data, level);
  if (!modes.has(mode)) throw new RangeError("Unknown listening mode.");
  if (!waveforms.has(waveform)) throw new RangeError("Unsupported oscillator waveform.");
  let events;
  if (mode === "legend") {
    events = legend(data, level, rows, cols, waveform);
  } else {
    const { grid, indexed } = gridFor(data, level);
    const range = rangeFor(grid);
    let positions;
    if (mode === "cell" || mode === "contrast") {
      const count = mode === "cell" ? 1 : 2;
      if (!Array.isArray(cells) || cells.length !== count) throw new RangeError(`${mode} requires ${count} cell(s).`);
      positions = cells.map(pair => coordinate(pair, rows, cols));
    } else if (mode === "row") {
      coordinate([row, 0], rows, cols);
      positions = Array.from({ length: cols }, (_, col) => [row, col]);
    } else {
      positions = Array.from({ length: cols }, (_, col) =>
        Array.from({ length: rows }, (_, row) => [row, col])).flat();
    }
    events = positions.map(([row, col], index) => {
      const cell = indexed.get(row * cols + col);
      return {
        id: `${data.id}:${level}:${mode}:${index}:${row}:${col}`, onsetS: index * slotS, row, col,
        tone: toneFor(data, cell, rows, cols, intensity(cell, range, data.behavior), waveform),
        evidence: { ...cell, unit: data.unit, mappingVersion },
      };
    });
  }
  return { caseId: data.id, level, mappingVersion, mode,
    durationS: mode === "legend" ? 6 : events.length * slotS, events };
}

/** Non-numeric listening feedback; boundaries are thirds of peak output gain. */
export function heardClass(data, level, row, col) {
  const { grid, indexed, rows, cols } = gridFor(data, level);
  coordinate([row, col], rows, cols);
  const normalized = intensity(indexed.get(row * cols + col), rangeFor(grid), data.behavior);
  if (normalized <= 0) return "silent";
  const amplitude = Math.sqrt(normalized);
  return amplitude < 1 / 3 ? "low" : amplitude < 2 / 3 ? "mid" : "high";
}
