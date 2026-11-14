import { h } from "../cinematic/site/dom.js";
import { resolveComparison } from "./compare.js";

// Optional: a shareable link that stores the date, the layer pair, the selected area and the path (never any audio).
// Parsing validates everything against the catalog and the region, so a hand-edited link cannot inject anything.

const round = (n) => Number(n.toFixed(3));
const MAX_POINTS = 40;

/** Query parameters for the current state. `dates` maps snapshot id -> ISO date. */
export function encodeShare({ snapshotId, comparison, rect, path }, dates) {
  const params = new URLSearchParams();
  params.set("date", dates[snapshotId]);
  if (comparison) params.set("cmp", `${dates[comparison.a]},${dates[comparison.b]}`);
  if (rect) params.set("rect", [rect.west, rect.south, rect.east, rect.north].map(round).join(","));
  if (path?.length) params.set("path", path.slice(0, MAX_POINTS).map((p) => `${round(p.lon)},${round(p.lat)}`).join(";"));
  return params;
}

/** Validated state from a query string; anything invalid is dropped. */
export function decodeShare(search, catalog, bounds) {
  const params = new URLSearchParams(search);
  const byDate = Object.fromEntries(catalog.snapshots.map((s) => [s.date, s.id]));
  const out = {};
  const date = params.get("date");
  if (date && (byDate[date] || catalog.snapshots.some((s) => s.id === date))) out.snapshotId = byDate[date] ?? date;
  const cmp = params.get("cmp")?.split(",");
  if (cmp?.length === 2 && byDate[cmp[0]] && byDate[cmp[1]]) {
    const r = resolveComparison(catalog, byDate[cmp[0]], byDate[cmp[1]]);
    if (r.status === "published" || r.status === "computed") out.cmp = r;
  }
  const inside = (lon, lat) => Number.isFinite(lon) && Number.isFinite(lat) && lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
  const rect = params.get("rect")?.split(",").map(Number);
  if (rect?.length === 4 && inside(rect[0], rect[1]) && inside(rect[2], rect[3]) && rect[2] > rect[0] && rect[3] > rect[1]) out.rect = { west: rect[0], south: rect[1], east: rect[2], north: rect[3] };
  const path = params.get("path")?.split(";").slice(0, MAX_POINTS).map((pair) => pair.split(",").map(Number)).filter(([lon, lat]) => inside(lon, lat)).map(([lon, lat]) => ({ lon, lat }));
  if (path?.length) out.path = path;
  return out;
}

export function mountShare(api) {
  const { state, el, c, document, win, catalog, list } = api;
  const dates = Object.fromEntries(list.map((s) => [s.id, s.date]));
  const button = h(document, "button", { type: "button", class: "button ghost small-button", text: c.share.copy });
  const status = h(document, "p", { class: "small", role: "status", "aria-live": "polite", text: c.share.note });
  button.addEventListener("click", async () => {
    const params = encodeShare({ snapshotId: state.snapshot.id, comparison: state.cmpSources ? { a: state.cmpSources.a.id, b: state.cmpSources.b.id } : null, rect: state.rect, path: state.path }, dates);
    const url = new URL(document.URL);
    url.search = params.toString() + (new URLSearchParams(url.search).get("lang") ? "&lang=" + new URLSearchParams(url.search).get("lang") : "");
    try { await win.navigator.clipboard.writeText(url.href); status.textContent = c.share.copied; } catch { status.textContent = url.href; }
  });
  state.right.append(h(document, "section", { class: "panel" }, button, status));
  // Apply a link on load.
  const wanted = decodeShare(new URL(document.URL).search, catalog, api.bounds);
  if (wanted.rect) { state.rect = wanted.rect; }
  if (wanted.path) { state.path = wanted.path; api.refreshPath?.(); }
  if (wanted.cmp) {
    el.cmpA.value = wanted.cmp.first; el.cmpB.value = wanted.cmp.second;
    api.describeComparison?.();
    api.showChange?.();
  }
  api.invalidate();
}
