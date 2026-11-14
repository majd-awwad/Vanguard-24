import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDecodeSession } from "../web/experiences/decode/session.js";
import { scoreGuesses } from "../web/experiences/decode/score.js";
import { createAttemptLog, attemptFromSnapshot } from "../web/experiences/decode/log.js";
import { describeCase } from "../web/experiences/decode/text.js";
import { validateDecodeCase } from "../web/contracts/validate.js";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/decode-fixture.json", import.meta.url), "utf8"));
const ids = fixtures.map((item) => item.id);

// Injected fakes: Andreh's heardClass and makeSpatialPlan are not merged yet.
function fakeHeard(data, level, row, col) {
  const grid = data.levels[level];
  const cell = grid.cells[row * grid.cols + col];
  if (cell.status !== "measured") return "silent";
  return cell.value >= grid.truth.threshold * 4 ? "high" : cell.value >= grid.truth.threshold * 2 ? "mid" : "low";
}

function fakePlan(data, { level, mode, row, cells }) {
  const grid = data.levels[level];
  const picks = mode === "cell" ? cells : mode === "row"
    ? grid.cells.filter((cell) => cell.row === row).map((cell) => [cell.row, cell.col])
    : mode === "legend" ? [] : grid.cells.map((cell) => [cell.row, cell.col]);
  const events = picks.map(([r, c], index) => ({
    id: `ev-${index}`, onsetS: index * 0.5, row: r, col: c, tone: null,
    evidence: { ...grid.cells[r * grid.cols + c], unit: data.unit, mappingVersion: "fake" },
  }));
  return { caseId: data.id, level, mappingVersion: "fake", mode, durationS: Math.max(1, events.length * 0.5), events };
}

function fakeTransport() {
  const listeners = new Set();
  const calls = [];
  let state = {
    status: "idle", positionS: 0, activeEventId: null, planRevision: 0, awaitingOnset: false,
    speed: 1, volume: 0.72, muted: false, playback: "audio", audioUnavailable: false,
  };
  const emit = () => listeners.forEach((listener) => listener({ ...state }));
  return {
    calls,
    snapshot: () => ({ ...state }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    load(plan, start = 0) {
      calls.push(["load", plan.mode]);
      state = { ...state, planRevision: state.planRevision + 1, status: "paused", positionS: start, activeEventId: null };
      emit();
    },
    async play(mode = "audio") {
      calls.push(["play", mode]);
      state = { ...state, status: "playing", playback: mode, activeEventId: "ev-0" };
      emit();
    },
    pause() {
      calls.push(["pause"]);
      if (state.status === "playing") { state = { ...state, status: "paused" }; emit(); }
    },
    async replay() { calls.push(["replay"]); },
    seek() {},
    setSpeed() {}, setVolume() {}, setMuted() {},
    emitRaw(snapshot) { listeners.forEach((listener) => listener(snapshot)); },
  };
}

const loadFixture = async (id) => validateDecodeCase(structuredClone(fixtures.find((item) => item.id === id)));

async function setup(options = {}) {
  const transport = fakeTransport();
  const session = createDecodeSession({
    cases: ids, loadCase: loadFixture, makePlan: fakePlan, heardClass: fakeHeard, transport, ...options,
  });
  const states = [];
  session.subscribe((state) => states.push(state));
  await session.ready;
  return { session, transport, states };
}

const truthOf = (id, level) => fixtures.find((item) => item.id === id).levels[level].truth;
const forbiddenKeys = new Set(["value", "status", "eventCount", "truth", "threshold", "present", "rule", "events", "evidence", "plan"]);

function assertRedacted(state) {
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${path}[${index}]`));
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        if (path === "snapshot" && key === "transport") {
          // TransportSnapshot is part of the contract; its own `status` is playback state, not a cell status.
          assert.deepEqual(Object.keys(child).sort(), [
            "activeEventId", "audioUnavailable", "awaitingOnset", "muted", "planRevision",
            "playback", "positionS", "speed", "status", "volume"]);
          continue;
        }
        assert.ok(!forbiddenKeys.has(key), `${path}.${key} must not appear before Reveal`);
        walk(child, `${path}.${key}`);
      }
    }
  };
  walk(state, "snapshot");
  for (const cell of state.grid.cells) assert.deepEqual(Object.keys(cell).sort(), ["col", "lat", "lon", "row"]);
  assert.equal(state.score, null);
  assert.equal(state.visualLink, null);
  assert.doesNotMatch(JSON.stringify(state), /below_threshold|measured|missing|synthetic/);
  if (state.lastProbe) {
    assert.deepEqual(Object.keys(state.lastProbe).sort(), ["col", "heard", "row"]);
    assert.ok(["low", "mid", "high", "silent"].includes(state.lastProbe.heard));
  }
}

test("every Discovery snapshot before Reveal is redacted across levels, conditions and playback", async () => {
  for (const condition of ["sound", "text", "both"]) {
    const { session, states } = await setup({ condition });
    session.dispatch({ type: "set-level", level: "advanced" });
    session.dispatch({ type: "set-level", level: "quick" });
    session.dispatch({ type: "play", mode: "legend" });
    session.dispatch({ type: "next" });
    session.dispatch({ type: "next" });
    session.dispatch({ type: "play", mode: "sweep" });
    session.dispatch({ type: "play", mode: "row" });
    session.dispatch({ type: "play", mode: "contrast" });
    session.dispatch({ type: "probe", row: 0, col: 2 });
    session.dispatch({ type: "probe", row: 1, col: 1 });
    session.dispatch({ type: "next" });
    session.dispatch({ type: "toggle", row: 0, col: 2 });
    session.dispatch({ type: "focus", row: 2, col: 3 });
    session.dispatch({ type: "pause" });
    assert.ok(states.length > 8);
    assert.ok(states.every((state) => state.phase !== "reveal"));
    for (const state of states) assertRedacted(state);
    assertRedacted(session.getState());
    if (condition === "text") {
      assert.equal(session.getState().lastProbe, null);
      assert.match(session.getState().description.text, /^[^0-9]+$/);
    }
  }
});

test("a full Discovery journey reveals evidence, locks guesses and advances to the next case", async () => {
  const { session, transport } = await setup();
  const first = session.getState();
  assert.equal(first.phase, "intro");
  assert.equal(first.mode, "discovery");
  assert.equal(first.caseId, "fixture-continuous");
  assert.equal(first.expectedCount, truthOf("fixture-continuous", "quick").present.length);
  assert.equal(first.grid.cells.length, 12);

  for (const phase of ["legend", "listen"]) {
    session.dispatch({ type: "next" });
    assert.equal(session.getState().phase, phase);
  }
  session.dispatch({ type: "probe", row: 0, col: 2 });
  assert.deepEqual(session.getState().lastProbe, { row: 0, col: 2, heard: fakeHeard(await loadFixture("fixture-continuous"), "quick", 0, 2) });
  session.dispatch({ type: "next" });
  assert.equal(session.getState().phase, "decode");

  session.dispatch({ type: "submit" });
  assert.equal(session.getState().phase, "reveal");
  assert.equal(session.getState().score.recall, 0);

  const second = await setup();
  for (let step = 0; step < 3; step++) second.session.dispatch({ type: "next" });
  for (const [row, col] of truthOf("fixture-continuous", "quick").present) {
    second.session.dispatch({ type: "toggle", row, col });
  }
  second.session.dispatch({ type: "submit" });
  const revealed = second.session.getState();
  assert.equal(revealed.phase, "reveal");
  assert.equal(revealed.score.f1, 1);
  assert.ok(revealed.grid.cells.every((cell) => "value" in cell && "status" in cell && !("eventCount" in cell)));
  assert.equal(revealed.visualLink.relation, "RELATED_CONTEXT");

  const lockedGuesses = JSON.stringify(revealed.guesses);
  second.session.dispatch({ type: "toggle", row: 0, col: 0 });
  assert.equal(JSON.stringify(second.session.getState().guesses), lockedGuesses);

  const revisionBefore = revealed.planRevision;
  await second.session.dispatch({ type: "next" });
  const next = second.session.getState();
  assert.equal(next.caseId, "fixture-intermittent");
  assert.equal(next.behavior, "intermittent");
  assert.equal(next.phase, "intro");
  assert.deepEqual(next.guesses, []);
  assert.ok(next.planRevision > revisionBefore);
  assertRedacted(next);
  assert.ok(transport.calls.some(([name]) => name === "play"));
});

test("Learning shows readings, never submits and never scores", async () => {
  const { session } = await setup({ mode: "learning" });
  const intro = session.getState();
  assert.equal(intro.mode, "learning");
  assert.ok(intro.grid.cells.some((cell) => cell.status === "measured" && typeof cell.value === "number"));
  assert.equal(intro.visualLink, null);
  for (let step = 0; step < 3; step++) session.dispatch({ type: "next" });
  session.dispatch({ type: "submit" });
  assert.equal(session.getState().phase, "decode");
  assert.equal(session.getState().score, null);
  session.dispatch({ type: "next" });
  const done = session.getState();
  assert.equal(done.phase, "reveal");
  assert.equal(done.score, null);
  assert.ok(done.visualLink);
});

test("level and mode change only in intro or after Reveal, rebuild the plan and stop old audio", async () => {
  const { session, transport } = await setup();
  const base = session.getState().planRevision;
  session.dispatch({ type: "next" });
  session.dispatch({ type: "next" });
  session.dispatch({ type: "set-level", level: "advanced" });
  session.dispatch({ type: "set-mode", mode: "learning" });
  assert.equal(session.getState().level, "quick");
  assert.equal(session.getState().mode, "discovery");

  session.dispatch({ type: "reset" });
  session.dispatch({ type: "play", mode: "sweep" });
  const callsBefore = transport.calls.length;
  const revision = session.getState().planRevision;
  session.dispatch({ type: "set-level", level: "advanced" });
  const state = session.getState();
  assert.equal(state.level, "advanced");
  assert.equal(state.grid.rows, 6);
  assert.equal(state.expectedCount, truthOf("fixture-continuous", "advanced").present.length);
  assert.ok(state.planRevision > revision && revision > base);
  const added = transport.calls.slice(callsBefore).map(([name]) => name);
  assert.ok(added.indexOf("pause") !== -1 && added.indexOf("pause") < added.indexOf("load"));
  assert.equal(state.phase, "intro");
  assert.deepEqual(state.focus, [0, 0]);

  for (let step = 0; step < 3; step++) session.dispatch({ type: "next" });
  session.dispatch({ type: "submit" });
  assert.equal(session.getState().phase, "reveal");
  session.dispatch({ type: "set-mode", mode: "learning" });
  assert.equal(session.getState().mode, "learning");
  assert.equal(session.getState().phase, "intro");
  assert.deepEqual(session.getState().guesses, []);
});

test("stale transport snapshots and superseded case loads cannot overwrite the current plan", async () => {
  const { session, transport } = await setup();
  const stale = transport.snapshot();
  session.dispatch({ type: "set-level", level: "advanced" });
  const revision = session.getState().planRevision;
  transport.emitRaw({ ...stale, status: "playing", activeEventId: "old-event" });
  assert.equal(session.getState().planRevision, revision);
  assert.equal(session.getState().transport.activeEventId, null);

  const gates = new Map();
  const slowLoad = (id) => new Promise((resolve) => gates.set(id, () => resolve(loadFixture(id))));
  const slow = createDecodeSession({
    cases: ids, loadCase: slowLoad, makePlan: fakePlan, heardClass: fakeHeard, transport: fakeTransport(),
  });
  await new Promise((resolve) => setImmediate(resolve));
  gates.get(ids[0])();
  await slow.ready;
  const pending = slow.dispatch({ type: "select-case", id: ids[1] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(slow.getState().grid.rows, 0);
  assert.equal(slow.getState().caseId, ids[1]);
  slow.dispatch({ type: "select-case", id: ids[0] });
  assert.equal(slow.getState().caseId, ids[0]);
  gates.get(ids[1])();
  await pending;
  assert.equal(slow.getState().caseId, ids[0]);
  assert.equal(slow.getState().grid.rows, 3);
});

test("focus is a single clamped cell, guesses toggle, and invalid intents are ignored", async () => {
  const { session } = await setup();
  session.dispatch({ type: "focus", row: 99, col: -5 });
  assert.deepEqual(session.getState().focus, [2, 0]);
  session.dispatch({ type: "focus", row: 1.5, col: 1 });
  session.dispatch({ type: "focus", row: "1", col: 1 });
  assert.deepEqual(session.getState().focus, [2, 0]);
  session.dispatch({ type: "toggle", row: 1, col: 1 });
  assert.deepEqual(session.getState().guesses, []);
  for (let step = 0; step < 3; step++) session.dispatch({ type: "next" });
  session.dispatch({ type: "toggle", row: 1, col: 1 });
  session.dispatch({ type: "toggle", row: 0, col: 3 });
  session.dispatch({ type: "toggle", row: 1, col: 1 });
  assert.deepEqual(session.getState().guesses, [[0, 3]]);
  assert.deepEqual(session.getState().focus, [1, 1]);
  session.dispatch({ type: "nonsense" });
  session.dispatch(null);
});

test("the text condition describes level and region only and never plays audio", async () => {
  const { session, transport } = await setup({ condition: "text" });
  session.dispatch({ type: "play", mode: "sweep" });
  session.dispatch({ type: "probe", row: 0, col: 2 });
  session.dispatch({ type: "replay" });
  assert.ok(!transport.calls.some(([name]) => name === "play" || name === "replay"));
  const state = session.getState();
  assert.equal(state.lastProbe, null);
  assert.deepEqual(state.focus, [0, 2]);
  assert.deepEqual(Object.keys(state.description).sort(), ["level", "region", "text"]);
  assert.doesNotMatch(state.description.text, /\d/);
  assert.equal(describeCase(fixtures[0], "quick").level, "moderate");
  const empty = structuredClone(fixtures[0]);
  empty.levels.quick.truth.present = [];
  assert.equal(describeCase(empty, "quick").level, "none");
});

test("scoreGuesses handles duplicates, empties, tolerance and never returns NaN", () => {
  const truth = { present: [[0, 0], [1, 1], [2, 2]] };
  assert.deepEqual(scoreGuesses(truth, [[0, 0], [0, 0], [1, 1], [5, 5]]), {
    hits: 2, misses: 1, falseAlarms: 1, precision: 2 / 3, recall: 2 / 3, f1: 2 / 3, nearHits: 0,
  });
  assert.deepEqual(scoreGuesses({ present: [] }, []), {
    hits: 0, misses: 0, falseAlarms: 0, precision: 1, recall: 1, f1: 1, nearHits: 0,
  });
  assert.deepEqual(scoreGuesses(truth, []), {
    hits: 0, misses: 3, falseAlarms: 0, precision: 0, recall: 0, f1: 0, nearHits: 0,
  });
  assert.deepEqual(scoreGuesses({ present: [] }, [[1, 1]]), {
    hits: 0, misses: 0, falseAlarms: 1, precision: 0, recall: 0, f1: 0, nearHits: 0,
  });
  assert.deepEqual(scoreGuesses({ present: [[0, 0]] }, [[0, 1]], { tolerance: 1 }), {
    hits: 0, misses: 1, falseAlarms: 0, precision: 0, recall: 0, f1: 0, nearHits: 1,
  });
  assert.equal(scoreGuesses({ present: [[0, 0]] }, [[0, 1]]).falseAlarms, 1);
  for (const odd of [undefined, null, {}, { present: "no" }]) {
    for (const guesses of [undefined, null, [[1]], ["x"], [[NaN, 0]]]) {
      const result = scoreGuesses(odd, guesses, { tolerance: NaN });
      assert.ok(Object.values(result).every((value) => Number.isFinite(value)));
    }
  }
});

test("the attempt log is anonymous, exports CSV and JSON, and survives broken storage", async () => {
  const { session } = await setup();
  for (let step = 0; step < 3; step++) session.dispatch({ type: "next" });
  session.dispatch({ type: "toggle", row: 0, col: 2 });
  assert.equal(attemptFromSnapshot(session.getState()), null);
  session.dispatch({ type: "submit" });

  const broken = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("full"); },
    removeItem() { throw new Error("blocked"); },
  };
  const log = createAttemptLog({ storage: broken, now: () => new Date("2026-01-02T03:04:05Z") });
  assert.equal(log.recordSnapshot(session.getState()), true);
  log.record({ ...log.list()[0], caseId: "=HYPERLINK(\"x\")" });
  assert.equal(log.list().length, 2);

  const [attempt] = JSON.parse(log.exportJson());
  assert.deepEqual(Object.keys(attempt).sort(), [
    "at", "behavior", "caseId", "condition", "expectedCount", "f1", "falseAlarms", "guessCount", "guesses",
    "hits", "level", "misses", "nearHits", "precision", "recall"]);
  assert.equal(attempt.at, "2026-01-02T03:04:05.000Z");
  const lines = log.exportCsv().split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^2026-01-02T03:04:05\.000Z,fixture-continuous,continuous,quick,sound,6,1,0:2,/);
  assert.match(lines[2], /,"'=HYPERLINK\(""x""\)"|,'=HYPERLINK/);
  log.clear();
  assert.equal(log.list().length, 0);

  const store = new Map();
  const working = { getItem: (key) => store.get(key) ?? null, setItem: (key, text) => store.set(key, text), removeItem: (key) => store.delete(key) };
  createAttemptLog({ storage: working }).record({ caseId: "kept" });
  assert.equal(createAttemptLog({ storage: working }).list()[0].caseId, "kept");
});
