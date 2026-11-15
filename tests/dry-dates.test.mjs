import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { openPackage } from "../web/studio/datasets.js";
import { SIGNAL, dryNotice, isDryValue, signalShare } from "../web/studio/signal-core.js";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async (u) => { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest: async (b) => createHash("sha256").update(b).digest("hex") });
const copy = await readFile(new URL("../web/studio/studio-ui-copy.js", import.meta.url), "utf8");

test("rain: a dry date gets a notice with the three wettest real dates, computed from the data", async () => {
  const rain = await pkg.openPhenomenon("rainfall");
  const jan = rain.byDate("2025-01-15");
  const notice = dryNotice({ phenomenon: "rainfall", list: rain.list, currentId: jan.id });
  assert.ok(notice, "15 January has only 45 cells at or above 0.1 mm/h");
  assert.equal(notice.count, 45);
  assert.deepEqual(notice.suggestions.map((s) => s.date), ["2025-08-15", "2025-07-15", "2025-11-15"]);
  assert.deepEqual(notice.suggestions.map((s) => s.count), [153, 114, 108]);
  for (const s of notice.suggestions) {
    const recount = [...rain.snapshot(s.id).values].filter((v) => v >= SIGNAL.rainfall.floor).length;
    assert.equal(recount, s.count, "each suggestion is recounted from the snapshot values");
  }
});

test("a date with enough measurable rain gets no notice; suggestions are always better than the current date", async () => {
  const rain = await pkg.openPhenomenon("rainfall");
  assert.equal(dryNotice({ phenomenon: "rainfall", list: rain.list, currentId: rain.byDate("2025-08-15").id }), null);
  assert.equal(dryNotice({ phenomenon: "rainfall", list: rain.list, currentId: rain.byDate("2025-04-15").id }), null, "101 cells = 10.1%");
  for (const s of rain.list) {
    const notice = dryNotice({ phenomenon: "rainfall", list: rain.list, currentId: s.id });
    if (!notice) continue;
    assert.ok(notice.suggestions.length >= 1 && notice.suggestions.length <= 3, s.date);
    assert.ok(notice.suggestions.every((x) => x.share > notice.share && x.id !== s.id), s.date);
  }
});

test("the same pattern covers wind, and phenomena without a floor never get a notice", async () => {
  assert.ok(SIGNAL.wind.floor > 0);
  const wind = await pkg.openPhenomenon("wind");
  for (const s of wind.list) assert.equal(dryNotice({ phenomenon: "wind", list: wind.list, currentId: s.id }), null, "wind is almost never calm in this region");
  const calm = [{ id: "a", date: "2025-01-01", values: new Array(100).fill(0) }, { id: "b", date: "2025-02-01", values: new Array(100).fill(2) }];
  assert.deepEqual(dryNotice({ phenomenon: "wind", list: calm, currentId: "a" }).suggestions.map((s) => s.date), ["2025-02-01"]);
  for (const id of ["dust"]) {
    const phen = await pkg.openPhenomenon(id);
    assert.equal(dryNotice({ phenomenon: id, list: phen.list, currentId: phen.list[0].id }), null, id);
  }
  assert.equal(signalShare([null, Number.NaN, 1, 0], 0.5).valid, 2, "missing values are not counted as dry");
});

test("a dry cell is explained, a missing value is not called dry", () => {
  assert.equal(isDryValue("rainfall", 0.05), true);
  assert.equal(isDryValue("rainfall", 0.1), false);
  assert.equal(isDryValue("rainfall", null), false);
  assert.ok(copy.includes("no measurable rain (< 0.1 mm/h)"));
  assert.ok(copy.includes("Little or no measurable rain on this date. Try a wetter date:"));
  assert.ok(copy.includes("قلّما يوجد مطر قابل للقياس في هذا التاريخ. جرّب تاريخًا أكثر مطرًا:"));
  assert.ok(copy.includes("لا مطر قابل للقياس (< 0.1 ملم/س)"));
});
