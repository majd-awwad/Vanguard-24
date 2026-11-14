import { cp, mkdir, copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { basename, resolve } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
export const gediSampleSha256 = "153b9fce2eb38fa62f2db2638f73ab66414871996e7ff101aee2136e03542c56";
export const atlasChecksums = new Map([
  ["mur-sst.csv", "d196c976396192b2b1b0dc0dcba267fcba535bcc1e11623c3b5a0939a90c653a"],
  ["imerg.csv", "fc7897a4e528f3d1a3d8938db9f15cebe000b5df54d390989aa0ea30ef11e22b"],
  ["firms-noaa21-europe.csv", "076d2d12eac400e8eb75cf6258ed74aa7400d389606fd06f89e0d415ae561622"],
]);
export const studioAssetChecksums = new Map([
  ["nightlights-2012.jpg", "31deb9a5a5c2f06a4d661fb02dee59d07a04db331fec3566f228241c07daa03b"],
  ["nightlights-2023.jpg", "2f9b2e2a39a87e9b2627a04a77cb32d17fe235929ec0d45d582e7b638ba658b9"],
  ["nightlights-change.jpg", "c46d9ae67c93f97bd1d376fc4d2246451576f3cdc78e2b7b4dcf41bc02ee9601"],
]);

export function isSiteSource(path) {
  return !basename(path).startsWith(".");
}

export async function buildSite(destination = resolve(root, "dist")) {
  const manifest = JSON.parse(await readFile(resolve(root, "science/gedi/provenance.json"), "utf8"));
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  // Older Windows checkouts may have converted the checkpoint's line endings.
  const sample = (await readFile(resolve(root, "science/gedi/sample.json"), "utf8")).replaceAll("\r\n", "\n");
  const eic = await readFile(resolve(root, "web/assets/gedi/svs-4950.jpg"));
  if (digest(sample) !== gediSampleSha256) {
    throw new Error("The GEDI checkpoint sample failed its integrity check.");
  }
  if (digest(eic) !== manifest.eic.asset_sha256) {
    throw new Error("The NASA SVS image failed its integrity check.");
  }

  const atlasFiles = new Map();
  for (const [file, hash] of atlasChecksums) {
    const contents = (await readFile(resolve(root, "science/atlas", file), "utf8")).replaceAll("\r\n", "\n");
    if (digest(contents) !== hash) throw new Error("The " + file + " subset failed its integrity check.");
    atlasFiles.set(file, contents);
  }

  const studioManifest = JSON.parse(await readFile(resolve(root, "web/assets/studio/manifest.json"), "utf8"));
  if (studioManifest.status !== "REFERENCE_IMAGE_ONLY" || studioManifest.quantitative !== false) {
    throw new Error("The Studio must not claim numeric radiance without a verified processed bundle.");
  }
  for (const [file, hash] of studioAssetChecksums) {
    const contents = await readFile(resolve(root, "web/assets/studio", file));
    if (digest(contents) !== hash || studioManifest.layers[file.includes("2012") ? "2012" : file.includes("2023") ? "2023" : "change"].sha256 !== hash) {
      throw new Error("The NASA SVS Studio asset failed its integrity check: " + file);
    }
  }

  await cp(resolve(root, "web"), destination, { recursive: true, filter: isSiteSource });
  await mkdir(resolve(destination, "assets/gedi"), { recursive: true });
  await writeFile(resolve(destination, "assets/gedi/sample.json"), sample);
  await copyFile(resolve(root, "science/gedi/provenance.json"), resolve(destination, "assets/gedi/provenance.json"));
  for (const [file, contents] of atlasFiles) await writeFile(resolve(destination, "assets/atlas", file), contents);
  await copyFile(resolve(root, "science/atlas/mur-sst-url.txt"), resolve(destination, "assets/atlas/mur-sst-url.txt"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildSite();
  // The previous CLI copied this exact source metadata path into dist.
  await rm(resolve(root, "dist/assets/decode/dust-v2/.gitignore"), { force: true });
  console.log("Built dist/ with Earth Sound Studio, Atlas, Dust Observatory and Earth Detective.");
}
