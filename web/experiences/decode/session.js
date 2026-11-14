import { scoreGuesses } from "./score.js";
import { describeCase } from "./text.js";

const LEVELS = ["quick", "advanced"];
const MODES = ["discovery", "learning"];
const CONDITIONS = ["sound", "text", "both"];
const PLAY_MODES = ["legend", "sweep", "row", "contrast"];
const NEXT_PHASE = { intro: "legend", legend: "listen", listen: "decode" };
const PROBE_PHASES = ["listen", "decode", "reveal"];

const cellKey = (row, col) => `${row},${col}`;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/**
 * DOM-free Decode engine. Every renderer reads `getState()` / `subscribe()` snapshots only.
 * In Discovery before Reveal the snapshot is built from a whitelist (row, col, lat, lon per cell),
 * so values, statuses, counts and truth cannot leak by omission.
 *
 * `ready` resolves when the first case has loaded; until then the snapshot is an empty placeholder
 * (grid 0x0, behavior null).
 */
export function createDecodeSession({
  cases, loadCase, makePlan, heardClass, transport,
  level = "quick", mode = "discovery", condition = "sound",
}) {
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new TypeError("createDecodeSession needs at least one case id.");
  }
  const listeners = new Set();
  const loaded = new Map();
  const gridCache = new Map();
  const textCache = new Map();

  let activeLevel = pick(level, LEVELS, "quick");
  let activeMode = pick(mode, MODES, "discovery");
  let activeCondition = pick(condition, CONDITIONS, "sound");
  let pendingId = cases[0];
  let data = null;
  let phase = "intro";
  let focus = [0, 0];
  let guesses = new Map();
  let lastProbe = null;
  let locked = false;
  let score = null;
  let planKey = null;
  let loadToken = 0;
  let quiet = 0;
  let transportState = transport.snapshot();

  const grid = () => data.levels[activeLevel];
  const audible = () => data !== null && activeCondition !== "text";

  function sessionGrid(evidence) {
    const id = `${data.id}|${activeLevel}|${evidence}`;
    if (!gridCache.has(id)) {
      const source = grid();
      const cells = source.cells.map(({ row, col, lat, lon, value, status }) => Object.freeze(
        evidence ? { row, col, lat, lon, value, status } : { row, col, lat, lon }));
      gridCache.set(id, Object.freeze({ rows: source.rows, cols: source.cols, cells: Object.freeze(cells) }));
    }
    return gridCache.get(id);
  }

  function description() {
    if (activeCondition === "sound" || !data) return null;
    const id = `${data.id}|${activeLevel}`;
    if (!textCache.has(id)) textCache.set(id, Object.freeze(describeCase(data, activeLevel)));
    return textCache.get(id);
  }

  function snapshot() {
    const evidence = data !== null && (activeMode === "learning" || phase === "reveal");
    const revealed = phase === "reveal";
    return {
      caseId: data?.id ?? pendingId,
      behavior: data?.behavior ?? null,
      level: activeLevel,
      condition: activeCondition,
      mode: activeMode,
      phase,
      focus: [...focus],
      guesses: [...guesses.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([row, col]) => [row, col]),
      expectedCount: data ? grid().truth.present.length : 0,
      lastProbe: lastProbe ? { ...lastProbe } : null,
      planRevision: transportState.planRevision ?? 0,
      transport: { ...transportState },
      description: description(),
      grid: data ? sessionGrid(evidence) : { rows: 0, cols: 0, cells: [] },
      visualLink: data && revealed ? data.visualLink : null,
      score: data && activeMode === "discovery" && revealed ? { ...score } : null,
    };
  }

  function emit() {
    const state = snapshot();
    for (const listener of listeners) listener(state);
  }

  transport.subscribe((state) => {
    // A snapshot from an older plan revision is stale and must not overwrite the current plan.
    if ((state.planRevision ?? 0) < (transportState.planRevision ?? 0)) return;
    transportState = state;
    if (quiet === 0) emit();
  });

  function loadPlan(options) {
    transport.pause();
    transport.load(makePlan(data, { level: activeLevel, ...options }), 0);
    transportState = transport.snapshot();
    planKey = JSON.stringify(options);
  }

  function resetAttempt() {
    phase = "intro";
    focus = [0, 0];
    guesses = new Map();
    lastProbe = null;
    locked = false;
    score = null;
  }

  function rebuild() {
    resetAttempt();
    if (data) loadPlan({ mode: "legend" });
  }

  function applyCase(next) {
    data = next;
    rebuild();
  }

  function cellFrom(intent) {
    if (!data || !Number.isInteger(intent.row) || !Number.isInteger(intent.col)) return null;
    const { rows, cols } = grid();
    return [clamp(intent.row, 0, rows - 1), clamp(intent.col, 0, cols - 1)];
  }

  function selectCase(id) {
    if (!cases.includes(id)) return undefined;
    const token = ++loadToken;
    pendingId = id;
    transport.pause();
    if (loaded.has(id)) {
      applyCase(loaded.get(id));
      return undefined;
    }
    data = null;
    resetAttempt();
    return Promise.resolve().then(() => loadCase(id)).then((next) => {
      if (!next?.levels?.quick || !next.levels.advanced) throw new TypeError(`Case ${id} has no Decode levels.`);
      loaded.set(id, next);
      if (token !== loadToken) return;
      quiet++;
      try {
        applyCase(next);
      } finally {
        quiet--;
      }
      emit();
    });
  }

  function setOption(apply) {
    if (data && phase !== "intro" && phase !== "reveal") return;
    apply();
    rebuild();
  }

  function handle(intent) {
    switch (intent.type) {
      case "select-case":
        return selectCase(intent.id);
      case "set-level":
        if (!LEVELS.includes(intent.level) || intent.level === activeLevel) return undefined;
        return setOption(() => { activeLevel = intent.level; });
      case "set-mode":
        if (!MODES.includes(intent.mode) || intent.mode === activeMode) return undefined;
        return setOption(() => { activeMode = intent.mode; });
      case "next": {
        if (!data) return undefined;
        if (phase === "reveal") {
          return selectCase(cases[(cases.indexOf(data.id) + 1) % cases.length]);
        }
        if (phase === "decode") {
          if (activeMode === "learning") phase = "reveal";
          return undefined;
        }
        phase = NEXT_PHASE[phase];
        return undefined;
      }
      case "focus": {
        const cell = cellFrom(intent);
        if (cell) focus = cell;
        return undefined;
      }
      case "toggle": {
        const cell = cellFrom(intent);
        if (!cell) return undefined;
        focus = cell;
        if (phase !== "decode" || locked) return undefined;
        const id = cellKey(...cell);
        if (guesses.has(id)) guesses.delete(id); else guesses.set(id, cell);
        return undefined;
      }
      case "probe": {
        const cell = cellFrom(intent);
        if (!cell) return undefined;
        focus = cell;
        if (!audible() || (activeMode === "discovery" && !PROBE_PHASES.includes(phase))) return undefined;
        lastProbe = { row: cell[0], col: cell[1], heard: heardClass(data, activeLevel, cell[0], cell[1]) };
        loadPlan({ mode: "cell", cells: [cell] });
        return transport.play(transportState.playback);
      }
      case "play": {
        if (!audible() || !PLAY_MODES.includes(intent.mode)) return undefined;
        const options = intent.mode === "row" ? { mode: "row", row: focus[0] } : { mode: intent.mode };
        if (JSON.stringify(options) !== planKey) loadPlan(options);
        return transport.play(transportState.playback);
      }
      case "pause":
        if (audible()) transport.pause();
        return undefined;
      case "replay":
        return audible() ? transport.replay() : undefined;
      case "submit":
        if (!data || activeMode !== "discovery" || phase !== "decode" || locked) return undefined;
        score = scoreGuesses(grid().truth, [...guesses.values()]);
        locked = true;
        phase = "reveal";
        return undefined;
      case "reset":
        transport.pause();
        rebuild();
        return undefined;
      default:
        return undefined;
    }
  }

  function dispatch(intent) {
    if (typeof intent?.type !== "string") return undefined;
    let result;
    quiet++;
    try {
      result = handle(intent);
    } finally {
      quiet--;
    }
    emit();
    return result;
  }

  const ready = Promise.resolve(selectCase(cases[0]));
  ready.catch(() => {});
  emit();

  return {
    ready,
    dispatch,
    getState: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
  };
}
