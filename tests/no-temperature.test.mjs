import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { EXCLUDED_PHENOMENA, SOURCE, TARGET } from "../scripts/earth-map/copy-package.mjs";
import { PHENOMENON_IDS } from "../web/studio/datasets.js";
import { copyFor } from "../web/studio/studio-ui-copy.js";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const WORDS = /temperature|حرار|T2M|degC|warmer|cooler|أدفأ|أبرد/i;
// Our files: the Studio, the site, the pages, the scripts and the Earth Map docs. Not scanned: the verified data copy (Mohammad's package, verbatim)
// and the NOTE in docs/final-ui/CHANGES.md. scripts/earth-map/copy-package.mjs is the one script that must name what it skips.
const SCANNED = ["web/studio", "web/cinematic", "web/pages", "scripts", "docs/earth-map"];
const ALLOWED = new Set(["scripts/earth-map/copy-package.mjs"]);
const TEXT = /\.(js|mjs|cjs|html|css|json|md|txt|svg)$/;

async function walk(dir, out = []) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "node_modules") await walk(path, out); } else if (TEXT.test(entry.name)) out.push(path);
  }
  return out;
}

test("no page, script, UI string or Earth Map doc of ours mentions temperature (English or Arabic)", async () => {
  const hits = [];
  let scanned = 0;
  for (const dir of SCANNED) {
    for (const file of await walk(join(root, dir))) {
      const rel = relative(root, file).split(sep).join("/");
      if (ALLOWED.has(rel) || rel.startsWith("web/assets/")) continue;
      scanned++;
      const text = await readFile(file, "utf8");
      const m = text.match(WORDS);
      if (m) hits.push(rel + ": " + m[0]);
    }
  }
  assert.ok(scanned > 60, "the scan really read our files (" + scanned + ")");
  assert.deepEqual(hits, []);
});

test("the app has Dust, Rain and Wind only: the dataset list, the copy and the data copy", async () => {
  assert.deepEqual([...PHENOMENON_IDS], ["dust", "rainfall", "wind"]);
  for (const language of ["en", "ar"]) assert.deepEqual(Object.keys(copyFor(language).phen.short).filter((k) => k !== "forests"), ["dust", "rainfall", "wind"]);
  assert.deepEqual([...EXCLUDED_PHENOMENA], ["temperature"]);
  for (const id of EXCLUDED_PHENOMENA) {
    await assert.rejects(access(join(TARGET, id)), "the copy has no folder for " + id);
    await access(join(SOURCE, id)); // Mohammad's package is untouched
  }
});

test("the NOTE about Mohammad's package is in CHANGES.md", async () => {
  const text = await readFile(join(root, "docs/final-ui/CHANGES.md"), "utf8");
  assert.ok(text.includes("deliverables/EarthPulse-JSON-ONLY/temperature/") && /intentionally does not use/.test(text));
});
