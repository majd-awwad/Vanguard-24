import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildSite } from "../scripts/build.mjs";
import { assertRelativeReferences, packSite, verifyBuild } from "../scripts/release.mjs";

const verifyFixtureRoutes = html => assertRelativeReferences(new Map([
  ["index.html", Buffer.from(html)],
  ["nested/index.html", Buffer.from("<p>Nested page</p>")],
  ["nested/script.js", Buffer.from('import "../shared.js";')],
  ["shared.js", Buffer.from("")],
]));

test("static references resolve under any hosting prefix and reject root-relative or missing targets", () => {
  verifyFixtureRoutes('<a href="./nested/?lang=ar">Open</a><script src="nested/script.js"></script>');
  assert.throws(() => verifyFixtureRoutes('<a href="/nested/">Open</a>'), /non-portable URL/);
  assert.throws(() => verifyFixtureRoutes('<a href="%2Fnested/">Open</a>'), /non-portable URL/);
  assert.throws(() => verifyFixtureRoutes('<img src="./missing.webp">'), /references missing/);
  assert.throws(() => verifyFixtureRoutes('<script type="module">\n    import "./missing.js";</script>'), /references missing/);
  assert.throws(() => assertRelativeReferences(new Map([
    ["screen.css", Buffer.from('body { background: url("missing.svg") }')],
  ])), /references missing/);
});

test("ZIP32 packaging keeps original bytes, sorted portable paths, and stable output", () => {
  const files = new Map([["nested/é.txt", Buffer.from([0xff, 0x01])], ["index.html", Buffer.from("123456789")]]);
  const archive = packSite(files);
  assert.deepEqual(archive, packSite(new Map([...files].reverse())));
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.equal(archive.readUInt16LE(12), 0x0021);
  assert.equal(archive.readUInt32LE(14), 0xcbf43926); // Published CRC-32 check vector.
  const footer = archive.length - 22;
  assert.equal(archive.readUInt32LE(footer), 0x06054b50);
  assert.equal(archive.readUInt16LE(footer + 10), files.size);
  let cursor = archive.readUInt32LE(footer + 16);
  const found = new Map();
  while (cursor < footer) {
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50);
    const size = archive.readUInt32LE(cursor + 24);
    const nameSize = archive.readUInt16LE(cursor + 28);
    const path = archive.subarray(cursor + 46, cursor + 46 + nameSize).toString();
    const offset = archive.readUInt32LE(cursor + 42);
    assert.equal(archive.readUInt32LE(offset), 0x04034b50);
    const contentStart = offset + 30 + nameSize;
    found.set(path, archive.subarray(contentStart, contentStart + size));
    cursor += 46 + nameSize;
  }
  assert.deepEqual([...found.keys()], ["index.html", "nested/é.txt"]);
  assert.deepEqual(found, files);
});

test("the host payload is derived from a fresh build and rejects fixture or compromised science files", async () => {
  const parent = fileURLToPath(new URL("../", import.meta.url)).replace(/[\\/]$/, "");
  const stage = await mkdtemp(join(parent, ".earthpulse-release-test-"));
  try {
    await buildSite(stage);
    const files = await verifyBuild(stage);
    const requirePath = path => assert.ok(files.has(path), "Missing " + path);
    requirePath("dust-observatory.html");
    requirePath("decode-3d.html");
    requirePath("assets/map/rain.jpg");
    requirePath("assets/decode/dust-v2/catalog.json");
    requirePath("assets/gedi/sample.json");
    assert.ok([...files].every(([path]) => !path.includes("\\") && !path.includes(".gitignore")));
    await writeFile(join(stage, "fixture.nc4"), "synthetic");
    await assert.rejects(verifyBuild(stage), /Non-production content/);
    await rm(join(stage, "fixture.nc4"));
    const broken = join(stage, "assets/atlas/mur-sst.csv");
    await writeFile(broken, "broken science asset");
    await assert.rejects(verifyBuild(stage), /Science checksum mismatch: assets\/atlas\/mur-sst.csv/);
  } finally {
    if (dirname(stage) === parent && stage.startsWith(parent + sep + ".earthpulse-release-test-")) {
      await rm(stage, { recursive: true, force: true });
    }
  }
});
