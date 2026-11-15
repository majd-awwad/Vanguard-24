import { compareDustSnapshots, loadDustCatalog, loadDustComparison, loadDustGrid, loadDustSnapshot } from "../sources/decode/dust-visual.js";
import { cellId, cellSize, fillIso, formatLat, formatLon, formatUtcDate, formatUtcTime, trimNumber } from "../cinematic/site/cells.js";
import { h } from "../cinematic/site/dom.js";
import { mountNav } from "../cinematic/site/nav.js";
import { allowSpoilersThisVisit, spoilersUnlocked } from "../cinematic/site/progress.js";
import { loadSettings, saveSettings } from "../cinematic/site/settings.js";
import { createStudioAudio } from "./audio.js";
import { DEFAULT_REASON, FINGERPRINT_CELLS, fingerprintPlan, fingerprintSteps, placeSummary, resolveComparison } from "./compare.js?v=5";
import { createDustLayer } from "./dust-layer.js?v=5";
import { drawValueProfile } from "./dust-profile.js?v=5";
import { DIFF_MAX, NEAR_ZERO, VALUE_MAX, VALUE_MIN, cellCenter, cellRect, diffColor, diffInverse, diffS, distanceKm, rectCells, summarize, valueColor, valueT } from "./field.js";
import { createMapCore } from "./map-core.js?v=5";
import { HIGH_HZ, MAX_SCAN_CELLS, PITCH_LOW_HZ, SLOT, changeSemitones, hoverPlan, joinPlans, lonPan, sequencePlan, valueHz } from "./mapping.js";
import { decodeShare, encodeShare, shareUrl } from "./share.js?v=5";
import { studioCopy } from "./studio-copy.js?v=5";
import { MAX_PATH_POINTS, PATH_STEP_KM, SPEEDS, areaScan, filterDirection, pathSteps, rectBetween, thinPath } from "./tools.js?v=5";
import { clipToRegion } from "./view.js";

// Earth Sound Studio, dust edition (web/pages/studio.html).
//
// Same map engine and interaction model as the night-lights studio (map-core.js: continuous world map, wheel / drag /
// pinch, pixel-precise probe, camera pill, bottom dock, transport row, route profile, A/B places), backed by real
// numeric NASA GMAO GEOS-FP dust optical depth. Numbers shown or played are always real cell values (field.js,
// mapping.js); the smooth colour field is display only and says so.

export const DEFAULT_SNAPSHOT = "geos-fp-dust-20250819-1930";
const EARTH_URL = () => new URL("../assets/earth/blue-marble-4096.jpg", import.meta.url).href;
const EARTH_URL_SMALL = () => new URL("../assets/earth/blue-marble-2048.jpg", import.meta.url).href;

/** Catalog snapshots in time order. */
export const chronological = (catalog) => [...catalog.snapshots].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

export function startStudio(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "studio", from: "pages" });
  const c = studioCopy[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("studio-root");
  // `?demo=1` skips the spoiler gate for presentations; the normal gate stays for everyone else.
  const demo = new URL(document.URL).searchParams.get("demo") === "1";
  if (demo) allowSpoilersThisVisit();
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
  const T = (template, values) => fillIso(template, values, language);
  root.replaceChildren(h(document, "p", { class: "status st-loading", role: "status", text: c.loading }));

  // ---- Data
  let catalog;
  let grid;
  let wanted = {};
  const cache = new Map();
  const getSnapshot = async (id) => { if (!cache.has(id)) cache.set(id, await loadDustSnapshot(id)); return cache.get(id); };
  try {
    [catalog, grid] = await Promise.all([loadDustCatalog(), loadDustGrid()]);
    wanted = decodeShare(new URL(document.URL).search, catalog, catalog.bounds ?? grid.bounds);
    await getSnapshot(wanted.snapshotId ?? DEFAULT_SNAPSHOT);
  } catch (error) {
    console.error(error);
    const retry = h(document, "button", { type: "button", class: "button", text: c.retry });
    retry.addEventListener("click", () => win.location.reload());
    root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: c.error }), retry);
    return undefined;
  }
  const bounds = grid.bounds;
  const size = cellSize(bounds, grid);
  const list = chronological(catalog);
  const dates = Object.fromEntries(list.map((s) => [s.id, s.date]));
  const total = grid.rows * grid.cols;

  const state = {
    snapshot: cache.values().next().value,
    comparison: null,      // difference layer (published or computed) when the change layer is shown
    cmpSources: null,      // { a, b } snapshots of the comparison
    pending: null,         // resolveComparison() of the two selected dates
    active: null,          // sample shown in the inspector
    selected: null,        // last clicked / keyboard-read sample
    tool: "explore",       // explore | area | path | places
    places: [],            // [A, B]: { type: "cell", cell, longitude, latitude } | { type: "area", rect }
    rect: null,
    cornerA: null,
    path: [],              // [{ lon, lat }]
    run: null,             // loaded scan / route / fingerprint
    repeat: false,
    direction: "both",
    keyboardProbe: false,
  };
  const layerValues = () => (state.comparison ? state.comparison.values : state.snapshot.values);
  const layerKind = () => (state.comparison ? "change" : "dust");
  const digits = (value) => (Math.abs(value) < 0.01 ? 4 : 3);
  const fmt = (value) => (value === null || value === undefined ? "—" : trimNumber(value, digits(value)));
  const fmtChange = (value) => (value === null || value === undefined ? "—" : (value > 0 ? "+" : value < 0 ? "−" : "") + trimNumber(Math.abs(value), digits(value)));
  const fmtLayer = (value) => (layerKind() === "change" ? fmtChange(value) : fmt(value));
  const tenth = (value) => Math.round(value * 10) / 10;
  const areaText = (r) => `${formatLat(tenth(r.south))}–${formatLat(tenth(r.north))} · ${formatLon(tenth(r.west))}–${formatLon(tenth(r.east))}`;
  const pointText = (lon, lat) => `${formatLat(Number(lat.toFixed(2)))}, ${formatLon(Number(lon.toFixed(2)))}`;
  const directionOf = (value) => (Math.abs(value) < NEAR_ZERO ? c.understand.flat : value > 0 ? c.understand.up : c.understand.down);

  // ---- View (static structure; every number is filled in later from data)
  const el = {};
  const icon = (text) => h(document, "span", { class: "st-ico", "aria-hidden": "true", text });
  const tool = (id, glyph, label, extra = {}) => h(document, "button", { type: "button", id, ...extra }, icon(glyph), h(document, "span", { class: "st-label", text: label }));
  const row = (label, id, attrs = {}) => h(document, "div", {}, h(document, "dt", { text: label }), h(document, "dd", { id, ...attrs }));

  el.map = h(document, "div", { id: "st-map", class: "st-map", dir: "ltr", tabindex: "0", role: "application", "aria-label": c.map.label, "aria-describedby": "st-keys", "data-renderer": "2d", "data-interaction": "navigate", "data-tool": "explore" });
  el.date = h(document, "select", { id: "st-date", "aria-label": c.date.label });
  for (const season of catalog.seasons) {
    const group = h(document, "optgroup", { label: c.date.seasons[season.name] + " " + season.seasonYear });
    for (const id of season.snapshotIds) group.append(h(document, "option", { value: id, text: dates[id], selected: id === state.snapshot.id }));
    el.date.append(group);
  }
  el.prev = h(document, "button", { type: "button", class: "st-step", "aria-label": c.date.prev, title: c.date.prev, text: "‹" });
  el.next = h(document, "button", { type: "button", class: "st-step", "aria-label": c.date.next, title: c.date.next, text: "›" });
  el.layerDust = h(document, "button", { type: "button", "data-layer": "dust", "aria-pressed": "true", text: c.layer.dust });
  el.layerChange = h(document, "button", { type: "button", "data-layer": "change", "aria-pressed": "false", text: c.layer.change });
  el.region = h(document, "button", { type: "button", id: "st-region", "aria-label": c.ui.region, title: c.ui.region, text: "⌖" });
  el.world = h(document, "button", { type: "button", id: "st-world", "aria-label": c.ui.world, title: c.ui.world, text: "◎" });
  el.minus = h(document, "button", { type: "button", id: "st-minus", "aria-label": c.zoom.out, title: c.zoom.out, text: "−" });
  el.plus = h(document, "button", { type: "button", id: "st-plus", "aria-label": c.zoom.in, title: c.zoom.in, text: "+" });
  el.dateInfo = h(document, "strong", { id: "st-date-info" });
  el.dateSeason = h(document, "span", { id: "st-date-season" });
  el.topbar = h(document, "div", { class: "st-topbar" },
    h(document, "div", { class: "st-pill st-date-pill", role: "group", "aria-label": c.date.title }, el.prev, el.date, el.next),
    h(document, "div", { class: "st-pill st-layer-pill", role: "group", "aria-label": c.ui.layerGroup }, el.layerDust, el.layerChange),
    h(document, "div", { class: "st-pill st-camera", role: "group", "aria-label": c.ui.camera }, el.region, el.world, el.minus, el.plus));
  el.status = h(document, "div", { class: "st-status", role: "note" }, h(document, "span", { class: "st-dot", "aria-hidden": "true" }), h(document, "div", {}, el.dateInfo, el.dateSeason));
  el.keys = h(document, "p", { class: "st-keys", id: "st-keys", text: c.ui.keyboardHint });

  // Inspector: the one place where numbers are shown.
  el.legend = h(document, "div", { class: "st-legend" });
  el.empty = h(document, "p", { id: "st-empty", class: "st-empty", text: c.understand.none });
  el.valueLabel = h(document, "span", { class: "st-value-label" });
  el.swatch = h(document, "i", { class: "st-swatch", "aria-hidden": "true" });
  el.value = h(document, "strong", { id: "st-value", class: "st-value", dir: "ltr" });
  el.valueUnit = h(document, "span", { class: "st-value-unit" });
  el.callout = h(document, "p", { id: "st-callout", class: "st-callout" });
  el.lon = h(document, "dd", { id: "st-lon", dir: "ltr" });
  el.lat = h(document, "dd", { id: "st-lat", dir: "ltr" });
  el.cell = h(document, "dd", { id: "st-cell", class: "st-hud-cell", dir: "ltr", text: "—" });
  el.cellBounds = h(document, "dd", { id: "st-bounds", dir: "ltr" });
  el.firstRow = row(c.understand.first, "st-first", { dir: "ltr" });
  el.secondRow = row(c.understand.second, "st-second", { dir: "ltr" });
  el.sound = h(document, "p", { id: "st-sound-text" });
  el.reading = h(document, "div", { id: "st-reading", hidden: true },
    h(document, "div", { class: "st-value-block" }, el.valueLabel, h(document, "div", { class: "st-value-line" }, el.swatch, el.value), el.valueUnit, el.callout),
    h(document, "section", {}, h(document, "h3", { text: c.understand.location }),
      h(document, "dl", { class: "st-two" }, h(document, "div", {}, h(document, "dt", { text: c.ui.lon }), el.lon), h(document, "div", {}, h(document, "dt", { text: c.ui.lat }), el.lat)),
      h(document, "dl", {}, h(document, "div", {}, h(document, "dt", { text: c.understand.cell }), el.cell), h(document, "div", {}, h(document, "dt", { text: c.understand.bounds }), el.cellBounds), el.firstRow, el.secondRow)),
    h(document, "section", {}, h(document, "h3", { text: c.understand.sound }), el.sound));

  // Contextual sections of the inspector (one per tool; hidden until used).
  el.placesStatus = h(document, "p", { id: "st-places-status", class: "st-hint" });
  el.placesTable = h(document, "div", { class: "st-places-table", hidden: true });
  el.hearA = h(document, "button", { type: "button", id: "st-hear-a", text: c.ui.hearA });
  el.hearB = h(document, "button", { type: "button", id: "st-hear-b", text: c.ui.hearB });
  el.hearBoth = h(document, "button", { type: "button", id: "st-hear-both", text: c.compare.playBoth });
  el.clearPlaces = h(document, "button", { type: "button", id: "st-clear-places", text: c.ui.clearPlaces });
  el.placesSection = h(document, "section", { id: "st-places-section", class: "st-context", hidden: true, "aria-labelledby": "st-places-title" },
    h(document, "h3", { id: "st-places-title", text: c.compare.places }), el.placesStatus, el.placesTable,
    h(document, "div", { class: "st-actions" }, el.hearA, el.hearB, el.hearBoth, el.clearPlaces),
    h(document, "p", { class: "st-note", text: c.compare.pointFp + " " + T(c.compare.areaFp, { n: FINGERPRINT_CELLS }) }));

  el.areaInfo = h(document, "div", { class: "st-area-info" });
  el.playSelected = h(document, "button", { type: "button", id: "st-play-selected", text: c.scan.selected });
  el.areaAsA = h(document, "button", { type: "button", id: "st-area-a", text: c.compare.setA });
  el.areaAsB = h(document, "button", { type: "button", id: "st-area-b", text: c.compare.setB });
  el.clearArea = h(document, "button", { type: "button", id: "st-clear-area", text: c.ui.clearArea });
  el.areaSection = h(document, "section", { id: "st-area-section", class: "st-context st-area-panel", hidden: true, "aria-labelledby": "st-area-title" },
    h(document, "h3", { id: "st-area-title", text: c.ui.areaTitle }), el.areaInfo,
    h(document, "div", { class: "st-actions" }, el.playSelected, el.areaAsA, el.areaAsB, el.clearArea),
    h(document, "p", { class: "st-note", text: c.scan.help }));

  const dateSelect = (id, label, value) => {
    const node = h(document, "select", { id, "aria-label": label });
    for (const entry of list) node.append(h(document, "option", { value: entry.id, text: entry.date, selected: entry.id === value }));
    return node;
  };
  el.cmpA = dateSelect("st-cmp-a", c.compare.first, wanted.cmp?.first ?? list.find((s) => s.date === "2025-04-15")?.id ?? list[0].id);
  el.cmpB = dateSelect("st-cmp-b", c.compare.second, wanted.cmp?.second ?? list.find((s) => s.date === "2025-07-15")?.id ?? list.at(-1).id);
  el.cmpStatus = h(document, "p", { id: "st-cmp-status", class: "st-callout", role: "status" });
  el.cmpInfo = h(document, "p", { class: "st-note" });
  el.cmpButton = h(document, "button", { type: "button", id: "st-cmp-show", class: "st-strong", text: c.compare.show });
  el.datesSection = h(document, "section", { id: "st-dates-section", class: "st-context", hidden: true, "aria-labelledby": "st-dates-title" },
    h(document, "h3", { id: "st-dates-title", text: c.compare.time }),
    h(document, "div", { class: "st-pickers" },
      h(document, "label", { for: "st-cmp-a" }, h(document, "span", { text: c.compare.first }), el.cmpA),
      h(document, "label", { for: "st-cmp-b" }, h(document, "span", { text: c.compare.second }), el.cmpB)),
    el.cmpStatus, el.cmpInfo, h(document, "div", { class: "st-actions" }, el.cmpButton),
    h(document, "p", { class: "st-note", text: c.compare.noMissing + " " + c.compare.sound }));

  el.summary = h(document, "section", { id: "st-summary-section", class: "st-context", hidden: true, "aria-labelledby": "st-summary-title" });

  el.provenance = h(document, "div", {});
  const mapRange = T(c.sound.range, { low: PITCH_LOW_HZ, high: HIGH_HZ, min: VALUE_MIN, max: VALUE_MAX });
  const mappingList = () => h(document, "ul", {}, h(document, "li", { text: c.sound.mapDust + " " + mapRange }), h(document, "li", { text: c.sound.mapPan }), h(document, "li", { text: c.sound.mapMissing }), h(document, "li", { text: c.sound.changeMap }));
  el.inspector = h(document, "aside", { class: "st-inspector st-understand", "aria-labelledby": "st-u-title" },
    h(document, "div", { class: "st-panel-heading" }, h(document, "span", { dir: "ltr", text: c.ui.inspectorTag }), h(document, "h2", { id: "st-u-title", text: c.ui.inspector })),
    el.legend, el.empty, el.reading, el.placesSection, el.areaSection, el.datesSection, el.summary,
    h(document, "details", { class: "st-more" }, h(document, "summary", { text: c.ui.provenance }), el.provenance),
    h(document, "details", { class: "st-more" }, h(document, "summary", { text: c.sound.mapping }), mappingList(), h(document, "p", { text: c.sound.note })));

  // Dock: big primary tools, transport row, profile row.
  el.soundButton = tool("st-sound", "◉", c.sound.enable, { class: "st-sound-enable", "aria-pressed": "false" });
  el.visibleInfo = h(document, "small", { id: "st-visible-info", "aria-hidden": "true", dir: "ltr" });
  el.playVisible = h(document, "button", { type: "button", id: "st-play-visible", "aria-describedby": "st-visible-info", title: c.zoom.scansHint }, icon("↝"),
    h(document, "span", { class: "st-label-stack" }, h(document, "span", { class: "st-label", text: c.scan.visible }), el.visibleInfo));
  el.areaTool = tool("st-area-tool", "▭", c.ui.selectArea, { "aria-pressed": "false" });
  el.drawTool = tool("st-draw", "⌁", c.ui.draw, { "aria-pressed": "false" });
  el.placesTool = tool("st-places", "A:B", c.ui.comparePlaces, { "aria-pressed": "false" });
  el.datesTool = tool("st-dates", "Δt", c.ui.compareDates, { "aria-expanded": "false", "aria-controls": "st-dates-section" });
  el.play = h(document, "button", { type: "button", id: "st-play", "aria-label": c.scan.play, title: c.scan.play, disabled: true, text: "▶" });
  el.pause = h(document, "button", { type: "button", id: "st-pause", "aria-label": c.scan.pause, title: c.scan.pause, disabled: true, text: "Ⅱ" });
  el.replay = h(document, "button", { type: "button", id: "st-replay", "aria-label": c.ui.replay, title: c.ui.replay, disabled: true, text: "↺" });
  el.stop = h(document, "button", { type: "button", id: "st-stop", "aria-label": c.scan.stop, title: c.scan.stop, text: "■" });
  el.runState = h(document, "span", { id: "st-run-state", role: "status", text: c.scan.state.idle });
  el.progress = h(document, "input", { type: "range", id: "st-progress", min: 0, max: 1000, value: 0, disabled: true, "aria-label": c.ui.progress });
  el.speed = h(document, "select", { id: "st-speed" });
  for (const speed of SPEEDS) el.speed.append(h(document, "option", { value: speed, text: speed + "×", selected: speed === 1 }));
  const settings = loadSettings();
  el.volume = h(document, "input", { type: "range", id: "st-volume", min: 0, max: 100, step: 1, value: Math.round(settings.volume * 100) });
  el.direction = h(document, "select", { id: "st-direction", title: c.ui.directionNote, disabled: true },
    h(document, "option", { value: "both", text: c.ui.both }), h(document, "option", { value: "increase", text: c.ui.onlyIncrease }), h(document, "option", { value: "decrease", text: c.ui.onlyDecrease }));
  el.profileNote = h(document, "p", { id: "st-profile-note", text: c.ui.profileEmpty });
  el.profile = h(document, "canvas", { id: "st-profile", width: 680, height: 64, role: "img", "aria-label": c.ui.profile });
  el.reverse = h(document, "button", { type: "button", id: "st-reverse", text: c.ui.reverse });
  el.repeat = h(document, "input", { type: "checkbox", id: "st-repeat" });
  el.undo = h(document, "button", { type: "button", id: "st-undo", text: c.path.undo });
  el.clearPath = h(document, "button", { type: "button", id: "st-clear-path", text: c.path.clear });
  el.pathTools = h(document, "div", { id: "st-path-tools", class: "st-path-tools", hidden: true }, el.reverse, h(document, "label", {}, el.repeat, h(document, "span", { text: c.ui.repeat })), el.undo, el.clearPath);
  el.dock = h(document, "section", { class: "st-dock", "aria-label": c.scan.playback },
    h(document, "div", { class: "st-primary" }, el.soundButton, el.playVisible, el.areaTool, el.drawTool, el.placesTool, el.datesTool),
    h(document, "div", { class: "st-transport st-run" },
      h(document, "div", { class: "st-transport-buttons" }, el.play, el.pause, el.replay, el.stop),
      h(document, "div", { class: "st-progress" }, el.runState, el.progress),
      h(document, "label", {}, h(document, "span", { text: c.scan.speed }), el.speed),
      h(document, "label", { class: "st-volume" }, h(document, "span", { text: c.sound.volume }), el.volume),
      h(document, "label", {}, h(document, "span", { text: c.ui.direction }), el.direction)),
    h(document, "div", { class: "st-profile-row" },
      h(document, "div", { class: "st-profile-heading" }, h(document, "span", { text: c.ui.profile }), el.profileNote), el.profile, el.pathTools));

  // Title strip: compact title, the "verified numeric data" badge, the source, and the secondary actions.
  el.methodButton = h(document, "button", { type: "button", id: "st-open-method", class: "st-quiet", text: c.ui.method });
  el.helpButton = h(document, "button", { type: "button", id: "st-open-help", class: "st-quiet", text: c.help.title });
  el.shareButton = h(document, "button", { type: "button", id: "st-share", class: "st-quiet", title: c.share.note, text: c.share.copy });
  el.shareStatus = h(document, "span", { id: "st-share-status", class: "st-share-status", role: "status" });
  const bar = h(document, "header", { class: "st-bar" },
    h(document, "h1", { class: "st-title" }, c.titleLead + " ", h(document, "em", { text: c.titleAccent })),
    h(document, "div", { class: "st-bar-meta" }, h(document, "span", { class: "badge badge-data", text: c.workspace.badge }), h(document, "span", { class: "st-source", text: c.workspace.source })),
    h(document, "div", { class: "st-bar-actions" }, el.shareStatus, h(document, "a", { class: "st-quiet st-switch", href: "../studio.html" + (language === "ar" ? "?lang=ar" : ""), text: c.workspace.experiment }), el.methodButton, el.helpButton, el.shareButton));

  el.methodDialog = h(document, "dialog", { id: "st-method-dialog", class: "st-dialog", "aria-labelledby": "st-method-title" });
  el.helpDialog = h(document, "dialog", { id: "st-help-dialog", class: "st-dialog", "aria-labelledby": "st-help-title" });
  el.live = h(document, "p", { id: "st-live", class: "visually-hidden", "aria-live": "polite" });
  el.stage = h(document, "section", { class: "st-stage", "aria-label": c.eyebrow },
    h(document, "div", { class: "st-mapwrap" }, el.map, el.topbar, el.status, el.keys), el.inspector, el.dock);
  root.replaceChildren(h(document, "div", { class: "st-shell" }, bar, el.stage, h(document, "p", { class: "st-credit", text: c.credit })), el.methodDialog, el.helpDialog, el.live);

  const nav = document.getElementById("site-nav");
  const measure = () => {
    if (nav) document.body.style.setProperty("--st-nav-h", `${nav.offsetHeight}px`);
    el.stage.style.setProperty("--st-dock-h", `${el.dock.offsetHeight}px`);
  };
  measure();
  new win.ResizeObserver(measure).observe(el.dock);
  if (nav) new win.ResizeObserver(measure).observe(nav);

  const announce = (message) => { el.live.textContent = ""; el.live.textContent = message; };

  // ---- Map: shared engine + dust layer
  let map;
  const layer = createDustLayer({
    grid,
    earthUrl: win.matchMedia?.("(max-width: 700px)").matches ? EARTH_URL_SMALL() : EARTH_URL(),
    formatValue: (value, mode) => (mode === "diff" ? fmtChange(value) : fmt(value)),
    formatLatitude: formatLat,
    formatLongitude: formatLon,
    labels: { region: T(c.ui.regionFrame, { area: areaText(bounds) }).replace(/[⁦⁩]/g, "") },
    onChange: () => map?.invalidate(),
  });
  layer.setField({ mode: "value", values: state.snapshot.values });

  /** Pixels of the map hidden behind floating UI, per edge (only elements that really overlap the map count). */
  function insets() {
    const box = el.map.getBoundingClientRect();
    const out = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const node of [el.topbar, el.status, el.keys, el.inspector, el.dock]) {
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const overlapX = Math.min(r.right, box.right) - Math.max(r.left, box.left);
      const overlapY = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
      if (overlapX <= 0 || overlapY <= 0) continue;
      const side = r.height > box.height * 0.45 && r.width < box.width * 0.6;
      if (side) {
        if ((r.left + r.right) / 2 > (box.left + box.right) / 2) out.right = Math.max(out.right, box.right - r.left + 12);
        else out.left = Math.max(out.left, r.right - box.left + 12);
      } else if ((r.top + r.bottom) / 2 < (box.top + box.bottom) / 2) out.top = Math.max(out.top, r.bottom - box.top + 10);
      else out.bottom = Math.max(out.bottom, box.bottom - r.top + 10);
    }
    return out;
  }

  map = createMapCore(el.map, {
    layer,
    sampleAt: layer.sampleAt,
    initialView: { longitude: (bounds.west + bounds.east) / 2, latitude: (bounds.south + bounds.north) / 2, zoom: 4 },
    minZoom: 1,
    maxZoom: 40,
    wheel: "smooth",
    inertia: true,
    animate: 260,
    deferred: true,
    insets,
    routeHalo: true,
    drawClickSelects: true,
    canvasClass: "st-map-canvas",
    resampleRoute: (points) => points,
    onHover: hover,
    onSelect: choose,
    onDraw: routeDrawn,
    onRect: rectDrawn,
    onView: viewChanged,
  });
  const safeCentre = () => { const s = map.getSafeRect(); return map.geographicAt(s.x + s.width / 2, s.y + s.height / 2); };
  const centreSample = () => { const g = safeCentre(); return layer.sampleAt(g.longitude, g.latitude); };
  const resample = (sample) => (sample ? layer.sampleAt(sample.longitude, sample.latitude) : null);

  // ---- Legend (fixed scales; the marker shows where the inspected value sits)
  function renderLegend() {
    const change = layerKind() === "change";
    el.marker = h(document, "i", { class: "st-marker", hidden: true, title: c.ui.scaleMarker });
    let barNode;
    let ticks;
    let swatches;
    let note;
    if (!change) {
      const stops = Array.from({ length: 14 }, (_, i) => { const [r, g, b] = valueColor(VALUE_MIN * (VALUE_MAX / VALUE_MIN) ** (i / 13)); return `rgb(${r},${g},${b}) ${((i / 13) * 100).toFixed(1)}%`; }).join(",");
      barNode = h(document, "div", { class: "st-scale", style: `background:linear-gradient(90deg,${stops})` }, el.marker);
      ticks = [VALUE_MIN, 0.01, 0.1, 1, VALUE_MAX].map((v) => h(document, "span", { style: `left:${valueT(v) * 100}%`, text: String(v) }));
      swatches = [h(document, "span", {}, h(document, "i", { class: "st-hatch" }), c.legend.missing), h(document, "span", {}, h(document, "i", { class: "st-hatch st-hatch-out" }), c.ui.outsideLegend)];
      note = c.legend.note;
    } else {
      const stops = Array.from({ length: 21 }, (_, i) => { const s = (i / 20) * 2 - 1; const [r, g, b] = diffColor(Math.sign(s) * diffInverse(Math.abs(s))); return `rgb(${r},${g},${b}) ${(i / 20) * 100}%`; }).join(",");
      barNode = h(document, "div", { class: "st-scale", style: `background:linear-gradient(90deg,${stops})` }, el.marker);
      ticks = [[0, "−" + DIFF_MAX], [50, "0"], [100, "+" + DIFF_MAX]].map(([left, text]) => h(document, "span", { style: `left:${left}%`, text }));
      swatches = [h(document, "span", {}, h(document, "i", { class: "st-sw st-sw-up" }), c.legend.increase), h(document, "span", {}, h(document, "i", { class: "st-sw st-sw-down" }), c.legend.decrease),
        h(document, "span", {}, h(document, "i", { class: "st-sw st-sw-flat" }), T(c.legend.near, { band: NEAR_ZERO })), h(document, "span", {}, h(document, "i", { class: "st-hatch" }), c.legend.missing)];
      note = c.legend.changeNote;
    }
    el.legend.replaceChildren(
      h(document, "h3", { text: change ? c.legend.changeTitle : c.legend.title + " · 550 nm" }),
      h(document, "div", { class: "st-scale-wrap", dir: "ltr", "aria-hidden": "true" }, barNode, h(document, "div", { class: "st-ticks" }, ...ticks)),
      h(document, "p", { class: "st-swatches" }, ...swatches),
      h(document, "p", { class: "st-note", text: note + " " + T(c.map.smoothing, { cellLat: trimNumber(size.lat), cellLon: trimNumber(size.lon) }) }));
  }

  // ---- Inspector
  const cellOf = (sample) => (sample?.inside ? sample.cell : null);
  function soundText(sample) {
    if (!sample.inside) return c.understand.outside;
    if (sample.value === null) return c.understand.missingSound;
    const pan = lonPan(grid, cellCenter(grid, sample.cell.row, sample.cell.col).lon);
    const side = pan < -0.2 ? c.understand.left : pan > 0.2 ? c.understand.right : c.understand.centre;
    let text;
    if (sample.kind === "dust") text = T(c.understand.soundText, { hz: trimNumber(valueHz(sample.value), 0), pan: side });
    else if (Math.abs(sample.value) < NEAR_ZERO) text = c.understand.soundFlat;
    else text = T(sample.value > 0 ? c.understand.soundUp : c.understand.soundDown, { semi: changeSemitones(sample.value) }) + " " + side + ".";
    return audio.enabled ? text : text + " " + c.understand.soundOff;
  }
  function renderInspector(sample) {
    el.empty.hidden = Boolean(sample);
    el.reading.hidden = !sample;
    if (!sample) { if (el.marker) el.marker.hidden = true; return; }
    state.active = sample;
    const change = sample.kind === "change";
    el.lon.textContent = formatLon(Number(sample.longitude.toFixed(2)));
    el.lat.textContent = formatLat(Number(sample.latitude.toFixed(2)));
    el.valueLabel.textContent = change ? c.understand.changeRow + " · " + c.legend.changeTitle : c.understand.value;
    el.valueUnit.textContent = change ? "" : c.layer.dustHelp;
    for (const node of [el.firstRow, el.secondRow]) node.hidden = !(change && sample.inside && state.cmpSources);
    if (!sample.inside) {
      el.value.textContent = "—";
      el.swatch.style.background = "transparent";
      el.swatch.dataset.state = "outside";
      el.callout.textContent = c.ui.noValueOutside;
      el.callout.hidden = false;
      el.cell.textContent = "—";
      el.cellBounds.textContent = "—";
      el.marker.hidden = true;
    } else {
      const { row: r, col } = sample.cell;
      const rect = cellRect(grid, r, col);
      el.cell.textContent = cellId(r, col);
      el.cellBounds.textContent = areaText(rect);
      if (sample.value === null) {
        el.value.textContent = "—";
        el.swatch.style.background = "";
        el.swatch.dataset.state = "missing";
        el.callout.textContent = c.understand.missing;
        el.callout.hidden = false;
        el.marker.hidden = true;
      } else {
        const [red, green, blue] = change ? diffColor(sample.value) : valueColor(sample.value);
        el.value.textContent = change ? fmtChange(sample.value) : fmt(sample.value);
        el.swatch.style.background = `rgb(${red}, ${green}, ${blue})`;
        el.swatch.dataset.state = "value";
        el.callout.textContent = change ? directionOf(sample.value) : T(c.understand.scaleText, { t: Math.round(valueT(sample.value) * 100) });
        el.callout.hidden = false;
        el.marker.hidden = false;
        el.marker.style.left = `${(change ? 0.5 + 0.5 * diffS(sample.value) : valueT(sample.value)) * 100}%`;
      }
      if (change && state.cmpSources) {
        el.firstRow.lastChild.textContent = `${dates[state.cmpSources.a.id]}: ${fmt(state.cmpSources.a.values[sample.cell.index])}`;
        el.secondRow.lastChild.textContent = `${dates[state.cmpSources.b.id]}: ${fmt(state.cmpSources.b.values[sample.cell.index])}`;
      }
    }
    el.sound.textContent = soundText(sample);
    el.map.dataset.cell = sample.inside ? cellId(sample.cell.row, sample.cell.col) : "";
  }
  function readText(sample) {
    if (!sample) return c.understand.none;
    if (!sample.inside) return `${pointText(sample.longitude, sample.latitude)}. ${c.understand.outside}`;
    const centre = cellCenter(grid, sample.cell.row, sample.cell.col);
    const base = { id: cellId(sample.cell.row, sample.cell.col), lat: formatLat(centre.lat), lon: formatLon(centre.lon) };
    if (sample.kind === "dust") return T(sample.value === null ? c.read.missing : c.read.dust, { ...base, value: fmt(sample.value) });
    return T(sample.value === null ? c.read.changeMissing : c.read.change, { ...base, value: fmtChange(sample.value), direction: sample.value === null ? "" : directionOf(sample.value) });
  }
  const playing = () => state.run?.status === "playing" || state.run?.status === "starting";
  function show(sample, { hover: hovering = false } = {}) {
    if (!sample) return;
    if (!hovering) state.selected = sample;
    renderInspector(sample);
    map.setCursor(sample, playing());
  }

  // ---- Sound: explicit enable, deterministic studio-v1 tones for hover / click / keyboard
  const audio = createStudioAudio({ volume: settings.volume });
  const transport = audio.transport;
  async function setSound(on) {
    el.soundButton.setAttribute("aria-pressed", String(on));
    el.soundButton.dataset.enabled = String(on);
    el.soundButton.querySelector(".st-label").textContent = on ? c.sound.disable : c.sound.enable;
    if (on) {
      await audio.enable();
      announce(audio.unavailable ? c.sound.unavailable : c.sound.enabled);
    } else {
      audio.disable();
      announce(c.sound.disabled);
    }
    if (state.active) el.sound.textContent = soundText(state.active);
  }
  const toneKey = (sample) => [state.snapshot.id, state.comparison?.id ?? "dust", state.direction, sample.cell.index].join("|");
  function soundFor(sample, force = false) {
    if (!audio.enabled || playing() || !sample?.inside) return;
    const make = () => filterDirection(hoverPlan(sample.kind, sample.cell, sample.value, grid), sample.kind, state.direction);
    if (force) audio.play(make()); else audio.hover(toneKey(sample), make);
    state.lastTone = toneKey(sample);
  }

  // ---- Pointer probe (same rhythm as the night-lights studio: one inspector update per animation frame)
  let hoverFrame;
  let pendingHover;
  function hover(sample) {
    pendingHover = { sample };
    if (hoverFrame !== undefined) return;
    hoverFrame = win.requestAnimationFrame(() => {
      hoverFrame = undefined;
      const next = pendingHover;
      pendingHover = undefined;
      if (!next?.sample || playing()) return;
      state.keyboardProbe = false;
      show(next.sample, { hover: true });
      if (map.mode === "navigate") soundFor(next.sample);
    });
  }

  function choose(sample, info = {}) {
    if (!sample) return;
    if (info.mode === "draw") { addPoint(sample); return; }
    if (info.mode === "rect") { setRect(null); return; }
    if (state.tool === "places") {
      if (!sample.inside) { announce(c.understand.outside); return; }
      if (state.places.length >= 2) state.places = [];
      state.places.push({ type: "cell", cell: { ...sample.cell }, longitude: sample.longitude, latitude: sample.latitude });
      refreshPlaces();
      show(sample);
      soundFor(sample, true);
      announce(readText(sample) + " " + (state.places.length === 1 ? c.ui.chooseB : c.ui.placesReady));
      return;
    }
    show(sample);
    soundFor(sample, true);
    announce(readText(sample));
  }

  // ---- "Play visible area": only what is in view (and not behind a panel) is ever read
  const visibleScan = () => areaScan(grid, map.getVisibleBounds({ safe: true }), layerValues());
  function viewChanged() {
    if (!map) return;
    const scan = visibleScan();
    layer.setFinder(scan?.rect ?? null);
    el.visibleInfo.textContent = !scan ? c.ui.visibleNone
      : T(scan.stride > 1 ? c.ui.visibleStride : c.ui.visibleNow, { n: scan.cells.length, read: scan.steps.length, area: areaText(scan.rect) }).replace(/[⁦⁩]/g, "");
    el.playVisible.disabled = !scan;
    el.map.dataset.visible = scan ? [scan.rect.west, scan.rect.south, scan.rect.east, scan.rect.north].map((v) => v.toFixed(3)).join(",") : "";
    el.map.dataset.visibleCells = String(scan?.cells.length ?? 0);
    if (state.keyboardProbe && !playing()) show(centreSample(), { hover: true });
  }

  // ---- Run controller: area scans, routes and place fingerprints share the transport clock and the transport row
  const kindLabel = (run) => ({ area: c.ui.kindArea, path: c.ui.kindPath, places: c.ui.kindPlaces, cell: c.ui.kindCell })[run.kind];
  function renderTransport() {
    const run = state.run;
    const status = run?.status ?? "idle";
    const active = status === "playing" || status === "starting";
    el.play.disabled = !run || active;
    el.pause.disabled = !active;
    el.replay.disabled = !run;
    el.progress.disabled = !run;
    if (run && !el.progress.matches(":active")) el.progress.value = String(Math.round((run.positionS / run.plan.durationS) * 1000));
    if (!run) el.progress.value = "0";
    const label = active ? c.scan.state.playing : status === "paused" && run.positionS > 0 ? c.scan.state.paused : status === "ended" ? c.scan.state.ended : c.scan.state.idle;
    el.runState.textContent = run ? `${kindLabel(run)} · ${label} · ${Math.max(0, run.stepIndex + 1)}/${run.steps.length}` : `${c.scan.state.idle} · ${state.visibleText ?? ""}`;
    el.map.dataset.run = run ? status : "";
  }
  function showStep(run, index) {
    const step = run.steps[index];
    if (!step) return;
    run.stepIndex = index;
    const point = run.kind === "path" ? { lon: step.lon, lat: step.lat } : cellCenter(grid, step.row, step.col);
    const sample = layer.sampleAt(point.lon, point.lat);
    renderInspector(sample);
    map.setCursor(sample, true);
    drawValueProfile(el.profile, run.steps, run.layerKind, index);
  }
  function summaryRows(run) {
    const s = run.stats;
    const rows = [[c.scan.cells, String(s.valid + s.missing)], [c.scan.min, fmtLayer(s.min)], [c.scan.max, fmtLayer(s.max)], [c.scan.mean, fmtLayer(s.mean)], [c.scan.missing, String(s.missing)]];
    if (run.kind === "area") rows.push([c.scan.area, areaText(run.rect)]);
    if (run.kind === "path") rows.push([c.path.samples, T(c.path.points, { n: run.points, km: trimNumber(run.totalKm, 0) })]);
    return rows;
  }
  function renderSummary(run) {
    if (!run || (run.kind !== "area" && run.kind !== "path")) { el.summary.hidden = true; return; }
    const dl = h(document, "dl", {});
    for (const [label, value] of summaryRows(run)) dl.append(h(document, "div", {}, h(document, "dt", { text: label }), h(document, "dd", { dir: "ltr", text: value })));
    const note = run.kind === "area" ? (run.stride > 1 ? T(c.scan.stride, { k: run.stride, max: MAX_SCAN_CELLS }) : c.scan.all) + " " + c.scan.plain : c.path.profileNote.replace("{step}", PATH_STEP_KM);
    el.summary.replaceChildren(h(document, "h3", { id: "st-summary-title", text: run.kind === "area" ? c.scan.summary : c.path.summary }), dl, h(document, "p", { class: "st-note", text: note }));
    el.summary.hidden = false;
  }
  async function loadRun(kind, steps, extra = {}, { play = true } = {}) {
    if (!steps.length) return;
    if (play && !audio.enabled) await setSound(true);
    const kindNow = layerKind();
    const slot = kind === "area" ? (kindNow === "change" ? SLOT.change : SLOT.dust) : SLOT.path;
    const plan = filterDirection(extra.plan ?? sequencePlan(kindNow, steps, grid, { slotS: slot, tag: kind }), kindNow, state.direction);
    const stats = summarize(layerValues(), steps.filter((s) => s.index >= 0));
    const outside = steps.filter((s) => s.index < 0).length;
    state.run = { kind, steps, layerKind: kindNow, stats: { ...stats, missing: stats.missing + outside, count: stats.count + outside }, stepIndex: -1, positionS: 0, status: "paused", ...extra, plan };
    transport.pause();
    transport.load(plan);
    state.run.revision = transport.snapshot().planRevision;
    layer.setScan(extra.rect ? { rect: extra.rect, label: `${kindLabel(state.run)} · ${areaText(extra.rect)}` } : null);
    el.map.dataset.scan = extra.rect ? [extra.rect.west, extra.rect.south, extra.rect.east, extra.rect.north].map((v) => v.toFixed(3)).join(",") : "";
    el.map.dataset.scanCells = String(steps.length);
    el.profileNote.textContent = `${kindLabel(state.run)} · ${c.ui.profileScale}`;
    drawValueProfile(el.profile, steps, kindNow, -1);
    renderSummary(state.run);
    renderTransport();
    if (play) await resumeRun();
  }
  async function resumeRun() {
    const run = state.run;
    if (!run) return;
    if (!audio.enabled) await setSound(true);
    if (transport.snapshot().planRevision !== run.revision) {
      // A hover tone borrowed the transport while the run was paused: put the run back where it was.
      transport.pause();
      transport.load(run.plan, run.status === "ended" ? 0 : run.positionS);
      run.revision = transport.snapshot().planRevision;
    }
    transport.setSpeed(Number(el.speed.value));
    run.status = "starting";
    renderTransport();
    await transport.play();
  }
  function pauseRun() {
    if (!state.run) return;
    if (transport.snapshot().planRevision === state.run.revision) transport.pause();
    state.run.status = "paused";
    map.setCursor(state.active, false);
    renderTransport();
  }
  function stopRun({ clear = false } = {}) {
    const run = state.run;
    if (run && transport.snapshot().planRevision === run.revision) { transport.pause(); transport.seek(0); }
    if (run) { run.status = "paused"; run.positionS = 0; run.stepIndex = -1; drawValueProfile(el.profile, run.steps, run.layerKind, -1); }
    if (clear || run?.kind === "area" || run?.kind === "places" || run?.kind === "cell") {
      state.run = null;
      layer.setScan(null);
      el.map.dataset.scan = "";
      el.map.dataset.scanCells = "0";
      el.summary.hidden = true;
      if (!state.path.length) { drawValueProfile(el.profile, [], "dust", -1); el.profileNote.textContent = c.ui.profileEmpty; }
    }
    map.setCursor(state.selected ?? state.active, false);
    if (state.selected) renderInspector(state.selected);
    renderTransport();
  }
  transport.subscribe((snap) => {
    const run = state.run;
    if (!run || snap.planRevision !== run.revision) return;
    run.positionS = snap.positionS;
    run.status = snap.status;
    if (snap.activeEventId && (snap.status === "playing" || snap.positionS > 0)) {
      const event = run.plan.events.findLast((entry) => entry.id === snap.activeEventId);
      if (event && event.step !== run.stepIndex) {
        showStep(run, event.step);
        if (run.kind === "places" && event.place && event.place !== run.place) { run.place = event.place; refreshPlaces(); }
      }
    }
    if (snap.status === "ended") {
      if (state.repeat && run.kind === "path") { transport.replay(); return; }
      run.finished = true;
      run.place = null;
      map.setCursor(state.active, false);
      if (run.kind === "places") refreshPlaces();
      renderSummary(run);
      if (run.kind === "area" || run.kind === "path") {
        const s = run.stats;
        announce(`${c.scan.state.ended}. ${c.scan.cells}: ${s.valid + s.missing}. ${c.scan.min}: ${fmtLayer(s.min)}. ${c.scan.max}: ${fmtLayer(s.max)}. ${c.scan.mean}: ${fmtLayer(s.mean)}. ${c.scan.missing}: ${s.missing}.`);
      }
    }
    renderTransport();
  });

  function playArea(scan, announceVisible = false) {
    if (!scan) { announce(announceVisible ? c.ui.visibleNone : c.scan.none); return Promise.resolve(); }
    if (announceVisible) announce(T(c.ui.scanAnnounce, { area: areaText(scan.rect) }));
    return loadRun("area", scan.steps, { rect: scan.rect, frame: scan.frame, stride: scan.stride, cellsInView: scan.cells.length });
  }
  const playVisible = () => playArea(visibleScan(), true);

  // ---- Tools
  function setTool(name) {
    state.tool = state.tool === name ? "explore" : name;
    state.cornerA = null;
    map.setMode(state.tool === "path" ? "draw" : state.tool === "area" ? "rect" : "navigate");
    el.map.dataset.tool = state.tool;
    el.areaTool.setAttribute("aria-pressed", String(state.tool === "area"));
    el.drawTool.setAttribute("aria-pressed", String(state.tool === "path"));
    el.placesTool.setAttribute("aria-pressed", String(state.tool === "places"));
    refreshSections();
    announce(state.tool === "path" ? c.ui.drawHelp : state.tool === "area" ? c.tools.help.area : state.tool === "places" ? (state.places.length === 1 ? c.ui.chooseB : c.ui.chooseA) : c.ui.probeMode);
  }
  function refreshSections() {
    el.placesSection.hidden = !(state.tool === "places" || state.places.length);
    el.areaSection.hidden = !(state.tool === "area" || state.rect);
    el.datesSection.hidden = !(state.datesOpen || state.comparison);
    el.datesTool.setAttribute("aria-expanded", String(!el.datesSection.hidden));
    win.requestAnimationFrame(viewChanged);
  }

  // Selected area
  function setRect(rect) {
    state.rect = rect ? clipToRegion(rect, bounds) : null;
    map.setRect(state.rect);
    if (rect && !state.rect) announce(c.ui.pathOutside);
    refreshArea();
    refreshSections();
  }
  function rectDrawn(rect) {
    setRect(rect);
    if (state.rect) announce(`${c.ui.areaTitle}: ${T(c.ui.cellsInArea, { n: rectCells(grid, state.rect).length })}, ${areaText(state.rect)}`);
  }
  function refreshArea() {
    const rect = state.rect;
    for (const node of [el.playSelected, el.areaAsA, el.areaAsB, el.clearArea]) node.disabled = !rect;
    if (!rect) { el.areaInfo.replaceChildren(h(document, "p", { class: "st-hint", text: c.ui.areaNone })); return; }
    const cells = rectCells(grid, rect);
    const s = summarize(layerValues(), cells);
    const dl = h(document, "dl", {});
    for (const [label, value] of [[c.scan.area, areaText(rect)], [c.scan.cells, T(c.ui.cellsInArea, { n: cells.length })], [c.scan.min, fmtLayer(s.min)], [c.scan.max, fmtLayer(s.max)], [c.scan.mean, fmtLayer(s.mean)], [c.scan.missing, String(s.missing)]]) {
      dl.append(h(document, "div", {}, h(document, "dt", { text: label }), h(document, "dd", { dir: "ltr", text: value })));
    }
    el.areaInfo.replaceChildren(dl);
    el.playSelected.disabled = cells.length === 0;
  }

  // Route
  const pathLength = () => state.path.slice(1).reduce((km, point, i) => km + distanceKm(state.path[i], point), 0);
  const insideRegion = (p) => p.lon >= bounds.west && p.lon <= bounds.east && p.lat >= bounds.south && p.lat <= bounds.north;
  function refreshPath({ play = false } = {}) {
    map.setRoute(state.path.map((p) => ({ longitude: p.lon, latitude: p.lat })));
    el.pathTools.hidden = state.path.length === 0;
    if (state.path.length < 2) {
      if (state.run?.kind === "path") stopRun({ clear: true });
      if (!state.run) { drawValueProfile(el.profile, [], "dust", -1); el.profileNote.textContent = state.path.length ? c.path.none : c.ui.profileEmpty; }
      return Promise.resolve();
    }
    const steps = pathSteps(state.path, layerValues(), grid);
    return loadRun("path", steps, { points: state.path.length, totalKm: pathLength() }, { play });
  }
  function routeDrawn(points) {
    const inside = points.map((p) => ({ lon: p.longitude, lat: p.latitude })).filter(insideRegion);
    if (inside.length < 2) { map.setRoute(state.path.map((p) => ({ longitude: p.lon, latitude: p.lat }))); announce(c.ui.pathOutside); return; }
    state.path = thinPath(inside, MAX_PATH_POINTS);
    if (state.tool === "path") setTool("path");
    announce(T(c.path.points, { n: state.path.length, km: trimNumber(pathLength(), 0) }));
    refreshPath({ play: true });
  }
  function addPoint(sample) {
    if (!sample?.inside) { announce(c.ui.pathOutside); return; }
    if (state.path.length >= MAX_PATH_POINTS) return;
    state.path.push({ lon: sample.longitude, lat: sample.latitude });
    announce(state.path.length < 2 ? c.path.none : T(c.path.points, { n: state.path.length, km: trimNumber(pathLength(), 0) }));
    refreshPath();
  }

  // Places A / B
  const placeLabel = (place) => (place.type === "cell" ? cellId(place.cell.row, place.cell.col) : areaText(place.rect));
  const placePoint = (place) => (place.type === "cell" ? { longitude: place.longitude, latitude: place.latitude } : { longitude: (place.rect.west + place.rect.east) / 2, latitude: (place.rect.south + place.rect.north) / 2 });
  function refreshPlaces() {
    const values = layerValues();
    const [a, b] = state.places;
    el.placesStatus.textContent = !a ? c.ui.chooseA : !b ? c.ui.chooseB : c.ui.placesReady;
    map.setMarkers(state.places.map((place, i) => ({ ...placePoint(place), label: i === 0 ? "A" : "B", color: i === 0 ? "#b79bff" : "#ffb469", radius: 12, active: state.run?.place === (i === 0 ? "a" : "b") })));
    layer.setOutlines(state.places.filter((p) => p.type === "area").map((p) => p.rect));
    el.hearA.disabled = !a;
    el.hearB.disabled = !b;
    el.hearBoth.disabled = !(a && b);
    el.clearPlaces.disabled = !a;
    const cards = [];
    const means = [];
    state.places.forEach((place, i) => {
      const s = placeSummary(place, values, grid);
      means.push(s.mean);
      const card = h(document, "div", { class: "st-place", "data-place": i === 0 ? "a" : "b", "data-active": String(state.run?.place === (i === 0 ? "a" : "b")) },
        h(document, "strong", { text: i === 0 ? c.compare.a : c.compare.b }), h(document, "b", { dir: "ltr", text: placeLabel(place) }));
      if (place.type === "cell") {
        card.append(h(document, "span", { dir: "ltr", text: pointText(place.longitude, place.latitude) }), h(document, "em", { dir: "ltr", text: s.valid ? fmtLayer(values[place.cell.index]) : c.legend.missing }));
      } else {
        card.append(h(document, "span", { dir: "ltr", text: T(c.ui.cellsInArea, { n: s.count }).replace(/[⁦⁩]/g, "") + (s.missing ? ` · ${c.scan.missing} ${s.missing}` : "") }),
          h(document, "em", { dir: "ltr", text: `${fmtLayer(s.mean)} (${fmtLayer(s.min)} – ${fmtLayer(s.max)})` }));
      }
      cards.push(card);
    });
    if (means.length === 2 && means[0] !== null && means[1] !== null) cards.push(h(document, "p", { class: "st-diff" }, c.compare.diff + ": ", h(document, "strong", { dir: "ltr", text: fmtChange(means[1] - means[0]) })));
    el.placesTable.replaceChildren(...cards);
    el.placesTable.hidden = !cards.length;
    refreshSections();
  }
  function hearPlaces(which) {
    const values = layerValues();
    const kind = layerKind();
    const [a, b] = state.places;
    if (which === "both") {
      if (!a || !b) { announce(c.compare.needBoth); return Promise.resolve(); }
      const stepsA = fingerprintSteps(a, values, grid);
      const plan = joinPlans(fingerprintPlan(a, values, kind, grid), fingerprintPlan(b, values, kind, grid));
      return loadRun("places", [...stepsA, ...fingerprintSteps(b, values, grid)], { plan });
    }
    const place = which === "a" ? a : b;
    if (!place) return Promise.resolve();
    const plan = fingerprintPlan(place, values, kind, grid);
    plan.events = plan.events.map((event) => ({ ...event, place: which }));
    return loadRun("places", fingerprintSteps(place, values, grid), { plan });
  }
  function usePlace(index) {
    if (!state.rect) return;
    state.places[index === 1 && !state.places[0] ? 0 : index] = { type: "area", rect: { ...state.rect } };
    refreshPlaces();
  }

  // ---- Dates and layers
  const seasonOf = (id) => catalog.seasons.find((season) => season.snapshotIds.includes(id));
  function renderDate() {
    const snapshot = state.snapshot;
    const time = snapshot.time;
    const windowText = T(c.date.window, { date: formatUtcDate(time.start, language), from: formatUtcTime(time.start).replace(" UTC", ""), to: formatUtcTime(time.end).replace(" UTC", ""), hours: trimNumber((Date.parse(time.end) - Date.parse(time.start)) / 3600000, 2) });
    const index = list.findIndex((entry) => entry.id === snapshot.id);
    const season = seasonOf(snapshot.id);
    if (state.comparison && state.cmpSources) {
      el.dateInfo.textContent = `${c.legend.changeTitle}: ${dates[state.cmpSources.b.id]} − ${dates[state.cmpSources.a.id]}`;
      el.dateSeason.textContent = state.pending?.status === "published" ? c.compare.published : c.compare.computed;
    } else {
      el.dateInfo.textContent = windowText;
      el.dateSeason.textContent = T(c.ui.seasonNote, { season: season ? c.date.seasons[season.name] + " " + season.seasonYear : "" }) + " · " + T(c.ui.snapshotOf, { n: index + 1, total: list.length });
    }
    el.date.value = snapshot.id;
    const locked = Boolean(state.comparison);
    el.date.disabled = locked;
    el.prev.disabled = locked || index <= 0;
    el.next.disabled = locked || index >= list.length - 1;
    el.map.dataset.date = snapshot.id;
    el.map.dataset.layer = layerKind();
    const source = snapshot.source;
    el.provenance.replaceChildren(
      h(document, "p", { dir: "ltr", text: T(c.understand.sourceValue, { short: source.shortName, variable: snapshot.variable }).replace(/[⁦⁩]/g, "") }),
      h(document, "p", { text: windowText }), h(document, "p", { text: c.date.sparse }),
      h(document, "p", { text: T(c.date.group, { build: source.modelSource }) }),
      h(document, "p", { text: T(c.ui.native, { lat: source.nativeResolutionDegrees.lat, lon: source.nativeResolutionDegrees.lon, cellLat: trimNumber(size.lat), cellLon: trimNumber(size.lon) }) }),
      h(document, "p", {}, c.ui.granule + ": ", h(document, "a", { href: source.url, target: "_blank", rel: "noreferrer", dir: "ltr", text: source.granule })));
  }
  /** Everything that depends on the values of the current layer. */
  function dataChanged() {
    layer.setField({ mode: state.comparison ? "diff" : "value", values: layerValues() });
    el.layerDust.setAttribute("aria-pressed", String(!state.comparison));
    el.layerChange.setAttribute("aria-pressed", String(Boolean(state.comparison)));
    el.direction.disabled = !state.comparison;
    audio.resetHover();
    stopRun({ clear: true });
    renderLegend();
    renderDate();
    state.selected = resample(state.selected);
    const active = resample(state.active);
    if (active) { renderInspector(active); map.setCursor(active, false); }
    refreshArea();
    refreshPlaces();
    if (state.path.length >= 2) refreshPath();
    viewChanged();
  }
  async function chooseDate(id) {
    if (state.comparison || id === state.snapshot.id) return;
    el.date.disabled = true;
    try { state.snapshot = await getSnapshot(id); } catch (error) { console.error(error); announce(c.error); }
    dataChanged();
    announce(el.dateInfo.textContent);
  }
  const stepDate = (delta) => { const i = list.findIndex((entry) => entry.id === state.snapshot.id); const next = list[Math.min(list.length - 1, Math.max(0, i + delta))]; if (next) chooseDate(next.id); };

  function describeComparison() {
    const r = resolveComparison(catalog, el.cmpA.value, el.cmpB.value);
    state.pending = r;
    el.cmpButton.disabled = !state.comparison && (r.status === "same" || r.status === "unavailable");
    el.cmpStatus.dataset.warn = String(r.status === "unavailable");
    el.cmpStatus.textContent = r.status === "same" ? c.compare.same : r.status === "published" ? c.compare.published : r.status === "computed" ? c.compare.computed
      : c.compare.unavailable + ". " + T(c.compare.reasonBuild, { reason: r.reason === DEFAULT_REASON ? c.compare.reasonDefault : r.reason });
    el.cmpInfo.textContent = r.status !== "same" && el.cmpA.value !== r.first ? c.compare.chrono : "";
    el.cmpInfo.hidden = !el.cmpInfo.textContent;
    return r;
  }
  async function showChange() {
    const r = state.pending ?? describeComparison();
    if (r.status === "same" || r.status === "unavailable") {
      state.datesOpen = true;
      refreshSections();
      announce(el.cmpStatus.textContent);
      return false;
    }
    el.cmpButton.disabled = true;
    try {
      const [a, b] = await Promise.all([getSnapshot(r.first), getSnapshot(r.second)]);
      state.comparison = r.status === "published" ? await loadDustComparison(r.id) : compareDustSnapshots(a, b);
      state.cmpSources = { a, b };
      el.cmpButton.textContent = c.compare.hide;
      el.cmpA.disabled = el.cmpB.disabled = true;
      dataChanged();
      refreshSections();
      announce(el.dateInfo.textContent);
      return true;
    } catch (error) {
      console.error(error);
      el.cmpStatus.textContent = c.compare.unavailable;
      return false;
    } finally {
      el.cmpButton.disabled = false;
    }
  }
  function hideChange() {
    if (!state.comparison) return;
    state.comparison = null;
    state.cmpSources = null;
    el.cmpButton.textContent = c.compare.show;
    el.cmpA.disabled = el.cmpB.disabled = false;
    el.direction.value = "both";
    state.direction = "both";
    dataChanged();
    describeComparison();
    refreshSections();
    announce(T(c.ui.layerNow, { layer: c.layer.dust }));
  }

  // ---- Share link (date, layer pair, area, path; never audio)
  async function copyShare() {
    const query = encodeShare({ snapshotId: state.snapshot.id, comparison: state.cmpSources ? { a: state.cmpSources.a.id, b: state.cmpSources.b.id } : null, rect: state.rect, path: state.path }, dates);
    const href = shareUrl(document.URL, query);
    el.map.dataset.share = href;
    try { await win.navigator.clipboard.writeText(href); el.shareStatus.textContent = c.share.copied; } catch { el.shareStatus.textContent = c.ui.linkManual + " " + href; }
    win.setTimeout(() => { if (el.shareStatus.textContent === c.share.copied) el.shareStatus.textContent = ""; }, 4000);
  }

  // ---- Dialogs
  const dialogHead = (id, tag, title, dialog) => {
    const close = h(document, "button", { type: "button", class: "st-quiet", text: c.ui.close });
    close.addEventListener("click", () => dialog.close());
    return h(document, "div", { class: "st-dialog-head" }, h(document, "div", {}, h(document, "span", { dir: "ltr", text: tag }), h(document, "h2", { id, text: title })), close);
  };
  el.methodDialog.append(dialogHead("st-method-title", "METHOD / STUDIO-V1", c.ui.method, el.methodDialog),
    h(document, "div", { class: "st-dialog-grid" },
      h(document, "section", {}, h(document, "h3", { text: "01 · " + c.ui.provenance }), h(document, "p", { text: c.workspace.source }), h(document, "p", { text: c.date.sparse }), h(document, "p", { text: T(c.map.smoothing, { cellLat: trimNumber(size.lat), cellLon: trimNumber(size.lon) }) }), h(document, "p", { text: c.legend.note })),
      h(document, "section", {}, h(document, "h3", { text: "02 · " + c.sound.mapping }), mappingList(), h(document, "p", { text: c.sound.note })),
      h(document, "section", {}, h(document, "h3", { text: "03 · " + c.ui.limits }), h(document, "p", { text: c.understand.missing }), h(document, "p", { text: c.ui.outsideLegend + "." }), h(document, "p", { text: c.legend.changeNote }), h(document, "p", { text: c.scan.plain }), h(document, "p", { text: c.credit }))));
  el.helpDialog.append(dialogHead("st-help-title", "KEYS", c.help.title, el.helpDialog), h(document, "ul", { class: "st-help-list" }, c.help.items.map((line) => h(document, "li", { text: line }))),
    h(document, "p", { class: "st-note", text: c.tools.help.explore }));

  // ---- Wiring
  el.date.addEventListener("change", () => chooseDate(el.date.value));
  el.prev.addEventListener("click", () => stepDate(-1));
  el.next.addEventListener("click", () => stepDate(1));
  el.layerDust.addEventListener("click", hideChange);
  el.layerChange.addEventListener("click", () => { if (!state.comparison) showChange(); });
  el.region.addEventListener("click", () => map.fit(bounds));
  el.world.addEventListener("click", () => map.reset());
  el.plus.addEventListener("click", () => map.zoom(1.35));
  el.minus.addEventListener("click", () => map.zoom(1 / 1.35));
  el.soundButton.addEventListener("click", () => setSound(!audio.enabled));
  el.playVisible.addEventListener("click", playVisible);
  el.areaTool.addEventListener("click", () => setTool("area"));
  el.drawTool.addEventListener("click", () => setTool("path"));
  el.placesTool.addEventListener("click", () => setTool("places"));
  el.datesTool.addEventListener("click", () => { state.datesOpen = !state.datesOpen; refreshSections(); if (state.datesOpen) { el.datesSection.scrollIntoView({ block: "nearest" }); announce(el.cmpStatus.textContent); } });
  el.play.addEventListener("click", resumeRun);
  el.pause.addEventListener("click", pauseRun);
  el.replay.addEventListener("click", async () => { const run = state.run; if (!run) return; if (transport.snapshot().planRevision === run.revision) transport.seek(0); run.positionS = 0; run.status = "paused"; await resumeRun(); });
  el.stop.addEventListener("click", () => { stopRun(); audio.stop(); });
  el.progress.addEventListener("input", () => {
    const run = state.run;
    if (!run) return;
    const wasPlaying = playing();
    const target = (Number(el.progress.value) / 1000) * run.plan.durationS;
    if (transport.snapshot().planRevision !== run.revision) { transport.load(run.plan, target); run.revision = transport.snapshot().planRevision; } else transport.seek(target);
    if (wasPlaying) transport.play();
  });
  el.speed.addEventListener("change", () => audio.setSpeed(Number(el.speed.value)));
  el.volume.addEventListener("input", () => { const v = Number(el.volume.value) / 100; audio.setVolume(v); saveSettings({ volume: v }); });
  el.direction.addEventListener("change", () => {
    state.direction = el.direction.value;
    audio.resetHover();
    const run = state.run;
    if (run && run.kind !== "places") { stopRun({ clear: run.kind !== "path" }); if (state.path.length >= 2) refreshPath(); }
  });
  el.reverse.addEventListener("click", () => { state.path.reverse(); refreshPath({ play: false }); });
  el.repeat.addEventListener("change", () => { state.repeat = el.repeat.checked; });
  el.undo.addEventListener("click", () => { state.path.pop(); refreshPath(); });
  el.clearPath.addEventListener("click", () => { state.path = []; refreshPath(); });
  el.hearA.addEventListener("click", () => hearPlaces("a"));
  el.hearB.addEventListener("click", () => hearPlaces("b"));
  el.hearBoth.addEventListener("click", () => hearPlaces("both"));
  el.clearPlaces.addEventListener("click", () => { state.places = []; if (state.run?.kind === "places") stopRun({ clear: true }); refreshPlaces(); });
  el.playSelected.addEventListener("click", () => playArea(areaScan(grid, state.rect, layerValues())));
  el.areaAsA.addEventListener("click", () => usePlace(0));
  el.areaAsB.addEventListener("click", () => usePlace(1));
  el.clearArea.addEventListener("click", () => setRect(null));
  el.cmpA.addEventListener("change", describeComparison);
  el.cmpB.addEventListener("change", describeComparison);
  el.cmpButton.addEventListener("click", () => (state.comparison ? hideChange() : showChange()));
  el.shareButton.addEventListener("click", copyShare);
  el.methodButton.addEventListener("click", () => el.methodDialog.showModal());
  el.helpButton.addEventListener("click", () => el.helpDialog.showModal());

  // Keyboard: same keys as the night-lights studio, plus cell-exact steps and tool keys. Geography never mirrors.
  function centreAction() {
    const sample = centreSample();
    if (state.tool === "path") { addPoint(sample); return; }
    if (state.tool === "area") {
      const here = { lon: sample.longitude, lat: sample.latitude };
      if (!state.cornerA) { state.cornerA = here; setRect(null); announce(pointText(here.lon, here.lat)); } else { rectDrawn(rectBetween(state.cornerA, here)); state.cornerA = null; }
      return;
    }
    choose(sample);
  }
  el.map.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (arrows[key]) {
      event.preventDefault();
      const [dx, dy] = arrows[key];
      state.keyboardProbe = true;
      if (event.shiftKey) map.moveBy(dx * size.lon, dy * size.lat); else map.move(dx * 0.12, -dy * 0.12);
      return;
    }
    const actions = {
      "+": () => map.zoom(1.3), "=": () => map.zoom(1.3), "-": () => map.zoom(1 / 1.3), "_": () => map.zoom(1 / 1.3),
      Home: () => map.fit(bounds), "0": () => map.fit(bounds),
      Enter: centreAction,
      r: () => announce(readText(state.keyboardProbe || !state.active ? centreSample() : state.active)),
      " ": () => { if (state.run) { if (playing()) pauseRun(); else resumeRun(); } else { const sample = centreSample(); show(sample); if (audio.enabled) soundFor(sample, true); else announce(c.sound.disabled + " " + readText(sample)); } },
      s: playVisible,
      d: () => setTool("path"),
      a: () => setTool("area"),
      c: () => setTool("places"),
      "[": () => stepDate(-1), "]": () => stepDate(1),
      Backspace: () => { if (state.tool === "path" && state.path.length) { state.path.pop(); refreshPath(); } },
      Escape: () => { if (playing()) { stopRun(); audio.stop(); } else if (state.tool !== "explore") setTool(state.tool); else if (state.run) stopRun({ clear: true }); },
    };
    if (!actions[key]) return;
    event.preventDefault();
    if (key === "+" || key === "=" || key === "-" || key === "_" || key === "Home" || key === "0") state.keyboardProbe = true;
    actions[key]();
  });
  win.addEventListener("resize", () => { if (state.run) drawValueProfile(el.profile, state.run.steps, state.run.layerKind, state.run.stepIndex); });
  win.addEventListener("pagehide", () => { audio.stop(); });

  // ---- Start: frame the dust region in the free part of the map, then apply a shared link or the guided start
  renderLegend();
  renderDate();
  describeComparison();
  refreshArea();
  refreshPlaces();
  renderTransport();
  drawValueProfile(el.profile, [], "dust", -1);
  map.fit(bounds, 0.05, { instant: true });
  // Layout (fonts, panels) can still settle after the first frame; re-frame once unless the user already moved.
  let framed = map.zoomLevel;
  win.requestAnimationFrame(() => win.requestAnimationFrame(() => { if (map.zoomLevel === framed) { map.fit(bounds, 0.05, { instant: true }); framed = map.zoomLevel; } }));
  new win.ResizeObserver(() => { if (map.zoomLevel === framed) { map.fit(bounds, 0.05, { instant: true }); framed = map.zoomLevel; } viewChanged(); }).observe(el.stage);

  if (wanted.rect) setRect(wanted.rect);
  if (wanted.path?.length) { state.path = wanted.path; refreshPath(); }
  if (wanted.cmp) await showChange();
  // Guided start: the strongest sampled cell of this snapshot is selected, so the inspector opens on a real value.
  const values = state.snapshot.values;
  const strongest = values.reduce((best, value, index) => (value !== null && (best < 0 || value > values[best]) ? index : best), -1);
  if (strongest >= 0) {
    const centre = cellCenter(grid, Math.floor(strongest / grid.cols), strongest % grid.cols);
    show(layer.sampleAt(centre.lon, centre.lat));
  }
  viewChanged();

  const api = { state, el, grid, catalog, list, map, layer, audio, transport, bounds, c, language, layerValues, layerKind, visibleScan, playVisible, playArea, setTool, setRect, chooseDate, showChange, hideChange, setSound, readText, total };
  if (params.has("debug")) win.__studio = api;
  return api;
}
