import { heardClass, makeSpatialPlan } from "../../audio/spatial-plan.js";
import { createTransport } from "../../audio/transport.js";
import { createDecodePlayback } from "../../decode.js";
import { createDecodeSession } from "../../experiences/decode/session.js";
import { loadDecodeCase } from "../../sources/decode/index.js";
import { drawWaveform } from "../audio-tap.js";
import { DUST_BREAKPOINTS, levelFor } from "../../studio/ambience-core.js";
import { createRecordings } from "../../studio/recordings.js";
import { copy as cinematicCopy } from "../copy.js";
import { createScene } from "../scene.js";
import { cellBounds, cellId, cellSize, fillIso, formatLat, formatLon, textureCrop, trimNumber } from "./cells.js";
import { mountCellGrid } from "./cell-grid.js";
import { h } from "./dom.js";
import { exploreCopy } from "./explore-copy.js";
import { mountNav } from "./nav.js";
import { allowSpoilersThisVisit, spoilersUnlocked } from "./progress.js";
import { loadSettings, saveSettings } from "./settings.js";
import { scienceModel } from "./science.js";

export const CASE_ID = "dust-geos-fp-20250819-1930-north-africa-med";
const TEXTURE = "../assets/earth/blue-marble-4096.jpg";
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 1.35;

/** Cell record from a session snapshot, or undefined. Values exist here only because the session runs in learning mode. */
export function cellOf(snapshot, row, col) {
  return snapshot.grid.cells.find((cell) => cell.row === row && cell.col === col);
}

export function levelMax(snapshot) {
  return Math.max(0, ...snapshot.grid.cells.map((cell) => (Number.isFinite(cell.value) ? cell.value : 0)));
}

/** Numerical difference and which cell is higher; pure so it can be tested. */
export function compareValues(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { difference: Math.abs(a - b), higher: a === b ? null : a > b ? "a" : "b" };
}

export function startExplore(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "explore", from: "pages" });
  const c = exploreCopy[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("explore-root");
  if (spoilersUnlocked()) return mountExplore(document, root, language);
  root.replaceChildren(h(document, "section", { class: "panel lock", "aria-labelledby": "lock-title" },
    h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", { id: "lock-title", text: c.lock.title }),
    h(document, "p", { class: "lede", text: c.lock.text }),
    h(document, "div", { class: "actions" },
      h(document, "a", { class: "button", href: "../" + (language === "ar" ? "?lang=ar" : ""), text: c.lock.decode }),
      (() => { const show = h(document, "button", { type: "button", class: "button ghost", text: c.lock.show }); show.addEventListener("click", () => { allowSpoilersThisVisit(); mountExplore(document, root, language); }); return show; })())));
  return Promise.resolve();
}

async function mountExplore(document, root, language) {
  const c = exploreCopy[language];
  const settings = loadSettings();
  const body = document.body;
  root.replaceChildren(h(document, "p", { class: "status", role: "status", text: c.loading }));

  // The 3D Earth: the same scene the Decode page uses, registered to the HTML grid below.
  let scene = null;
  try {
    scene = createScene({ document });
    scene.setDirection(language === "ar");
    body.prepend(scene.canvas);
    body.classList.add("explore-3d");
    body.dataset.renderer = "webgl";
    body.dataset.flight = "hero";
    scene.onFrame(({ progress, target }) => {
      const flight = progress !== target ? "flying" : target === 1 ? "done" : "hero";
      if (body.dataset.flight !== flight) body.dataset.flight = flight;
    });
    scene.onLost(() => { body.dataset.renderer = "svg"; body.classList.remove("explore-3d"); scene.canvas.remove(); stageFallback(); });
  } catch (error) {
    console.warn("WebGL is unavailable; using the flat map.", error);
    body.dataset.renderer = "svg";
  }

  // Listening here plays the user's recordings, chosen by the real value of the cell. The Decode session only keeps the focus and the captions.
  const rec = createRecordings({ baseUrl: new URL("../../assets/ambient/", import.meta.url), reduced: () => matchMedia?.("(prefers-reduced-motion: reduce)").matches === true });
  rec.setVolume(settings.volume);
  const transport = createTransport();
  const playback = createDecodePlayback(transport);
  let caseData = null;
  const session = createDecodeSession({
    cases: [CASE_ID], makePlan: makeSpatialPlan, heardClass, transport: playback.transport, level: "quick", mode: "learning", condition: "sound",
    async loadCase(id) { caseData = await loadDecodeCase(id); return caseData; },
  });
  try {
    await session.ready;
  } catch (error) {
    console.error(error);
    const retry = h(document, "button", { type: "button", class: "button", text: c.retry });
    retry.addEventListener("click", () => location.reload());
    root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: c.error }), retry);
    return;
  }
  const reachReveal = () => { for (let i = 0; i < 5 && session.getState().phase !== "reveal"; i++) session.dispatch({ type: "next" }); };
  reachReveal();

  const model = scienceModel(caseData, language);
  const state = { a: null, b: null, zoom: 1 };
  const view = () => playback.withActiveCell(session.getState());
  const el = {};
  const idOf = ([row, col]) => cellId(row, col);
  const bounds = caseData.bounds;

  // ---- Left column
  const features = h(document, "ul", { class: "xp-features" });
  c.features.forEach(([title, text], index) => features.append(h(document, "li", {}, h(document, "span", { class: "xp-icon", "aria-hidden": "true", text: ["♫", "⌖", "⇄"][index] }), h(document, "div", {}, h(document, "h3", { text: title }), h(document, "p", { text: text })))));
  const levelPicker = h(document, "fieldset", { class: "level-picker" }, h(document, "legend", { text: c.level }));
  for (const level of ["quick", "advanced"]) {
    const input = h(document, "input", { type: "radio", name: "xp-level", id: "xp-level-" + level, value: level, checked: level === "quick" });
    input.addEventListener("change", () => { transport.pause(); session.dispatch({ type: "set-level", level }); reachReveal(); state.a = state.b = null; buildGrid(); renderAll(); });
    levelPicker.append(h(document, "label", { for: input.id }, input, h(document, "span", { text: c[level] + " " + caseData.levels[level].rows + "×" + caseData.levels[level].cols })));
  }
  const left = h(document, "div", { class: "xp-left" },
    h(document, "p", { class: "eyebrow", text: c.eyebrow }),
    h(document, "h1", {}, c.titleLead + " ", h(document, "em", { text: c.titleAccent })),
    h(document, "p", { class: "lede", text: c.lede }), features,
    h(document, "section", { class: "panel xp-dataset" }, h(document, "h2", { text: c.dataset.title }),
      h(document, "dl", { class: "kv" },
        h(document, "dt", { text: "NASA" }), h(document, "dd", { class: "ltr", text: c.dataset.source }),
        h(document, "dt", { text: "⌖" }), h(document, "dd", { text: c.dataset.region }),
        h(document, "dt", { text: "◷" }), h(document, "dd", { text: fillIso(c.dataset.date, model, language) }),
        h(document, "dt", { text: "▦" }), h(document, "dd", { class: "ltr", text: fillIso(c.dataset.coverage, model, language) }),
        h(document, "dt", { text: "◌" }), h(document, "dd", { text: fillIso(c.dataset.variable, model, language) })), levelPicker),
    h(document, "section", { class: "panel xp-dod" }, h(document, "h2", { text: c.dod.title }), h(document, "p", { text: c.dod.text }),
      h(document, "p", { class: "callout", text: fillIso(c.dod.threshold, model, language) + ". " + c.dod.note })));

  // ---- Centre: stage registered to the globe
  el.stage = h(document, "div", { class: "xp-stage", dir: "ltr" });
  el.grid = h(document, "div", { class: "xp-grid" });
  el.stage.append(el.grid);
  const crop = textureCrop(bounds);
  el.stage.style.aspectRatio = String(crop.aspect);
  function stageFallback() {
    el.stage.dataset.renderer = "svg";
    el.stage.style.backgroundImage = `url("${TEXTURE}")`;
    el.stage.style.backgroundSize = `${crop.sizeX}% ${crop.sizeY}%`;
    el.stage.style.backgroundPosition = `${crop.posX}% ${crop.posY}%`;
    el.note.hidden = false;
  }
  el.note = h(document, "p", { class: "small xp-fallback", role: "note", hidden: true, text: c.map.fallback });
  el.caption = h(document, "p", { class: "small xp-particles", text: cinematicCopy[language].caption.dust });
  const zoomIn = h(document, "button", { type: "button", class: "xp-tool", "aria-label": c.map.zoomIn, text: "+" });
  const zoomOut = h(document, "button", { type: "button", class: "xp-tool", "aria-label": c.map.zoomOut, text: "−" });
  const reset = h(document, "button", { type: "button", class: "xp-tool", "aria-label": c.map.reset, text: "⟲" });
  const setZoom = (value) => { state.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)); el.stage.style.transform = `scale(${state.zoom})`; scene?.canvas && scene.setStage(el.stage); };
  zoomIn.addEventListener("click", () => setZoom(state.zoom + 0.15));
  zoomOut.addEventListener("click", () => setZoom(state.zoom - 0.15));
  reset.addEventListener("click", () => setZoom(1));
  const compass = h(document, "div", { class: "xp-compass", role: "img", "aria-label": c.map.compass }, h(document, "span", { "aria-hidden": "true", text: c.map.north }), h(document, "span", { class: "needle", "aria-hidden": "true", text: "↑" }));
  const centre = h(document, "section", { class: "xp-centre", "aria-label": c.title },
    h(document, "div", { class: "xp-stage-box" }, el.stage, h(document, "div", { class: "xp-tools", dir: "ltr" }, zoomIn, zoomOut, reset), compass),
    h(document, "p", { class: "small", id: "xp-help", text: c.map.help }), el.note, el.caption,
    h(document, "div", { class: "xp-scale panel" }, h(document, "h3", { id: "xp-scale-title", text: c.scale.title }), (el.scale = h(document, "div", {}))));

  function describe(row, col) {
    const b = cellBounds(bounds, caseData.levels[view().level], row, col);
    return c.map.cell.replace("{id}", cellId(row, col)).replace("{lat}", formatLat(b.north) + " – " + formatLat(b.south)).replace("{lon}", formatLon(b.west) + " – " + formatLon(b.east));
  }
  let gridApi;
  function buildGrid() {
    const snap = view();
    gridApi = mountCellGrid(document, el.grid, { rows: snap.grid.rows, cols: snap.grid.cols, label: c.map.label, describe, onChoose: choose, helpId: "xp-help" });
    gridApi.setSelected(state);
  }

  // ---- Right column
  el.selected = h(document, "section", { class: "panel", "aria-labelledby": "xp-sel-title" });
  el.listen = h(document, "section", { class: "panel", "aria-labelledby": "xp-listen-title" });
  el.compare = h(document, "section", { class: "panel", "aria-labelledby": "xp-compare-title" });
  el.selected.className = "xp-part";
  el.listen.className = "xp-part";
  el.compare.className = "xp-compare-body";
  const drawerClose = h(document, "button", { type: "button", class: "icon-btn", "aria-label": c.compare.title + " ×", text: "×" });
  const drawer = h(document, "aside", { class: "xp-drawer", id: "xp-compare-drawer", hidden: true, "aria-label": c.compare.title }, h(document, "div", { class: "xp-drawer-head" }, drawerClose), el.compare);
  const openCompare = h(document, "button", { type: "button", class: "button ghost", "aria-expanded": "false", "aria-controls": "xp-compare-drawer", text: c.compare.title });
  const setDrawer = (open, focus = false) => { drawer.hidden = !open; openCompare.setAttribute("aria-expanded", String(open)); if (open) drawerClose.focus(); else if (focus) openCompare.focus(); };
  openCompare.addEventListener("click", () => setDrawer(drawer.hidden));
  drawerClose.addEventListener("click", () => setDrawer(false, true));
  drawer.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); setDrawer(false, true); } });
  const right = h(document, "div", { class: "xp-right" }, h(document, "section", { class: "panel xp-card" }, el.selected, el.listen, openCompare), drawer);

  root.replaceChildren(h(document, "div", { class: "xp-layout" }, left, centre, right), h(document, "p", { class: "credit", text: c.credit }));
  if (!scene) stageFallback(); else { scene.setStage(el.stage); scene.setGeography({ caseId: caseData.id, bounds: { ...bounds }, projection: "plate-carree" }); }

  // ---- Listen panel (built once; state text updates on transport ticks)
  el.state = h(document, "span", { class: "player-state", role: "status" });
  el.cellLabel = h(document, "span", { class: "player-cell" });
  const play = h(document, "button", { type: "button", class: "button", text: c.listen.play });
  const stop = h(document, "button", { type: "button", class: "button ghost", text: c.listen.stop });
  el.volume = h(document, "input", { type: "range", min: 0, max: 100, step: 1, id: "xp-volume", value: Math.round(settings.volume * 100) });
  el.wave = h(document, "canvas", { width: 480, height: 80, role: "img", "aria-label": c.listen.wave });
  el.caption2 = h(document, "p", { class: "captions", role: "status", "aria-live": "polite" });
  el.caption2.classList.toggle("visually-hidden", !settings.captions);
  el.listenNote = h(document, "p", { class: "small" });
  el.listen.append(h(document, "h2", { id: "xp-listen-title", text: c.listen.title }), h(document, "div", { class: "player-line" }, el.cellLabel, el.state),
    h(document, "div", { class: "player-buttons" }, play, stop), h(document, "label", { class: "volume", for: "xp-volume" }, h(document, "span", { text: c.listen.volume }), el.volume), el.wave, el.listenNote, el.caption2);
  play.addEventListener("click", () => { if (!state.a) { el.caption2.textContent = c.listen.needCell; return; } hearCell(state.a[0], state.a[1]); el.caption2.textContent = fillIso(c.captions.playing, { id: idOf(state.a) }, language); });
  stop.addEventListener("click", () => { rec.stop(); clearTimeout(second); el.state.textContent = c.listen.states.paused; el.caption2.textContent = c.captions.stopped; });
  el.volume.addEventListener("input", () => { const value = Number(el.volume.value) / 100; rec.setVolume(value); saveSettings({ volume: value }); });
  const panOfCell = (row, col) => { const b = cellBounds(bounds, caseData.levels[view().level], row, col); const lon = (b.west + b.east) / 2; return Math.max(-1, Math.min(1, (2 * (lon - bounds.west)) / (bounds.east - bounds.west) - 1)); };
  let second = 0;
  function hearCell(row, col, seconds = 1.8) {
    const value = cellOf(view(), row, col)?.value;
    const level = levelFor({ phenomenon: "dust", value: Number.isFinite(value) ? value : null, breakpoints: DUST_BREAKPOINTS });
    rec.unlock().then(() => rec.preview("dust", level, panOfCell(row, col), seconds));
    el.state.textContent = level ? c.listen.states.playing : c.listen.states.idle;
    return level;
  }
  el.listenLabel = h(document, "small", { class: "st-sound-note", text: language === "ar" ? "الأصوات تسجيلات تُختار بالقيمة الحقيقية: منخفض / متوسط / مرتفع. المستوى يتبع البيانات؛ أما التسجيلات نفسها فتوضيحية." : "Sounds are recordings chosen by the real value: low / mid / high. The level follows the data; the recordings themselves are illustrative." });
  el.listen.append(el.listenLabel);

  function choose(row, col) {
    state.a = [row, col];
    if (state.b && state.b[0] === row && state.b[1] === col) state.b = null;
    session.dispatch({ type: "focus", row, col });
    hearCell(row, col);
    el.caption2.textContent = fillIso(c.captions.playing, { id: idOf(state.a) }, language);
    gridApi.setSelected(state);
    gridApi.focusCell(row, col);
    renderPanels();
  }

  // ---- Panels that depend on the selection
  function renderPanels() {
    const snap = view();
    const threshold = caseData.levels[snap.level].truth.threshold;
    const tokens = { threshold: trimNumber(threshold, 4) };
    // Selected cell
    const parts = [h(document, "h2", { id: "xp-sel-title", text: c.selected.title })];
    if (!state.a) parts.push(h(document, "p", { text: c.selected.none }));
    else {
      const [row, col] = state.a;
      const record = cellOf(snap, row, col);
      const b = cellBounds(bounds, caseData.levels[snap.level], row, col);
      const size = cellSize(bounds, caseData.levels[snap.level]);
      const measured = record?.status === "measured";
      parts.push(
        h(document, "div", { class: "xp-cell-head" }, h(document, "span", { class: "xp-cell-id", text: idOf(state.a) }), h(document, "span", { class: "badge badge-data", text: record?.status === "measured" ? c.selected.above.replace("{threshold}", tokens.threshold) : c.selected.below.replace("{threshold}", tokens.threshold) })),
        h(document, "dl", { class: "kv" },
          h(document, "dt", { text: c.selected.value }), h(document, "dd", { class: "ltr xp-value", text: Number.isFinite(record?.value) ? trimNumber(record.value, 3) : c.selected.missing }),
          h(document, "dt", { text: c.selected.cellSize }), h(document, "dd", { class: "ltr", text: c.selected.size.replace("{lat}", trimNumber(size.lat)).replace("{lon}", trimNumber(size.lon)) }),
          h(document, "dt", { text: "⌖" }), h(document, "dd", { class: "ltr", text: fillIso(c.selected.bounds, { south: formatLat(b.south), north: formatLat(b.north), west: formatLon(b.west), east: formatLon(b.east) }, language) })),
        h(document, "p", { class: "callout", text: measured ? c.selected.aboveText : c.selected.belowText }));
    }
    el.selected.replaceChildren(...parts);
    el.cellLabel.textContent = state.a ? idOf(state.a) : "—";
    el.listenNote.textContent = state.a ? (cellOf(snap, ...state.a)?.status === "measured" ? c.listen.from : c.listen.silentCell) : c.listen.needCell;

    // Compare
    const cmp = [h(document, "h2", { id: "xp-compare-title", text: c.compare.title })];
    const select = h(document, "select", { id: "xp-other", "aria-label": c.compare.other });
    select.append(h(document, "option", { value: "", text: c.compare.choose }));
    for (const cell of snap.grid.cells) {
      if (state.a && cell.row === state.a[0] && cell.col === state.a[1]) continue;
      select.append(h(document, "option", { value: cell.row + "," + cell.col, text: cellId(cell.row, cell.col), selected: state.b && state.b[0] === cell.row && state.b[1] === cell.col }));
    }
    select.disabled = !state.a;
    select.addEventListener("change", () => { state.b = select.value ? select.value.split(",").map(Number) : null; gridApi.setSelected(state); renderPanels(); select.focus?.(); });
    const hear = h(document, "button", { type: "button", class: "button", text: c.compare.hear });
    hear.disabled = !(state.a && state.b);
    hear.addEventListener("click", () => {
      session.dispatch({ type: "focus", row: state.b[0], col: state.b[1] });
      hearCell(state.a[0], state.a[1], 1.4);
      clearTimeout(second);
      second = setTimeout(() => hearCell(state.b[0], state.b[1], 1.4), 1900);
      el.caption2.textContent = fillIso(c.captions.contrast, { a: idOf(state.a), b: idOf(state.b) }, language);
    });
    cmp.push(h(document, "label", { class: "xp-pick", for: "xp-other" }, h(document, "span", { text: c.compare.other }), select), h(document, "div", { class: "player-buttons" }, hear), h(document, "p", { class: "small", text: c.compare.hearNote }));
    if (state.a && state.b) {
      const va = cellOf(snap, ...state.a)?.value;
      const vb = cellOf(snap, ...state.b)?.value;
      const result = compareValues(va, vb);
      const max = levelMax(snap) || 1;
      const bar = (id, value, tag) => h(document, "div", { class: "xp-bar-row" }, h(document, "span", { class: "ltr", text: id + (tag ? " " + c.compare.selectedTag : "") }),
        h(document, "div", { class: "xp-bar-track", "aria-hidden": "true" }, h(document, "div", { class: "xp-bar", style: `width:${Math.max(2, (value / max) * 100)}%` })), h(document, "span", { class: "ltr", text: trimNumber(value, 3) }));
      if (result) {
        cmp.push(h(document, "div", { class: "xp-chart", role: "img", "aria-label": c.compare.chart + ": " + idOf(state.a) + " " + trimNumber(va, 3) + ", " + idOf(state.b) + " " + trimNumber(vb, 3) }, bar(idOf(state.a), va, true), bar(idOf(state.b), vb, false)),
          h(document, "p", { class: "xp-diff" }, h(document, "span", { text: c.compare.diff + ": " }), h(document, "strong", { class: "ltr", text: trimNumber(result.difference, 3) }), " · " + (result.higher ? c.compare.higher.replace("{id}", idOf(result.higher === "a" ? state.a : state.b)) : c.compare.equal)));
      }
    } else cmp.push(h(document, "p", { class: "small", text: c.compare.needBoth }));
    el.compare.replaceChildren(...cmp);

    // Scale: only the real maximum of this grid and the documented threshold.
    const max = levelMax(snap);
    el.scale.replaceChildren(h(document, "div", { class: "scale-bar", style: "position:relative", "aria-hidden": "true" }, h(document, "span", { class: "scale-mark", style: `left:${Math.min(100, (threshold / (max || 1)) * 100)}%` })),
      h(document, "div", { class: "scale-labels ltr", "aria-hidden": "true" }, h(document, "span", { text: "0" }), h(document, "span", { class: "scale-threshold", text: c.scale.threshold.replace("{threshold}", tokens.threshold) }), h(document, "span", { text: trimNumber(max, 3) })),
      h(document, "p", { class: "small", text: c.scale.note }));
  }

  function renderAll() { renderPanels(); }

  // ---- Wiring
  session.subscribe(() => {
    const snap = view();
    scene?.setSnapshot(snap);
    const t = snap.transport;
    void t;
  });
  buildGrid();
  renderAll();
  let frame;
  const loop = () => { drawWaveform(el.wave, rec.analyser, { color: "#68e0d0" }); frame = requestAnimationFrame(loop); };
  frame = requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(frame); frame = undefined; } else if (frame === undefined) frame = requestAnimationFrame(loop); });
  if (new URL(document.URL).searchParams.has("debug")) window.__explore = { session, scene, transport, state, rec };
}
