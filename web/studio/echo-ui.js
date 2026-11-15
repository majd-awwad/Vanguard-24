import { cellId, fillIso, formatLat, formatLon, trimNumber } from "../cinematic/site/cells.js";
import { signalsCopy } from "./signals-copy.js";
import { infoIcon, stateBox } from "./studio-ui-kit.js";
import { h } from "../cinematic/site/dom.js";
import { DECODE_LOCKED_DATES, formatValue } from "./datasets.js";
import { DEFAULT_SEPARATION, SIMILARITY_NOTE, monthlyGroup, toEchoData } from "./echo-core.js";
import { cellCenter } from "./field.js";
import { joinPlans, lonPan } from "./mapping.js";
import { allowSpoilersThisVisit } from "../cinematic/site/progress.js";
import { analysisCopy } from "./analysis-copy.js";
import { mapCopy } from "./earthmap-copy.js";

// Find similar (Feature 03): pattern matching on the monthly DATA series of one cell (never on audio). The source chart,
// the mode, the ranked matches pinned on the same map, the two curves, and listening to source then match.

const SVGNS = "http://www.w3.org/2000/svg";

/** A small line chart of one or two monthly series with dates and the unit. Returns an <svg>. */
export function lineChart(document, { series, dates, unit, label, height = 110 }) {
  const W = 300;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${height}`);
  svg.setAttribute("class", "em-chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const x = (i) => 8 + (i / Math.max(1, dates.length - 1)) * (W - 16);
  const y = (v) => height - 22 - ((v - lo) / span) * (height - 40);
  const make = (name, attrs, text) => { const n = document.createElementNS(SVGNS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text !== undefined) n.textContent = text; return n; };
  for (const s of series) {
    svg.append(make("path", { d: s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(""), class: "line " + (s.cls ?? "") }));
    s.values.forEach((v, i) => svg.append(make("circle", { cx: x(i), cy: y(v), r: 2.4, class: "dot " + (s.cls ?? "") })));
  }
  svg.append(make("text", { x: 8, y: height - 6, class: "axis" }, dates[0].slice(2)), make("text", { x: W - 8, y: height - 6, class: "axis", "text-anchor": "end" }, dates.at(-1).slice(2)));
  svg.append(make("text", { x: 8, y: 10, class: "axis" }, `${trimNumber(hi, 3)} ${unit}`), make("text", { x: 8, y: height - 26, class: "axis" }, `${trimNumber(lo, 3)}`));
  return svg;
}

export function mountEcho(api, container) {
  const { document, store, language, state } = api;
  const a = analysisCopy[language].echo;
  const sc = signalsCopy[language].echo;
  const m = mapCopy[language];
  const T = (template, values) => fillIso(template, values, language);
  const el = {};
  let controller = null;
  let lastResult = null;
  let group = null;
  let playing = null;
  let playStatus = null;
  // One subscription for the whole page life (no listener per opened match).
  api.audio.transport.subscribe((snap) => {
    if (!playing || snap.planRevision !== playing.revision) return;
    if (snap.status === "playing" && snap.activeEventId) {
      const event = playing.plan.events.findLast((e) => e.id === snap.activeEventId);
      if (event && event.place !== playing.place) { playing.place = event.place; if (playStatus) playStatus.textContent = T(a.playing, { which: event.place === "a" ? a.sourceLabel : a.matchLabel }); }
    }
    if (snap.status === "ended") { playing = null; api.state.busy = false; if (playStatus) playStatus.textContent = ""; }
  });

  const spec = () => api.phen.spec;
  const unitName = () => m.phen.unitName[api.phen.id];
  const data = () => toEchoData(api.phen, { excludeDates: api.lockedDates() });
  let sourceIndex = state.selected?.index ?? null;
  const sampleOf = () => sourceIndex;

  el.source = h(document, "strong", { class: "st-source-chip", id: "echo-source", role: "status", "aria-live": "polite" });
  el.useSelected = h(document, "button", { type: "button", hidden: true });
  el.chart = h(document, "div", { class: "em-chartbox" });
  el.modeSel = h(document, "select", { id: "echo-mode", "aria-label": sc.compareLabel }, h(document, "option", { value: "shape", text: sc.shape }), h(document, "option", { value: "value", text: sc.level }));
  const modeRadios = { shape: { get checked() { return el.modeSel.value === "shape"; } }, value: { get checked() { return el.modeSel.value === "value"; } } };
  el.modeInfo = h(document, "span", { class: "st-inline-info" });
  el.align = h(document, "select", { id: "echo-align", "aria-label": a.align }, h(document, "option", { value: "dtw", text: a.dtw, selected: true }), h(document, "option", { value: "euclidean", text: a.euclid }));
  el.limit = h(document, "select", { id: "echo-limit", "aria-label": sc.compareLabel + " 5/10/20" }, ...[5, 10, 20].map((n) => h(document, "option", { value: n, text: String(n), selected: n === 10 })));
  el.search = h(document, "button", { type: "button", class: "button", text: a.search });
  el.cancel = h(document, "button", { type: "button", class: "button ghost", text: a.cancel });
  el.state = h(document, "div", { class: "st-state-slot" });
  el.lock = h(document, "div", { class: "st-state-slot", hidden: true });
  el.head = h(document, "div", { class: "st-results-head", hidden: true });
  el.list = h(document, "ol", { class: "em-results st-rows", "aria-label": a.resultsLabel });
  el.detail = h(document, "div", { class: "em-echo-detail", hidden: true });
  container.append(h(document, "section", { class: "panel st-tool", "aria-labelledby": "echo-title" }, h(document, "h2", { id: "echo-title", text: a.title }),
    h(document, "div", { class: "st-question" },
      h(document, "div", { class: "st-sentence", dir: "auto" }, h(document, "span", { text: sc.sentence }), el.source),
      h(document, "div", { class: "st-sentence st-sentence-sub", dir: "auto" }, h(document, "span", { text: sc.match }), el.modeSel, el.modeInfo, h(document, "span", { text: sc.show }), el.limit),
      el.chart,
      h(document, "details", { class: "st-advanced" }, h(document, "summary", { text: sc.advanced }), el.align),
      h(document, "div", { class: "st-question-actions" }, el.search)),
    el.lock, el.state, el.head, el.list, el.detail));

  function syncModeInfo() { el.modeInfo.replaceChildren(infoIcon(document, sc.shapeHelp + " " + T(sc.levelHelp, { unit: unitName() }))); }
  function setState(kind, text, actions = []) { el.state.replaceChildren(...(text ? [stateBox(document, kind, text, actions)] : [])); }

  function monthly() { const d = data(); return { d, g: monthlyGroup(d) }; }
  const phenSnapshot = (date) => api.phen.byDate(date);

  function renderSource() {
    const index = sampleOf();
    const locked = api.phen.id === "dust" && api.lockedDates().length > 0;
    el.lock.hidden = !locked;
    el.state.hidden = locked;
    if (locked) {
      const show = h(document, "button", { type: "button", class: "button ghost small-button", text: a.show });
      show.addEventListener("click", () => { allowSpoilersThisVisit(); api.refreshLocks(); });
      el.lock.replaceChildren(stateBox(document, "unavailable", sc.locked, [show]));
    }
    el.search.disabled = locked || index === null;
    if (index === null) { el.source.textContent = sc.noSource; el.chart.replaceChildren(); syncModeInfo(); return; }
    const id = cellId(Math.floor(index / api.grid.cols), index % api.grid.cols);
    const centreCell = cellCenter(api.grid, Math.floor(index / api.grid.cols), index % api.grid.cols);
    el.source.textContent = T(sc.source, { id }) + " · " + formatLat(centreCell.lat) + ", " + formatLon(centreCell.lon);
    const { g } = monthly();
    group = g;
    if (!g.snapshots.length) { el.chart.replaceChildren(); return; }
    const values = g.snapshots.map((s) => s.values[index]);
    el.chart.replaceChildren(h(document, "h3", { text: T(a.chart, { id }) }), lineChart(document, { series: [{ values, cls: "src" }], dates: g.snapshots.map((s) => s.date), unit: unitName(), label: T(a.chartLabel, { id, unit: unitName(), range: `${formatValue(spec(), Math.min(...values))} – ${formatValue(spec(), Math.max(...values))}` }) }),
      h(document, "p", { class: "small ltr", text: T(a.build, { build: g.build, n: g.snapshots.length }) }));
    syncModeInfo();
  }
  el.useSelected.addEventListener("click", renderSource);
  api.state.selectHooks = [...(api.state.selectHooks ?? []), (cell, opts) => { if (opts?.user !== false) { sourceIndex = cell.index; renderSource(); } }];
  api.state.tabHooks = { ...(api.state.tabHooks ?? {}), ECHO: () => { sourceIndex = sourceIndex ?? state.selected?.index ?? null; renderSource(); if (lastResult && store.state.echoMatches.length) renderPins(); } };

  function setStatus(text, warn) { setState(warn ? "unavailable" : "idle", text); }
  function renderPins() {
    api.setPins(store.state.echoMatches.map((mt) => ({ index: mt.sampleId, label: mt.rank, kind: "echo", selected: mt.sampleId === store.state.selectedSampleId })));
  }
  const whereOf = (mt) => { const c = cellCenter(api.grid, mt.row, mt.col); return formatLat(c.lat) + ", " + formatLon(c.lon); };
  function renderResults() {
    const matches = store.state.echoMatches;
    el.list.replaceChildren(...matches.map((mt) => {
      const b = h(document, "button", { type: "button", class: "em-result st-row st-row-echo", "aria-pressed": String(mt.sampleId === store.state.selectedSampleId), "data-index": mt.sampleId, "aria-label": cellId(mt.row, mt.col) + " · " + T(sc.distance, { d: trimNumber(mt.distance, 3) }) },
        h(document, "span", { class: "em-rank", text: String(mt.rank) }),
        h(document, "span", { class: "st-row-main" }, h(document, "strong", { class: "st-row-value ltr", text: whereOf(mt) })),
        h(document, "span", { class: "st-row-where ltr" }, T(sc.distance, { d: trimNumber(mt.distance, 3) }), h(document, "small", { text: cellId(mt.row, mt.col) })));
      b.addEventListener("click", () => openMatch(mt.sampleId));
      for (const type of ["mouseenter", "focus"]) b.addEventListener(type, () => api.hoverPin?.(mt.sampleId));
      for (const type of ["mouseleave", "blur"]) b.addEventListener(type, () => api.hoverPin?.(null));
      return h(document, "li", {}, b);
    }));
    renderPins();
  }
  el.list.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = [...el.list.querySelectorAll(".em-result")];
    const i = rows.indexOf(document.activeElement);
    if (i < 0) return;
    event.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, i + (event.key === "ArrowDown" ? 1 : -1)))].focus();
  });
  function renderHead(result) {
    const srcId = cellId(Math.floor(result.sourceSampleId / api.grid.cols), result.sourceSampleId % api.grid.cols);
    el.head.replaceChildren(h(document, "strong", { text: T(sc.header, { n: result.matches.length, id: srcId }) }),
      infoIcon(document, sc.distanceInfo + " " + result.scopeLabel + ". " + T(a.excluded, { flat: result.flatExcluded, gappy: result.gappyExcluded }) + " " + T(a.separation, { n: result.separation })));
    el.head.hidden = false;
  }

  async function search() {
    const index = sampleOf();
    if (index === null) { setStatus(sc.noSource, true); return; }
    controller?.abort();
    const query = { sourceIndex: index, mode: modeRadios.value.checked ? "value" : "shape", algorithm: el.align.value, window: 1, maxResults: Number(el.limit.value), unit: spec().unitLabel || spec().unit, minSeparation: DEFAULT_SEPARATION };
    store.dispatch("SEARCH_ECHO", { sourceId: index });
    const requestId = store.state.echoRequestId;
    const datasetId = api.phen.id;
    controller = new AbortController();
    const mine = controller;
    el.search.disabled = true;
    el.cancel.hidden = false;
    setState("loading", sc.running, [el.cancel]);
    api.setPins([]);
    el.list.replaceChildren();
    el.detail.hidden = true;
    try {
      const result = await api.analysis.request("echo", query, data(), mine.signal);
      store.dispatch("ECHO_RESULT", { requestId, datasetId, matches: result.matches, status: result.status });
      if (store.state.echoRequestId !== requestId || store.state.datasetId !== datasetId) return;
      lastResult = result;
      renderResults();
      const reason = result.reason ?? "";
      if (result.status === "results") { setState(null, ""); renderHead(result); }
      else if (result.status === "no_results") setState("empty", sc.empty);
      else if (result.status === "error") setState("error", T(a.error, { reason }));
      else setState("unavailable", result.status === "insufficient_data" ? T(a.insufficient, { reason }) : result.status === "incompatible" ? T(a.incompatible, { reason }) : sc.cancelled);
      if (result.status === "results") api.guided(T(a.found, { n: result.matches.length, id: cellId(result.matches[0].row, result.matches[0].col) }));
    } catch (error) {
      if (error.name === "AbortError") { setStatus(sc.cancelled); } else { console.error(error); store.dispatch("DATA_ERROR", { message: error.message }); setState("error", sc.error, [Object.assign(h(document, "button", { type: "button", class: "button ghost small-button", text: sc.retry }), { onclick: search })]); }
    } finally {
      if (controller === mine) { el.cancel.hidden = true; el.search.disabled = false; }
      renderSource();
    }
  }
  el.search.addEventListener("click", search);
  el.cancel.addEventListener("click", () => controller?.abort());

  // ---- A match: the same map moves to it; two curves side by side; listen to source then match.
  // The monthly series as markers: each month plays a slice of the recording for its real value (no synthesized tones).
  function seriesPlan(index, dates) {
    const row = Math.floor(index / api.grid.cols);
    const col = index % api.grid.cols;
    const pan = lonPan(api.grid, cellCenter(api.grid, row, col).lon);
    const events = dates.map((date, i) => ({ id: `ev-${i}`, onsetS: i * 0.5, row, col, step: i, pan, evidence: { recValue: phenSnapshot(date).values[index], date } }));
    return { caseId: "earthmap", level: "earthmap", mappingVersion: "recordings-v1", mode: "echo", durationS: dates.length * 0.5 + 0.1, events };
  }
  function openMatch(sampleId) {
    const mt = store.state.echoMatches.find((x) => x.sampleId === sampleId);
    if (!mt || !lastResult) return;
    store.dispatch("OPEN_ECHO_MATCH", { sampleId });
    const cell = { row: mt.row, col: mt.col, index: sampleId };
    api.selectCell(cell, { play: false, say: false, user: false });
    const centre = cellCenter(api.grid, mt.row, mt.col);
    api.setView({ lon: centre.lon, lat: centre.lat, zoom: Math.max(api.state.view.zoom, 3) });
    renderResults();
    const src = lastResult.sourceSeries;
    const dates = lastResult.dates;
    const srcId = cellId(Math.floor(lastResult.sourceSampleId / api.grid.cols), lastResult.sourceSampleId % api.grid.cols);
    const listen = h(document, "button", { type: "button", class: "button small-button", text: a.listen });
    const status = h(document, "p", { class: "small", role: "status", "aria-live": "polite" });
    listen.addEventListener("click", async () => {
      if (!api.audio.enabled) await api.setSound(true);
      const plan = joinPlans(seriesPlan(lastResult.sourceSampleId, dates), seriesPlan(sampleId, dates), 0.7);
      api.state.busy = true;
      playing = { plan, place: "a" };
      api.audio.play(plan);
      playing.revision = api.audio.transport.snapshot().planRevision;
      status.textContent = T(a.playing, { which: a.sourceLabel });
    });
    el.detail.replaceChildren(h(document, "h3", { text: T(a.opened, { rank: mt.rank, id: cellId(mt.row, mt.col) }) }),
      h(document, "div", { class: "em-curves" },
        h(document, "figure", {}, lineChart(document, { series: [{ values: src, cls: "src" }], dates, unit: unitName(), label: `${a.sourceLabel} ${srcId}` }), h(document, "figcaption", { class: "small", text: a.sourceLabel + " " + srcId })),
        h(document, "figure", {}, lineChart(document, { series: [{ values: mt.series, cls: "match" }], dates, unit: unitName(), label: `${a.matchLabel} ${cellId(mt.row, mt.col)}` }), h(document, "figcaption", { class: "small", text: a.matchLabel + " " + cellId(mt.row, mt.col) + " · " + T(a.distance, { d: trimNumber(mt.distance, 3) }) }))),
      listen, status);
    el.detail.hidden = false;
    playStatus = status;
    api.guided(T(a.opened, { rank: mt.rank, id: cellId(mt.row, mt.col) }));
  }

  api.state.phenHooks = [...(api.state.phenHooks ?? []), () => { controller?.abort(); lastResult = null; el.list.replaceChildren(); el.detail.hidden = true; el.head.hidden = true; setStatus(sc.idle); renderSource(); }];
  api.state.lockHooks = [...(api.state.lockHooks ?? []), renderSource];
  api.state.dateHooks = [...(api.state.dateHooks ?? []), renderSource];
  setState("idle", sc.idle);
  renderSource();
  return { search, openMatch, render: renderResults, get result() { return lastResult; }, el };
}
