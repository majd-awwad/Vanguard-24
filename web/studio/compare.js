import { compareDustSnapshots, loadDustComparison } from "../sources/decode/dust-visual.js";
import { cellId, formatLat, formatLon } from "../cinematic/site/cells.js";
import { h } from "../cinematic/site/dom.js";
import { cellRect, rectCells, summarize } from "./field.js";
import { joinPlans, scanSteps, sequencePlan, strideFor } from "./mapping.js";

// Milestone M5: compare two dates (published comparison, or computed only inside one model-build group, otherwise
// unavailable with the catalog's reason) and compare two places by their sound fingerprints.

export const DEFAULT_REASON = "Different literal model build labels; numerical build equivalence unverified.";
export const FINGERPRINT_CELLS = 24;

const groupOf = (catalog, id) => catalog.compatibilityGroups.find((g) => g.snapshotIds.includes(id))?.modelSource ?? null;

/**
 * What may be shown for a pair of dates. Earlier date first. Never invents a comparison across model builds.
 * Returns { status: "same" | "published" | "computed" | "unavailable", first, second, id?, reason? }.
 */
export function resolveComparison(catalog, idA, idB) {
  if (idA === idB) return { status: "same" };
  const dates = Object.fromEntries(catalog.snapshots.map((s) => [s.id, s.date]));
  const [first, second] = dates[idA] <= dates[idB] ? [idA, idB] : [idB, idA];
  const published = catalog.comparisons.find((p) => p.first === first && p.second === second);
  if (published) return { status: "published", first, second, id: published.id };
  if (groupOf(catalog, first) && groupOf(catalog, first) === groupOf(catalog, second)) return { status: "computed", first, second };
  const known = catalog.unavailableComparisons.find((p) => p.first === first && p.second === second);
  return { status: "unavailable", first, second, reason: known?.reason ?? DEFAULT_REASON };
}

/** A place is one cell or one rectangle; its summary uses the real values of the current layer. */
export function placeSummary(place, values, grid) {
  if (!place) return null;
  if (place.type === "cell") return { ...summarize(values, [place.cell]), kind: "cell" };
  return { ...summarize(values, rectCells(grid, place.rect)), kind: "area" };
}

/** Sound fingerprint of a place: a cell repeats its tone three times; an area plays up to 24 of its cells west to east. */
export function fingerprintPlan(place, values, kind, grid) {
  if (place.type === "cell") {
    const step = { row: place.cell.row, col: place.cell.col, index: place.cell.index, value: values[place.cell.index] ?? null };
    return sequencePlan(kind, [step, step, step], grid, { slotS: 0.24, tag: "fingerprint", compact: false });
  }
  const cells = rectCells(grid, place.rect);
  const steps = scanSteps(cells, values, strideFor(cells.length, FINGERPRINT_CELLS));
  return sequencePlan(kind, steps, grid, { slotS: 0.1, tag: "fingerprint" });
}

export function mountCompare(api) {
  const { state, el, grid, catalog, list, c, T, document, audio } = api;
  const transport = audio.transport;
  state.places = { a: null, b: null };
  state.cmpSources = null;

  const select = (id, label, value) => {
    const node = h(document, "select", { id, "aria-label": label });
    for (const entry of list) node.append(h(document, "option", { value: entry.id, text: entry.date, selected: entry.id === value }));
    return node;
  };
  const dates = Object.fromEntries(list.map((s) => [s.id, s.date]));
  const defaultA = list.find((s) => s.date === "2025-04-15")?.id ?? list[0].id;
  const defaultB = list.find((s) => s.date === "2025-07-15")?.id ?? list.at(-1).id;
  el.cmpA = select("st-cmp-a", c.compare.first, defaultA);
  el.cmpB = select("st-cmp-b", c.compare.second, defaultB);
  el.cmpStatus = h(document, "p", { class: "callout", role: "status", "aria-live": "polite" });
  el.cmpButton = h(document, "button", { type: "button", class: "button", text: c.compare.show });
  el.cmpInfo = h(document, "p", { class: "small" });

  function describe() {
    const r = resolveComparison(catalog, el.cmpA.value, el.cmpB.value);
    state.pending = r;
    el.cmpButton.disabled = r.status === "same" || r.status === "unavailable";
    el.cmpStatus.className = r.status === "unavailable" ? "callout warn" : "callout";
    el.cmpStatus.textContent = r.status === "same" ? c.compare.same : r.status === "published" ? c.compare.published : r.status === "computed" ? c.compare.computed : c.compare.unavailable + ". " + T(c.compare.reasonBuild, { reason: r.reason === DEFAULT_REASON ? c.compare.reasonDefault : r.reason });
    el.cmpInfo.textContent = r.status !== "same" && el.cmpA.value !== r.first ? c.compare.chrono : "";
  }
  el.cmpA.addEventListener("change", describe);
  el.cmpB.addEventListener("change", describe);

  async function showChange() {
    if (state.comparison) { hideChange(); return; }
    const r = state.pending;
    if (!r || r.status === "same" || r.status === "unavailable") return;
    el.cmpButton.disabled = true;
    try {
      const [a, b] = await Promise.all([api.getSnapshot(r.first), api.getSnapshot(r.second)]);
      state.comparison = r.status === "published" ? await loadDustComparison(r.id) : compareDustSnapshots(a, b);
      state.cmpSources = { a, b };
      el.cmpButton.textContent = c.compare.hide;
      el.cmpA.disabled = el.cmpB.disabled = true;
      el.date.disabled = el.prev.disabled = el.next.disabled = true;
      api.stopRun?.(true);
      api.applyLayer();
      api.onDataChanged();
      el.dateInfo.textContent = c.legend.changeTitle + ": " + dates[state.cmpSources.b.id] + " − " + dates[state.cmpSources.a.id];
    } catch (error) {
      console.error(error);
      el.cmpStatus.textContent = c.compare.unavailable;
    } finally {
      el.cmpButton.disabled = false;
    }
  }
  function hideChange() {
    state.comparison = null;
    state.cmpSources = null;
    el.cmpButton.textContent = c.compare.show;
    el.cmpA.disabled = el.cmpB.disabled = false;
    el.date.disabled = el.prev.disabled = el.next.disabled = false;
    api.stopRun?.(true);
    api.applyLayer();
    api.onDataChanged();
    api.refreshDateInfo?.();
    describe();
  }
  el.cmpButton.addEventListener("click", showChange);

  // Understand panel gets the two source values when a change is shown.
  const dl = el.frame.ownerDocument.querySelector(".st-understand .kv");
  const first = { dt: h(document, "dt", { text: c.understand.first }), dd: h(document, "dd", { class: "ltr" }) };
  const second = { dt: h(document, "dt", { text: c.understand.second }), dd: h(document, "dd", { class: "ltr" }) };
  dl.append(first.dt, first.dd, second.dt, second.dd);
  state.understandExtras.push((d) => {
    const show = Boolean(state.cmpSources);
    for (const node of [first.dt, first.dd, second.dt, second.dd]) node.hidden = !show;
    if (!show) return;
    const index = state.cursor.index;
    first.dd.textContent = `${dates[state.cmpSources.a.id]}: ${api.fmt(state.cmpSources.a.values[index])}`;
    second.dd.textContent = `${dates[state.cmpSources.b.id]}: ${api.fmt(state.cmpSources.b.values[index])}`;
  });
  for (const node of [first.dt, first.dd, second.dt, second.dd]) node.hidden = true;

  // ---- Places A / B
  const placeButtons = (which) => {
    const cellButton = h(document, "button", { type: "button", class: "button ghost small-button", text: (which === "a" ? c.compare.setA : c.compare.setB) + " · " + c.compare.cursorCell });
    const areaButton = h(document, "button", { type: "button", class: "button ghost small-button", text: (which === "a" ? c.compare.setA : c.compare.setB) + " · " + c.compare.areaSel });
    cellButton.addEventListener("click", () => { if (state.cursor) { state.places[which] = { type: "cell", cell: { ...state.cursor } }; refreshPlaces(); } });
    areaButton.addEventListener("click", () => { if (state.rect) { state.places[which] = { type: "area", rect: { ...state.rect } }; refreshPlaces(); } });
    return [cellButton, areaButton];
  };
  el.placeTable = h(document, "div", { class: "st-places" });
  const playBoth = h(document, "button", { type: "button", class: "button", text: c.compare.playBoth });
  el.placeNote = h(document, "p", { class: "small", role: "status", "aria-live": "polite" });
  const label = (place) => (!place ? c.compare.none : place.type === "cell" ? cellId(place.cell.row, place.cell.col) : T("{south} to {north}, {west} to {east}", { south: formatLat(place.rect.south), north: formatLat(place.rect.north), west: formatLon(place.rect.west), east: formatLon(place.rect.east) }));
  function refreshPlaces() {
    const values = api.layerValues();
    const rows = [];
    const summaries = {};
    for (const which of ["a", "b"]) {
      const place = state.places[which];
      const s = placeSummary(place, values, grid);
      summaries[which] = s;
      const dl = h(document, "dl", { class: "kv", "data-place": which });
      dl.append(h(document, "dt", { text: which === "a" ? c.compare.a : c.compare.b }), h(document, "dd", { class: "ltr", text: label(place) }));
      if (s) {
        if (s.kind === "cell") dl.append(h(document, "dt", { text: c.understand.value }), h(document, "dd", { class: "ltr", text: s.valid ? api.fmt(values[place.cell.index]) : c.understand.missing }));
        else for (const [k, v] of [[c.scan.min, api.fmt(s.min)], [c.scan.max, api.fmt(s.max)], [c.scan.mean, api.fmt(s.mean)], [c.scan.missing, String(s.missing)]]) dl.append(h(document, "dt", { text: k }), h(document, "dd", { class: "ltr", text: v }));
      }
      rows.push(dl);
    }
    const a = summaries.a;
    const b = summaries.b;
    const meanOf = (s) => (s ? (s.kind === "cell" ? s.mean : s.mean) : null);
    if (meanOf(a) !== null && meanOf(b) !== null) rows.push(h(document, "p", { class: "xp-diff" }, c.compare.diff + ": ", h(document, "strong", { class: "ltr", text: api.fmtChange(meanOf(b) - meanOf(a)) })));
    el.placeTable.replaceChildren(...rows);
    api.invalidate();
  }
  state.dataHooks.push(refreshPlaces);

  let playing = null;
  playBoth.addEventListener("click", async () => {
    const { a, b } = state.places;
    if (!a || !b) { el.placeNote.textContent = c.compare.needBoth; return; }
    if (!audio.enabled) await api.setSound(true);
    api.stopRun?.(true);
    const values = api.layerValues();
    const kind = api.layerKind();
    const plan = joinPlans(fingerprintPlan(a, values, kind, grid), fingerprintPlan(b, values, kind, grid));
    state.busy = true;
    playing = { plan, revision: null, place: "a" };
    audio.play(plan);
    playing.revision = transport.snapshot().planRevision;
    el.placeNote.textContent = c.compare.a;
    api.invalidate();
  });
  transport.subscribe((snap) => {
    if (!playing || snap.planRevision !== playing.revision) return;
    if (snap.status === "playing" && snap.activeEventId) {
      const event = playing.plan.events.findLast((e) => e.id === snap.activeEventId);
      if (event && event.place !== playing.place) { playing.place = event.place; el.placeNote.textContent = event.place === "a" ? c.compare.a : c.compare.b; api.invalidate(); }
    }
    if (snap.status === "ended") { playing = null; state.busy = false; el.placeNote.textContent = ""; api.invalidate(); }
  });

  state.extraOverlay.push((overlay, svg, toScreen) => {
    for (const which of ["a", "b"]) {
      const place = state.places[which];
      if (!place) continue;
      const r = place.type === "cell" ? cellRect(grid, place.cell.row, place.cell.col) : place.rect;
      const p1 = toScreen(r.west, r.north);
      const p2 = toScreen(r.east, r.south);
      overlay.append(svg("rect", { x: p1.x, y: p1.y, width: p2.x - p1.x, height: p2.y - p1.y, class: "st-place st-place-" + which + (playing?.place === which ? " active" : "") }));
      const text = svg("text", { x: p1.x + 6, y: p1.y + 18, class: "st-place-label" });
      text.textContent = which.toUpperCase();
      overlay.append(text);
    }
  });

  const panel = h(document, "section", { class: "panel st-compare", "aria-labelledby": "st-cmp-title" }, h(document, "h2", { id: "st-cmp-title", text: c.compare.title }),
    h(document, "h3", { text: c.compare.time }),
    h(document, "label", { class: "st-pick", for: "st-cmp-a" }, h(document, "span", { text: c.compare.first }), el.cmpA), h(document, "label", { class: "st-pick", for: "st-cmp-b" }, h(document, "span", { text: c.compare.second }), el.cmpB),
    el.cmpStatus, el.cmpInfo, el.cmpButton, h(document, "p", { class: "small", text: c.compare.noMissing }), h(document, "p", { class: "small", text: c.compare.sound }),
    h(document, "h3", { text: c.compare.places }),
    h(document, "div", { class: "st-tools-row" }, ...placeButtons("a")), h(document, "div", { class: "st-tools-row" }, ...placeButtons("b")), el.placeTable,
    h(document, "div", { class: "st-tools-row" }, playBoth), el.placeNote, h(document, "p", { class: "small", text: c.compare.fingerprint + " " + c.compare.pointFp + " " + T(c.compare.areaFp, { n: FINGERPRINT_CELLS }) }));
  state.right.insertBefore(panel, state.right.children[state.right.children.length - 1]);
  describe();
  refreshPlaces();
  Object.assign(api, { showChange, hideChange, describeComparison: describe, refreshPlaces, state });
  return api;
}
