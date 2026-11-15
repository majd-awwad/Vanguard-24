import { cellId, formatLat, formatLon } from "../cinematic/site/cells.js";
import { h } from "../cinematic/site/dom.js";
import { cellCenter, cellRect, rectCells, summarize } from "./field.js";
import { infoIcon } from "./studio-ui-kit.js";
import { compareCopy } from "./compare-copy.js";
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
  if (published) return { status: "published", first, second, id: published.id, path: published.path };
  if (groupOf(catalog, first) && groupOf(catalog, first) === groupOf(catalog, second)) return { status: "computed", first, second };
  const known = catalog.unavailableComparisons.find((p) => p.first === first && p.second === second);
  return { status: "unavailable", first, second, reason: known?.reason ?? catalog.policy ?? DEFAULT_REASON };
}

/** A place is one cell or one rectangle; its summary uses the real values of the current layer. */
export function placeSummary(place, values, grid) {
  if (!place) return null;
  if (place.type === "cell") return { ...summarize(values, [place.cell]), kind: "cell" };
  return { ...summarize(values, rectCells(grid, place.rect)), kind: "area" };
}

/** Sound fingerprint of a place: a cell repeats its tone three times; an area plays up to 24 of its cells west to east. */
export function fingerprintPlan(place, values, kind, grid, tonesFor = null) {
  if (place.type === "cell") {
    const step = { row: place.cell.row, col: place.cell.col, index: place.cell.index, value: values[place.cell.index] ?? null };
    return sequencePlan(kind, [step, step, step], grid, { slotS: 0.5, tag: "fingerprint", compact: false, tonesFor });
  }
  const cells = rectCells(grid, place.rect);
  const steps = scanSteps(cells, values, strideFor(cells.length, FINGERPRINT_CELLS));
  return sequencePlan(kind, steps, grid, { slotS: 0.25, tag: "fingerprint", tonesFor });
}

export function mountCompare(api) {
  const { state, el, grid, c, T, document, audio } = api;
  const transport = audio.transport;
  state.places = { a: null, b: null };
  const k = compareCopy[api.language];
  state.cmpSources = null;

  const select = (id, label) => h(document, "select", { id, "aria-label": label });
  const datesOf = () => Object.fromEntries(api.list.map((s) => [s.id, s.date]));
  el.cmpA = select("st-cmp-a", c.compare.first);
  el.cmpB = select("st-cmp-b", c.compare.second);
  function fillSelects() {
    const locked = new Set(api.lockedDates());
    const open = api.list.filter((s) => !locked.has(s.date));
    const defaultA = open.find((s) => s.date === "2025-04-15")?.id ?? open[0].id;
    const defaultB = open.find((s) => s.date === "2025-07-15")?.id ?? open.at(-1).id;
    for (const [node, value] of [[el.cmpA, defaultA], [el.cmpB, defaultB]]) {
      node.replaceChildren(...api.list.map((entry) => h(document, "option", { value: entry.id, text: entry.date + (locked.has(entry.date) ? " 🔒" : ""), selected: entry.id === value, disabled: locked.has(entry.date), title: locked.has(entry.date) ? api.language === "ar" ? "مقفل حتى تنهي فك الشيفرة" : "Locked until you finish Decode" : "" })));
    }
  }
  fillSelects();
  el.cmpStatus = h(document, "p", { class: "callout", role: "status", "aria-live": "polite" });
  el.cmpButton = h(document, "button", { type: "button", class: "button", text: c.compare.show });
  el.cmpInfo = h(document, "p", { class: "small" });
  el.cmpHelp = h(document, "span", { class: "st-inline-info" });

  function describe() {
    const r = resolveComparison(api.catalog, el.cmpA.value, el.cmpB.value);
    state.pending = r;
    el.cmpButton.disabled = r.status === "same" || r.status === "unavailable";
    el.cmpStatus.className = r.status === "unavailable" ? "callout warn" : "callout";
    el.cmpStatus.hidden = r.status === "published" || r.status === "computed";
    el.cmpHelp.replaceChildren(infoIcon(document, (r.status === "published" ? c.compare.published : r.status === "computed" ? c.compare.computed : "") + " " + c.compare.noMissing + " " + c.compare.sound));
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
      state.comparison = await api.difference(r);
      state.cmpSources = { a, b };
      el.cmpButton.textContent = c.compare.hide;
      el.cmpA.disabled = el.cmpB.disabled = true;
      el.date.disabled = el.prev.disabled = el.next.disabled = true;
      api.stopRun?.(true);
      api.applyLayer();
      api.onDataChanged();
      api.refreshDateInfo?.();
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
    first.dd.textContent = `${datesOf()[state.cmpSources.a.id]}: ${api.fmt(state.cmpSources.a.values[index])}`;
    second.dd.textContent = `${datesOf()[state.cmpSources.b.id]}: ${api.fmt(state.cmpSources.b.values[index])}`;
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
  function refreshPlacesLegacy() {
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
  playBoth.textContent = k.listen;
  playBoth.addEventListener("click", async () => {
    const { a, b } = state.places;
    if (!a || !b) { el.placeNote.textContent = c.compare.needBoth; return; }
    if (!audio.enabled) await api.setSound(true);
    api.stopRun?.(true);
    const cellsOnly = a.type === "cell" && b.type === "cell";
    const values = cellsOnly ? state.snapshot.values : api.layerValues();
    const kind = cellsOnly ? "dust" : api.layerKind();
    const plan = joinPlans(fingerprintPlan(a, values, kind, grid, api.tonesFor), fingerprintPlan(b, values, kind, grid, api.tonesFor));
    state.busy = true;
    playing = { plan, revision: null, place: "a" };
    audio.play(plan);
    playing.revision = transport.snapshot().planRevision;
    el.placeNote.textContent = T(k.playing, { x: "A" });
    markPlaying("a");
    api.invalidate();
  });
  transport.subscribe((snap) => {
    if (!playing || snap.planRevision !== playing.revision) return;
    if (snap.status === "playing" && snap.activeEventId) {
      const event = playing.plan.events.findLast((e) => e.id === snap.activeEventId);
      if (event && event.place !== playing.place) { playing.place = event.place; el.placeNote.textContent = T(k.playing, { x: event.place.toUpperCase() }); markPlaying(event.place); api.invalidate(); }
    }
    if (snap.status === "ended") { playing = null; state.busy = false; el.placeNote.textContent = k.done; markPlaying(null); api.invalidate(); }
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

  // ---- Region A / B on the map: click a cell to set the next region; both values come from the loaded snapshot.
  let last = null;
  let forced = null;
  let lastSnap = state.snapshot.id;
  let cmpPlaying = null;
  const target = () => (!state.places.a ? "a" : !state.places.b ? "b" : forced ?? (last === "a" ? "b" : "a"));
  const isCell = (p) => p?.type === "cell";
  const valueOf = (place) => { const v = state.snapshot.values[place.cell.index]; return v === null || v === undefined || Number.isNaN(v) ? null : v; };
  function markPlaying(which) { cmpPlaying = which; for (const card of el.placeTable.querySelectorAll(".cmp-card")) card.dataset.playing = String(card.dataset.which === which); }
  function stopCompareAudio() { if (playing) { audio.stop(); playing = null; state.busy = false; } cmpPlaying = null; }
  function announce(text) { el.placeNote.textContent = text; }
  function setCell(which, cell) {
    stopCompareAudio();
    state.places[which] = { type: "cell", cell: { row: cell.row, col: cell.col, index: cell.index } };
    last = which;
    forced = null;
    refreshPlaces();
    const v = valueOf(state.places[which]);
    announce(T(k.setTo, { x: which.toUpperCase(), id: cellId(cell.row, cell.col), value: v === null ? "—" : api.fmt(v), unit: v === null ? k.noValue : api.unitText() }));
  }
  el.cmpPrompt = h(document, "p", { class: "cmp-prompt", role: "status", "aria-live": "polite" });
  el.cmpReplace = h(document, "div", { class: "seg cmp-replace", role: "group", "aria-label": k.replace });
  const replaceButtons = {};
  for (const which of ["a", "b"]) {
    const b = h(document, "button", { type: "button", "aria-pressed": "false", text: which === "a" ? k.replaceA : k.replaceB });
    b.addEventListener("click", () => { forced = which; renderPrompt(); });
    replaceButtons[which] = b;
    el.cmpReplace.append(b);
  }
  const swapButton = h(document, "button", { type: "button", class: "button ghost small-button", text: k.swap });
  const clearButton = h(document, "button", { type: "button", class: "button ghost small-button", text: k.clear });
  swapButton.addEventListener("click", () => {
    stopCompareAudio();
    [state.places.a, state.places.b] = [state.places.b, state.places.a];
    refreshPlaces();
    announce(k.swapped);
  });
  clearButton.addEventListener("click", () => {
    stopCompareAudio();
    state.places = { a: null, b: null };
    last = null; forced = null;
    refreshPlaces();
    announce(k.cleared);
  });
  function renderPrompt() {
    const { a, b } = state.places;
    const t = target();
    el.cmpPrompt.textContent = !a ? k.promptA : !b ? k.promptB : T(k.nextReplace, { x: t.toUpperCase() });
    el.cmpReplace.hidden = !(a && b);
    for (const [which, button] of Object.entries(replaceButtons)) button.setAttribute("aria-pressed", String(which === t));
    swapButton.disabled = !(a && b);
    clearButton.disabled = !(a || b);
    playBoth.disabled = !(a && b);
  }
  function renderCellCompare() {
    const unit = api.unitText();
    const card = (which) => {
      const place = state.places[which];
      const box = h(document, "div", { class: "cmp-card", "data-which": which, "data-empty": String(!place), "data-playing": String(cmpPlaying === which) }, h(document, "span", { class: "cmp-tag", text: which === "a" ? k.regionA : k.regionB }));
      if (!place) { box.append(h(document, "span", { class: "cmp-empty", text: k.notSet })); return box; }
      const v = valueOf(place);
      const centre = cellCenter(grid, place.cell.row, place.cell.col);
      box.append(h(document, "strong", { class: "cmp-id ltr", text: cellId(place.cell.row, place.cell.col) }), h(document, "span", { class: "cmp-where ltr", text: formatLat(centre.lat) + ", " + formatLon(centre.lon) }),
        h(document, "strong", { class: "cmp-value ltr", text: v === null ? "—" : api.fmt(v) }), h(document, "span", { class: "cmp-unit", text: v === null ? k.noValue : unit }));
      return box;
    };
    const { a, b } = state.places;
    const nodes = [h(document, "div", { class: "cmp-cards" }, card("a"), card("b"))];
    if (a && b) {
      const va = valueOf(a);
      const vb = valueOf(b);
      let sentence = k.missing;
      let diffText = "—";
      if (va !== null && vb !== null) {
        const d = vb - va;
        diffText = api.fmtChange(d) + " " + unit;
        sentence = d === 0 ? k.equal : T(d > 0 ? k.higher : k.lower, { x: api.fmtChange(Math.abs(d)).replace(/^\+/, ""), unit });
      }
      nodes.push(h(document, "div", { class: "cmp-diff" }, h(document, "span", { class: "cmp-diff-label", text: k.diff }), h(document, "strong", { class: "cmp-diff-value ltr", text: diffText }), h(document, "p", { class: "cmp-diff-text", text: sentence })));
      const facts = h(document, "dl", { class: "kv cmp-facts" },
        h(document, "dt", { text: k.phenomenon }), h(document, "dd", { text: api.phenName() }),
        h(document, "dt", { text: k.date }), h(document, "dd", { text: api.dateText() }),
        h(document, "dt", { text: k.unit }), h(document, "dd", { text: unit }));
      nodes.push(facts);
      if (state.comparison) nodes.push(h(document, "p", { class: "small", text: k.changeLayer }));
      nodes.push(h(document, "p", { class: "small cmp-note", text: k.note }));
    }
    return nodes;
  }
  function refreshPlaces() {
    const { a, b } = state.places;
    if (lastSnap !== state.snapshot.id) { lastSnap = state.snapshot.id; if (a || b) { stopCompareAudio(); announce(T(k.dateUpdated, { date: api.dateText() })); } }
    if ((!a || isCell(a)) && (!b || isCell(b))) {
      el.placeTable.replaceChildren(...renderCellCompare());
      api.invalidate();
    } else refreshPlacesLegacy();
    renderPrompt();
  }
  state.selectHooks = [...(state.selectHooks ?? []), (cell, opts) => { if (state.compareActive && opts?.user !== false) setCell(target(), cell); }];

  const panel = h(document, "section", { class: "panel st-compare", "aria-labelledby": "st-cmp-title" }, h(document, "h2", { id: "st-cmp-title", text: c.compare.title }),
    h(document, "h3", { text: k.title }),
    el.cmpPrompt, el.cmpReplace, el.placeTable,
    h(document, "div", { class: "st-tools-row cmp-actions" }, playBoth, swapButton, clearButton), el.placeNote, h(document, "p", { class: "small", text: k.listenHint }),
    h(document, "h3", { text: c.compare.time }),
    h(document, "label", { class: "st-pick", for: "st-cmp-a" }, h(document, "span", { text: c.compare.first }), el.cmpA), h(document, "label", { class: "st-pick", for: "st-cmp-b" }, h(document, "span", { text: c.compare.second }), el.cmpB),
    el.cmpStatus, el.cmpInfo, h(document, "div", { class: "st-question-actions" }, el.cmpButton, el.cmpHelp),
    h(document, "details", { class: "cmp-more" }, h(document, "summary", { text: k.more }),
      h(document, "div", { class: "st-tools-row" }, ...placeButtons("a")), h(document, "div", { class: "st-tools-row" }, ...placeButtons("b")),
      h(document, "p", { class: "small", text: c.compare.fingerprint + " " + c.compare.pointFp + " " + T(c.compare.areaFp, { n: FINGERPRINT_CELLS }) })));
  state.right.insertBefore(panel, state.right.children[state.right.children.length - 1]);
  api.panels.compare = panel;
  describe();
  refreshPlaces();
  state.lockHooks = [...(state.lockHooks ?? []), () => { fillSelects(); describe(); }];
  api.phenomenonHooks = api.phenomenonHooks ?? [];
  api.phenomenonHooks.push(() => {
    if (state.comparison) hideChange();
    fillSelects();
    describe();
    if (state.places.a || state.places.b) { stopCompareAudio(); state.places = { a: null, b: null }; last = null; forced = null; refreshPlaces(); announce(k.clearedPhen); }
  });
  Object.assign(api, { showChange, hideChange, describeComparison: describe, refreshPlaces, state });
  return api;
}
