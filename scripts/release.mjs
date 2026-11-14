import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { atlasChecksums, buildSite, gediSampleSha256, isSiteSource, studioAssetChecksums } from "./build.mjs";
import { validateDecodeCase } from "../web/contracts/validate.js";
import {
  validateDustCatalog, validateDustComparison, validateDustGrid, validateDustSnapshot,
} from "../web/sources/decode/dust-visual.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const textExtensions = new Set([".html", ".js", ".css", ".json", ".ts", ".svg", ".txt", ".csv", ".md"]);
const pinnedScience = {
  ...Object.fromEntries([...atlasChecksums].map(([name, hash]) => ["assets/atlas/" + name, hash])),
  ...Object.fromEntries([...studioAssetChecksums].map(([name, hash]) => ["assets/studio/" + name, hash])),
  "assets/gedi/sample.json": gediSampleSha256,
  "assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json": "7f71da5fe3b10af60e6e78f169d2a68578f67d5d33c4717b1bc047023b5ca582",
  "assets/decode/svs-5669-context.webp": "abece93664d0966265da5819b6844a7b9dd9aac17aded9c84a0076f80d72b30a",
};
const generated = [
  "assets/gedi/provenance.json",
  "assets/gedi/sample.json",
  "assets/atlas/mur-sst-url.txt",
  ...[...atlasChecksums.keys()].map(name => "assets/atlas/" + name),
];
const entrypoints = [
  "index.html", "studio.html", "dust.html", "decode.html", "decode-3d.html", "dust-observatory.html", "forest.html",
  "pages/about.html", "pages/explore.html", "pages/science.html", "pages/settings.html", "pages/sound-lab.html", "pages/studio.html",
];
// These are assembled by runtime imports and asset resolvers rather than
// appearing as complete URL literals in markup.
const dynamicDependencies = [
  "audio/spatial-plan.js", "visual/decode-visual.js",
  "assets/atlas/svs-4285.jpg", "assets/atlas/svs-5113.jpg",
  "assets/gedi/cerrado-dusk.jpg",
  "assets/earth/blue-marble-2048.jpg", "assets/earth/blue-marble-4096.jpg",
  "assets/earth/black-marble-2048.jpg", "assets/earth/black-marble-3600.jpg",
  "assets/map/provenance.json",
];
const sha256 = data => createHash("sha256").update(data).digest("hex");

function canonicalBytes(path, bytes) {
  return textExtensions.has(extname(path))
    ? Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"))
    : bytes;
}

async function* filesIn(folder, prefix = "", source = false) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (source && !isSiteSource(entry.name)) continue;
    const path = prefix + entry.name;
    if (entry.isDirectory()) yield* filesIn(join(folder, entry.name), path + "/", source);
    else if (entry.isFile()) yield path;
    else throw Error("Unexpected file type: " + path);
  }
}

export function assertRelativeReferences(files) {
  const check = (path, reference) => {
    if (!reference || reference.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(reference)) return;
    const target = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    if (target.startsWith("/") || target.includes("\\")) {
      throw Error(path + " uses a non-portable URL: " + reference);
    }
    if (!target) return; // A query on the current document.
    const route = posix.normalize(posix.join(posix.dirname(path), target));
    const exists = files.has(route) || files.has(posix.join(route, "index.html"));
    const directory = target.endsWith("/") && [...files.keys()].some(name => name.startsWith(route.replace(/\/$/, "") + "/"));
    if (!exists && !directory) {
      throw Error(path + " references missing " + reference);
    }
  };

  for (const [path, bytes] of files) {
    const extension = extname(path);
    if (extension === ".html") {
      const html = bytes.toString("utf8");
      for (const [, , reference] of html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) check(path, reference);
      // Inline type=module scripts may import an entry point.
      for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) checkImports(path, script, check);
    } else if (extension === ".js") {
      checkImports(path, bytes.toString("utf8"), check);
    } else if (extension === ".css") {
      for (const [, , quoted, bare] of bytes.toString("utf8").matchAll(/\burl\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/gi)) {
        check(path, quoted ?? bare);
      }
    }
  }
}

function checkImports(path, source, check) {
  for (const [, , reference] of source.matchAll(/^[ \t]*(?:import\s+|export\s+)(?:[^"'()]*?\sfrom\s+)?(["'])(.*?)\1/gm)) {
    check(path, reference);
  }
  for (const [, , reference] of source.matchAll(/new URL\(\s*(["'])(.*?)\1\s*,\s*import\.meta\.url/g)) {
    check(path, reference);
  }
}

export async function verifyBuild(folder) {
  const expected = new Set(generated);
  for await (const path of filesIn(join(root, "web"), "", true)) expected.add(path);
  const files = new Map();
  for await (const path of filesIn(folder)) {
    if (/(?:^|\/)(?:raw|tests?|fixtures?|\.[^/]+)(?:\/|$)|\.(?:nc4?|hdf5?|py|pyc)$/i.test(path)) {
      throw Error("Non-production content in dist: " + path);
    }
    if (!expected.delete(path)) throw Error("Unexpected build file: " + path);
    files.set(path, canonicalBytes(path, await readFile(join(folder, path))));
  }
  if (expected.size) throw Error("Missing build file(s): " + [...expected].join(", "));
  for (const path of [...entrypoints, ...dynamicDependencies]) {
    if (!files.has(path)) throw Error("Missing runtime dependency: " + path);
  }
  assertRelativeReferences(files);

  const readJson = path => JSON.parse(files.get(path).toString("utf8"));
  const mapAssets = readJson("assets/map/provenance.json").assets;
  for (const id of ["ocean", "rain", "fires", "dust"]) {
    const path = "assets/map/" + id + ".jpg";
    const info = mapAssets[id];
    const bytes = files.get(path);
    if (info?.file !== id + ".jpg" || !bytes || bytes.length !== info.bytes || sha256(bytes) !== info.sha256) {
      throw Error("Map asset checksum mismatch: " + path);
    }
  }
  const assertDigest = (path, digest) => {
    if (!files.has(path) || sha256(files.get(path)) !== digest) throw Error("Science checksum mismatch: " + path);
  };
  for (const [path, digest] of Object.entries(pinnedScience)) assertDigest(path, digest);
  assertDigest("assets/gedi/svs-4950.jpg", readJson("assets/gedi/provenance.json").eic.asset_sha256);

  const referencePath = "assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json";
  const reference = readJson(referencePath);
  validateDecodeCase(reference);
  if (reference.fixture) throw Error("Guided Discovery must package the verified reference case");

  const dust = "assets/decode/dust-v2/";
  const catalog = readJson(dust + "catalog.json");
  validateDustCatalog(catalog);
  for (const [entries, validate] of [
    [[catalog.grid], validateDustGrid],
    [catalog.snapshots, validateDustSnapshot],
    [catalog.comparisons, validateDustComparison],
  ]) {
    for (const entry of entries) {
      assertDigest(dust + entry.path, entry.sha256_lf);
      const asset = readJson(dust + entry.path);
      validate(asset);
      if (entry.id && asset.id !== entry.id) throw Error("Dust asset identity mismatch: " + entry.path);
    }
  }
  return files;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

// ZIP32 stored entries, with sorted paths and a fixed 1980-01-01 timestamp.
// The static site is small and much of the asset weight is already compressed.
export function packSite(files) {
  const entries = [...files.keys()].sort();
  if (entries.length > 0xffff) throw Error("Too many files for ZIP32");
  const local = [];
  const central = [];
  let offset = 0;
  let centralSize = 0;
  for (const path of entries) {
    const bytes = files.get(path);
    const name = Buffer.from(path);
    if (name.length > 0xffff || offset + bytes.length + name.length + 30 > 0xffffffff) {
      throw Error("Site exceeds the ZIP32 limit");
    }
    const checksum = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8 paths.
    header.writeUInt16LE(0x0021, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, bytes);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    header.copy(record, 6, 4, 30);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);
    offset += header.length + name.length + bytes.length;
    centralSize += record.length + name.length;
  }
  if (offset + centralSize > 0xffffffff) throw Error("Site exceeds the ZIP32 limit");

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

async function releaseSite() {
  const output = join(root, "release");
  await mkdir(output, { recursive: true });
  const temp = await mkdtemp(join(output, ".earthpulse-"));
  try {
    const stage = join(temp, "site");
    await buildSite(stage);
    const files = await verifyBuild(stage);
    const archive = packSite(files);
    const name = "earthpulse.zip";
    const hash = sha256(archive);
    await writeFile(join(temp, name), archive);
    await writeFile(join(temp, "earthpulse.sha256"), hash + "  " + name + "\n");
    await rename(join(temp, name), join(output, name));
    await rename(join(temp, "earthpulse.sha256"), join(output, "earthpulse.sha256"));
    console.log("Verified " + files.size + " files and wrote release/" + name);
    console.log("SHA-256 " + hash);
  } finally {
    // Only the newly allocated directory under the release output is removed.
    if (dirname(temp) === output && temp.startsWith(output + sep + ".earthpulse-")) {
      await rm(temp, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "--verify") {
    const files = await verifyBuild(join(root, "dist"));
    console.log("Verified " + files.size + " packaged files, relative routes, and scientific asset checksums.");
  } else {
    await releaseSite();
  }
}
