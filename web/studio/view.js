// Map view maths for the Earth Sound Studio. Pure functions, no DOM.
// The map is plate carrée (x linear in longitude, y linear in latitude), the projection the dust grid documents
// (docs/dust-v2-data.md). A view is { lon, lat, zoom }: the geographic point at the viewport centre and a zoom
// factor where 1 means the whole region just fits the viewport.

export const MAX_ZOOM = 18;

export const createView = (bounds) => ({ lon: (bounds.west + bounds.east) / 2, lat: (bounds.south + bounds.north) / 2, zoom: 1 });

/** Pixels per degree at zoom 1: the whole region fits (contain). */
export function basePixelsPerDegree(bounds, width, height) {
  return Math.min(width / (bounds.east - bounds.west), height / (bounds.north - bounds.south));
}

export const pixelsPerDegree = (view, bounds, width, height) => basePixelsPerDegree(bounds, width, height) * view.zoom;

/** Keeps the zoom in range and the viewport inside the region (centred on an axis when the region is smaller). */
export function clampView(view, bounds, width, height) {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom));
  const ppd = basePixelsPerDegree(bounds, width, height) * zoom;
  const halfLon = width / (2 * ppd);
  const halfLat = height / (2 * ppd);
  const axis = (value, low, high, half) => (high - low <= 2 * half ? (low + high) / 2 : Math.min(high - half, Math.max(low + half, value)));
  return { zoom, lon: axis(view.lon, bounds.west, bounds.east, halfLon), lat: axis(view.lat, bounds.south, bounds.north, halfLat) };
}

export function screenToGeo(view, bounds, width, height, x, y) {
  const ppd = pixelsPerDegree(view, bounds, width, height);
  return { lon: view.lon + (x - width / 2) / ppd, lat: view.lat - (y - height / 2) / ppd };
}

export function geoToScreen(view, bounds, width, height, lon, lat) {
  const ppd = pixelsPerDegree(view, bounds, width, height);
  return { x: width / 2 + (lon - view.lon) * ppd, y: height / 2 - (lat - view.lat) * ppd };
}

/** Zooms by `factor` keeping the geographic point under (x, y) fixed. */
export function zoomAt(view, bounds, width, height, factor, x = width / 2, y = height / 2) {
  const anchor = screenToGeo(view, bounds, width, height, x, y);
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom * factor));
  const ppd = basePixelsPerDegree(bounds, width, height) * zoom;
  return clampView({ zoom, lon: anchor.lon - (x - width / 2) / ppd, lat: anchor.lat + (y - height / 2) / ppd }, bounds, width, height);
}

export function panBy(view, bounds, width, height, dx, dy) {
  const ppd = pixelsPerDegree(view, bounds, width, height);
  return clampView({ ...view, lon: view.lon - dx / ppd, lat: view.lat + dy / ppd }, bounds, width, height);
}

/** The geographic window the viewport shows (may extend past the region on the long axis of a wide viewport). */
export function visibleBounds(view, bounds, width, height) {
  const ppd = pixelsPerDegree(view, bounds, width, height);
  return { west: view.lon - width / (2 * ppd), east: view.lon + width / (2 * ppd), south: view.lat - height / (2 * ppd), north: view.lat + height / (2 * ppd) };
}

/** Intersection of a window with the region; null when they do not overlap. */
export function clipToRegion(window, bounds) {
  const west = Math.max(window.west, bounds.west);
  const east = Math.min(window.east, bounds.east);
  const south = Math.max(window.south, bounds.south);
  const north = Math.min(window.north, bounds.north);
  return east > west && north > south ? { west, east, south, north } : null;
}

/** The view that shows `rect` (with a margin) as large as possible. */
export function fitRect(rect, bounds, width, height, margin = 0.1) {
  const spanLon = (rect.east - rect.west) * (1 + margin * 2);
  const spanLat = (rect.north - rect.south) * (1 + margin * 2);
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Math.min(width / spanLon, height / spanLat) / basePixelsPerDegree(bounds, width, height)));
  return clampView({ zoom, lon: (rect.west + rect.east) / 2, lat: (rect.south + rect.north) / 2 }, bounds, width, height);
}

export const lerpView = (a, b, t) => ({ lon: a.lon + (b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t, zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * t) });
