import { cellId, fillIso, formatLat, formatLon, trimNumber } from "../cinematic/site/cells.js";
import { h } from "../cinematic/site/dom.js";
import { formatChange, formatValue } from "./datasets.js";
import { cellCenter } from "./field.js";
import { QUERY, toHunterData } from "./hunter-core.js";
import { analysisCopy } from "./analysis-copy.js";
import { mapCopy } from "./earthmap-copy.js";
import { signalsCopy } from "./signals-copy.js";
import { infoIcon, stateBox } from "./studio-ui-kit.js";

// Find signals: one question sentence, a primary button, human results pinned on the same map, and the
// "How was this found?" evidence. Nothing here computes science: hunter-core.js does, off the main thread.

const ORDER = [QUERY.HIGHEST, QUERY.THRESHOLD, QUERY.INCREASE, QUERY.DECREASE];

export function mountHunter(api, container) {
  const { document, store, language, state } = api;
  const a = analysisCopy[language].hunter;
  const s = signalsCopy[language].hunter;
  const m = mapCopy[language];
  const T = (template, values) => fillIso(template, values, language);
  const el = {};
  let controller = null;

  const spec = () => api.phen.spec;
  const unitName = () => m.phen.unitName[api.phen.id];
  const locked = () => new Set(api.lockedDates());

  // ---- The question: "Show the [10] [highest] Dust values on [date]"
  el.type = h(document, "select", { id: "hunter-type", "aria-label": s.typeLabel }, ...ORDER.map((type) => h(document, "option", { value: type, text: s.types[type] })));
  el.limit = h(document, "select", { id: "hunter-limit", "aria-label": s.limitLabel }, ...[5, 10, 20].map((n) => h(document, "option", { value: n, text: String(n), selected: n === 10 })));
  el.date = h(document, "select", { id: "hunter-date", "aria-label": s.dateLabel });
  el.from = h(document, "select", { id: "hunter-from", "aria-label": s.fromLabel });
  el.to = h(document, "select", { id: "hunter-to", "aria-label": s.toLabel });
  el.threshold = h(document, "input", { type: "number", id: "hunter-threshold", step: "any", inputmode: "decimal", "aria-label": a.threshold.replace("{unit}", "") });
  el.preset = h(document, "button", { type: "button", class: "button ghost small-button" });
  el.sentence = h(document, "div", { class: "st-sentence", dir: "auto" });
  el.thresholdRow = h(document, "div", { class: "st-sentence st-sentence-sub" });
  el.search = h(document, "button", { type: "button", class: "button", text: a.search });
  el.cancel = h(document, "button", { type: "button", class: "button ghost", text: a.cancel });
  el.state = h(document, "div", { class: "st-state-slot" });
  el.head = h(document, "div", { class: "st-results-head", hidden: true });
  el.list = h(document, "ol", { class: "em-results st-rows", "aria-label": a.resultsLabel });
  el.how = h(document, "details", { class: "em-how", hidden: true });
  el.listen = h(document, "button", { type: "button", class: "button ghost small-button", text: a.listen, hidden: true });
  container.append(h(document, "section", { class: "panel st-tool", "aria-labelledby": "hunter-title" }, h(document, "h2", { id: "hunter-title", text: a.title }),
    h(document, "div", { class: "st-question" }, el.sentence, el.thresholdRow, h(document, "div", { class: "st-question-actions" }, el.search, infoIcon(document, s.help))),
    el.state, el.head, el.list, el.listen, el.how));

  const selectedType = () => el.type.value || QUERY.HIGHEST;
  function dateOptions(selected) {
    const lock = locked();
    return api.phen.list.map((entry) => h(document, "option", { value: entry.date, text: entry.date + (lock.has(entry.date) ? " 🔒" : ""), selected: entry.date === selected, disabled: lock.has(entry.date), title: lock.has(entry.date) ? m.date.locked : "" }));
  }
  function fillDates() {
    const lock = locked();
    const open = api.phen.list.filter((entry) => !lock.has(entry.date));
    const dflt = open.find((entry) => entry.date === state.snapshot.date)?.date ?? open[0]?.date;
    el.date.replaceChildren(...dateOptions(dflt));
    el.from.replaceChildren(...dateOptions(open.find((entry) => entry.date === "2025-04-15")?.date ?? open[0]?.date));
    el.to.replaceChildren(...dateOptions(open.find((entry) => entry.date === "2025-07-15")?.date ?? open.at(-1)?.date));
  }
  function syncForm() {
    const type = selectedType();
    const change = type === QUERY.INCREASE || type === QUERY.DECREASE;
    const phen = m.phen[api.phen.id];
    const lead = h(document, "span", { text: s.show });
    const tail = h(document, "span", { text: T(change ? s.tailBetween : s.tailOn, { phen }) });
    el.sentence.replaceChildren(lead, el.limit, el.type, tail, ...(change ? [el.from, h(document, "span", { text: s.and }), el.to] : [el.date]));
    el.thresholdRow.hidden = type !== QUERY.THRESHOLD;
    if (type === QUERY.THRESHOLD) {
      el.thresholdRow.replaceChildren(h(document, "span", { text: s.atLeast }), el.threshold, h(document, "span", { class: "st-unit", text: unitName() }), ...(api.phen.id === "dust" ? [el.preset] : []));
    }
    if (document.activeElement !== el.threshold && (el.threshold.value === "" || el.threshold.dataset.phen !== api.phen.id)) { el.threshold.value = String(spec().defaultThreshold); el.threshold.dataset.phen = api.phen.id; }
    el.preset.textContent = T(a.preset, { value: spec().decodeThreshold ?? "" });
  }
  el.type.addEventListener("change", syncForm);
  el.preset.addEventListener("click", () => { el.threshold.value = String(spec().decodeThreshold); });

  // ---- Human results: rank, value (big) with a bar relative to the best, coordinates, the cell code last
  const unitText = () => unitName();
  const valueText = (v) => formatValue(spec(), v);
  const where = (f) => { const c = cellCenter(api.grid, f.row, f.col); return `${formatLat(c.lat)}, ${formatLon(c.lon)}`; };
  const describeFinding = (f) => (f.delta !== null ? T(a.deltaRow, { id: cellId(f.row, f.col), delta: formatChange(spec(), f.delta), unit: unitText(), first: f.firstDate, second: f.secondDate }) : T(a.valueRow, { id: cellId(f.row, f.col), value: valueText(f.value), unit: unitText(), date: f.date }));
  function linkPin(button, index) {
    for (const type of ["mouseenter", "focus"]) button.addEventListener(type, () => api.hoverPin?.(index));
    for (const type of ["mouseleave", "blur"]) button.addEventListener(type, () => api.hoverPin?.(null));
  }
  function renderPins() {
    const selected = store.state.selectedFindingId;
    api.setPins(store.state.findings.map((f) => ({ index: f.sampleId, label: f.rank, kind: "finding", selected: f.id === selected })));
  }
  function renderResults() {
    const findings = store.state.findings;
    const top = Math.max(...findings.map((f) => Math.abs(f.delta !== null ? f.delta : f.value)), 0) || 1;
    el.list.replaceChildren(...findings.map((f) => {
      const v = f.delta !== null ? f.delta : f.value;
      const pct = Math.max(3, Math.round((Math.abs(v) / top) * 100));
      const big = f.delta !== null ? formatChange(spec(), f.delta) : valueText(f.value);
      const b = h(document, "button", { type: "button", class: "em-result st-row", "aria-pressed": String(f.id === store.state.selectedFindingId), "data-id": f.id, "data-index": f.sampleId, "aria-label": describeFinding(f) },
        h(document, "span", { class: "em-rank", text: String(f.rank) }),
        h(document, "span", { class: "st-row-main" }, h(document, "strong", { class: "st-row-value ltr", text: big }), h(document, "span", { class: "st-row-bar", "aria-hidden": "true" }, h(document, "i", { style: `width:${pct}%` }))),
        h(document, "span", { class: "st-row-where ltr" }, where(f), h(document, "small", { text: cellId(f.row, f.col) + (f.delta !== null && f.percent !== null ? " · " + (f.percent > 0 ? "+" : "") + trimNumber(f.percent, 1) + "%" : "") })));
      b.addEventListener("click", () => openFinding(f.id));
      linkPin(b, f.sampleId);
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
    const first = result.findings[0];
    const change = first.delta !== null;
    const when = change ? `${first.firstDate} → ${first.secondDate}` : first.date;
    el.head.replaceChildren(h(document, "strong", { text: T(s.header, { n: result.findings.length, total: result.totalMatches ?? result.findings.length, when }) }),
      infoIcon(document, T(a.total, { total: result.totalMatches, n: result.findings.length }) + " " + result.scopeLabel + "."),
      h(document, "span", { class: "st-unitline", text: T(change ? s.unitChange : s.unitValue, { unit: unitText() }) }));
    el.head.hidden = false;
  }
  function renderHow(result, f) {
    if (!f) { el.how.hidden = true; return; }
    const rows = a.rows;
    const cells = [
      [rows.question, a.method[f.evidence.method === "largest increase" ? "largest_increase" : f.evidence.method === "largest decrease" ? "largest_decrease" : f.evidence.method.startsWith("value >=") ? "threshold" : "highest"] + (f.evidence.method.startsWith("value >=") ? ` (${f.evidence.method})` : "")],
      [rows.dataset, `${m.phen[api.phen.id]} · ${m.phen.measure[api.phen.id]} · ${unitText()}`],
      [rows.dates, f.evidence.dates.join(" → ")],
      [rows.calculation, f.evidence.formula],
      [rows.samples, String(f.evidence.inputCount) + " · " + T(a.total, { total: result.totalMatches, n: result.findings.length })],
      [rows.missing, String(result.missingExcluded)],
      [rows.build, f.evidence.build],
      [rows.source, f.evidence.granules.join(", ")],
      [rows.scope, result.scopeLabel],
      [rows.quality, f.quality.status + (f.quality.notes.length ? ": " + f.quality.notes.join(" ") : "")],
    ];
    const dl = h(document, "dl", { class: "kv" });
    for (const [k, v] of cells) dl.append(h(document, "dt", { text: k }), h(document, "dd", { class: "ltr mono", text: v }));
    el.how.replaceChildren(h(document, "summary", { text: a.how }), dl);
    el.how.hidden = false;
  }
  let lastResult = null;
  function setState(kind, text, actions = []) { el.state.replaceChildren(...(text ? [stateBox(document, kind, text, actions)] : [])); }
  function clearResults() { el.list.replaceChildren(); el.head.hidden = true; el.how.hidden = true; el.listen.hidden = true; }

  // ---- Search
  async function search() {
    controller?.abort();
    const type = selectedType();
    const query = { type, limit: Number(el.limit.value), date: el.date.value, startDate: el.from.value, endDate: el.to.value, threshold: el.threshold.value === "" ? Number.NaN : Number(el.threshold.value) };
    store.dispatch("RUN_HUNTER", { filters: query });
    const requestId = store.state.hunterRequestId;
    const datasetId = api.phen.id;
    controller = new AbortController();
    const mine = controller;
    el.search.disabled = true;
    setState("loading", s.running, [el.cancel]);
    api.setPins([]);
    clearResults();
    try {
      const result = await api.analysis.request("hunter", query, toHunterData(api.phen, { excludeDates: api.lockedDates() }), mine.signal);
      store.dispatch("HUNTER_RESULT", { requestId, datasetId, findings: result.findings, status: result.status });
      if (store.state.hunterRequestId !== requestId || store.state.datasetId !== datasetId) return;
      lastResult = result;
      show(result);
    } catch (error) {
      if (error.name === "AbortError") { if (store.state.hunterStatus === "running") store.dispatch("CANCEL_SEARCH"); setState("idle", s.cancelled); }
      else { console.error(error); store.dispatch("DATA_ERROR", { message: error.message }); setState("error", s.error, [Object.assign(h(document, "button", { type: "button", class: "button ghost small-button", text: s.retry }), { onclick: search })]); }
    } finally {
      if (controller === mine) el.search.disabled = false;
    }
  }
  function show(result) {
    const reason = result.reason ?? "";
    if (result.status === "results") {
      setState(null, "");
      renderResults();
      renderHead(result);
      api.guided(T(a.found, { n: result.findings.length, id: cellId(result.findings[0].row, result.findings[0].col) }));
    } else if (result.status === "no_results") setState("empty", s.empty);
    else if (result.status === "error") setState("error", T(a.error, { reason }));
    else {
      const text = { insufficient_data: T(a.insufficient, { reason }), unsupported_period: T(a.unsupported, { reason }), not_available: T(a.notAvailable, { reason }) }[result.status] ?? reason ?? result.status;
      setState("unavailable", text);
    }
    renderHow(result, null);
  }
  el.search.addEventListener("click", search);
  el.cancel.addEventListener("click", () => { controller?.abort(); });

  // ---- Opening a finding: the same map moves, highlights, shows the evidence and can be heard.
  async function showLayerFor(f) { if (f.delta !== null) await api.showChangeFor(f.firstDate, f.secondDate); else await api.showValues(f.date); }
  async function openFinding(id) {
    const f = store.state.findings.find((x) => x.id === id);
    if (!f) return;
    store.dispatch("OPEN_FINDING", { id });
    const cell = { row: f.row, col: f.col, index: f.sampleId };
    await showLayerFor(f);
    api.selectCell(cell, { play: false, say: false, user: false });
    const centre = cellCenter(api.grid, f.row, f.col);
    api.setView({ lon: centre.lon, lat: centre.lat, zoom: Math.max(api.state.view.zoom, 4) });
    renderResults();
    renderHow(lastResult, f);
    el.listen.hidden = false;
    if (api.audio.enabled) api.playCurrent();
    api.guided(T(a.opened, { rank: f.rank, id: cellId(f.row, f.col) }) + " " + describeFinding(f));
  }
  el.listen.addEventListener("click", async () => { if (!api.audio.enabled) await api.setSound(true); api.playCurrent(); });

  // ---- Keep the panel in step with the dataset and the locked dates; coming back restores this tool's own state.
  async function restore() {
    const findings = store.state.findings;
    if (!findings.length || !lastResult) return;
    renderPins();
    const f = findings.find((x) => x.id === store.state.selectedFindingId);
    if (f) await showLayerFor(f);
  }
  api.state.phenHooks = [...(api.state.phenHooks ?? []), () => { controller?.abort(); lastResult = null; clearResults(); fillDates(); syncForm(); setState("idle", s.idle); }];
  api.state.lockHooks = [...(api.state.lockHooks ?? []), () => { fillDates(); }];
  api.state.tabHooks = { ...(api.state.tabHooks ?? {}), HUNTER: () => { fillDates(); syncForm(); restore(); } };
  fillDates();
  syncForm();
  setState("idle", s.idle);
  return { search, openFinding, render: renderResults, get result() { return lastResult; }, el };
}
