import { sources } from "./catalog.js";
import { loadGediCase } from "../data/gedi-case.js";

export async function loadForest() {
  const gedi = await loadGediCase({
    sampleUrl: new URL("../assets/gedi/sample.json", import.meta.url),
    provenanceUrl: new URL("../assets/gedi/provenance.json", import.meta.url),
  });
  /** @type {import('./contracts.js').DiscreteWaveforms} */
  const science = {
    id: "forest", kind: "discrete-waveforms", source: sources.find(({ id }) => id === "forest"),
    heightEdgesM: gedi.edges, axes: ["track", "height"], relativeTo: "estimated-ground",
    observations: gedi.footprints.map((row) => ({
      id: row.id, utc: row.utc, distanceM: row.distance,
      coordinates: { lat: row.coordinates[0], lon: row.coordinates[1] },
      returnFraction: row.profile, l1bCounts: row.raw.l1b_rxwaveform_adc_descending_height,
    })),
  };
  return { science, gedi };
}
