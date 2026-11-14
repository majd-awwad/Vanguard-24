import { loadDustCatalog, loadDustGrid, loadDustSnapshot } from "../sources/decode/dust-visual.js";
import { cellId, cellSize, fill, fillIso, formatLat, formatLon, formatUtcDate, formatUtcTime, trimNumber } from "../cinematic/site/cells.js";
import { h } from "../cinematic/site/dom.js";
import { mountNav } from "../cinematic/site/nav.js";
import { allowSpoilersThisVisit, spoilersUnlocked } from "../cinematic/site/progress.js";
import { cellAt, cellCenter, cellRect, diffInverse, NEAR_ZERO, valueColor, valueT, VALUE_MAX, VALUE_MIN } from "./field.js";
import { createCanvasRenderer } from "./renderer-2d.js";
import { createGlRenderer } from "./renderer-gl.js";
import { studioCopy } from "./studio-copy.js";
import { createStudioAudio } from "./audio.js";
import { mountCompare } from "./compare.js";
import { decodeShare, mountShare } from "./share.js";
import { mountTools } from "./tools.js";
import { drawWaveform } from "../cinematic/audio-tap.js";
import { loadSettings, saveSettings } from "../cinematic/site/settings.js";
import { HIGH_HZ, PITCH_LOW_HZ, changeSemitones, hoverPlan, lonPan, valueHz } from "./mapping.js";
import { clampView, createView, geoToScreen, lerpView, panBy, pixelsPerDegree, screenToGeo, zoomAt } from "./view.js";

export const DEFAULT_SNAPSHOT = "geos-fp-dust-20250819-1930";
const EARTH_URL = () => new URL("../assets/earth/blue-marble-4096.jpg", import.meta.url).href;
const EARTH_URL_SMALL = () => new URL("../assets/earth/blue-marble-2048.jpg", import.meta.url).href;

/** Catalog snapshots in time order. */
export const chronological = (catalog) => [...catalog.snapshots].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

let api_refreshDateInfo;
export function startStudio(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "studio", from: "pages" });
  const c = studioCopy[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("studio-root");
  if (spoilersUnlocked()) return mountStudio(document, root, language);
  root.replaceChildren(h(document, "section", { class: "panel st-lock", "aria-labelledby": "st-lock-title" },
    h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", { id: "st-lock-title", text: c.lock.title }), h(document, "p", { class: "lede", text: c.lock.text }),
    h(document, "div", { class: "actions" },
      h(document, "a", { class: "button", href: "../decode-3d.html" + (language === "ar" ? "?lang=ar" : ""), text: c.lock.decode }),
      (() => { const show = h(document, "button", { type: "button", class: "button ghost", text: c.lock.show }); show.addEventListener("click", () => { allowSpoilersThisVisit(); mountStudio(document, root, language); }); return show; })())));
  return Promise.resolve();
}

async function mountStudio(document, root, language) {
  const c = studioCopy[language];
  const win = document.defaultView;
  const params = new URL(document.URL).searchParams;
  const reduced = () => win.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  root.replaceChildren(h(document, "p", { class: "status", role: "status", text: c.loading }));

  let catalog;
  let grid;
  const cache = new Map();
  const getSnapshot = async (id) => { if (!cache.has(id)) cache.set(id, await loadDustSnapshot(id)); return cache.get(id); };
  try {
    [catalog, grid] = await Promise.all([loadDustCatalog(), loadDustGrid()]);
    const wanted = decodeShare(new URL(document.URL).search, catalog, catalog.bounds ?? grid.bounds);
    const startId = wanted.snapshotId ?? DEFAULT_SNAPSHOT;
    cache.set(startId, await loadDustSnapshot(startId));
  } catch (error) {
    console.error(error);
    const retry = h(document, "button", { type: "button", class: "button", text: c.retry });
    retry.addEventListener("click", () => location.reload());
    root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: c.error }), retry);
    return;
  }
  const bounds = grid.bounds;
  const size = cellSize(bounds, grid);
  const list = chronological(catalog);
  const first = cache.values().next().value;
  const state = { snapshot: first, comparison: null, layer: "dust", view: createView(bounds), cursor: null, tool: "explore", width: 1, height: 1 };
  const el = {};
  const T = (template, extra) => fillIso(template, extra, language);
  const layerValues = () => (state.comparison ? state.comparison.values : state.snapshot.values);
  const layerKind = () => (state.comparison ? "change" : "dust");
  const fmt = (value) => (value === null || value === undefined ? "—" : trimNumber(value, Math.abs(value) < 0.01 ? 4 : 3));
  const fmtChange = (value) => (value === null || value === undefined ? "—" : (value > 0 ? "+" : value < 0 ? "−" : "") + trimNumber(Math.abs(value), Math.abs(value) < 0.01 ? 4 : 3));

  // ---- Map frame
  el.frame = h(document, "div", { class: "st-map", dir: "ltr", tabindex: "0", role: "application", "aria-label": c.map.label, "aria-describedby": "st-keys" });
  el.overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.overlay.setAttribute("class", "st-overlay");
  el.overlay.setAttribute("aria-hidden", "true");
  el.frame.append(el.overlay);
  el.note = h(document, "p", { class: "small st-note", role: "note" });
  let renderer;
  let frameRequest = 0;
  const earth = () => (win.matchMedia?.("(max-width: 700px)").matches ? EARTH_URL_SMALL() : EARTH_URL());
  function makeRenderer(force2d) {
    renderer?.dispose();
    const options = { document, container: el.frame, earthUrl: earth(), onReady: invalidate };
    if (!force2d) {
      try { renderer = createGlRenderer({ ...options, onLost: () => { el.note.textContent = c.map.fallback; makeRenderer(true); } }); } catch (error) { console.warn("WebGL unavailable", error); renderer = null; }
    }
    if (!renderer || force2d) { renderer = createCanvasRenderer(options); el.note.textContent = c.map.fallback; }
    el.frame.dataset.renderer = renderer.kind;
    resize();
    applyLayer();
  }
  const sizeOf = () => ({ w: Math.max(1, el.frame.clientWidth), h: Math.max(1, el.frame.clientHeight) });
  function resize() {
    const { w, h: hh } = sizeOf();
    state.width = w; state.height = hh;
    renderer.resize(w, hh, Math.min(win.devicePixelRatio || 1, 2));
    state.view = clampView(state.view, bounds, w, hh);
    invalidate();
  }
  function applyLayer() {
    renderer.setLayer({ mode: state.comparison ? "diff" : "value", values: layerValues() }, grid);
    invalidate();
  }
  function invalidate() { if (!frameRequest) frameRequest = win.requestAnimationFrame(draw); }
  function draw() {
    frameRequest = 0;
    renderer.setView(state.view, pixelsPerDegree(state.view, bounds, state.width, state.height), bounds);
    renderer.render();
    drawOverlay();
  }
  const toScreen = (lon, lat) => geoToScreen(state.view, bounds, state.width, state.height, lon, lat);
  const toGeo = (x, y) => screenToGeo(state.view, bounds, state.width, state.height, x, y);

  // View changes, animated unless the user prefers reduced motion.
  let animation = 0;
  function setView(target, animate = true) {
    const next = clampView(target, bounds, state.width, state.height);
    win.cancelAnimationFrame(animation);
    if (!animate || reduced()) { state.view = next; invalidate(); return; }
    const from = state.view;
    const start = win.performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 320);
      state.view = clampView(lerpView(from, next, 1 - (1 - t) ** 3), bounds, state.width, state.height);
      invalidate();
      if (t < 1) animation = win.requestAnimationFrame(step);
    };
    animation = win.requestAnimationFrame(step);
  }
  const zoomBy = (factor, x, y, animate = true) => setView(zoomAt(state.view, bounds, state.width, state.height, factor, x, y), animate);

  // ---- Overlay (SVG, registered with the same view maths as the map)
  const svg = (name, attrs) => { const node = document.createElementNS("http://www.w3.org/2000/svg", name); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v)); return node; };
  state.extraOverlay = [];
  function drawOverlay() {
    el.overlay.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);
    el.overlay.replaceChildren();
    if (state.cursor) {
      const r = cellRect(grid, state.cursor.row, state.cursor.col);
      const a = toScreen(r.west, r.north);
      const b = toScreen(r.east, r.south);
      el.overlay.append(svg("rect", { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: "st-cursor" }));
    }
    for (const draw of state.extraOverlay) draw(el.overlay, svg, toScreen);
  }

  // ---- Left panel: date, layer, view
  const seasonLabel = (season) => c.date.seasons[season.name] + " " + season.seasonYear;
  el.date = h(document, "select", { id: "st-date", "aria-label": c.date.label });
  for (const season of catalog.seasons) {
    const group = h(document, "optgroup", { label: seasonLabel(season) });
    for (const id of season.snapshotIds) { const entry = catalog.snapshots.find((s) => s.id === id); group.append(h(document, "option", { value: id, text: entry.date, selected: id === state.snapshot.id })); }
    el.date.append(group);
  }
  el.prev = h(document, "button", { type: "button", class: "st-icon", "aria-label": c.date.prev, text: "‹" });
  el.next = h(document, "button", { type: "button", class: "st-icon", "aria-label": c.date.next, text: "›" });
  el.dateInfo = h(document, "p", { class: "small", id: "st-date-info" });
  el.build = h(document, "p", { class: "small" });
  async function chooseDate(id) {
    el.date.disabled = true;
    try { state.snapshot = await getSnapshot(id); } catch (error) { console.error(error); el.note.textContent = c.error; } finally { el.date.disabled = false; }
    el.date.value = state.snapshot.id;
    onDateChanged();
  }
  function onDateChanged() {
    const time = state.snapshot.time;
    el.dateInfo.textContent = T(c.date.window, { date: formatUtcDate(time.start, language), from: formatUtcTime(time.start).replace(" UTC", ""), to: formatUtcTime(time.end).replace(" UTC", ""), hours: trimNumber((Date.parse(time.end) - Date.parse(time.start)) / 3600000, 2) });
    el.build.textContent = T(c.date.group, { build: state.snapshot.source.modelSource });
    if (!state.comparison) applyLayer();
    onDataChanged();
  }
  api_refreshDateInfo = onDateChanged;
  el.date.addEventListener("change", () => chooseDate(el.date.value));
  const step = (delta) => { const i = list.findIndex((s) => s.id === state.snapshot.id); const next = list[Math.min(list.length - 1, Math.max(0, i + delta))]; if (next) chooseDate(next.id); };
  el.prev.addEventListener("click", () => step(-1));
  el.next.addEventListener("click", () => step(1));
  const datePanel = h(document, "section", { class: "panel", "aria-labelledby": "st-date-title" }, h(document, "h2", { id: "st-date-title", text: c.date.title }),
    h(document, "div", { class: "st-row" }, el.prev, el.date, el.next), el.dateInfo, h(document, "p", { class: "small", text: c.date.sparse }), el.build);

  const zoomIn = h(document, "button", { type: "button", class: "st-icon", "aria-label": c.zoom.in, text: "+" });
  const zoomOut = h(document, "button", { type: "button", class: "st-icon", "aria-label": c.zoom.out, text: "−" });
  const resetView = h(document, "button", { type: "button", class: "st-icon", "aria-label": c.zoom.reset, text: "⟲" });
  zoomIn.addEventListener("click", () => zoomBy(1.5));
  zoomOut.addEventListener("click", () => zoomBy(1 / 1.5));
  resetView.addEventListener("click", () => setView(createView(bounds)));
  const viewPanel = h(document, "section", { class: "panel", "aria-label": c.zoom.label }, h(document, "div", { class: "st-row" }, zoomOut, zoomIn, resetView));

  // ---- Legend
  el.legend = h(document, "div", { class: "st-legend panel" });
  function renderLegend() {
    const parts = [];
    if (!state.comparison) {
      const stops = Array.from({ length: 12 }, (_, i) => { const [r, g, b] = valueColor(VALUE_MIN * (VALUE_MAX / VALUE_MIN) ** (i / 11)); return `rgb(${r},${g},${b}) ${(i / 11 * 100).toFixed(1)}%`; }).join(",");
      const ticks = [0.01, 0.1, 1].map((v) => h(document, "span", { class: "tick ltr", style: `left:${valueT(v) * 100}%`, text: String(v) }));
      parts.push(h(document, "h3", { text: c.legend.title }), h(document, "div", { class: "st-bar", style: `background:linear-gradient(90deg,${stops})`, "aria-hidden": "true" }), h(document, "div", { class: "st-ticks ltr", "aria-hidden": "true" }, ...ticks),
        h(document, "p", { class: "small", text: c.legend.note }), h(document, "p", { class: "small" }, h(document, "span", { class: "st-hatch" }), " " + c.legend.missing));
    } else {
      parts.push(h(document, "h3", { text: c.legend.changeTitle }), h(document, "div", { class: "st-bar st-bar-diff", "aria-hidden": "true" }),
        h(document, "div", { class: "st-ticks ltr", "aria-hidden": "true" }, h(document, "span", { class: "tick", style: "left:0%", text: "−1.5" }), h(document, "span", { class: "tick", style: "left:50%", text: "0" }), h(document, "span", { class: "tick", style: "left:100%", text: "+1.5" })),
        h(document, "p", { class: "small" }, h(document, "span", { class: "sw sw-up" }), " " + c.legend.increase + "  ", h(document, "span", { class: "sw sw-down" }), " " + c.legend.decrease + "  ", h(document, "span", { class: "sw sw-flat" }), " " + T(c.legend.near, { band: NEAR_ZERO })),
        h(document, "p", { class: "small", text: c.legend.changeNote }), h(document, "p", { class: "small" }, h(document, "span", { class: "st-hatch" }), " " + c.legend.missing));
    }
    el.legend.replaceChildren(...parts);
  }

  // ---- Understand panel (rows created once, text updated per cursor move)
  const row = (label) => { const dd = h(document, "dd", {}); return { dt: h(document, "dt", { text: label }), dd }; };
  const u = { source: row(c.understand.source), time: row(c.understand.dateRow), cell: row(c.understand.cell), loc: row(c.understand.location), bounds: row(c.understand.bounds), value: row(c.understand.value), scale: row(c.understand.scaleMeaning), sound: row(c.understand.sound) };
  const dl = h(document, "dl", { class: "kv" }, ...Object.values(u).flatMap((r) => [r.dt, r.dd]));
  el.status = h(document, "p", { class: "callout", role: "status", "aria-live": "polite" });
  el.read = h(document, "p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
  const understand = h(document, "section", { class: "panel st-understand", "aria-labelledby": "st-u-title" }, h(document, "h2", { id: "st-u-title", text: c.understand.title }), el.status, dl, el.read);
  state.understandExtras = [];

  function describeCell(cell) {
    const value = layerValues()[cell.index];
    const kind = layerKind();
    const center = cellCenter(grid, cell.row, cell.col);
    const r = cellRect(grid, cell.row, cell.col);
    return { value, kind, id: cellId(cell.row, cell.col), lat: formatLat(center.lat), lon: formatLon(center.lon), r };
  }
  function soundText(d) {
    if (d.value === null) return c.understand.missingSound;
    const pan = lonPan(grid, cellCenter(grid, state.cursor.row, state.cursor.col).lon);
    const side = pan < -0.2 ? c.understand.left : pan > 0.2 ? c.understand.right : c.understand.centre;
    const text = d.kind === "dust" ? T(c.understand.soundText, { hz: trimNumber(valueHz(d.value), 0), pan: side })
      : Math.abs(d.value) < NEAR_ZERO ? c.understand.soundFlat : T(d.value > 0 ? c.understand.soundUp : c.understand.soundDown, { semi: changeSemitones(d.value) }) + " " + side + ".";
    return audio.enabled ? text : text + " " + c.understand.soundOff;
  }
  function renderUnderstand() {
    const s = state.snapshot;
    u.source.dd.textContent = T(c.understand.sourceValue, { short: s.source.shortName, variable: s.variable });
    u.source.dd.className = "ltr";
    const time = s.time;
    u.time.dd.textContent = T(c.date.window, { date: formatUtcDate(time.start, language), from: formatUtcTime(time.start).replace(" UTC", ""), to: formatUtcTime(time.end).replace(" UTC", ""), hours: trimNumber((Date.parse(time.end) - Date.parse(time.start)) / 3600000, 2) });
    const cell = state.cursor;
    if (!cell) {
      el.status.textContent = c.understand.none;
      for (const key of ["cell", "loc", "bounds", "value", "scale", "sound"]) u[key].dd.textContent = "—";
      return;
    }
    const d = describeCell(cell);
    el.status.textContent = d.value === null ? c.understand.missing : "";
    el.status.hidden = d.value !== null;
    u.cell.dd.textContent = d.id;
    u.loc.dd.textContent = T(c.understand.cellRow, { lat: d.lat, lon: d.lon });
    u.loc.dd.className = "ltr";
    u.bounds.dd.textContent = T("{south} to {north}, {west} to {east}", { south: formatLat(d.r.south), north: formatLat(d.r.north), west: formatLon(d.r.west), east: formatLon(d.r.east) });
    u.bounds.dd.className = "ltr";
    if (d.kind === "dust") {
      u.value.dd.textContent = d.value === null ? "—" : T(c.understand.valueUnit, { value: fmt(d.value) });
      u.scale.dd.textContent = d.value === null ? "—" : T(c.understand.scaleText, { t: Math.round(valueT(d.value) * 100) });
    } else {
      const dir = d.value === null ? "" : Math.abs(d.value) < NEAR_ZERO ? c.understand.flat : d.value > 0 ? c.understand.up : c.understand.down;
      u.value.dd.textContent = d.value === null ? "—" : T(c.understand.changeText, { value: fmtChange(d.value), direction: dir });
      u.scale.dd.textContent = d.value === null ? "—" : T(c.legend.near, { band: NEAR_ZERO });
    }
    u.sound.dd.textContent = soundText(d);
    for (const extra of state.understandExtras) extra(d);
  }
  const readText = (cell) => {
    const d = describeCell(cell);
    if (d.kind === "dust") return T(d.value === null ? c.read.missing : c.read.dust, { id: d.id, lat: d.lat, lon: d.lon, value: fmt(d.value) });
    const dir = d.value === null ? "" : Math.abs(d.value) < NEAR_ZERO ? c.understand.flat : d.value > 0 ? c.understand.up : c.understand.down;
    return T(d.value === null ? c.read.changeMissing : c.read.change, { id: d.id, lat: d.lat, lon: d.lon, value: fmtChange(d.value), direction: dir });
  };
  function onDataChanged() { renderLegend(); renderUnderstand(); invalidate(); for (const hook of state.dataHooks ?? []) hook(); if (state.audio) state.onCursor?.(state.cursor); }

  // ---- Cursor
  function setCursor(cell, { announce = false } = {}) {
    const changed = (state.cursor?.index ?? -1) !== (cell?.index ?? -1);
    state.cursor = cell;
    if (changed) { renderUnderstand(); invalidate(); state.onCursor?.(cell); }
    if (announce && cell) el.read.textContent = readText(cell);
  }
  const cursorAt = (x, y) => { const g = toGeo(x, y); return cellAt(grid, g.lon, g.lat); };

  // ---- Pointer, wheel, touch
  const pointers = new Map();
  let dragging = null;
  const local = (event) => { const r = el.frame.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
  el.frame.addEventListener("pointerdown", (event) => {
    el.frame.focus({ preventScroll: true });
    pointers.set(event.pointerId, local(event));
    el.frame.setPointerCapture?.(event.pointerId);
    state.onPointer?.("down", event, local(event), pointers);
    if (event.defaultPrevented) return;
    dragging = { id: event.pointerId, start: local(event), last: local(event), moved: false, pinch: pointers.size > 1 };
  });
  el.frame.addEventListener("pointermove", (event) => {
    const p = local(event);
    if (!pointers.has(event.pointerId)) { if (event.pointerType === "mouse") setCursor(cursorAt(p.x, p.y)); state.onPointer?.("hover", event, p, pointers); return; }
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, p);
    state.onPointer?.("move", event, p, pointers);
    if (event.defaultPrevented) return;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const [pa, pb] = [...pointers.entries()].map(([id, pt]) => (id === event.pointerId ? previous : pt));
      const before = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let view = zoomAt(state.view, bounds, state.width, state.height, before > 0 ? after / before : 1, centre.x, centre.y);
      view = panBy(view, bounds, state.width, state.height, centre.x - (pa.x + pb.x) / 2, centre.y - (pa.y + pb.y) / 2);
      state.view = view; invalidate();
      return;
    }
    if (!dragging || dragging.id !== event.pointerId || dragging.pinch) return;
    if (!dragging.moved && Math.hypot(p.x - dragging.start.x, p.y - dragging.start.y) < 4) return;
    dragging.moved = true;
    state.view = panBy(state.view, bounds, state.width, state.height, p.x - dragging.last.x, p.y - dragging.last.y);
    dragging.last = p;
    el.frame.dataset.dragging = "true";
    invalidate();
  });
  const endPointer = (event) => {
    const p = local(event);
    pointers.delete(event.pointerId);
    state.onPointer?.("up", event, p, pointers);
    if (dragging?.id === event.pointerId) {
      if (!dragging.moved && event.type === "pointerup") setCursor(cursorAt(p.x, p.y), { announce: true });
      dragging = null;
    }
    if (pointers.size === 0) delete el.frame.dataset.dragging;
  };
  el.frame.addEventListener("pointerup", endPointer);
  el.frame.addEventListener("pointercancel", endPointer);
  el.frame.addEventListener("wheel", (event) => { event.preventDefault(); const p = local(event); zoomBy(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0016)), p.x, p.y, false); }, { passive: false });
  el.frame.style.touchAction = "none";

  // ---- Keyboard
  function moveCursor(dRow, dCol) {
    const from = state.cursor ?? (() => { const g = toGeo(state.width / 2, state.height / 2); return cellAt(grid, g.lon, g.lat) ?? { row: 0, col: 0 }; })();
    const row = Math.max(0, Math.min(grid.rows - 1, from.row + dRow));
    const col = Math.max(0, Math.min(grid.cols - 1, from.col + dCol));
    const cell = { row, col, index: row * grid.cols + col };
    setCursor(state.cursor ? cell : (dRow || dCol ? cell : cell), { announce: true });
    // Keep the cursor visible.
    const centre = cellCenter(grid, row, col);
    const s = toScreen(centre.lon, centre.lat);
    const margin = 40;
    if (s.x < margin || s.x > state.width - margin || s.y < margin || s.y > state.height - margin) setView({ ...state.view, lon: centre.lon, lat: centre.lat }, true);
  }
  el.frame.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      if (event.shiftKey) { const step = 60; const [dr, dc] = arrows[event.key]; setView(panBy(state.view, bounds, state.width, state.height, -dc * step, -dr * step), false); return; }
      // Geography never mirrors: ArrowLeft is always west.
      moveCursor(...arrows[event.key]);
      return;
    }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1.4); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomBy(1 / 1.4); return; }
    if (event.key === "Home") { event.preventDefault(); setView(createView(bounds)); return; }
    if ((event.key === "r" || event.key === "R") && state.cursor) { event.preventDefault(); el.read.textContent = readText(state.cursor); return; }
    state.onKey?.(event);
  });

  // ---- Sound (M2): explicit enable, hover/keyboard/touch reading, studio-v1 mapping
  const settings = loadSettings();
  const audio = createStudioAudio({ volume: settings.volume });
  state.audio = audio;
  el.soundButton = h(document, "button", { type: "button", class: "button", "aria-pressed": "false", text: c.sound.enable });
  el.soundState = h(document, "p", { class: "small", role: "status", "aria-live": "polite", text: c.sound.disabled });
  el.volume = h(document, "input", { type: "range", id: "st-volume", min: 0, max: 100, step: 1, value: Math.round(settings.volume * 100) });
  el.wave = h(document, "canvas", { width: 360, height: 60, role: "img", "aria-label": c.sound.wave });
  el.volume.addEventListener("input", () => { const v = Number(el.volume.value) / 100; audio.setVolume(v); saveSettings({ volume: v }); });
  const setSound = async (on) => {
    el.soundButton.setAttribute("aria-pressed", String(on));
    el.soundButton.textContent = on ? c.sound.disable : c.sound.enable;
    if (on) { await audio.enable(); el.soundState.textContent = audio.unavailable ? c.sound.unavailable : c.sound.enabled; } else { audio.disable(); el.soundState.textContent = c.sound.disabled; }
    renderUnderstand();
    if (on && state.cursor) soundForCursor();
  };
  el.soundButton.addEventListener("click", () => setSound(!audio.enabled));
  const cursorKey = () => [state.snapshot.id, state.comparison?.id ?? "dust", state.cursor?.index].join("|");
  function soundForCursor(force = false) {
    if (!audio.enabled || !state.cursor || state.busy) return;
    const cell = state.cursor;
    const make = () => hoverPlan(layerKind(), cell, layerValues()[cell.index], grid);
    if (force) audio.play(make()); else audio.hover(cursorKey(), make);
  }
  state.onCursor = () => { if (state.tool === "explore") soundForCursor(); };
  state.onKeyExtra = [];
  state.onKey = (event) => {
    if (event.key === " " && state.cursor) { event.preventDefault(); if (audio.enabled) soundForCursor(true); else el.read.textContent = c.sound.disabled + " " + readText(state.cursor); return; }
    for (const handler of state.onKeyExtra) if (handler(event)) return;
  };
  state.pointerHandlers = [];
  state.onPointer = (type, event, p, pointers) => {
    for (const handler of state.pointerHandlers) { handler(type, event, p, pointers); if (event.defaultPrevented) return; }
    // Touch: press and drag listens (one finger) while sound is on; two fingers always pan and zoom.
    if (event.pointerType === "touch" && state.tool === "explore" && audio.enabled && pointers.size === 1 && (type === "down" || type === "move")) {
      event.preventDefault();
      setCursor(cursorAt(p.x, p.y));
    }
  };
  const mapRange = T(c.sound.range, { low: PITCH_LOW_HZ, high: HIGH_HZ, min: VALUE_MIN, max: VALUE_MAX });
  const soundPanel = h(document, "section", { class: "panel", "aria-labelledby": "st-sound-title" }, h(document, "h2", { id: "st-sound-title", text: c.sound.title }), el.soundButton, el.soundState,
    h(document, "label", { class: "volume", for: "st-volume" }, h(document, "span", { text: c.sound.volume }), el.volume), el.wave,
    h(document, "h3", { text: c.sound.mapping }), h(document, "ul", { class: "st-keys small" }, h(document, "li", { text: c.sound.mapDust + " " + mapRange }), h(document, "li", { text: c.sound.mapPan }), h(document, "li", { text: c.sound.mapMissing }), h(document, "li", { text: c.sound.changeMap })),
    h(document, "p", { class: "small", text: c.sound.note }));
  let waveFrame = win.requestAnimationFrame(function loop() { drawWaveform(el.wave, audio.tap.analyser, { color: "#68e0d0" }); waveFrame = win.requestAnimationFrame(loop); });

  // ---- Assemble
  const left = h(document, "div", { class: "st-left" }, datePanel, viewPanel, soundPanel);
  state.left = left;
  const centre = h(document, "div", { class: "st-centre" }, el.frame, el.note, el.legend);
  state.centre = centre;
  const right = h(document, "div", { class: "st-right" }, understand);
  state.right = right;
  const cellLat = trimNumber(size.lat);
  const cellLon = trimNumber(size.lon);
  const smoothing = h(document, "p", { class: "small st-smoothing", text: fill(c.map.smoothing, { cellLat, cellLon }) });
  centre.append(smoothing);
  el.keys = h(document, "ul", { class: "st-keys small", id: "st-keys" }, c.help.items.map((line) => h(document, "li", { text: line })));
  right.append(h(document, "section", { class: "panel" }, h(document, "h2", { text: c.help.title }), el.keys));
  root.replaceChildren(
    h(document, "section", { class: "st-intro" }, h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", {}, c.titleLead + " ", h(document, "em", { text: c.titleAccent })), h(document, "p", { class: "lede", text: c.lede })),
    h(document, "div", { class: "st-layout" }, left, centre, right), h(document, "p", { class: "credit", text: c.credit }));

  makeRenderer(params.get("renderer") === "2d");
  new win.ResizeObserver(resize).observe(el.frame);
  onDateChanged();
  win.addEventListener("resize", resize);
  win.document.addEventListener("visibilitychange", () => { if (!win.document.hidden) invalidate(); });
  const api = { state, el, grid, catalog, list, get renderer() { return renderer; }, setView, setCursor, chooseDate, applyLayer, onDataChanged, renderUnderstand, invalidate, toScreen, toGeo, T, c, language, layerValues, layerKind, getSnapshot, refreshDateInfo: () => api_refreshDateInfo(), audio, soundForCursor, setSound, readText, fmt, fmtChange, document, win, bounds, drawOverlay, reduced, svgNode: svg };
  if (params.has("debug")) win.__studio = api;
  state.api = api;
  mountTools(api);
  mountCompare(api);
  mountShare(api);
  return api;
}
