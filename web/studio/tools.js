import { cellId, formatLat, formatLon, trimNumber } from "../cinematic/site/cells.js";
import { h } from "../cinematic/site/dom.js";
import { infoIcon } from "./studio-ui-kit.js";
import { cellAt, cellCenter, cellRect, distanceKm, rectCells, samplePath, summarize, valueT } from "./field.js";
import { MAX_SCAN_CELLS, SLOT, scanSteps, sequencePlan, strideFor } from "./mapping.js";
import { clipToRegion, visibleBounds } from "./view.js";

// Milestones M3 (play an area) and M4 (draw a path): selection tools, a scan with a visible reading marker driven by
// the transport's own clock, play/pause/stop/speed, summaries of the real cells that were read, and a profile chart.

export const PATH_STEP_KM = 130;
export const SPEEDS = [0.5, 1, 2, 4];

/** Steps of a path: equal-distance samples, each the nearest cell's real value. */
export function pathSteps(points, values, grid, options = {}) {
  return samplePath(points, { stepKm: PATH_STEP_KM, ...options }).map((sample) => {
    const cell = cellAt(grid, sample.lon, sample.lat);
    return cell ? { ...cell, lon: sample.lon, lat: sample.lat, distanceKm: sample.distanceKm, value: values[cell.index] ?? null } : { row: 0, col: 0, index: -1, lon: sample.lon, lat: sample.lat, distanceKm: sample.distanceKm, value: null, outside: true };
  });
}

/** Rectangle between two points, ordered. */
export const rectBetween = (a, b) => ({ west: Math.min(a.lon, b.lon), east: Math.max(a.lon, b.lon), south: Math.min(a.lat, b.lat), north: Math.max(a.lat, b.lat) });

export function mountTools(api) {
  const { state, el, grid, c, T, document, win, bounds, audio } = api;
  const transport = audio.transport;
  Object.assign(state, { rect: null, cornerA: null, drawing: null, path: [], run: null, summary: null });
  state.dataHooks = state.dataHooks ?? [];

  // ---- Tool selector
  const names = ["explore", "area", "path"];
  const buttons = Object.fromEntries(names.map((name) => [name, h(document, "button", { type: "button", class: "st-tool", "aria-pressed": name === "explore", text: c.tools[name] })]));
  el.toolHelp = h(document, "p", { class: "small", id: "st-tool-help", text: c.tools.help.explore });
  function setTool(name) {
    state.tool = name;
    state.cornerA = null;
    state.drawing = null;
    el.frame.dataset.tool = name;
    for (const [key, button] of Object.entries(buttons)) button.setAttribute("aria-pressed", String(key === name));
    el.toolHelp.textContent = c.tools.help[name];
    api.invalidate();
  }
  for (const name of names) buttons[name].addEventListener("click", () => setTool(name));
  const toolPanel = h(document, "section", { class: "panel", "aria-labelledby": "st-tools-title" }, h(document, "h2", { id: "st-tools-title", text: c.tools.title }), h(document, "div", { class: "st-tools-row" }, ...Object.values(buttons)), el.toolHelp);
  state.left.insertBefore(toolPanel, state.left.children[1]);

  // ---- Shared run controller (area scans and paths use the same transport clock)
  el.runState = h(document, "p", { class: "small", role: "status", "aria-live": "polite", text: c.scan.state.idle });
  el.reading = h(document, "p", { class: "callout", role: "status", "aria-live": "off", hidden: true });
  const playPause = h(document, "button", { type: "button", class: "button ghost", text: c.scan.pause });
  const stopButton = h(document, "button", { type: "button", class: "button ghost", text: c.scan.stop });
  const speedSelect = h(document, "select", { id: "st-speed", "aria-label": c.scan.speed });
  for (const speed of SPEEDS) speedSelect.append(h(document, "option", { value: speed, text: speed + "×", selected: speed === 1 }));
  el.summary = h(document, "div", { class: "st-summary", hidden: true, tabindex: "-1" });
  const runPanel = h(document, "section", { class: "panel", "aria-labelledby": "st-run-title" }, h(document, "h2", { id: "st-run-title", text: c.scan.playback }),
    h(document, "div", { class: "st-tools-row" }, playPause, stopButton, h(document, "label", { class: "st-speed", for: "st-speed" }, h(document, "span", { text: c.scan.speed }), speedSelect)), el.runState, el.reading, el.summary);

  function drawSummary(run) {
    const s = run.stats;
    const rows = [[c.scan.cells, `${s.valid + s.missing}`], [c.scan.min, api.fmt(s.min)], [c.scan.max, api.fmt(s.max)], [c.scan.mean, api.fmt(s.mean)], [c.scan.missing, String(s.missing)]];
    if (run.kind === "area") rows.push([c.scan.area, T("{south} to {north}, {west} to {east}", { south: formatLat(run.rect.south), north: formatLat(run.rect.north), west: formatLon(run.rect.west), east: formatLon(run.rect.east) })]);
    else rows.push([c.path.samples, T(c.path.points, { n: run.points, km: trimNumber(run.totalKm, 0) })]);
    const dl = h(document, "dl", { class: "kv" });
    for (const [label, value] of rows) dl.append(h(document, "dt", { text: label }), h(document, "dd", { class: "ltr", text: value }));
    el.summary.replaceChildren(h(document, "h3", { text: run.kind === "area" ? c.scan.summary : c.path.summary }), dl,
      h(document, "p", { class: "small", text: run.kind === "area" ? (run.stride > 1 ? T(c.scan.stride, { k: run.stride, max: MAX_SCAN_CELLS }) : c.scan.all) + " " + c.scan.plain : c.path.profileNote.replace("{step}", PATH_STEP_KM) }));
    el.summary.hidden = false;
    el.summary.focus?.({ preventScroll: true });
  }

  async function begin(kind, steps, extra) {
    if (!steps.length) return;
    if (!audio.enabled) await api.setSound(true);
    stopRun(false);
    const slot = api.slotFor ? api.slotFor(kind) : kind === "area" ? (api.layerKind() === "change" ? SLOT.change : SLOT.dust) : SLOT.path;
    const plan = sequencePlan(api.layerKind(), steps, grid, { slotS: slot, tag: kind, tonesFor: api.tonesFor });
    const stats = summarize(api.layerValues(), steps.filter((s) => s.index >= 0));
    const outside = steps.filter((s) => s.index < 0).length;
    state.run = { kind, steps, plan, stats: { ...stats, missing: stats.missing + outside, count: stats.count + outside }, current: null, ...extra };
    state.busy = true;
    el.summary.hidden = true;
    el.runState.textContent = c.scan.state.playing;
    playPause.textContent = c.scan.pause;
    audio.play(plan);
    state.run.revision = transport.snapshot().planRevision;
    api.invalidate();
  }

  function stopRun(clearState = true) {
    if (!state.run && !state.busy) return;
    audio.stop();
    if (clearState) transport.seek(0);
    state.run = null;
    state.busy = false;
    el.reading.hidden = true;
    el.runState.textContent = c.scan.state.idle;
    playPause.textContent = c.scan.pause;
    api.invalidate();
  }

  transport.subscribe((snap) => {
    const run = state.run;
    if (!run || snap.planRevision !== run.revision) return;
    if (snap.status === "playing" && snap.activeEventId) {
      const event = run.plan.events.findLast((e) => e.id === snap.activeEventId);
      const step = event ? run.steps[event.step] : null;
      if (step && step !== run.current) {
        run.current = step;
        run.stepIndex = event.step;
        if (step.index >= 0) api.setCursor({ row: step.row, col: step.col, index: step.index });
        el.reading.hidden = false;
        el.reading.textContent = T(run.kind === "area" ? c.scan.reading : c.path.reading, { id: step.index >= 0 ? cellId(step.row, step.col) : "—" }) + ": " + (step.value === null ? c.understand.missing : api.fmt(step.value));
        state.onProgress?.(run);
        api.invalidate();
      }
    }
    if (snap.status === "playing") { el.runState.textContent = c.scan.state.playing; playPause.textContent = c.scan.pause; }
    if (snap.status === "paused") { el.runState.textContent = c.scan.state.paused; playPause.textContent = c.scan.play; }
    if (snap.status === "ended") {
      el.runState.textContent = c.scan.state.ended;
      playPause.textContent = c.scan.play;
      state.busy = false;
      run.finished = true;
      drawSummary(run);
      api.invalidate();
    }
  });
  playPause.addEventListener("click", () => {
    if (!state.run) return;
    const snap = transport.snapshot();
    if (snap.status === "playing") transport.pause(); else { state.busy = true; transport.play(); }
  });
  stopButton.addEventListener("click", () => stopRun(true));
  speedSelect.addEventListener("change", () => audio.setSpeed(Number(speedSelect.value)));

  // ---- M3: area
  const visibleRect = () => clipToRegion(visibleBounds(state.view, bounds, api.vw(), api.vh()), bounds);
  function playArea(rect) {
    if (!rect) { el.runState.textContent = c.scan.none; return; }
    const cells = rectCells(grid, rect);
    if (!cells.length) { el.runState.textContent = c.scan.none; return; }
    const stride = strideFor(cells.length);
    begin("area", scanSteps(cells, api.layerValues(), stride), { rect: { ...rect }, stride });
  }
  const playVisible = h(document, "button", { type: "button", class: "button", text: c.scan.visible });
  const playSelected = h(document, "button", { type: "button", class: "button ghost", text: c.scan.selected });
  playVisible.addEventListener("click", () => playArea(visibleRect()));
  playSelected.addEventListener("click", () => playArea(state.rect));
  const areaPanel = h(document, "section", { class: "panel", "aria-labelledby": "st-area-title" }, h(document, "h2", { id: "st-area-title", text: c.scan.title }),
    h(document, "p", { class: "st-ask" }, c.tools.help.area, infoIcon(document, c.scan.help)), h(document, "div", { class: "st-tools-row" }, playVisible, playSelected));

  // Drawing a rectangle: mouse/touch drag or Enter at two corners.
  state.pointerHandlers.push((type, event, p, pointers) => {
    if (state.tool === "area" && pointers.size <= 1) {
      if (type === "down") { state.drawing = { a: api.toGeo(p.x, p.y), start: p }; event.preventDefault(); }
      else if (type === "move" && state.drawing) { event.preventDefault(); state.rect = rectBetween(state.drawing.a, api.toGeo(p.x, p.y)); api.invalidate(); }
      else if (type === "up" && state.drawing) {
        const moved = Math.hypot(p.x - state.drawing.start.x, p.y - state.drawing.start.y);
        if (moved < 6) { state.rect = null; } else { state.rect = rectBetween(state.drawing.a, api.toGeo(p.x, p.y)); announceRect(); }
        state.drawing = null;
        api.invalidate();
      }
    } else if (state.tool === "path") {
      if (type === "down") state.pathDown = { p, count: pointers.size };
      if (type === "up" && state.pathDown && state.pathDown.count === 1) {
        const moved = Math.hypot(p.x - state.pathDown.p.x, p.y - state.pathDown.p.y);
        if (moved < 6) addPoint(api.toGeo(p.x, p.y));
        state.pathDown = null;
      }
    }
  });
  const announceRect = () => { el.runState.textContent = rectCells(grid, state.rect).length + " " + c.scan.cells.toLowerCase(); };

  // ---- M4: path
  el.profile = h(document, "div", { class: "st-profile" });
  const pathInfo = h(document, "p", { class: "small", role: "status", "aria-live": "polite" });
  const playPath = h(document, "button", { type: "button", class: "button", text: c.path.play });
  const clearPath = h(document, "button", { type: "button", class: "button ghost", text: c.path.clear });
  const undoPath = h(document, "button", { type: "button", class: "button ghost", text: c.path.undo });
  function pathLength() { let km = 0; for (let i = 1; i < state.path.length; i++) km += distanceKm(state.path[i - 1], state.path[i]); return km; }
  function addPoint(geo) {
    if (!cellAt(grid, geo.lon, geo.lat)) return;
    state.path.push({ lon: geo.lon, lat: geo.lat });
    refreshPath();
  }
  function refreshPath() {
    pathInfo.textContent = state.path.length < 2 ? c.path.none : T(c.path.points, { n: state.path.length, km: trimNumber(pathLength(), 0) });
    renderProfile();
    api.invalidate();
  }
  playPath.addEventListener("click", () => {
    if (state.path.length < 2) { pathInfo.textContent = c.path.none; return; }
    const steps = pathSteps(state.path, api.layerValues(), grid);
    begin("path", steps, { points: state.path.length, totalKm: pathLength() });
  });
  clearPath.addEventListener("click", () => { state.path = []; refreshPath(); });
  undoPath.addEventListener("click", () => { state.path.pop(); refreshPath(); });
  const pathPanel = h(document, "section", { class: "panel", "aria-labelledby": "st-path-title" }, h(document, "h2", { id: "st-path-title", text: c.path.title }),
    h(document, "p", { class: "st-ask" }, c.tools.help.path, infoIcon(document, c.path.profileNote.replace("{step}", PATH_STEP_KM))), h(document, "div", { class: "st-tools-row" }, playPath, undoPath, clearPath), pathInfo, el.profile);

  // Profile chart: the real cell values along the path on the same fixed log scale as the colours.
  function renderProfile() {
    el.profile.replaceChildren();
    if (state.path.length < 2) return;
    const steps = pathSteps(state.path, api.layerValues(), grid);
    const W = 300;
    const H = 90;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "st-profile-svg");
    svg.setAttribute("role", "img");
    const known = steps.filter((s) => s.value !== null);
    svg.setAttribute("aria-label", c.path.profile + ": " + (known.length ? `${api.fmt(Math.min(...known.map((s) => s.value)))} – ${api.fmt(Math.max(...known.map((s) => s.value)))}` : c.understand.missing));
    const total = steps.at(-1).distanceKm || 1;
    const x = (s) => 4 + (s.distanceKm / total) * (W - 8);
    const y = (v) => H - 6 - valueT(v) * (H - 12);
    const make = (name, attrs) => { const n = document.createElementNS("http://www.w3.org/2000/svg", name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; };
    let d = "";
    let drawing = false;
    for (const s of steps) {
      if (s.value === null) { drawing = false; svg.append(make("rect", { x: x(s) - 2, y: 4, width: 4, height: H - 10, class: "missing" })); continue; }
      d += (drawing ? "L" : "M") + x(s).toFixed(1) + " " + y(s.value).toFixed(1);
      drawing = true;
    }
    svg.append(make("path", { d, class: "line" }));
    svg.append(make("line", { x1: 4, x2: 4, y1: 4, y2: H - 4, class: "marker", id: "st-profile-marker" }));
    el.profile.append(h(document, "h3", { text: c.path.profile }), svg);
    state.profileSteps = steps; state.profileX = x;
  }
  state.onProgress = (run) => {
    if (run.kind !== "path") return;
    const marker = el.profile.querySelector("#st-profile-marker");
    if (marker && state.profileX) { const x = state.profileX(run.steps[run.stepIndex]); marker.setAttribute("x1", x); marker.setAttribute("x2", x); }
  };
  state.dataHooks.push(() => { renderProfile(); if (state.run && !state.run.finished) stopRun(true); });

  // Keyboard drawing.
  state.onKeyExtra.push((event) => {
    if (event.key === "Escape") { if (state.run) { stopRun(true); return true; } if (state.tool === "area") { state.rect = null; state.cornerA = null; api.invalidate(); return true; } if (state.tool === "path") { state.path = []; refreshPath(); return true; } return false; }
    if (event.key === "Enter" && state.cursor) {
      const centre = cellCenter(grid, state.cursor.row, state.cursor.col);
      if (state.tool === "area") {
        event.preventDefault();
        if (!state.cornerA || state.rect) { state.cornerA = centre; state.rect = null; } else { state.rect = rectBetween(state.cornerA, centre); state.cornerA = null; announceRect(); }
        api.invalidate();
        return true;
      }
      if (state.tool === "path") { event.preventDefault(); addPoint(centre); return true; }
    }
    if (event.key === "Backspace" && state.tool === "path" && state.path.length) { event.preventDefault(); state.path.pop(); refreshPath(); return true; }
    return false;
  });

  // ---- Overlay
  state.extraOverlay.push((overlay, svg, toScreen) => {
    const pt = (g) => toScreen(g.lon, g.lat);
    if (state.rect) {
      const a = toScreen(state.rect.west, state.rect.north);
      const b = toScreen(state.rect.east, state.rect.south);
      overlay.append(svg("rect", { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: "st-area" }));
    }
    if (state.cornerA) { const a = pt(state.cornerA); overlay.append(svg("circle", { cx: a.x, cy: a.y, r: 6, class: "st-corner" })); }
    if (state.path.length) {
      overlay.append(svg("polyline", { points: state.path.map((g) => { const s = pt(g); return `${s.x},${s.y}`; }).join(" "), class: "st-path" }));
      for (const g of state.path) { const s = pt(g); overlay.append(svg("circle", { cx: s.x, cy: s.y, r: 4, class: "st-vertex" })); }
    }
    const run = state.run;
    if (run?.current) {
      if (run.kind === "area" && run.current.index >= 0) {
        const r = cellRect(grid, run.current.row, run.current.col);
        const left = toScreen(run.rect.west, (r.north + r.south) / 2);
        const right = toScreen(run.rect.east, (r.north + r.south) / 2);
        overlay.append(svg("line", { x1: left.x, y1: left.y, x2: right.x, y2: right.y, class: "st-scanline" }));
        const a = toScreen(r.west, r.north);
        const b = toScreen(r.east, r.south);
        overlay.append(svg("rect", { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: "st-reading" }));
      } else if (run.kind === "path") {
        const s = toScreen(run.current.lon, run.current.lat);
        overlay.append(svg("circle", { cx: s.x, cy: s.y, r: 9, class: "st-progress" }));
      }
    }
  });

  state.right.insertBefore(runPanel, state.right.children[1]);
  state.right.insertBefore(areaPanel, runPanel);
  state.right.insertBefore(pathPanel, runPanel);
  Object.assign(api.panels, { area: areaPanel, path: pathPanel, run: runPanel });
  Object.assign(api, { setTool, playArea, playVisible: () => playArea(visibleRect()), stopRun, begin, pathSteps: () => pathSteps(state.path, api.layerValues(), grid), addPoint, refreshPath });
  return api;
}
