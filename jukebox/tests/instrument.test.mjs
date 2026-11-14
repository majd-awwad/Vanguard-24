import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateFrame, totalsOf } from "../site/science.js";
import { gainFor, makeScore, scale, slot } from "../site/score.js";
import { createPlayer } from "../site/player.js";

const source = validateFrame(JSON.parse(await readFile(new URL("../site/media/night-lights.json", import.meta.url))));
const europe = source.regions[0], india = source.regions.at(-1);

test("exact source, inset totals, and classification sensitivity agree", () => {
  assert.deepEqual(totalsOf(europe), { pixels: 1566480, bright: 40852, dim: 78673 });
  assert.deepEqual(totalsOf(india), { pixels: 936000, bright: 73147, dim: 1324 });
  for (const threshold of [10, 12, 14]) {
    const [purpleEurope, orangeEurope] = europe.sensitivity[threshold];
    const [purpleIndia, orangeIndia] = india.sensitivity[threshold];
    assert.ok(purpleEurope < orangeEurope && purpleIndia > orangeIndia);
  }
  const bad = structuredClone(source);
  bad.regions[0].bands[2].pixels -= 1;
  assert.throws(() => validateFrame(bad), /band could not be verified/);
});

test("scoring uses ordered bands, a global gain scale and equal mappings across regions", () => {
  const score = makeScore([europe, india]);
  assert.equal(score.length, 24);
  assert.deepEqual(score, makeScore([europe, india]));
  assert.deepEqual(score.slice(11, 13).map(({ region, index }) => [region.id, index]), [["europe", 11], ["india", 0]]);
  assert.equal(gainFor(0), 0);
  assert.equal(gainFor(1), 0.17);
  assert.equal(gainFor(scale / 4), 0.085);
  assert.ok(score.every(({ signals }) => signals.bright.fraction < scale && signals.dim.fraction < scale));
  assert.ok(score.every(({ signals }) => signals.bright.hz > signals.dim.hz));
  assert.ok(score.every(({ signals }) => signals.bright.gain + signals.dim.gain <= 0.34));
});

function clockHarness(factory) {
  let seconds = 0, currentCallback;
  const frames = [], states = [];
  const transport = createPlayer({
    context: factory, now: () => seconds, frame: callback => { currentCallback = callback; return 1; },
    cancel: () => { currentCallback = undefined; },
    onFrame: event => frames.push([event.region.id, event.index]),
    onStatus: (...status) => states.push(status),
  });
  return { transport, frames, states, advance(newTime) { seconds = newTime; currentCallback?.(); } };
}

test("the comparison timeline changes region once same-clock playback reaches band 13", async () => {
  const { transport, frames, states, advance } = clockHarness(() => assert.fail("Silent mode initialized audio"));
  transport.load(makeScore([europe, india]));
  await transport.play("silent");
  advance(slot * 11 + 0.1);
  assert.deepEqual(frames.at(-1), ["europe", 11]);
  advance(slot * 12 + 0.1);
  assert.deepEqual(frames.at(-1), ["india", 0]);
  transport.pause();
  advance(slot * 17);
  assert.deepEqual(frames.at(-1), ["india", 0]);
  transport.seek(2);
  assert.deepEqual(frames.at(-1), ["europe", 2]);
  assert.deepEqual(states.at(-1), ["paused", "silent"]);
});

test("a rejected browser audio context leaves a playable silent timeline", async () => {
  const { transport, frames, states, advance } = clockHarness(() => { throw new Error("Unavailable"); });
  transport.load(makeScore([india]));
  await transport.play();
  assert.deepEqual(states.at(-1), ["playing", "fallback"]);
  advance(2 * slot + 0.1);
  assert.deepEqual(frames.at(-1), ["india", 2]);
});
