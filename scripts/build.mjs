import { cp, mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const destination = resolve(root, "dist");
const manifest = JSON.parse(await readFile(resolve(root, "science/gedi/provenance.json"), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Older Windows checkouts may have converted the checkpoint's line endings.
const sample = (await readFile(resolve(root, "science/gedi/sample.json"), "utf8")).replaceAll("\r\n", "\n");
const eic = await readFile(resolve(root, "web/assets/gedi/svs-4950.jpg"));
if (digest(sample) !== "153b9fce2eb38fa62f2db2638f73ab66414871996e7ff101aee2136e03542c56") {
  throw new Error("The GEDI checkpoint sample failed its integrity check.");
}
if (digest(eic) !== manifest.eic.asset_sha256) {
  throw new Error("The NASA SVS image failed its integrity check.");
}

const atlasFiles = new Map();
for (const [file, hash] of [
  ["mur-sst.csv", "d196c976396192b2b1b0dc0dcba267fcba535bcc1e11623c3b5a0939a90c653a"],
  ["imerg.csv", "fc7897a4e528f3d1a3d8938db9f15cebe000b5df54d390989aa0ea30ef11e22b"],
  ["firms-noaa21-europe.csv", "076d2d12eac400e8eb75cf6258ed74aa7400d389606fd06f89e0d415ae561622"],
]) {
  const contents = (await readFile(resolve(root, "science/atlas", file), "utf8")).replaceAll("\r\n", "\n");
  if (digest(contents) !== hash) throw new Error(`The ${file} subset failed its integrity check.`);
  atlasFiles.set(file, contents);
}

await cp(resolve(root, "web"), destination, { recursive: true });
await mkdir(resolve(destination, "assets/gedi"), { recursive: true });
await writeFile(resolve(destination, "assets/gedi/sample.json"), sample);
await copyFile(resolve(root, "science/gedi/provenance.json"), resolve(destination, "assets/gedi/provenance.json"));
for (const [file, contents] of atlasFiles) await writeFile(resolve(destination, "assets/atlas", file), contents);
await copyFile(resolve(root, "science/atlas/mur-sst-url.txt"), resolve(destination, "assets/atlas/mur-sst-url.txt"));
console.log("Built dist/ with the EarthPulse Atlas and all four science cases.");
