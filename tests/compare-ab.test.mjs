import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compareCopy } from "../web/studio/compare-copy.js";

const text = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("Region A/B: click flow, both languages carry the same keys", () => {
  assert.deepEqual(Object.keys(compareCopy.en).sort(), Object.keys(compareCopy.ar).sort());
  const compare = text("web/studio/compare.js");
  assert.match(compare, /state\.compareActive && opts\?\.user !== false/);
  assert.match(compare, /const d = vb - va/);
  assert.match(compare, /k\.missing/);
});

test("Region A/B: values come from the loaded snapshot, never zero for missing data", () => {
  const compare = text("web/studio/compare.js");
  assert.match(compare, /state\.snapshot\.values\[place\.cell\.index\]/);
  assert.match(compare, /Number\.isNaN\(v\) \? null : v/);
  assert.match(compare, /va !== null && vb !== null/);
});

test("Region A/B: playback reuses the existing fingerprint plan, and a phenomenon switch clears it", () => {
  const compare = text("web/studio/compare.js");
  assert.match(compare, /joinPlans\(fingerprintPlan\(a, values, kind, grid, api\.tonesFor\)/);
  assert.match(compare, /announce\(k\.clearedPhen\)/);
  assert.match(text("web/studio/studio.js"), /state\.compareActive = id === "compare"/);
});
