import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PHENOMENON_IDS, openPackage } from "../web/studio/datasets.js";
import { monthlyGroup, toEchoData } from "../web/studio/echo-core.js";
import { resolveComparison } from "../web/studio/compare.js";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async (u) => { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest: async (b) => createHash("sha256").update(b).digest("hex") });
const catalogOf = (phen) => ({ snapshots: phen.list, comparisons: phen.comparisons, compatibilityGroups: phen.compatibilityGroups, policy: phen.compatibilityPolicy, unavailableComparisons: phen.unavailableComparisons });

test("every phenomenon uses the catalog's own compatibilityGroups (3 + 10 snapshots); the derived rule is only a fallback", async () => {
  for (const id of PHENOMENON_IDS) {
    const phen = await pkg.openPhenomenon(id);
    assert.equal(phen.groupsFrom, "catalog", id);
    assert.deepEqual(phen.compatibilityGroups.map((g) => g.snapshotIds.length), [3, 10], id);
    const declared = JSON.parse(await readFile(new URL(id + "/catalog.json", base), "utf8")).compatibilityGroups;
    assert.deepEqual(phen.compatibilityGroups, declared.map((g) => ({ modelSource: g.modelSource, snapshotIds: g.snapshotIds })), id);
  }
});

test("rain: a cross-build comparison is blocked with the catalog's policy text; the same build is allowed", async () => {
  const rain = await pkg.openPhenomenon("rainfall");
  assert.ok(rain.compatibilityPolicy.startsWith("Comparisons require the same literal NASA modelSource"));
  const [early, late] = [rain.byDate("2025-01-15"), rain.byDate("2025-05-15")];
  const blocked = pkg.resolveComparison(rain, early.id, late.id);
  assert.equal(blocked.status, "unavailable");
  assert.equal(blocked.reason, rain.compatibilityPolicy);
  assert.equal(resolveComparison(catalogOf(rain), early.id, late.id).reason, rain.compatibilityPolicy);
  const same = pkg.resolveComparison(rain, rain.byDate("2025-03-15").id, rain.byDate("2025-07-15").id);
  assert.equal(same.status, "computed");
});

test("Echo for rain uses one build group: 9 monthly points (March to November 2025, without 19 August)", async () => {
  const rain = await pkg.openPhenomenon("rainfall");
  const group = monthlyGroup(toEchoData(rain, { excludeDates: [] }));
  assert.equal(group.snapshots.length, 9);
  assert.equal(group.build, rain.compatibilityGroups.find((g) => g.snapshotIds.length === 10).modelSource);
  assert.deepEqual(group.snapshots.map((s) => s.date.slice(0, 7)), ["2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11"]);
});
