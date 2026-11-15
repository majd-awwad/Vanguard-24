import { cellId, cellSize, fill, fillIso, formatLat, formatLon, formatUtcDate, formatUtcTime, trimNumber } from "../cinematic/site/cells.js";
import { drawWaveform } from "../cinematic/audio-tap.js";
import { h } from "../cinematic/site/dom.js";
import { mountNav } from "../cinematic/site/nav.js";
import { allowSpoilersThisVisit, spoilersUnlocked } from "../cinematic/site/progress.js";
import { loadSettings, saveSettings } from "../cinematic/site/settings.js";
import { createStudioAudio } from "./audio.js";
import {
  DECODE_LOCKED_DATES, PHENOMENA, PHENOMENON_IDS, changeNormalizer, formatChange, formatValue, isLocked, normalizer, openPackage, rampFromStops,
} from "./datasets.js";
import { cellAt, cellCenter, cellRect, rampTable } from "./field.js";
import { createAnalysisClient } from "./analysis-client.js";
import { mountCompare } from "./compare.js";
import { mountEcho } from "./echo-ui.js";
import { mountHunter } from "./hunter-ui.js";
import { lonPan } from "./mapping.js";
import { cellInfo } from "./sonify.js";
import { meaningLevel, meaningPhrase, spokenNumber } from "./meaning.js";
import { createCanvasRenderer } from "./renderer-2d.js";
import { createGlRenderer } from "./renderer-gl.js";
import { decodeShare, mountShare } from "./share.js";
import { GUIDED, PURE, createSpeech } from "./speech.js";
import { AUDIO, SOUND_MODES, TOOLS, createAppState, createStore } from "./state.js";
import { copyFor } from "./studio-ui-copy.js";
import { ICON } from "./studio-icons.js";
import { DOCUMENTED_BREAKPOINTS, MIN_VALUE, breakpoints, levelFor } from "./ambience-core.js";
import { createRecordings } from "./recordings.js";
import { SIGNAL, dryNotice, isDryValue } from "./signal-core.js";
import { infoIcon } from "./studio-ui-kit.js";
import { studioCopy } from "./studio-copy.js";
import { mountTools } from "./tools.js";
import { clampView, createView, geoToScreen, lerpView, panBy, pixelsPerDegree, screenToGeo, zoomAt } from "./view.js";

export const DEFAULT_DATE = "2025-04-15";
const EARTH_URL = () => new URL("../assets/earth/blue-marble-4096.jpg", import.meta.url).href;
const EARTH_URL_SMALL = () => new URL("../assets/earth/blue-marble-2048.jpg", import.meta.url).href;
const CARDINAL_EN = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const CARDINAL_AR = ["شمال", "شمال-شمال شرق", "شمال شرق", "شرق-شمال شرق", "شرق", "شرق-جنوب شرق", "جنوب شرق", "جنوب-جنوب شرق", "جنوب", "جنوب-جنوب غرب", "جنوب غرب", "غرب-جنوب غرب", "غرب", "غرب-شمال غرب", "شمال غرب", "شمال-شمال غرب"];
export const cardinal = (degrees, language = "en") => (language === "ar" ? CARDINAL_AR : CARDINAL_EN)[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];

/** Chronological sampled dates of a phenomenon. */
export const chronological = (phen) => [...phen.list];

// ---------------------------------------------------------------------------------------------------------------
// Entry: one sentence, one button, no autoplay. Then the two-choice sound-mode dialog.
export function openModeDialog(document, language, { current = null, dismissable = false, onChoose, onClose = () => {} }) {
  const m = copyFor(language);
  const overlay = h(document, "div", { class: "em-modal-backdrop" });
  const dialog = h(document, "div", { class: "em-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "em-mode-title" });
  const choice = (mode, title, text) => {
    const art = h(document, "span", { class: "em-choice-art", "aria-hidden": "true" });
    art.innerHTML = mode === GUIDED ? ICON.voice : ICON.waves;
    const button = h(document, "button", { type: "button", class: "em-choice", "data-mode": mode, "aria-pressed": String(current === mode) }, art, h(document, "strong", { text: title }), h(document, "span", { text }));
    button.addEventListener("click", () => { close(); onChoose(mode); });
    return button;
  };
  const buttons = [choice(GUIDED, m.mode.guided, m.mode.guidedText), choice(PURE, m.mode.pure, m.mode.pureText)];
  const closeButton = dismissable ? h(document, "button", { type: "button", class: "button ghost", text: m.mode.close }) : null;
  dialog.append(h(document, "h2", { id: "em-mode-title", text: m.mode.title }), h(document, "div", { class: "em-choices" }, ...buttons), h(document, "p", { class: "small", text: m.mode.note }), ...(closeButton ? [closeButton] : []));
  overlay.append(dialog);
  const previous = document.activeElement;
  function close() { overlay.remove(); document.removeEventListener("keydown", onKey, true); previous?.focus?.(); onClose(); }
  function onKey(event) {
    if (event.key === "Escape" && dismissable) { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  closeButton?.addEventListener("click", close);
  document.addEventListener("keydown", onKey, true);
  document.body.append(overlay);
  (buttons.find((b) => b.dataset.mode === current) ?? buttons[0]).focus();
  return { close };
}

export function startStudio(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "studio", from: "pages" });
  const m = copyFor(language);
  document.title = m.title + " · EARTHPULSE";
  const root = document.getElementById("studio-root");
  document.body.classList.add("studio-page");
  const params = new URL(document.URL).searchParams;
  const preset = params.get("mode") === "pure" ? PURE : params.get("mode") === "guided" ? GUIDED : null;
  if (params.get("entry") === "skip" && preset) return mountApp(document, root, language, preset);
  const start = h(document, "button", { type: "button", class: "button em-start", text: m.entry.start });
  root.replaceChildren(h(document, "section", { class: "em-entry", "aria-labelledby": "em-entry-title" },
    h(document, "p", { class: "eyebrow", text: m.entry.eyebrow }), h(document, "h1", { id: "em-entry-title", text: m.entry.title }),
    h(document, "p", { class: "lede", text: m.entry.sentence }), start, h(document, "p", { class: "small", text: m.entry.note })));
  // The entry asks how to explore by sound. The choice is the "Spoken instructions" setting (guidance), the one source of truth.
  start.addEventListener("click", () => openModeDialog(document, language, { current: loadSettings().guidance ? GUIDED : PURE, onChoose: (mode) => { const next = saveSettings({ guidance: mode === GUIDED }); document.defaultView?.dispatchEvent(new document.defaultView.CustomEvent("earthpulse:settings", { detail: next })); mountApp(document, root, language, mode); } }));
  return Promise.resolve();
}

// ---------------------------------------------------------------------------------------------------------------
async function mountApp(document, root, language, initialMode) {
  const c = studioCopy[language];
  const m = copyFor(language);
  const win = document.defaultView;
  const params = new URL(document.URL).searchParams;
  const reduced = () => win.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const T = (template, extra) => fillIso(template, extra, language);
  // Old stored sound settings are reset once: the sound is now the recordings only.
  try { if (win.localStorage.getItem("earthpulse.sound.v2") !== "1") { saveSettings({ volume: 0.72 }); win.localStorage.setItem("earthpulse.sound.v2", "1"); } } catch { /* storage unavailable */ }
  const settings = loadSettings();
  root.replaceChildren(h(document, "p", { class: "status", role: "status", text: m.entry.loading }));

  // ---- Data
  let pkg;
  let phen;
  const startParams = new URLSearchParams(new URL(document.URL).search);
  const wantedPhen = PHENOMENON_IDS.includes(startParams.get("phen")) ? startParams.get("phen") : "dust";
  try {
    pkg = await openPackage();
    phen = await pkg.openPhenomenon(wantedPhen);
  } catch (error) {
    console.error(error);
    const retry = h(document, "button", { type: "button", class: "button", text: m.phen.retry });
    retry.addEventListener("click", () => location.reload());
    root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: m.phen.error }), retry);
    return null;
  }
  const grid = phen.grid;
  const bounds = grid.bounds;
  const size = cellSize(bounds, grid);
  const unlocked = () => spoilersUnlocked();
  const firstOpen = () => phen.list.find((s) => !isLocked(phen.id, s.date, unlocked()) && s.date === DEFAULT_DATE) ?? phen.list.find((s) => !isLocked(phen.id, s.date, unlocked()));
  const decoded = decodeShare(new URL(document.URL).search, { snapshots: phen.list, comparisons: phen.comparisons, compatibilityGroups: phen.compatibilityGroups, unavailableComparisons: phen.unavailableComparisons }, bounds);
  const startSnap = (decoded.snapshotId && !isLocked(phen.id, phen.snapshot(decoded.snapshotId).date, unlocked()) ? phen.snapshot(decoded.snapshotId) : null) ?? firstOpen();

  const store = createStore(createAppState({ datasetId: phen.id, variable: phen.spec.measure, soundMode: initialMode, uiLanguage: language, timeRange: { start: startSnap.date, end: startSnap.date } }));
  const state = { snapshot: startSnap, comparison: null, view: createView(bounds), cursor: null, selected: null, pins: [], tool: "explore", width: 1, height: 1, ins: { l: 8, t: 8, r: 8, b: 8 }, outside: false, extraOverlay: [], understandExtras: [], onKeyExtra: [], pointerHandlers: [], dataHooks: [] };
  const el = {};
  const spec = () => phen.spec;
  const layerValues = () => (state.comparison ? state.comparison.values : state.snapshot.values);
  const layerKind = () => (state.comparison ? "change" : "dust");
  const fmt = (value) => formatValue(spec(), value);
  const fmtChange = (value) => formatChange(spec(), value);
  const unitText = () => m.phen.unitName[phen.id];
  const catalog = () => ({ snapshots: phen.list, comparisons: phen.comparisons, compatibilityGroups: phen.compatibilityGroups, policy: phen.compatibilityPolicy, unavailableComparisons: phen.unavailableComparisons, bounds });
  const dateOf = (snapshot) => formatUtcDate(snapshot.time.start, language);
  const sampleName = (index) => cellId(Math.floor(index / grid.cols), index % grid.cols);

  // ---- Skeleton
  el.live = h(document, "p", { class: "visually-hidden", id: "em-live", role: "status", "aria-live": "polite" });
  el.frame = h(document, "div", { class: "st-map", dir: "ltr", tabindex: "0", role: "application", "aria-label": c.map.label, "aria-describedby": "st-map-hint" });
  el.overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.overlay.setAttribute("class", "st-overlay");
  el.overlay.setAttribute("aria-hidden", "true");
  el.compass = h(document, "div", { class: "st-compass", dir: "ltr", role: "img", "aria-label": m.compass }, h(document, "span", { "aria-hidden": "true", text: "N" }), h(document, "span", { class: "needle", "aria-hidden": "true", text: "↑" }));
  el.frame.append(el.overlay, el.compass);
  el.note = h(document, "p", { class: "small st-note", role: "note" });

  // ---- Renderer
  let renderer;
  let frameRequest = 0;
  const earth = () => (win.matchMedia?.("(max-width: 700px)").matches ? EARTH_URL_SMALL() : EARTH_URL());
  function makeRenderer(force2d) {
    renderer?.dispose();
    const options = { document, container: el.frame, earthUrl: earth(), onReady: invalidate };
    renderer = null;
    if (!force2d) {
      try { renderer = createGlRenderer({ ...options, onLost: () => { el.note.textContent = c.map.fallback; makeRenderer(true); } }); } catch (error) { console.warn("WebGL unavailable", error); }
    }
    if (!renderer) { renderer = createCanvasRenderer(options); el.note.textContent = c.map.fallback; }
    el.frame.dataset.renderer = renderer.kind;
    resize();
    applyLayer();
  }
  const vw = () => Math.max(40, state.width - state.ins.l - state.ins.r);
  const vh = () => Math.max(40, state.height - state.ins.t - state.ins.b);
  function computeInsets() { state.ins = { l: 8, t: 8, r: 8, b: 8 }; } // the map box holds only the map; zoom and legend sit in the empty bands
  function layoutChanged(animate = true) {
    if (!renderer || !state.width) return;
    computeInsets();
    const fit = state.view.zoom < 1.001;
    setView(fit ? initialView() : state.view, fit && animate);
  }
  function resize() {
    const w = Math.max(1, el.frame.clientWidth);
    const hh = Math.max(1, el.frame.clientHeight);
    state.width = w; state.height = hh;
    renderer.resize(w, hh, Math.min(win.devicePixelRatio || 1, 2));
    computeInsets();
    state.view = state.view.zoom < 1.001 ? initialView() : clampView(state.view, bounds, vw(), vh());
    invalidate();
  }
  function layerDescription() {
    const s = spec();
    if (state.comparison) {
      const norm = changeNormalizer(s);
      return { mode: "diff", values: layerValues(), normalize: (v) => 0.5 + 0.5 * norm(v), ramp: rampTable("diff") };
    }
    return { mode: "value", values: layerValues(), normalize: normalizer(s), ramp: rampFromStops(s.stops) };
  }
  let layerShown = false;
  function fadeFrom() {
    if (!layerShown || reduced() || !state.width) { layerShown = true; return; }
    const src = el.frame.querySelector("canvas.studio-canvas");
    if (!src || !src.width) return;
    try {
      renderer.render();
      const copy = document.createElement("canvas");
      copy.className = "st-fade";
      copy.width = src.width; copy.height = src.height;
      copy.getContext("2d").drawImage(src, 0, 0);
      copy.style.opacity = "1";
      el.frame.insertBefore(copy, el.overlay);
      win.requestAnimationFrame(() => win.requestAnimationFrame(() => { copy.style.opacity = "0"; }));
      win.setTimeout(() => copy.remove(), 500);
    } catch { /* the cross-fade is decoration only */ }
  }
  function applyLayer() { fadeFrom(); renderer.setLayer(layerDescription(), grid); invalidate(); }
  function invalidate() { if (!frameRequest) frameRequest = win.requestAnimationFrame(draw); }
  function draw() {
    frameRequest = 0;
    const centre = toGeo(state.width / 2, state.height / 2);
    renderer.setView({ ...state.view, lon: centre.lon, lat: centre.lat }, pixelsPerDegree(state.view, bounds, vw(), vh()), bounds);
    renderer.render();
    drawOverlay();
    if (el.inspector) positionCard();
  }
  const toScreen = (lon, lat) => { const p = geoToScreen(state.view, bounds, vw(), vh(), lon, lat); return { x: p.x + state.ins.l, y: p.y + state.ins.t }; };
  const toGeo = (x, y) => screenToGeo(state.view, bounds, vw(), vh(), x - state.ins.l, y - state.ins.t);
  let animation = 0;
  function setView(target, animate = true) {
    const next = clampView(target, bounds, vw(), vh());
    win.cancelAnimationFrame(animation);
    if (!animate || reduced()) { state.view = next; invalidate(); store.dispatch("SET_CAMERA", { bounds: visibleWindow() }); return; }
    const from = state.view;
    const start = win.performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 320);
      state.view = clampView(lerpView(from, next, 1 - (1 - t) ** 3), bounds, vw(), vh());
      invalidate();
      if (t < 1) animation = win.requestAnimationFrame(step); else store.dispatch("SET_CAMERA", { bounds: visibleWindow() });
    };
    animation = win.requestAnimationFrame(step);
  }
  const visibleWindow = () => { const a = toGeo(0, 0); const b = toGeo(state.width, state.height); return { west: a.lon, east: b.lon, north: a.lat, south: b.lat }; };
  const zoomBy = (factor, x, y, animate = true) => setView(zoomAt(state.view, bounds, vw(), vh(), factor, (x ?? state.ins.l + vw() / 2) - state.ins.l, (y ?? state.ins.t + vh() / 2) - state.ins.t), animate);
  const svg = (name, attrs) => { const node = document.createElementNS("http://www.w3.org/2000/svg", name); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v)); return node; };
  function hoverTip(p, cell) {
    const tip = el.hoverTip;
    if (!tip) return;
    if (!cell || (state.selected && cell.index === state.selected.index)) { tip.hidden = true; return; }
    const d = describeCell(cell);
    const line = d.value === null ? m.info.missing : d.kind !== "change" && isDryValue(phen.id, d.value) ? m.dry[phen.id].cell : (d.kind === "change" ? fmtChange(d.value) : fmt(d.value)) + " " + unitText();
    const mean = meaningFor(cell.index);
    tip.replaceChildren(h(document, "span", { class: "st-tip-value", text: line }), ...(mean ? [makeBadge(mean)] : []));
    tip.hidden = false;
    const x = Math.min(state.width - tip.offsetWidth - 6, p.x + 14);
    tip.style.transform = `translate(${Math.max(6, Math.round(x))}px, ${Math.max(6, Math.round(p.y - 34))}px)`;
  }
  function hoverPin(index) {
    if (state.hoverPin === index) return;
    state.hoverPin = index;
    for (const b of document.querySelectorAll(".em-result[data-index]")) b.classList.toggle("linked", index !== null && b.dataset.index === String(index));
    invalidate();
  }
  function pinHoverAt(p) {
    let found = null;
    for (const pin of state.pins) { const centre = cellCenter(grid, Math.floor(pin.index / grid.cols), pin.index % grid.cols); const s = toScreen(centre.lon, centre.lat); if (Math.hypot(s.x - p.x, s.y - p.y) < 16) { found = pin.index; break; } }
    hoverPin(found);
  }
  function drawOverlay() {
    el.overlay.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);
    el.overlay.replaceChildren();
    const cellBox = (index, cls) => {
      const r = cellRect(grid, Math.floor(index / grid.cols), index % grid.cols);
      const a = toScreen(r.west, r.north);
      const b = toScreen(r.east, r.south);
      el.overlay.append(svg("rect", { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: cls }));
    };
    if (state.selected) cellBox(state.selected.index, "st-selected");
    if (state.cursor) cellBox(state.cursor.index, "st-cursor");
    const spots = state.pins.map((pin) => { const centre = cellCenter(grid, Math.floor(pin.index / grid.cols), pin.index % grid.cols); return { pin, p: toScreen(centre.lon, centre.lat) }; });
    const clusters = [];
    for (const spot of spots) {
      const solo = spot.pin.selected || state.hoverPin === spot.pin.index;
      const home = solo ? null : clusters.find((cl) => !cl.solo && Math.hypot(cl.p.x - spot.p.x, cl.p.y - spot.p.y) < 26);
      if (home) home.items.push(spot); else clusters.push({ p: spot.p, items: [spot], solo });
    }
    for (const cl of clusters) {
      const first = cl.items[0];
      const many = cl.items.length > 1;
      const active = cl.items.some((it) => it.pin.selected);
      const hover = cl.items.some((it) => state.hoverPin === it.pin.index);
      el.overlay.append(svg("circle", { cx: cl.p.x, cy: cl.p.y, r: active || hover ? 15 : many ? 13 : 11, class: "st-pin st-pin-" + first.pin.kind + (active ? " active" : "") + (hover ? " hover" : "") + (many ? " st-pin-cluster" : "") }));
      const label = svg("text", { x: cl.p.x, y: cl.p.y + 4, class: "st-pin-label", "text-anchor": "middle" });
      label.textContent = many ? "×" + cl.items.length : String(first.pin.label);
      el.overlay.append(label);
    }
    for (const extra of state.extraOverlay) extra(el.overlay, svg, toScreen);
  }

  // ---- Audio, speech
  const audio = createStudioAudio({ volume: settings.volume });
  const rec = createRecordings({ baseUrl: new URL("../assets/ambient/", import.meta.url), reduced });
  rec.setVolume(settings.volume);
  const speech = createSpeech({ language: () => language, liveRegion: el.live, onState: (s) => store.dispatch("SET_SPEECH", { speech: s }), onDuck: (on) => { audio.setDuck(on); rec.setDuck(on); } });
  speech.setMode(initialMode);
  const speak = (text) => speech.say(text);
  const guided = (text) => speech.announce(text);

  // ---- Understand / info panel
  const row = (label) => ({ dt: h(document, "dt", { text: label }), dd: h(document, "dd", {}) });
  const u = { cell: row(m.info.sample), loc: row(c.understand.location), bounds: row(c.understand.bounds), value: row(m.info.value), time: row(m.info.window), source: row(m.info.source), type: row(m.info.dataType), sound: row(m.info.sound), wind: row(m.info.wind), cover: row(m.info.coverage) };
  const dl = h(document, "dl", { class: "kv" }, ...Object.values(u).flatMap((r) => [r.dt, r.dd]));
  el.status = h(document, "p", { class: "callout", role: "status" });
  el.status.setAttribute("aria-live", initialMode === GUIDED ? "polite" : "off");
  el.provenance = h(document, "details", { class: "em-provenance" }, h(document, "summary", { text: m.info.provenance }));
  const info = h(document, "section", { class: "panel st-understand", "aria-labelledby": "st-u-title" }, h(document, "h2", { id: "st-u-title", text: m.info.title }), el.status, dl, el.provenance);

  function describeCell(cell) {
    const kind = layerKind();
    const value = layerValues()[cell.index];
    const centre = cellCenter(grid, cell.row, cell.col);
    return { value, kind, id: cellId(cell.row, cell.col), lat: formatLat(centre.lat), lon: formatLon(centre.lon), r: cellRect(grid, cell.row, cell.col), index: cell.index };
  }
  const windText = (index) => {
    const w = cellInfo("wind", state.snapshot, index);
    if (w.direction === null || w.direction === undefined) return m.info.windCalm;
    return T(m.info.windFrom, { dir: cardinal(w.direction, language), deg: Math.round(w.direction) });
  };
  function soundText(d) {
    if (d.value === null) return c.understand.missingSound;
    const level = levelAt(d.index);
    return level ? T(m.sound.levelText, { level: m.sound.levels[level] }) : m.sound.silence;
  }
  function renderInfo() {
    const s = state.snapshot;
    u.time.dd.textContent = T(c.date.window, { date: dateOf(s), from: formatUtcTime(s.time.start).replace(" UTC", ""), to: formatUtcTime(s.time.end).replace(" UTC", ""), hours: trimNumber((Date.parse(s.time.end) - Date.parse(s.time.start)) / 3600000, 2) });
    u.source.dd.textContent = T(m.info.sourceValue, { short: s.source.shortName, variable: spec().variable });
    u.source.dd.className = "ltr";
    u.type.dd.textContent = m.info.dataTypeValue;
    u.cover.dd.textContent = T(m.info.coverageValue, { west: formatLon(bounds.west), east: formatLon(bounds.east), south: formatLat(bounds.south), north: formatLat(bounds.north) });
    const showWind = phen.id === "wind";
    for (const node of [u.wind.dt, u.wind.dd]) node.hidden = !showWind;
    const cell = state.cursor;
    if (!cell) {
      el.status.hidden = false;
      el.status.textContent = state.outside ? m.info.outside : m.info.none;
      for (const key of ["cell", "loc", "bounds", "value", "sound", "wind"]) u[key].dd.textContent = "—";
    } else {
      const d = describeCell(cell);
      el.status.hidden = d.value !== null;
      el.status.textContent = d.value === null ? m.info.missing : "";
      u.cell.dd.textContent = d.id;
      u.loc.dd.textContent = T(c.understand.cellRow, { lat: d.lat, lon: d.lon });
      u.loc.dd.className = "ltr";
      u.bounds.dd.textContent = T("{south} to {north}, {west} to {east}", { south: formatLat(d.r.south), north: formatLat(d.r.north), west: formatLon(d.r.west), east: formatLon(d.r.east) });
      u.bounds.dd.className = "ltr";
      if (d.kind === "dust") u.value.dd.textContent = d.value === null ? "—" : T("{value} {unit}", { value: fmt(d.value), unit: unitText() });
      else u.value.dd.textContent = d.value === null ? "—" : T("{value} {unit}", { value: fmtChange(d.value), unit: unitText() });
      u.sound.dd.textContent = soundText(d);
      u.wind.dd.textContent = showWind ? windText(d.index) : "—";
      for (const extra of state.understandExtras) extra(d);
    }
    renderProvenance();
    if (el.inspector) renderInspector();
  }
  function renderProvenance() {
    const s = state.snapshot;
    const items = [h(document, "li", { class: "ltr", text: T(m.info.build, { build: s.source.modelSource }) }), h(document, "li", { class: "ltr mono", text: s.source.granule })];
    for (const rel of spec().related) if (!rel.only || rel.only === s.date) items.push(h(document, "li", {}, T(m.info.related, { label: "" }).replace(/:\s*$/, ": "), h(document, "a", { href: rel.url, target: "_blank", rel: "noopener noreferrer", text: rel.label + " (" + rel.relation + ")" })));
    items.push(h(document, "li", { text: T(m.info.files, { n: pkg.integrity.verified }) }));
    el.provenance.replaceChildren(h(document, "summary", { text: m.info.provenance }), h(document, "ul", { class: "st-keys small" }, ...items));
  }
  const readText = (cell) => {
    const d = describeCell(cell);
    const measure = m.phen.measure[phen.id];
    if (d.kind === "change") return T(d.value === null ? c.read.changeMissing : m.read.change, { id: d.id, lat: d.lat, lon: d.lon, measure, value: fmtChange(d.value), unit: unitText(), direction: d.value === null ? "" : Math.abs(d.value) < spec().change.nearZero ? c.understand.flat : d.value > 0 ? c.understand.up : c.understand.down });
    const base = T(d.value === null ? m.read.missing : m.read.cell, { id: d.id, lat: d.lat, lon: d.lon, measure, value: fmt(d.value), unit: unitText(), date: dateOf(state.snapshot) });
    return phen.id === "wind" && d.value !== null ? base + " " + windText(d.index) + "." : base;
  };

  // ---- Meaning of a value: a relative phrase from the same level that chooses the recording
  function meaningFor(index) {
    if (layerKind() === "change" || index === undefined || index < 0) return null;
    const value = state.snapshot.values[index];
    const args = { phenomenon: phen.id, value, breakpoints: bpFor() };
    return { level: meaningLevel(args), text: meaningPhrase({ ...args, language }) };
  }
  function fillBadge(node, mean) {
    node.hidden = !mean;
    if (!mean) return;
    node.textContent = mean.text;
    node.dataset.level = mean.level;
    node.dataset.kind = phen.id;
  }
  const makeBadge = (mean) => { const node = h(document, "span", { class: "st-badge", dir: "auto" }); fillBadge(node, mean); return node; };
  // Spoken order: meaning phrase, value with unit, short place, the date only when it changed. Resolved when it is actually said.
  let lastSpokenDate = null;
  let lastSpokenPhrase = null;
  // While exploring, the phrase is spoken the first time and again only when it changes (a new level or phenomenon); explicit requests always say it in full.
  function spokenNow(cell, always) {
    const d = describeCell(cell);
    const mean = meaningFor(cell.index);
    if (!mean) return readText(cell);
    const parts = [];
    if (always || mean.text !== lastSpokenPhrase) { parts.push(mean.text); lastSpokenPhrase = mean.text; }
    if (d.value !== null && mean.level !== "missing") parts.push(spokenNumber(phen.id, d.value) + " " + unitText());
    const centre = cellCenter(grid, cell.row, cell.col);
    parts.push(formatLat(Math.round(centre.lat * 10) / 10) + ", " + formatLon(Math.round(centre.lon * 10) / 10));
    const date = dateOf(state.snapshot);
    if (date !== lastSpokenDate) { parts.push(date); lastSpokenDate = date; }
    return parts.join(". ") + ".";
  }
  const spoken = (cell, prefix = "", always = false) => () => (prefix ? prefix + " " : "") + spokenNow(cell, always);

  // ---- Legend (compact: title, gradient bar, ticks)
  el.legend = h(document, "div", { class: "st-legend" });
  function renderLegend() {
    const s = spec();
    const parts = [];
    if (!state.comparison) {
      const norm = normalizer(s);
      const stops = s.stops.map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${(t * 100).toFixed(1)}%`).join(",");
      const ticks = s.ticks.map((v) => h(document, "span", { class: "tick ltr", style: `left:${norm(v) * 100}%`, text: String(v) }));
      parts.push(h(document, "p", { class: "st-legend-title", text: m.phen.short[phen.id] + " · " + unitText() }), h(document, "div", { class: "st-bar", style: `background:linear-gradient(90deg,${stops})`, "aria-hidden": "true" }), h(document, "div", { class: "st-ticks ltr", "aria-hidden": "true" }, ...ticks));
    } else {
      parts.push(h(document, "p", { class: "st-legend-title", text: c.legend.changeTitle + " · " + unitText() }), h(document, "div", { class: "st-bar st-bar-diff", "aria-hidden": "true" }),
        h(document, "div", { class: "st-ticks ltr", "aria-hidden": "true" }, h(document, "span", { class: "tick", style: "left:0%", text: "−" + s.change.max }), h(document, "span", { class: "tick", style: "left:50%", text: "0" }), h(document, "span", { class: "tick", style: "left:100%", text: "+" + s.change.max })));
    }
    parts.push(h(document, "span", { class: "st-legend-range ltr", "aria-hidden": "true", text: state.comparison ? "−" + s.change.max + " … +" + s.change.max : s.min + " … " + s.max }));
    el.legend.replaceChildren(...parts);
  }

  // ---- Cursor and selection
  function setCursor(cell, { announce = false, outside = false } = {}) {
    const changed = (state.cursor?.index ?? -1) !== (cell?.index ?? -1) || state.outside !== outside;
    state.cursor = cell;
    state.outside = outside;
    if (changed) { renderInfo(); invalidate(); if (cell) store.dispatch("MOVE_FOCUS", { sampleId: cell.index }); state.onCursor?.(cell); }
    if (announce && cell) speech.say(spoken(cell));
  }
  const cursorAt = (x, y) => { const g = toGeo(x, y); return cellAt(grid, g.lon, g.lat); };
  function selectCell(cell, { play = true, say = true, user = true } = {}) {
    if (!cell) return;
    state.selected = cell;
    state.cursor = cell;
    store.dispatch("SELECT_SAMPLE", { sampleId: cell.index });
    renderInfo();
    invalidate();
    updateSoundStatus();
    for (const hook of state.selectHooks ?? []) hook(cell, { user });
    if (user && typeof app !== "undefined" && app.dataset.flyout !== "open" && win.innerHeight >= 700) setInspectorCollapsed(false);
    if (play) soundForCursor(true);
    if (say) guided(spoken(cell));
  }
  const explain = () => { if (state.cursor) speech.say(spoken(state.cursor, "", true)); else speech.say(m.info.none); };

  // ---- Sound: the user's recordings, chosen by the REAL value (low / mid / high). No synthesized tones.
  const slotFor = () => 0.3;
  const tonesFor = () => [{ offsetS: 0, tone: undefined }]; // markers only: the recording slice plays when the step becomes active
  const bpCache = new Map();
  const bpFor = () => { if (!bpCache.has(phen.id)) bpCache.set(phen.id, breakpoints(phen.list.map((s) => s.values), { min: MIN_VALUE[phen.id] ?? -Infinity })); return bpCache.get(phen.id); };
  const levelOfValue = (value) => levelFor({ phenomenon: phen.id, value, breakpoints: bpFor() });
  const levelAt = (index) => levelOfValue(index >= 0 ? state.snapshot.values[index] : null);
  const panOf = (cell) => lonPan(grid, cellCenter(grid, cell.row, cell.col).lon);
  const soundCell = () => state.cursor ?? state.selected;
  function updateSoundStatus() {
    if (!el.soundLevel) return;
    const cell = soundCell();
    if (!cell) { el.soundLevel.textContent = ""; return; }
    const level = levelAt(cell.index);
    el.soundLevel.textContent = level ? T(m.sound.levelLine, { level: m.sound.levels[level] }) : m.sound.silence;
  }
  function soundForCursor(force = false) {
    updateSoundStatus();
    if (!audio.enabled || state.busy) return;
    const cell = soundCell();
    if (!cell) { rec.silence(); return; }
    const level = levelAt(cell.index);
    if (force) rec.preview(phen.id, level, panOf(cell)); else rec.hold(phen.id, level, panOf(cell));
  }
  function refreshSound() {
    if (!audio.enabled) { rec.stop(); updateSoundStatus(); return; }
    if (state.busy) updateSoundStatus(); else soundForCursor();
  }
  // Scans, paths, comparisons and Echo: the clock reports each active step and a slice of the matching recording plays.
  audio.onEvent = (event) => {
    rec.silence();
    if (!(event.row >= 0)) return;
    const value = event.evidence && event.evidence.recValue !== undefined ? event.evidence.recValue : state.snapshot.values[event.row * grid.cols + event.col];
    const level = levelOfValue(value);
    if (level) rec.slice(phen.id, level, { pan: event.pan ?? 0, offsetS: (event.step ?? 0) * 0.37 });
  };
  audio.onHalt = () => rec.stopSlices();
  state.onCursor = (cell) => {
    updateSoundStatus();
    if (state.tool === "explore") soundForCursor();
    if (cell && state.tool === "explore" && store.state.tool === TOOLS.EXPLORE) guided(spoken(cell));
  };

  const setSound = async (on) => {
    const unlocking = on ? rec.unlock().catch(() => null) : null; // inside the click: the audio context is created and resumed here
    el.soundButton.setAttribute("aria-pressed", String(on));
    const soundLabel = on ? m.sound.disable : m.sound.enable;
    el.soundButton.setAttribute("aria-label", soundLabel);
    el.soundLabel.textContent = soundLabel;
    el.soundButton.setAttribute("data-tip", soundLabel);
    if (on) { await audio.enable(); await unlocking; el.soundState.textContent = rec.state === "none" ? c.sound.unavailable : m.sound.on; } else { audio.disable(); audio.stop(); rec.stop(); el.soundState.textContent = m.sound.off; }
    store.dispatch("SET_AUDIO", { audio: on ? AUDIO.IDLE : AUDIO.MUTED });
    renderInfo();
    refreshSound();
    if (on) soundForCursor(true);
  };

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
    if (!pointers.has(event.pointerId)) {
      if (event.pointerType === "mouse") { const cell = cursorAt(p.x, p.y); setCursor(cell, { outside: !cell }); pinHoverAt(p); hoverTip(p, cell); }
      state.onPointer?.("hover", event, p, pointers);
      return;
    }
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
      let view = zoomAt(state.view, bounds, vw(), vh(), before > 0 ? after / before : 1, centre.x - state.ins.l, centre.y - state.ins.t);
      view = panBy(view, bounds, vw(), vh(), centre.x - (pa.x + pb.x) / 2, centre.y - (pa.y + pb.y) / 2);
      state.view = view; invalidate();
      return;
    }
    if (!dragging || dragging.id !== event.pointerId || dragging.pinch) return;
    if (!dragging.moved && Math.hypot(p.x - dragging.start.x, p.y - dragging.start.y) < 4) return;
    dragging.moved = true;
    if (el.hoverTip) el.hoverTip.hidden = true;
    state.view = panBy(state.view, bounds, vw(), vh(), p.x - dragging.last.x, p.y - dragging.last.y);
    dragging.last = p;
    el.frame.dataset.dragging = "true";
    invalidate();
  });
  const endPointer = (event) => {
    const p = local(event);
    pointers.delete(event.pointerId);
    state.onPointer?.("up", event, p, pointers);
    if (dragging?.id === event.pointerId) {
      if (!dragging.moved && event.type === "pointerup" && state.tool === "explore") { const cell = cursorAt(p.x, p.y); if (cell) selectCell(cell); else setCursor(null, { outside: true }); }
      dragging = null;
    }
    if (pointers.size === 0) delete el.frame.dataset.dragging;
  };
  el.frame.addEventListener("pointerleave", () => { if (el.hoverTip) el.hoverTip.hidden = true; });
  el.frame.addEventListener("pointerup", endPointer);
  el.frame.addEventListener("pointercancel", endPointer);
  let trackpadUntil = 0;
  el.frame.addEventListener("wheel", (event) => {
    event.preventDefault();
    const p = local(event);
    const now = event.timeStamp;
    const scroll = !event.ctrlKey && event.deltaMode === 0 && (event.deltaX !== 0 || Math.abs(event.deltaY) < 40 || (Math.abs(event.deltaY) < 100 && now < trackpadUntil));
    if (scroll) { trackpadUntil = now + 120; setView(panBy(state.view, bounds, vw(), vh(), -event.deltaX, -event.deltaY), false); return; }
    zoomBy(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : event.ctrlKey ? 0.01 : 0.0016)), p.x, p.y, false);
  }, { passive: false });
  el.frame.style.touchAction = "none";
  state.onPointer = (type, event, p, ptrs) => {
    for (const handler of state.pointerHandlers) { handler(type, event, p, ptrs); if (event.defaultPrevented) return; }
    if (event.pointerType === "touch" && state.tool === "explore" && audio.enabled && ptrs.size === 1 && (type === "down" || type === "move")) { event.preventDefault(); const cell = cursorAt(p.x, p.y); setCursor(cell, { outside: !cell }); }
  };

  // ---- Keyboard: arrows move one cell, geography never mirrors.
  function moveCursor(dRow, dCol) {
    const from = state.cursor ?? (() => { const g = toGeo(state.width / 2, state.height / 2); return cellAt(grid, g.lon, g.lat) ?? { row: 0, col: 0 }; })();
    const row = Math.max(0, Math.min(grid.rows - 1, from.row + dRow));
    const col = Math.max(0, Math.min(grid.cols - 1, from.col + dCol));
    setCursor({ row, col, index: row * grid.cols + col });
    const centre = cellCenter(grid, row, col);
    const s = toScreen(centre.lon, centre.lat);
    if (s.x < 40 || s.x > state.width - 40 || s.y < 40 || s.y > state.height - 40) setView({ ...state.view, lon: centre.lon, lat: centre.lat }, true);
  }
  state.onKeyExtra.push((event) => {
    if (event.key === "Enter" && state.tool === "explore" && state.cursor) { event.preventDefault(); selectCell(state.cursor); return true; }
    return false;
  });
  state.onKey = (event) => {
    if (event.key === " " && state.cursor) { event.preventDefault(); if (audio.enabled) soundForCursor(true); else speech.say(spoken(state.cursor, m.sound.off, true)); return; }
    for (const handler of state.onKeyExtra) if (handler(event)) return;
  };
  el.frame.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      if (event.shiftKey) { const [dr, dc] = arrows[event.key]; setView(panBy(state.view, bounds, vw(), vh(), -dc * 60, -dr * 60), false); return; }
      moveCursor(...arrows[event.key]);
      return;
    }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1.4); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomBy(1 / 1.4); return; }
    if (event.key === "Home") { event.preventDefault(); setView(initialView()); return; }
    if (event.key === "Escape") { speech.cancel(); return; }
    if ((event.key === "r" || event.key === "R") && state.cursor) { event.preventDefault(); explain(); return; }
    state.onKey?.(event);
  });

  // ---- Sound card: one on/off button, one volume, the live waveform of the real output, and the honest note
  el.soundButton = h(document, "button", { type: "button", class: "icon-btn st-sound-toggle", "aria-pressed": "false", "aria-label": m.sound.enable, "data-tip": m.sound.enable, "data-tip-pos": "below" });
  el.soundButton.innerHTML = ICON.sound;
  el.soundLabel = h(document, "span", { text: m.sound.enable });
  el.soundButton.append(el.soundLabel);
  el.soundState = h(document, "p", { class: "visually-hidden", role: "status", "aria-live": "polite", text: m.sound.off });
  el.volume = h(document, "input", { type: "range", id: "st-volume", min: 0, max: 100, step: 1, value: Math.round(settings.volume * 100), "aria-label": m.sound.volume });
  el.volume.addEventListener("input", () => { const v = Number(el.volume.value) / 100; audio.setVolume(v); rec.setVolume(v); saveSettings({ volume: v }); });
  speech.setSpeechVolume(settings.speechVolume);
  el.soundButton.addEventListener("click", () => setSound(!audio.enabled));
  el.wave = h(document, "canvas", { width: 120, height: 36, role: "img", "aria-label": c.sound.wave });
  el.modeSeg = h(document, "div", { class: "seg", role: "group", "aria-label": m.mode.title });
  const modeButtons = {};
  for (const [mode, label] of [[GUIDED, m.mode.guided], [PURE, m.mode.pure]]) {
    const b = h(document, "button", { type: "button", "aria-pressed": String(mode === store.state.soundMode), text: label });
    b.addEventListener("click", () => setSoundMode(mode));
    modeButtons[mode] = b;
    el.modeSeg.append(b);
  }
  function renderModeButton() { for (const [mode, b] of Object.entries(modeButtons)) b.setAttribute("aria-pressed", String(mode === store.state.soundMode)); }
  el.soundMore = h(document, "div", { class: "st-sound-more" }, el.volume);
  el.soundLevel = h(document, "p", { class: "st-sound-level", role: "status", "aria-live": "polite" });
  el.soundNote = h(document, "small", { class: "st-sound-note", text: m.sound.note });
  el.soundPill = h(document, "div", { hidden: true });
  el.voiceNote = h(document, "p", { class: "small", hidden: true, text: m.voice.unavailable });
  // Guided Voice (spoken guidance plus the recordings, ducked while speaking) or Pure Sonification (the recordings only, no automatic speech).
  // The mode is the "Spoken instructions" setting (guidance): switching here saves it and tells the drawer; changing it there switches here.
  function setSoundMode(mode, { persist = true } = {}) {
    if (store.state.soundMode === mode) { renderModeButton(); return; }
    store.dispatch("SET_SOUND_MODE", { mode });
    speech.setMode(mode);
    el.status.setAttribute("aria-live", mode === GUIDED ? "polite" : "off");
    renderModeButton();
    el.live.textContent = m.mode.switched[mode];
    if (persist) { const next = saveSettings({ guidance: mode === GUIDED }); win.dispatchEvent(new win.CustomEvent("earthpulse:settings", { detail: next })); }
    if (mode === GUIDED && state.cursor) speak(spoken(state.cursor, m.mode.switched[mode], true));
  }

  // ---- Dry dates: explain a date with almost no signal and suggest the wettest real dates
  el.dryNotice = h(document, "div", { class: "st-dry", role: "status", "aria-live": "polite", hidden: true });
  function renderDryNotice() {
    if (!el.dryNotice) return;
    const rule = SIGNAL[phen.id];
    const notice = !rule || state.comparison ? null : dryNotice({ phenomenon: phen.id, list: phen.list, currentId: state.snapshot.id, exclude: api.lockedDates() });
    el.dryNotice.hidden = !notice;
    if (!notice) { el.dryNotice.replaceChildren(); return; }
    const words = m.dry[phen.id];
    const buttons = notice.suggestions.map((s) => {
      const pct = Math.round(s.share * 100);
      const b = h(document, "button", { type: "button", class: "button ghost small-button", "aria-label": T(m.dry.pick, { date: s.date, n: pct }), title: T(m.dry.share, { n: pct }), text: s.date });
      b.addEventListener("click", () => requestDate(s.id));
      return b;
    });
    el.dryNotice.replaceChildren(h(document, "p", { text: words.notice }), h(document, "div", { class: "st-dry-dates" }, ...buttons));
  }

  // ---- Phenomena and date (top left over the map)
  const phenButtons = {};
  el.phenGroup = h(document, "div", { class: "seg", role: "group", "aria-label": m.phen.label });
  for (const id of PHENOMENON_IDS) {
    const b = h(document, "button", { type: "button", "aria-pressed": String(id === phen.id), text: m.phen.short[id], "data-phen": id });
    b.addEventListener("click", () => switchPhenomenon(id));
    phenButtons[id] = b;
    el.phenGroup.append(b);
  }
  const forests = h(document, "button", { type: "button", "aria-disabled": "true", "data-tip": m.phen.forestsReason, "data-tip-pos": "below", "aria-describedby": "st-forests-reason", text: m.phen.short.forests });
  el.forestsNote = h(document, "p", { class: "visually-hidden", id: "st-forests-reason", text: m.phen.forestsReason });
  forests.addEventListener("click", () => toast(m.phen.forestsReason));
  el.phenGroup.append(forests, el.forestsNote);
  el.date = h(document, "select", { id: "st-date", "aria-label": m.date.label });
  el.prev = h(document, "button", { type: "button", class: "icon-btn", "aria-label": m.date.prev, text: "‹" });
  el.next = h(document, "button", { type: "button", class: "icon-btn", "aria-label": m.date.next, text: "›" });
  el.dateInfo = h(document, "span", { class: "small st-dateinfo" });
  el.lock = h(document, "div", { class: "callout warn st-lock floating", role: "alert", hidden: true });
  function fillDates() {
    const seasonLabel = (season) => m.date.seasons[season.name] + " " + season.seasonYear;
    el.date.replaceChildren(...phen.seasons.map((season) => h(document, "optgroup", { label: seasonLabel(season) }, ...season.snapshotIds.map((id) => { const entry = phen.snapshot(id); return h(document, "option", { value: id, text: entry.date + (isLocked(phen.id, entry.date, unlocked()) ? " 🔒" : ""), selected: id === state.snapshot.id, disabled: isLocked(phen.id, entry.date, unlocked()), title: isLocked(phen.id, entry.date, unlocked()) ? m.date.locked : "" }); }))));
  }
  async function requestDate(id) {
    const entry = phen.snapshot(id);
    if (!entry) return;
    if (isLocked(phen.id, entry.date, unlocked())) {
      stopTime();
      el.lock.hidden = false;
      el.lock.replaceChildren(h(document, "span", { text: T(m.lock.text, { date: entry.date }) + " " }), (() => { const show = h(document, "button", { type: "button", class: "button ghost small-button", text: m.lock.show }); show.addEventListener("click", () => { allowSpoilersThisVisit(); el.lock.hidden = true; fillDates(); renderTimeline(); requestDate(id); }); return show; })(),
        h(document, "a", { class: "button ghost small-button", href: "../" + (language === "ar" ? "?lang=ar" : ""), text: m.lock.decode }));
      el.date.value = state.snapshot.id;
      return;
    }
    el.lock.hidden = true;
    state.snapshot = entry;
    el.date.value = entry.id;
    store.dispatch("SET_TIME_RANGE", { start: entry.date, end: entry.date });
    onSnapshotChanged();
  }
  function onSnapshotChanged() {
    el.dateInfo.textContent = "";
    if (!state.comparison) applyLayer();
    renderTimeline();
    onDataChanged();
    for (const hook of state.dateHooks ?? []) hook();
  }
  el.date.addEventListener("change", () => requestDate(el.date.value));
  const stepDate = (delta) => { const i = phen.list.findIndex((s) => s.id === state.snapshot.id); const next = phen.list[Math.min(phen.list.length - 1, Math.max(0, i + delta))]; if (next) requestDate(next.id); };
  el.prev.addEventListener("click", () => stepDate(-1));
  el.next.addEventListener("click", () => stepDate(1));
  el.layerText = h(document, "span", { class: "st-layer-text" });
  el.layerClear = h(document, "button", { type: "button", class: "st-layer-clear", "aria-label": m.layer.clear, "data-tip": m.layer.clear, "data-tip-pos": "below", hidden: true });
  el.layerClear.innerHTML = ICON.close;
  el.layerClear.addEventListener("click", () => api.hideChange?.());
  el.layerChip = h(document, "span", { class: "st-layer", role: "status", "aria-live": "polite" }, el.layerText, el.layerClear);
  function renderLayerChip() {
    const change = state.cmpSources;
    const sameYear = change && change.a.date.slice(0, 4) === change.b.date.slice(0, 4);
    const full = change ? m.phen.short[phen.id] + " " + m.layer.change + " · " + change.a.date + " → " + change.b.date : m.phen.short[phen.id] + " · " + state.snapshot.date;
    const name = m.phen.short[phen.id] + (change ? " " + m.layer.change : "") + " · ";
    const dates = change ? (sameYear ? change.a.date.slice(5) + " → " + change.b.date.slice(5) : change.a.date + " → " + change.b.date) : state.snapshot.date;
    el.layerText.replaceChildren(name, h(document, "bdi", { dir: "ltr", text: dates }));
    el.layerChip.title = full;
    el.layerClear.hidden = !change;
    el.layerChip.dataset.kind = change ? "change" : "snapshot";
    el.date.value = change ? change.b.id : state.snapshot.id;
  }
  el.timeButton = h(document, "button", { type: "button", class: "icon-btn st-time-open", "aria-expanded": "false", "aria-haspopup": "dialog", "aria-label": m.date.timeline, "data-tip": m.date.timeline, "data-tip-pos": "below" });
  el.timeButton.innerHTML = ICON.calendar;
  const topLeft = h(document, "div", { class: "st-tb-group st-tb-left" }, el.phenGroup, h(document, "div", { class: "st-datebox" }, el.prev, el.date, el.next, el.timeButton), el.layerChip);

  // ---- Toasts and sheets
  let toastTimer = 0;
  function toast(text) {
    document.querySelectorAll(".toast").forEach((n) => n.remove());
    const node = h(document, "div", { class: "toast", role: "status", text });
    document.body.append(node);
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => node.remove(), 4200);
  }
  const holder = h(document, "div", { class: "st-holder", hidden: true });
  function openSheet(title, nodes, { onClose = () => {} } = {}) {
    const backdrop = h(document, "div", { class: "em-modal-backdrop" });
    const closeButton = h(document, "button", { type: "button", class: "icon-btn", "aria-label": m.mode.close });
    closeButton.innerHTML = ICON.close;
    const dialog = h(document, "div", { class: "em-modal st-sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "st-sheet-title" }, h(document, "div", { class: "st-sheet-head" }, h(document, "h2", { id: "st-sheet-title", text: title }), closeButton), ...nodes);
    backdrop.append(dialog);
    const previous = document.activeElement;
    const done = () => { for (const n of nodes) if (n.dataset?.park) holder.append(n); backdrop.remove(); document.removeEventListener("keydown", onKey, true); previous?.focus?.(); onClose(); };
    function onKey(event) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); done(); } }
    closeButton.addEventListener("click", done);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) done(); });
    document.addEventListener("keydown", onKey, true);
    document.body.append(backdrop);
    closeButton.focus();
    return { close: done };
  }
  info.dataset.park = "true";
  el.sourceStatus = h(document, "p", { class: "small st-source" });
  function renderStatus() {
    const verified = pkg.integrity.mode === "sha256" ? T(m.status.verified, { n: pkg.integrity.verified }) : m.status.verifyOff;
    el.sourceStatus.textContent = m.status.source + " · " + verified + (pkg.integrity.failed.length ? " · ⚠ " + pkg.integrity.failed.length : "");
  }
  const openComputed = () => openSheet(m.info.how, [el.sourceStatus, info]);
  const helpNodes = () => {
    const mapping = h(document, "ul", { class: "st-help-list" }, ...PHENOMENON_IDS.map((id) => h(document, "li", {}, h(document, "strong", { text: m.phen[id] + ": " }), DOCUMENTED_BREAKPOINTS[id] ? T(m.help.levelRule, { low: Number(DOCUMENTED_BREAKPOINTS[id].low.toPrecision(4)), high: Number(DOCUMENTED_BREAKPOINTS[id].high.toPrecision(4)), unit: m.phen.unitName[id] }) + (id === "rainfall" ? " " + m.help.rainRule : "") : m.sound.noRecording)));
    const keys = h(document, "ul", { class: "st-help-list" }, ...m.help.shortcuts.map(([key, text]) => h(document, "li", {}, h(document, "span", { class: "kbd", text: key }), " " + text)));
    const notes = h(document, "ul", { class: "st-help-list" }, ...m.help.notes.map((line) => h(document, "li", { text: T(line, { cellLat: trimNumber(size.lat), cellLon: trimNumber(size.lon) }) })));
    const actions = h(document, "div", { class: "st-ins-actions" }, (() => { const b = h(document, "button", { type: "button", class: "button ghost small-button", text: m.voice.explain }); b.addEventListener("click", explain); return b; })(), (() => { const b = h(document, "button", { type: "button", class: "button ghost small-button", text: m.voice.help }); b.addEventListener("click", () => speech.say(m.voice.helpText[store.state.tool])); return b; })());
    return [h(document, "h3", { text: m.help.mapping }), mapping, h(document, "h3", { text: m.help.keyboard }), keys, h(document, "h3", { text: m.help.data }), notes, h(document, "p", { class: "small" }, m.credit), h(document, "p", { class: "st-ins-actions" }, (() => { const b = h(document, "button", { type: "button", class: "button ghost small-button", text: c.share.copy }); b.addEventListener("click", () => api.copyLink?.()); return b; })()), h(document, "p", { class: "small" }, h(document, "a", { href: "../atlas.html", text: language === "ar" ? "الأرشيف: أطلس الصوت v1" : "Archive: Sound Atlas v1" })), actions];
  };
  const openHelp = () => openSheet(m.help.title, helpNodes());

  // ---- Inspector (right): value big, unit, location, time, model badge, one-line sound meaning
  el.insId = h(document, "h3", { class: "st-ins-id", id: "st-ins-title" });
  el.insValue = h(document, "strong", { class: "st-ins-number" });
  el.insUnit = h(document, "span", { class: "st-ins-unit" });
  el.insSub = h(document, "p", { class: "small st-ins-sub" });
  el.insWhere = h(document, "p", { class: "small ltr st-ins-where" });
  el.insWhen = h(document, "p", { class: "small st-ins-when", dir: "auto" });
  el.insSound = h(document, "p", { class: "small st-ins-sound" });
  el.insBadge = h(document, "p", { class: "st-badge", dir: "auto", hidden: true });
  const insListen = h(document, "button", { type: "button", class: "button small-button", text: m.sound.replay });
  const insHow = h(document, "button", { type: "button", class: "button ghost small-button", text: m.info.how });
  insListen.addEventListener("click", async () => { if (!state.selected) return; state.cursor = state.selected; if (!audio.enabled) await setSound(true); soundForCursor(true); });
  insHow.addEventListener("click", openComputed);
  el.insCollapse = h(document, "button", { type: "button", class: "icon-btn st-collapse", "aria-expanded": "true", "aria-label": m.info.collapse });
  el.insCollapse.innerHTML = ICON.chevron;
  el.insPill = h(document, "span", { class: "st-ins-pill" });
  el.insClose = h(document, "button", { type: "button", class: "icon-btn st-collapse st-ins-close", "aria-label": m.mode.close });
  el.insClose.innerHTML = ICON.close;
  el.insClose.addEventListener("click", () => { state.selected = null; renderInspector(); invalidate(); });
  el.insBody = h(document, "div", { class: "st-ins-body" }, h(document, "div", { class: "st-ins-value" }, el.insValue, el.insUnit), el.insBadge, el.insSub, el.insWhere, el.insWhen, el.insSound, h(document, "div", { class: "st-ins-actions" }, insListen, insHow));
  el.handle = h(document, "button", { type: "button", class: "st-handle", "aria-label": m.mobile.expand, "data-snap-control": "inspector" });
  el.inspector = h(document, "aside", { class: "st-inspector", "aria-labelledby": "st-ins-title", "data-collapsed": "false" },
    h(document, "div", { class: "st-ins-head" }, el.insId, h(document, "span", { class: "chip" }, m.info.modelBadge), el.insPill, el.insCollapse, el.insClose), el.insBody);
  el.insEmpty = h(document, "p", { class: "st-ins-empty", text: m.info.none });
  el.inspector.prepend(h(document, "h2", { class: "st-card-title", text: m.cards.place }));
  el.inspector.append(el.insEmpty);
  el.insCollapse.addEventListener("click", () => setInspectorCollapsed(el.inspector.dataset.collapsed !== "true"));
  function setInspectorCollapsed(collapsed) {
    el.inspector.dataset.collapsed = String(collapsed);
    el.insCollapse.setAttribute("aria-expanded", String(!collapsed));
    el.insCollapse.setAttribute("aria-label", collapsed ? m.info.panelShow : m.info.collapse);
    layoutChanged();
  }
  const snaps = ["peek", "half", "full"];
  const cycleSnap = (panel) => { panel.dataset.snap = snaps[(snaps.indexOf(panel.dataset.snap) + 1) % snaps.length]; };
  function renderInspector() {
    const cell = state.selected;
    const d = cell ? describeCell(cell) : null;
    el.inspector.hidden = false;
    el.insEmpty.hidden = Boolean(d);
    el.insBody.hidden = !d;
    el.inspector.querySelector(".st-ins-head").hidden = !d;
    if (!d) return;
    el.insId.textContent = d.id;
    el.insValue.textContent = d.value === null ? "—" : d.kind === "change" ? fmtChange(d.value) : fmt(d.value);
    el.insUnit.textContent = d.value === null ? m.info.missing : unitText();
    fillBadge(el.insBadge, d.kind === "change" ? null : meaningFor(d.index));
    el.insPill.textContent = d.value === null ? "—" : (d.kind === "change" ? fmtChange(d.value) : fmt(d.value)) + " " + unitText();
    const where = T("{lat}, {lon}", { lat: d.lat, lon: d.lon });
    const s = state.snapshot;
    el.insWhere.textContent = where;
    const range = h(document, "bdi", { dir: "ltr", text: formatUtcTime(s.time.start).replace(" UTC", "") + "–" + formatUtcTime(s.time.end) });
    el.insWhen.replaceChildren(dateOf(s) + " · ", range);
    el.insSub.textContent = state.cmpSources ? state.cmpSources.a.date + " → " + state.cmpSources.b.date + ": " + fmt(state.cmpSources.a.values[d.index]) + " → " + fmt(state.cmpSources.b.values[d.index]) : phen.id === "wind" && d.value !== null ? windText(d.index) : "";
    el.insSound.textContent = d.kind !== "change" && isDryValue(phen.id, d.value) ? m.dry[phen.id].cell + ". " + soundText(d) : soundText(d);
    el.handle.setAttribute("aria-label", m.mobile.expand);
    positionCard();
  }
  function positionCard() {}

  // ---- Tool rail and flyouts
  const toolDefs = [["explore", "tool"], ["area", "tool"], ["path", "tool"], ["compare", "flyout"], ["hunter", "flyout"], ["echo", "flyout"]];
  const railButtons = {};
  el.rail = h(document, "nav", { class: "st-rail", "aria-label": m.tabs.label });
  for (const [id] of toolDefs) {
    const b = h(document, "button", { type: "button", class: "icon-btn st-rail-button", "aria-pressed": String(id === "explore"), "aria-label": m.tools[id], "data-tip": m.tools[id], "data-tip-pos": "below", "data-id": id });
    b.innerHTML = ICON[id];
    b.append(h(document, "span", { class: "st-rail-label", text: m.tools[id] }));
    b.addEventListener("click", () => openTool(id, { focus: true }));
    railButtons[id] = b;
    el.rail.append(b);
  }
  const helpButton = h(document, "button", { type: "button", class: "icon-btn st-rail-button st-rail-help", "aria-label": m.help.title, "data-tip": m.help.title, "data-tip-pos": "below" });
  helpButton.innerHTML = ICON.help;
  helpButton.addEventListener("click", openHelp);
  const hunterBox = h(document, "div", { id: "em-panel-hunter", class: "st-flyout-body" });
  const echoBox = h(document, "div", { id: "em-panel-echo", class: "st-flyout-body" });
  state.left = h(document, "div", { hidden: true }, h(document, "div"), h(document, "div"));
  state.right = h(document, "div", { hidden: true }, h(document, "div"), h(document, "div"));
  const flyoutClose = h(document, "button", { type: "button", class: "icon-btn", "aria-label": m.mode.close });
  flyoutClose.innerHTML = ICON.close;
  el.flyoutTitle = h(document, "h2", { id: "st-flyout-title", tabindex: "-1" });
  el.flyoutBody = h(document, "div", { class: "st-flyout-content" });
  el.flyoutHandle = h(document, "button", { type: "button", class: "st-handle", "aria-label": m.mobile.expand });
  el.flyout = h(document, "section", { class: "st-flyout", "aria-labelledby": "st-flyout-title", hidden: true, "data-snap": "half" }, el.flyoutHandle, h(document, "div", { class: "st-flyout-head" }, el.flyoutTitle, flyoutClose), el.flyoutBody);
  el.flyoutHandle.addEventListener("click", () => cycleSnap(el.flyout));
  const introduced = new Set();
  let currentTool = "explore";
  function flyoutNodes(id) {
    if (id === "area") return [api.panels.area, api.panels.run];
    if (id === "path") return [api.panels.path, api.panels.run];
    if (id === "compare") return [api.panels.compare];
    if (id === "hunter") return [hunterBox];
    if (id === "echo") return [echoBox];
    return [];
  }
  const memory = {};
  function leaveTool(prev) {
    if (prev === "area" || prev === "path") {
      memory[prev] = { rect: state.rect, path: [...(state.path ?? [])] };
      api.stopRun?.(true);
      state.rect = null; state.cornerA = null; state.drawing = null; state.path = [];
      api.refreshPath?.();
    }
    if (prev === "compare") { memory.compare = { places: state.places, pair: state.cmpSources ? [state.cmpSources.a.date, state.cmpSources.b.date] : null }; state.places = { a: null, b: null }; api.refreshPlaces?.(); }
    if (state.comparison) api.hideChange?.();
    state.pins = [];
    state.hoverPin = null;
  }
  async function enterTool(id) {
    const saved = memory[id];
    if (!saved) return;
    if (id === "area" || id === "path") { state.rect = saved.rect; state.path = saved.path; api.refreshPath?.(); }
    if (id === "compare") { state.places = saved.places; api.refreshPlaces?.(); if (saved.pair) await api.showChangeFor(saved.pair[0], saved.pair[1]); }
    invalidate();
  }
  function openTool(id, { focus = false } = {}) {
    const previous = currentTool;
    if (previous !== id) leaveTool(previous);
    currentTool = id;
    state.compareActive = id === "compare";
    app.dataset.tool = id;
    speech.cancel();
    for (const [key, b] of Object.entries(railButtons)) b.setAttribute("aria-pressed", String(key === id));
    const mapTool = id === "area" || id === "path" ? id : "explore";
    api.setTool?.(mapTool);
    const storeTool = id === "hunter" ? TOOLS.HUNTER : id === "echo" ? TOOLS.ECHO : TOOLS.EXPLORE;
    store.dispatch("SET_TOOL", { tool: storeTool });
    const nodes = flyoutNodes(id);
    el.flyout.hidden = nodes.length === 0;
    el.frame.dataset.tool = mapTool;
    el.frame.dataset.tab = storeTool;
    if (nodes.length) {
      const icon = h(document, "span", { class: "st-flyout-icon", "aria-hidden": "true" });
      icon.innerHTML = ICON[id];
      el.flyoutTitle.replaceChildren(icon, m.tools[id]);
      el.flyoutBody.replaceChildren(...nodes);
      el.flyout.dataset.snap = "half";
      if (focus) el.flyoutTitle.focus();
    } else if (focus) railButtons.explore.focus();
    el.rail.dataset.open = "false";
    setFlyout(nodes.length > 0);
    setInspectorCollapsed(nodes.length > 0 || win.innerHeight < 700);
    if (previous !== id) enterTool(id);
    layoutChanged();
    if (storeTool !== TOOLS.EXPLORE && !introduced.has(storeTool) && store.state.soundMode === GUIDED) { introduced.add(storeTool); speak(m.voice.toolIntro[storeTool]); }
    state.tabHooks?.[storeTool]?.();
    invalidate();
  }
  const setTab = (tool) => openTool(tool === TOOLS.HUNTER ? "hunter" : tool === TOOLS.ECHO ? "echo" : "explore");
  const closeFlyout = () => { const opener = railButtons[currentTool]; openTool("explore"); opener?.focus(); };
  flyoutClose.addEventListener("click", closeFlyout);
  el.flyout.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeFlyout(); } });

  // ---- Zoom cluster (bottom right) and the timeline (bottom)
  const clusterButton = (label, html, handler) => { const b = h(document, "button", { type: "button", class: "icon-btn", "aria-label": label, "data-tip": label }); b.innerHTML = html; b.addEventListener("click", handler); return b; };
  el.compass.remove();
  el.compassButton = clusterButton(m.compass, ICON.compass, () => setView(initialView()));
  el.cluster = h(document, "div", { class: "st-cluster", role: "group", "aria-label": c.zoom.label }, clusterButton(c.zoom.in, "+", () => zoomBy(1.5)), clusterButton(c.zoom.out, "−", () => zoomBy(1 / 1.5)), el.compassButton);
  el.timeline = h(document, "div", { class: "st-ticks-row", role: "group", "aria-label": m.date.timeline });
  function renderTimeline() {
    if (el.lockFoot) el.lockFoot.hidden = !phen.list.some((s) => isLocked(phen.id, s.date, unlocked()));
    el.timeline.replaceChildren(...phen.seasons.map((season) => h(document, "div", { class: "st-season" }, h(document, "span", { class: "st-season-label", text: m.date.seasons[season.name] }),
      h(document, "div", { class: "st-season-dates" }, ...season.snapshotIds.map((id) => {
        const s = phen.snapshot(id);
        const locked = isLocked(phen.id, s.date, unlocked());
        const b = h(document, "button", { type: "button", class: "st-date", "aria-pressed": String(s.id === state.snapshot.id), "aria-label": s.date + (locked ? " (" + m.date.locked + ")" : ""), "data-locked": String(locked), "aria-disabled": locked ? "true" : null, title: locked ? m.date.locked : null, "data-tip": locked ? m.date.locked : null, text: (locked ? "🔒 " : "") + s.date.slice(5) });
        b.addEventListener("click", () => { stopTime(); requestDate(s.id); });
        return b;
      })))));
  }
  let timeTimer = 0;
  el.timePlay = h(document, "button", { type: "button", class: "icon-btn st-time-play", "aria-pressed": "false", "aria-label": m.sound.timePlay, "data-tip": m.sound.timePlay });
  el.timePlay.innerHTML = ICON.play;
  function stopTime() { win.clearInterval(timeTimer); timeTimer = 0; el.timePlay.setAttribute("aria-pressed", "false"); el.timePlay.innerHTML = ICON.play; el.timePlay.setAttribute("aria-label", m.sound.timePlay); }
  function startTime() {
    const open = phen.list.filter((s) => !isLocked(phen.id, s.date, unlocked()));
    if (open.length < 2) return;
    let i = open.findIndex((s) => s.id === state.snapshot.id);
    if (i < 0 || i >= open.length - 1) { i = -1; }
    el.timePlay.setAttribute("aria-pressed", "true");
    el.timePlay.innerHTML = ICON.pause;
    el.timePlay.setAttribute("aria-label", m.sound.timePause);
    const advance = () => { i += 1; if (i >= open.length) { stopTime(); return; } requestDate(open[i].id); };
    advance();
    timeTimer = win.setInterval(advance, 1500);
  }
  el.timePlay.addEventListener("click", () => (timeTimer ? stopTime() : startTime()));
  el.lockFoot = h(document, "div", { class: "st-lockfoot", hidden: true }, h(document, "span", { text: m.layer.lockFoot }));
  const lockShow = h(document, "button", { type: "button", class: "button ghost small-button", text: m.lock.show });
  lockShow.addEventListener("click", () => { allowSpoilersThisVisit(); api.refreshLocks(); });
  el.lockFoot.append(lockShow, h(document, "a", { class: "button ghost small-button", href: "../" + (language === "ar" ? "?lang=ar" : ""), text: m.lock.decode }));
  el.timePop = h(document, "div", { class: "st-timepop", role: "dialog", "aria-label": m.date.timeline, hidden: true }, el.lockFoot);
  function closeTimePop(focus) { if (el.timePop.hidden) return; el.timePop.hidden = true; el.timeButton.setAttribute("aria-expanded", "false"); if (focus) el.timeButton.focus(); }
  el.timeButton.addEventListener("click", () => { const open = el.timePop.hidden; el.timePop.hidden = !open; el.timeButton.setAttribute("aria-expanded", String(open)); if (open) el.timePop.querySelector('[aria-pressed="true"]')?.focus?.(); });
  el.timePop.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeTimePop(true); } });
  document.addEventListener("pointerdown", (event) => { if (!el.timePop.hidden && !el.timePop.contains(event.target) && !el.timeButton.contains(event.target)) closeTimePop(false); });
  let waveFrame = win.requestAnimationFrame(function loop() { if (audio.enabled) drawWaveform(el.wave, rec.analyser, { color: "#68e0d0" }); waveFrame = win.requestAnimationFrame(loop); });
  audio.transport.subscribe((snap) => { store.dispatch("SET_AUDIO", { audio: !audio.enabled ? AUDIO.MUTED : snap.status === "playing" ? AUDIO.PLAYING : snap.status === "paused" ? AUDIO.PAUSED : AUDIO.IDLE }); });

  function onDataChanged() {
    renderLegend();
    renderDryNotice();
    refreshSound();
    renderLayerChip();
    renderInfo();
    invalidate();
    for (const hook of state.dataHooks) hook();
    if (state.audio) state.onCursor?.(state.cursor);
  }
  const initialView = () => clampView(createView(bounds), bounds, vw(), vh()); // the whole coverage fits the free area (contain)


  // ---- Phenomenon switch (the dataset changes; position, tool, mode and sound settings stay)
  async function switchPhenomenon(id) {
    if (id === phen.id) return;
    speech.cancel();
    stopTime();
    for (const b of Object.values(phenButtons)) b.disabled = true;
    el.sourceStatus.textContent = T(m.phen.loading, { name: m.phen[id] });
    try {
      const next = await pkg.openPhenomenon(id);
      const date = state.snapshot.date;
      const same = next.byDate(date);
      phen = next;
      state.comparison = null;
      state.cmpSources = null;
      state.pins = [];
      api.stopRun?.(true);
      const open = same && !isLocked(id, same.date, unlocked()) ? same : next.list.find((s) => s.date === DEFAULT_DATE && !isLocked(id, s.date, unlocked())) ?? next.list.find((s) => !isLocked(id, s.date, unlocked()));
      state.snapshot = open;
      store.dispatch("SELECT_DATASET", { datasetId: id, variable: next.spec.measure });
      for (const [key, b] of Object.entries(phenButtons)) b.setAttribute("aria-pressed", String(key === id));
      fillDates();
      el.date.value = open.id;
      applyLayer();
      renderTimeline();
      onDataChanged();
      for (const hook of api.phenomenonHooks ?? []) hook();
      for (const hook of state.phenHooks ?? []) hook();
      if (store.state.soundMode === GUIDED) speak(T(m.voice.phenomenon, { name: m.phen[id], measure: m.phen.measure[id], n: next.list.length }));
    } catch (error) {
      console.error(error);
      store.dispatch("DATA_ERROR", { message: String(error.message ?? error) });
      toast(m.phen.error);
    } finally {
      for (const b of Object.values(phenButtons)) b.disabled = false;
      renderStatus();
    }
  }

  // ---- Assemble: the map is the page; everything else floats over it
  el.hint = h(document, "p", { class: "visually-hidden", id: "st-map-hint", text: m.help.mapHint });
  el.hoverTip = h(document, "div", { class: "st-hovertip", hidden: true, "aria-hidden": "true" });
  el.exploreHint = h(document, "p", { class: "st-hint", text: c.tools.help.explore });
  el.timewrap = h(document, "div", { class: "st-timewrap" }, el.timeline);
  el.soundMore.replaceChildren(el.modeSeg, h(document, "label", { class: "volume", for: "st-volume" }, h(document, "span", { text: m.sound.volume }), el.volume));
  const title = (text) => h(document, "h2", { text });
  const head = h(document, "header", { class: "st-head" }, h(document, "p", { class: "eyebrow", text: m.cards.eyebrow }), h(document, "h1", {}, m.cards.title[0] + " ", h(document, "em", { text: m.cards.title[1] })), h(document, "p", { class: "lede", text: m.cards.lede }));
  const dataCard = h(document, "section", { class: "st-card", "aria-label": m.cards.data }, title(m.cards.data), el.phenGroup,
    h(document, "div", { class: "st-datebox" }, el.prev, el.date, el.next, el.timeButton), el.timewrap, h(document, "div", { class: "st-inline" }, el.layerChip, el.timePlay), el.lock, el.lockFoot);
  const soundCard = h(document, "section", { class: "st-card st-sound", role: "group", "aria-label": c.sound.title }, title(m.cards.sound), el.soundButton, el.soundState, el.soundMore, el.wave, el.soundLevel, el.soundNote);
  const toolsCard = h(document, "section", { class: "st-card", "aria-label": m.cards.tools }, title(m.cards.tools), el.rail, el.exploreHint, el.flyout);
  let mapBoxEl;
  const how = h(document, "details", { class: "st-card st-how" }, h(document, "summary", { text: m.cards.how }), ...helpNodes());
  const app = h(document, "div", { class: "st-page", "data-flyout": "closed", "data-tool": "explore", "data-timeline": "bar" },
    h(document, "div", { class: "st-mapcol" }, (mapBoxEl = h(document, "div", { class: "st-mapbox" }, el.frame, el.hint, el.legend, el.cluster, el.hoverTip, el.note, el.dryNotice))),
    h(document, "div", { class: "st-col" }, head, dataCard, soundCard, el.inspector, toolsCard, how));
  // On small screens the dry-date notice moves into the Data card so it never covers the small map.
  const narrow = win.matchMedia?.("(max-width: 1023px)");
  const placeDry = () => { if (narrow?.matches) dataCard.insertBefore(el.dryNotice, el.timewrap); else mapBoxEl.append(el.dryNotice); };
  narrow?.addEventListener?.("change", placeDry);
  function setFlyout(open) { app.dataset.flyout = open ? "open" : "closed"; el.exploreHint.hidden = open; invalidate(); }
  function placeTimeline() { app.dataset.timeline = "bar"; layoutChanged(false); }
  placeDry();
  setFlyout(false);
  root.replaceChildren(el.live, app, holder);
  holder.append(info);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { speech.cancel(); if (!el.timePop.hidden) closeTimePop(true); } if (event.key === "?" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? "")) { event.preventDefault(); openHelp(); } });
  win.addEventListener("earthpulse:settings", (event) => { const s = event.detail; audio.setVolume(s.volume); rec.setVolume(s.volume); if (typeof s.guidance === "boolean") setSoundMode(s.guidance ? GUIDED : PURE, { persist: false }); speech.setSpeechVolume(s.speechVolume); el.volume.value = String(Math.round(s.volume * 100)); });


  // First load: a real value is already in the inspector (nearest data cell to the centre of the coverage), sound off.
  function selectDefaultCell() {
    const cr = Math.floor(grid.rows / 2);
    const cc = Math.floor(grid.cols / 2);
    const values = layerValues();
    for (let radius = 0; radius < Math.max(grid.rows, grid.cols); radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          const row = cr + dr; const col = cc + dc;
          if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) continue;
          const index = row * grid.cols + col;
          if (values[index] !== null && values[index] !== undefined && !Number.isNaN(values[index])) { selectCell({ row, col, index }, { play: false, say: false, user: false }); return; }
        }
      }
    }
  }

  const api = {
    rec, vw, vh, panels: {}, toast, hoverPin, unitText, phenName: () => m.phen[phen.id], dateText: () => dateOf(state.snapshot), state, el, grid, bounds, c, T, document, win, audio, speech, store, pkg, language, setSound, setCursor, selectCell, setView, invalidate, toScreen, toGeo, fmt, fmtChange,
    layerValues, layerKind, applyLayer, onDataChanged, renderInfo, readText, tonesFor, slotFor, setTab, requestDate, switchPhenomenon, sampleName, explain, speak, guided,
    get phen() { return phen; }, get catalog() { return catalog(); }, get list() { return phen.list; }, get renderer() { return renderer; }, phenomenonId: () => phen.id,
    getSnapshot: async (id) => phen.snapshot(id),
    difference: (resolution) => pkg.difference(phen, resolution),
    refreshDateInfo: () => { el.dateInfo.textContent = ""; renderLayerChip(); },
    setPins: (pins) => { state.pins = pins; invalidate(); },
    reduced,
    analysis: createAnalysisClient(),
    lockedDates: () => (phen.id === "dust" && !unlocked() ? [...DECODE_LOCKED_DATES] : []),
    refreshLocks: () => { fillDates(); renderTimeline(); for (const hook of state.lockHooks ?? []) hook(); if (state.snapshot && isLocked(phen.id, state.snapshot.date, unlocked())) requestDate(firstOpen().id); },
    playCurrent: () => soundForCursor(true),
    showValues: async (date) => {
      if (state.comparison) api.hideChange();
      const target = phen.byDate(date);
      if (target && state.snapshot.id !== target.id) await requestDate(target.id);
    },
    showChangeFor: async (firstDate, secondDate) => {
      const A = phen.byDate(firstDate)?.id;
      const B = phen.byDate(secondDate)?.id;
      if (!A || !B) return;
      if (state.comparison) {
        if (state.cmpSources?.a.id === A && state.cmpSources?.b.id === B) return;
        api.hideChange();
      }
      el.cmpA.value = A;
      el.cmpB.value = B;
      api.describeComparison();
      await api.showChange();
    },
  };
  makeRenderer(params.get("renderer") === "2d");
  new win.ResizeObserver(resize).observe(el.frame);
  fillDates();
  renderStatus();
  renderModeButton();
  renderTimeline();
  onDataChanged();
  setSound(false);
  win.addEventListener("resize", resize);
  win.document.addEventListener("visibilitychange", () => { if (!win.document.hidden) invalidate(); });
  mountTools(api);
  mountCompare(api);
  mountShare(api);
  mountHunter(api, hunterBox);
  mountEcho(api, echoBox);
  placeTimeline();
  setView(initialView(), false);
  openTool("explore");
  selectDefaultCell();
  setInspectorCollapsed(true);
  if (params.has("debug")) win.__studio = api;
  if (initialMode === GUIDED) speak(m.voice.welcome.GUIDED_VOICE);
  return api;
}
