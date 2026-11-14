const asset = (file) => new URL(`../assets/${file}`, import.meta.url).href;

/** @type {(import('./contracts.js').SourceReference & {id: string, kind: import('./contracts.js').ScientificCase['kind'], image: string, range: string, color: string})[]} */
export const sources = [
  { id: "ocean", kind: "gridded-time-series", status: "VERIFIED_RELATED_VISUAL", svs: "5101",
    product: "MUR SST", version: "4.1", url: "https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1",
    image: asset("atlas/svs-5101.jpg"), range: "2024-08-01 – 2024-09-12", color: "#70e4e7" },
  { id: "rain", kind: "gridded-time-series", status: "VERIFIED_RELATED_VISUAL", svs: "4285",
    product: "GPM IMERG Final", version: "V07B", url: "https://doi.org/10.5067/GPM/IMERGDF/DAY/07",
    image: asset("atlas/svs-4285.jpg"), range: "2024-09-24 – 2024-09-28", color: "#aec4ff" },
  { id: "fires", kind: "windowed-events", status: "VERIFIED_RELATED_VISUAL", svs: "5113",
    product: "NOAA-21 VIIRS / FIRMS", version: "2.0NRT", url: "https://firms.modaps.eosdis.nasa.gov/content/active_fire/",
    image: asset("atlas/svs-5113.jpg"), range: "2026-11-07 – 2026-11-12 UTC", color: "#ffad78" },
  { id: "forest", kind: "discrete-waveforms", status: "VERIFIED_RELATED_VISUAL", svs: "4950",
    product: "GEDI L1B / L2A", version: "V001", url: "https://svs.gsfc.nasa.gov/4950/",
    image: asset("gedi/cerrado-dusk.jpg"), range: "2019-04-18", color: "#dcf69b" },
];

export const svsUrl = (source) => `https://svs.gsfc.nasa.gov/${source.svs}/`;
