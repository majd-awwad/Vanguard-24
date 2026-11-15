import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GUIDED, PURE, createSpeech } from "../web/studio/speech.js";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");

test("VOICE-UI-A: the entry opens the two-choice dialog (Guided Voice / Pure Sonification) and the choice is saved as the guidance setting", async () => {
  const studio = await read("web/studio/studio.js");
  assert.match(studio, /export function openModeDialog/);
  assert.match(studio, /choice\(GUIDED, m\.mode\.guided/);
  assert.match(studio, /choice\(PURE, m\.mode\.pure/);
  assert.match(studio, /saveSettings\(\{ guidance: mode === GUIDED \}\)/, "the dialog choice writes the one source of truth");
  assert.match(studio, /current: loadSettings\(\)\.guidance \? GUIDED : PURE/, "the dialog starts from the stored setting");
});

test("VOICE-UI-B: the Guided / Pure switch in the sound controls switches any time, persists, tells the other switches and keeps position, tab, findings", async () => {
  const studio = await read("web/studio/studio.js");
  assert.match(studio, /el\.modeSeg/);
  assert.match(studio, /function setSoundMode\(mode, \{ persist = true \} = \{\}\)/);
  assert.match(studio, /earthpulse:settings/);
  assert.match(studio, /setSoundMode\(s\.guidance \? GUIDED : PURE, \{ persist: false \}\)/, "a change from the drawer does not loop back");
  const body = studio.slice(studio.indexOf("function setSoundMode"), studio.indexOf("function setSoundMode") + 900);
  assert.ok(!/state\.(cursor|selected|tool|pins)\s*=/.test(body), "switching never touches position, tool, findings");
});

test("VOICE-UI-C: the drawer and the settings page carry the same Spoken instructions switch", async () => {
  const nav = await read("web/cinematic/site/nav.js");
  const page = await read("web/cinematic/site/settings-page.js");
  assert.match(nav, /toggle\(t\.guidance, "guidance"\)/);
  assert.match(nav, /earthpulse:settings/);
  assert.match(page, /settings\.guidance/);
  assert.match(page, /guidance: value/);
});

test("VOICE-UI-D: recordings only, no old synthetic tones; Guided ducks the recordings, Pure never speaks", async () => {
  const studio = await read("web/studio/studio.js");
  assert.ok(!/valueTones|stepTones|hoverPlan|continuousVoice/.test(studio), "no synthetic tones are brought back");
  assert.match(studio, /rec\.setDuck/, "speech ducks the recordings");
  const spoken = [];
  const ducks = [];
  const timers = [];
  class U { constructor(text) { this.text = text; } }
  const synth = { speak: (u) => { spoken.push(u.text); u.onstart?.(); }, cancel() {}, getVoices: () => [{ lang: "en-US" }] };
  const speech = createSpeech({ synth, Utterance: U, language: () => "en", setTimer: (f) => { timers.push(f); return timers.length; }, clearTimer() {}, onDuck: (on) => ducks.push(on) });
  speech.setMode(PURE);
  speech.announce("moved");
  timers.splice(0).forEach((f) => f());
  assert.equal(spoken.length, 0, "Pure Sonification: zero automatic speech");
  speech.setMode(GUIDED);
  speech.announce("moved");
  assert.equal(spoken.length, 0, "Guided: debounced, not spoken at once");
  timers.splice(0).forEach((f) => f());
  assert.deepEqual(spoken, ["moved"], "Guided: speaks after the movement settles");
  assert.ok(ducks.includes(true), "Guided: the recordings are ducked while speaking");
});
