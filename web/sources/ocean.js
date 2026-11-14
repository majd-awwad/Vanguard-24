import { sources } from "./catalog.js";

const sites = [
  { id: "south", lat: 35, lon: -68 },
  { id: "north", lat: 44, lon: -62 },
];
const start = Date.UTC(2024, 7, 1, 9);
const week = 7 * 86400000;
const expectedTimes = Array.from({ length: 7 }, (_, index) => new Date(start + index * week).toISOString().replace(".000Z", "Z"));
const granuleIds = ["G3182116833", "G3189287721", "G3198325058", "G3207969622", "G3219593197", "G3229209724", "G3237231780"];

/** @returns {import('./contracts.js').GriddedSeries} */
export function parseOcean(csv, subsetUrl) {
  const [header, units, ...rows] = csv.trim().split(/\r?\n/);
  if (header !== "time,latitude,longitude,analysed_sst,analysis_error,mask"
      || units !== "UTC,degrees_north,degrees_east,degree_C,degree_C," || rows.length !== 1001) {
    throw new Error("Unexpected MUR SST subset schema.");
  }
  const cells = new Map();
  for (const row of rows) {
    const [time, latText, lonText, valueText, errorText, maskText] = row.split(",");
    const [lat, lon, value, error, mask] = [latText, lonText, valueText, errorText, maskText].map(Number);
    const index = expectedTimes.indexOf(time);
    if (index < 0 || !Number.isInteger((lat - 32) / 1.5) || !Number.isInteger((lon + 74) / 1.5)
        || lat < 32 || lat > 47 || lon < -74 || lon > -56 || !Number.isInteger(mask)) {
      throw new Error(`Unexpected MUR coordinate, timestamp or mask: ${row}`);
    }
    const key = `${lat},${lon}`;
    if (!cells.has(key)) cells.set(key, { lat, lon, samples: Array(7) });
    const cell = cells.get(key);
    if (cell.samples[index] !== undefined) throw new Error(`Duplicate MUR cell: ${row}`);
    if (mask === 1 && (!Number.isFinite(value) || value < -7.767 || value > 57.767 || !Number.isFinite(error) || error < 0)) {
      throw new Error(`Invalid open-water SST sample: ${row}`);
    }
    cell.samples[index] = { value: mask === 1 ? value : null, error: mask === 1 ? error : null, mask };
  }
  if (sites.some(({ lat, lon }) => !cells.get(`${lat},${lon}`)?.samples.every(({ value }) => value !== null))) {
    throw new Error("MUR comparison sites must be open ocean for all seven dates.");
  }
  return {
    id: "ocean", kind: "gridded-time-series", source: sources[0], coordinates: "EPSG:4326",
    subsetUrl: subsetUrl.trim(), unit: "°C", sites, cells: [...cells.values()],
    bounds: { south: 31.25, north: 47.75, west: -74.75, east: -55.25 }, step: 1.5,
    times: expectedTimes.map((time, index) => ({ start: time, end: time,
      granule: `https://cmr.earthdata.nasa.gov/search/concepts/${granuleIds[index]}-POCLOUD.html`,
    })),
  };
}

export async function loadOcean() {
  const files = ["mur-sst.csv", "mur-sst-url.txt"];
  const contents = await Promise.all(files.map(async (file) => {
    const response = await fetch(new URL(`../assets/atlas/${file}`, import.meta.url));
    if (!response.ok) throw new Error(`Could not load ${file} (${response.status}).`);
    return response.text();
  }));
  return parseOcean(...contents);
}
