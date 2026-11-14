import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validateFrame } from "../site/science.js";

const media = new URL("../site/media/", import.meta.url);
const data = validateFrame(JSON.parse(await readFile(new URL("night-lights.json", media), "utf8")));
for (const name of ["night-lights.webp", ...data.regions.map(region => region.image)]) {
  const bytes = await readFile(new URL(name, media));
  const sum = createHash("sha256").update(bytes).digest("hex");
  assert.equal(sum, data.media[name], name + " differs from the asset generated from the pinned NASA frame");
}
console.log("Verified the source manifest, 48 bands and five frame assets.");
