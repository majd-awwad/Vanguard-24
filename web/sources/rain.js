import { sources } from "./catalog.js";
import { csvNumber, isRegularCoordinate } from "./numeric.js";

const sites = [
  { id: "gulf", lat: 27.05, lon: -84.95 },
  { id: "mountains", lat: 37.05, lon: -84.95 },
];
const days = Array.from({ length: 5 }, (_, index) => `2024-09-${24 + index}`);
const granule = (day) => `https://data.gdex.ucar.edu/d734000/gpm_3imergdf_v07/2024/09/3B-DAY.MS.MRG.3IMERG.${day.replaceAll("-", "")}-S000000-E235959.V07B.nc4`;

/** @returns {import('./contracts.js').GriddedSeries} */
export function parseRain(csv) {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  if (header !== "date,lat,lon,rate_mm_day,valid_half_hours,granule_url" || rows.length !== 320) {
    throw new Error("Unexpected IMERG subset schema.");
  }
  const cells = new Map();
  for (const row of rows) {
    const [date, latText, lonText, rate, count, url, extra] = row.split(",");
    const [lat, lon, value, mask] = [latText, lonText, rate, count].map(csvNumber);
    const index = days.indexOf(date);
    if (extra !== undefined || index < 0 || url !== granule(date)
      || lat < 23.05 || lat > 37.05 || lon < -90.95 || lon > -76.95
      || !isRegularCoordinate(lat, 23.05, 2) || !isRegularCoordinate(lon, -90.95, 2)
      || !Number.isInteger(mask) || mask < 0 || mask > 48 || (rate !== "" && (!Number.isFinite(value) || value < 0))) {
      throw new Error(`Invalid IMERG sample: ${row}`);
    }
    const key = `${lat},${lon}`;
    if (!cells.has(key)) cells.set(key, { lat, lon, samples: Array(5) });
    const cell = cells.get(key);
    if (cell.samples[index] !== undefined) throw new Error(`Duplicate IMERG cell: ${row}`);
    const available = rate !== "" && mask === 48;
    cell.samples[index] = {
      value: available ? value : null,
      error: null,
      mask,
      status: available ? "available" : mask < 48 ? "incomplete-coverage" : "missing",
    };
  }
  return {
    id: "rain", kind: "gridded-time-series", source: sources.find(({ id }) => id === "rain"),
    coordinates: "EPSG:4326", unit: "mm/day", sites, cells: [...cells.values()], step: 2,
    bounds: { south: 22.05, north: 38.05, west: -91.95, east: -75.95 },
    sampling: {
      nativeLatDegrees: 0.1, nativeLonDegrees: 0.1,
      retainedLatStrideDegrees: 2, retainedLonStrideDegrees: 2, temporalSupport: "daily-utc",
    },
    times: days.map((day, index) => ({
      start: `${day}T00:00:00Z`, end: `${days[index + 1] ?? "2024-09-29"}T00:00:00Z`,
      endExclusive: true, granule: granule(day),
    })),
  };
}

export async function loadRain() {
  const response = await fetch(new URL("../assets/atlas/imerg.csv", import.meta.url));
  if (!response.ok) throw new Error(`Could not load IMERG data (${response.status}).`);
  return parseRain(await response.text());
}
