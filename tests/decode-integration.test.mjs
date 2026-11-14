import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createTransport } from "../web/audio/transport.js";
import { validateDecodeCase } from "../web/contracts/validate.js";
import { createDecodePlayback } from "../web/decode.js";
import { createDecodeSession } from "../web/experiences/decode/session.js";

const caseId = "dust-geos-fp-20250819-1930-north-africa-med";
const source = validateDecodeCase(JSON.parse(await readFile(
  new URL("../web/assets/decode/data/" + caseId + ".json", import.meta.url), "utf8",
)));

function run() {
  let clock = 0;
  let frame;
  const transport = createTransport({
    now: () => clock,
    requestFrame(callback) { frame = callback; return 1; },
    cancelFrame() { frame = undefined; },
    createContext() { throw new Error("The integration fixture must remain silent."); },
  });
  const playback = createDecodePlayback({
    ...transport,
    play(_mode) { return transport.play("silent"); },
  });
  function makePlan(data, { level, mode }) {
    return {
      caseId: data.id, level, mode, mappingVersion: "test-only",
      durationS: 2,
      events: data.levels[level].cells.slice(0, 2).map((cell, index) => ({
        id: "slot-" + index, row: cell.row, col: cell.col, onsetS: index,
        tone: null, evidence: { ...cell, unit: data.unit, mappingVersion: "test-only" },
      })),
    };
  }
  const session = createDecodeSession({
    cases: [caseId], loadCase: async () => source, transport: playback.transport,
    makePlan, heardClass: () => "silent",
  });
  return {
    session, transport,
    state: () => playback.withActiveCell(session.getState()),
    project: playback.withActiveCell,
    tick(seconds) { clock += seconds; frame?.(); },
  };
}

test("real dust case publishes only public geography until a submitted guess is locked", async () => {
  const { session, state } = run();
  await session.ready;
  assert.equal(source.fixture, false);
  assert.equal(state().phase, "intro");
  assert.equal(state().grid.rows, 3);
  assert.equal(state().grid.cols, 4);
  for (const phase of ["legend", "listen", "decode"]) {
    session.dispatch({ type: "next" });
    const snapshot = state();
    assert.equal(snapshot.phase, phase);
    assert.equal(snapshot.visualLink, null);
    assert.equal(snapshot.score, null);
    assert.equal(snapshot.grid.cells.length, 12);
    assert.ok(snapshot.grid.cells.every(cell => Object.keys(cell).sort().join() === "col,lat,lon,row"));
  }
  const [row, col] = source.levels.quick.truth.present[0];
  session.dispatch({ type: "toggle", row, col });
  session.dispatch({ type: "submit" });
  const revealed = state();
  assert.equal(revealed.phase, "reveal");
  assert.equal(revealed.score.hits, 1);
  assert.equal(revealed.visualLink.relation, "RELATED_CONTEXT");
  assert.equal(revealed.grid.cells[row * 4 + col].value, source.levels.quick.cells[row * 4 + col].value);
  session.dispatch({ type: "toggle", row, col });
  session.dispatch({ type: "submit" });
  assert.deepEqual(state().guesses, revealed.guesses);
  assert.deepEqual(state().score, revealed.score);

  session.dispatch({ type: "reset" });
  assert.equal(state().phase, "intro");
  assert.equal(state().visualLink, null);
  assert.equal(state().score, null);
  assert.equal("value" in state().grid.cells[0], false);
});

test("the renderer highlight follows the transport through pause, seek, and plan changes", async () => {
  const { session, transport, state, project, tick } = run();
  await session.ready;
  await session.dispatch({ type: "play", mode: "legend" });
  assert.equal(state().activeCell, null);

  await session.dispatch({ type: "play", mode: "sweep" });
  assert.deepEqual(state().activeCell, [0, 0]);
  const first = state();
  assert.equal(project({ ...first, caseId: "different" }).activeCell, null);
  assert.equal(project({ ...first, level: "advanced" }).activeCell, null);
  assert.equal(project({ ...first, transport: { ...first.transport, awaitingOnset: true } }).activeCell, null);
  assert.equal(project({ ...first, transport: { ...first.transport, activeEventId: "unknown" } }).activeCell, null);
  tick(1);
  assert.deepEqual(state().activeCell, [0, 1]);
  assert.deepEqual(state().focus, first.focus);

  session.dispatch({ type: "pause" });
  assert.equal(state().activeCell, null);
  transport.seek(0);
  assert.equal(state().activeCell, null);
  await session.dispatch({ type: "replay" });
  assert.deepEqual(state().activeCell, [0, 0]);
  tick(2);
  assert.equal(state().transport.status, "ended");
  assert.equal(state().activeCell, null);

  await session.dispatch({ type: "play", mode: "row" });
  assert.ok(state().planRevision > first.planRevision);
  assert.equal(project(first).activeCell, null);
  assert.deepEqual(state().activeCell, [0, 0]);
  assert.equal("evidence" in state(), false);
});
