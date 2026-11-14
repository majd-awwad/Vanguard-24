import { sources } from "./catalog.js";

const archive = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Europe_7d.csv";
const sites = [
  { id: "balkans", bounds: { south: 39, north: 48, west: 15, east: 31 } },
  { id: "blackSea", bounds: { south: 45, north: 53, west: 31, east: 41 } },
];

/** @returns {import('./contracts.js').WindowedEvents} */
export function parseFires(csv) {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  if (header !== "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight"
    || rows.length !== 1811) throw new Error("Unexpected FIRMS snapshot schema.");
  const detections = rows.map((row) => {
    const [latitude, longitude, , , , date, hour, sensor, confidence, version, , frp] = row.split(",");
    const acquisitionTime = `${date}T${hour.slice(0, 2)}:${hour.slice(2)}:00Z`;
    const [lat, lon, frpMW] = [latitude, longitude, frp].map(Number);
    if (sensor !== "N21" || version !== "2.0NRT" || !["low", "nominal", "high"].includes(confidence)
      || !/^\d{4}$/.test(hour) || !Number.isFinite(Date.parse(acquisitionTime)) || !latitude || !longitude || !frp
      || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(frpMW)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180 || frpMW < 0) throw new Error("Invalid FIRMS detection.");
    return { lat, lon, acquisitionTime, sensor, confidence, frpMW };
  });
  const times = ["2026-11-07", "2026-11-08"].map((day, index) => ({
    start: `${day}T00:00:00Z`, end: `2026-11-${12 + index}T00:00:00Z`, granule: archive,
  }));
  const windows = times.map(({ start, end }) => ({ start, end,
    detections: detections.filter((row) => row.acquisitionTime >= start && row.acquisitionTime < end && row.confidence !== "low"),
  }));
  return {
    id: "fires", kind: "windowed-events", source: sources.find(({ id }) => id === "fires"),
    coordinates: "EPSG:4326", times, windows, sites, unit: "MW", subsetUrl: archive,
    bounds: { south: 38, north: 54, west: 13, east: 42 },
  };
}

export function regionDetections(data, site, index) {
  const { south, north, west, east } = site.bounds;
  return data.windows[index].detections.filter(({ lat, lon }) => lat >= south && lat < north && lon >= west && lon < east);
}

export async function loadFires() {
  const response = await fetch(new URL("../assets/atlas/firms-noaa21-europe.csv", import.meta.url));
  if (!response.ok) throw new Error(`Could not load FIRMS data (${response.status}).`);
  return parseFires(await response.text());
}
