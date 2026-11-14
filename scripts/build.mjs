import { cp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";
import { validateDecodeCase } from "../web/contracts/validate.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const destination = resolve(root, "dist");
const source = resolve(root, "web");
const id = "dust-geos-fp-20250819-1930-north-africa-med";
const sample = (await readFile(resolve(source, "assets/decode/data", `${id}.json`), "utf8")).replaceAll("\r\n", "\n");
const provenance = JSON.parse(await readFile(resolve(root, "science/decode/dust-extraction.json"), "utf8"));
validateDecodeCase(JSON.parse(sample));
if (createHash("sha256").update(sample).digest("hex") !== provenance.case_sha256_lf) {
  throw new Error("The dust case failed its integrity check.");
}

// Remove only this checkout's generated output so retired pages cannot survive a rebuild.
if (!destination.startsWith(resolve(root) + sep) || destination !== resolve(root, "dist")) {
  throw new Error("Build output must be the workspace dist directory.");
}
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
console.log("Built dist/ with the single EarthPulse 3D interface.");
