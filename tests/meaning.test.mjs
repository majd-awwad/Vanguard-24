import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PHENOMENON_IDS, openPackage } from "../web/studio/datasets.js";
import { AMBIENCE_PHENOMENA, DOCUMENTED_BREAKPOINTS, levelFor } from "../web/studio/ambience-core.js";
import { meaningCopy, meaningLevel, meaningPhrase, spokenNumber } from "../web/studio/meaning.js";
import { GUIDED, createSpeech } from "../web/studio/speech.js";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async (u) => { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest: async (b) => createHash("sha256").update(b).digest("hex") });
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");

test("the meaning phrases cover exactly the phenomena of the app, with the documented breakpoints", () => {
  assert.deepEqual(Object.keys(meaningCopy.en).filter((k) => k !== "missing").sort(), [...PHENOMENON_IDS].sort());
  assert.deepEqual(Object.keys(meaningCopy.ar).filter((k) => k !== "missing").sort(), [...PHENOMENON_IDS].sort());
  assert.deepEqual([...AMBIENCE_PHENOMENA], [...PHENOMENON_IDS]);
});

const WORDS = {
  en: {
    dust: ["Dust: low compared with this dataset", "Dust: moderate compared with this dataset", "Dust: high compared with this dataset"],
    rainfall: ["Rain: light compared with this dataset", "Rain: moderate compared with this dataset", "Rain: high compared with this dataset"],
    wind: ["Wind: low compared with this dataset", "Wind: moderate compared with this dataset", "Wind: high compared with this dataset"],
    none: "Rain: no measurable rain", missing: "no data here",
  },
  ar: {
    dust: ["غبار منخفض مقارنة ببقية البيانات", "غبار متوسط مقارنة ببقية البيانات", "غبار مرتفع مقارنة ببقية البيانات"],
    rainfall: ["مطر قليل مقارنة ببقية البيانات", "مطر متوسط مقارنة ببقية البيانات", "مطر مرتفع مقارنة ببقية البيانات"],
    wind: ["رياح ضعيفة مقارنة ببقية البيانات", "رياح متوسطة مقارنة ببقية البيانات", "رياح قوية مقارنة ببقية البيانات"],
    none: "لا يوجد مطر يُقاس", missing: "لا توجد بيانات هنا",
  },
};

test("every phenomenon, every level, English and Arabic: the exact wording, from the documented breakpoints", () => {
  const rank = ["low", "mid", "high"];
  for (const language of ["en", "ar"]) {
    for (const id of AMBIENCE_PHENOMENA) {
      const bp = DOCUMENTED_BREAKPOINTS[id];
      const probes = [[bp.low, "low"], [bp.low - 0.01 > 0.1 || id !== "rainfall" ? bp.low - 0.01 : bp.low, "low"], [(bp.low + bp.high) / 2, "mid"], [bp.high, "mid"], [bp.high + 0.01, "high"]];
      for (const [value, level] of probes) {
        assert.equal(meaningLevel({ phenomenon: id, value }), level, id + " " + value);
        assert.equal(meaningPhrase({ phenomenon: id, value, language }), WORDS[language][id][rank.indexOf(level)], language + " " + id + " " + level);
      }
      assert.equal(meaningPhrase({ phenomenon: id, value: null, language }), WORDS[language].missing);
      assert.equal(meaningPhrase({ phenomenon: id, value: Number.NaN, language }), WORDS[language].missing);
    }
    assert.equal(meaningPhrase({ phenomenon: "rainfall", value: 0.0999, language }), WORDS[language].none, "no measurable rain");
    assert.equal(meaningPhrase({ phenomenon: "rainfall", value: 0, language }), WORDS[language].none);
    assert.equal(meaningPhrase({ phenomenon: "rainfall", value: 0.1, language }), WORDS[language].rainfall[0], "0.1 mm/h is light rain");
    assert.equal(meaningPhrase({ phenomenon: "forests", value: 3, language }), null, "no phrase for a phenomenon without one");
  }
  assert.deepEqual(Object.keys(meaningCopy), ["en", "ar"]);
});

test("the phrase level is the level of the recording: same breakpoints, same bins, over every value of a catalog date", async () => {
  for (const id of ["dust", "rainfall", "wind"]) {
    const phen = await pkg.openPhenomenon(id);
    for (const v of phen.list[3].values) {
      const recording = levelFor({ phenomenon: id, value: v, breakpoints: DOCUMENTED_BREAKPOINTS[id] });
      const said = meaningLevel({ phenomenon: id, value: v });
      if (Number.isFinite(v)) assert.equal(said, recording ?? "none", id + " " + v); else assert.equal(said, "missing");
    }
  }
});

test("wording is relative, never a weather claim", () => {
  for (const language of ["en", "ar"]) {
    const all = JSON.stringify(meaningCopy[language]);
    assert.ok(!/storm|heavy|severe|dangerous|freezing|عاصف|غزير|خطير/.test(all));
  }
});

test("spoken numbers are rounded sensibly: 0.17, 23, 4.1", () => {
  assert.equal(spokenNumber("rainfall", 0.1737), "0.17");
  assert.equal(spokenNumber("wind", 4.0999), "4.1");
  assert.equal(spokenNumber("dust", 0.537), "0.54");
});

test("spoken order and badges are wired into the Studio: phrase, value, place, date only when changed; badge in the card and the tooltip", async () => {
  const studio = await read("web/studio/studio.js");
  const body = studio.slice(studio.indexOf("function spokenNow"), studio.indexOf("const spoken = "));
  const order = ["mean.text", "spokenNumber(", "formatLat(", "lastSpokenDate"].map((s) => body.indexOf(s));
  assert.ok(order.every((i) => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]), "phrase, value, place, date in that order");
  assert.ok(studio.includes("if (date !== lastSpokenDate)"));
  assert.ok(studio.includes("always || mean.text !== lastSpokenPhrase"), "while exploring the phrase is spoken only the first time and when it changes");
  assert.ok(studio.includes("spoken(state.cursor, \"\", true)"), "an explicit request always says the full phrase");
  assert.ok(studio.includes("fillBadge(el.insBadge"), "badge in the selected-place card");
  assert.ok(studio.includes("makeBadge(mean)"), "badge in the hover tooltip");
  assert.ok(!/GUIDED/.test(body), "the text does not depend on the mode; only speech does");
  assert.ok(!/speech\.(say|announce)\(readText/.test(studio) && !/guided\(readText/.test(studio), "automatic speech uses the new order");
});

test("speech resolves the text only when it is said: a cancelled announcement never counts, Guided speaks after the pause", () => {
  const spoken = [];
  let timers = [];
  let made = 0;
  class U { constructor(t) { this.text = t; } }
  const synth = { speak: (u) => spoken.push(u.text), cancel() {}, getVoices: () => [{ lang: "en-US" }] };
  const speech = createSpeech({ synth, Utterance: U, language: () => "en", setTimer: (f) => { timers.push(f); return timers.length; }, clearTimer: () => { timers = []; } });
  speech.setMode(GUIDED);
  speech.announce(() => { made++; return "first"; });
  speech.announce(() => { made++; return "second"; });
  timers.forEach((f) => f());
  assert.equal(made, 1, "the stale announcement is never even composed");
  assert.deepEqual(spoken, ["second"]);
});
