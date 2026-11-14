import { createTransport } from "../../audio/transport.js";
import { makeSpatialPlan, mappingVersion } from "../../audio/spatial-plan.js";
import { loadDecodeCase } from "../../sources/decode/index.js";
import { createAudioTap, drawWaveform } from "../audio-tap.js";
import { drawSpectrogramColumn } from "./audio-viz.js";
import { cellBounds, cellId, fill, formatLat, formatLon, textureCrop, trimNumber } from "./cells.js";
import { h } from "./dom.js";
import { mountNav } from "./nav.js";
import { allowSpoilersThisVisit, spoilersUnlocked } from "./progress.js";
import { loadSettings, saveSettings } from "./settings.js";
import { soundCopy } from "./sound-copy.js";

export const CASE_ID = "dust-geos-fp-20250819-1930-north-africa-med";
const TEXTURE = "../assets/earth/blue-marble-4096.jpg";
export const SPECTROGRAM_MAX_HZ = 4000;

/** Pan -1..1 to a word; the number is shown beside it. */
export const panWord = (pan, c) => (pan < -0.2 ? c.output.left : pan > 0.2 ? c.output.right : c.output.centre);

/** The calibration facts, read from the real legend plan (never typed). */
export function calibration(data, level = "quick") {
  const plan = makeSpatialPlan(data, { level, mode: "legend" });
  const byLabel = Object.fromEntries(plan.events.map((event) => [event.evidence.calibration, event.tone]));
  return {
    left: byLabel.left.pan, right: byLabel.right.pan,
    high: byLabel["high-pitch"].frequencyHz, low: byLabel["low-pitch"].frequencyHz,
    quiet: byLabel.quiet.gain, loud: byLabel.loud.gain,
    behavior: data.behavior, plan,
  };
}

/** Sound properties of one cell, read from the real plan event. `tone` is null when the cell is silent. */
export function cellSound(data, level, row, col) {
  const plan = makeSpatialPlan(data, { level, mode: "cell", cells: [[row, col]] });
  const [event] = plan.events;
  return { plan, event, tone: event.tone, evidence: event.evidence };
}

function lookup(data, level, row, col) {
  return data.levels[level].cells.find((cell) => cell.row === row && cell.col === col);
}

export async function startSound(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "sound", from: "pages" });
  const c = soundCopy[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("sound-root");
  const load = async () => {
    root.replaceChildren(h(document, "p", { class: "status", role: "status", text: c.loading }));
    try {
      const data = await loadDecodeCase(CASE_ID);
      render(document, root, data, language);
    } catch (error) {
      console.error(error);
      const retry = h(document, "button", { type: "button", class: "button", text: c.retry });
      retry.addEventListener("click", load);
      root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: c.error }), retry);
    }
  };
  await load();
}

function render(document, root, data, language) {
  const c = soundCopy[language];
  const settings = loadSettings();
  const tap = createAudioTap();
  const transport = createTransport({ createContext: () => tap.createContext() });
  transport.setVolume(settings.volume);
  transport.setSpeed(settings.speed);
  const cal = calibration(data);
  const state = { level: "quick", cell: null, unlocked: spoilersUnlocked(), mode: null };
  const el = {};

  // Hero
  const hero = h(document, "section", { class: "sound-intro" },
    h(document, "p", { class: "eyebrow", text: c.eyebrow }),
    h(document, "h1", {}, c.titleLead + " ", h(document, "em", { text: c.titleAccent })),
    h(document, "p", { class: "lede", text: c.lede }));

  // Grid
  const levelPicker = h(document, "fieldset", { class: "level-picker" }, h(document, "legend", { text: c.levelLabel }));
  for (const level of ["quick", "advanced"]) {
    const input = h(document, "input", { type: "radio", name: "sound-level", id: "sound-level-" + level, value: level, checked: level === state.level });
    input.addEventListener("change", () => { state.level = level; state.cell = null; transport.pause(); drawGrid(); renderDetails(); });
    levelPicker.append(h(document, "label", { for: input.id }, input, h(document, "span", { text: c[level] + " " + data.levels[level].rows + "×" + data.levels[level].cols })));
  }
  el.grid = h(document, "div", { class: "sound-grid", role: "grid", "aria-label": c.gridLabel, dir: "ltr" });
  el.plate = h(document, "div", { class: "sound-plate" }, el.grid);
  const crop = textureCrop(data.bounds);
  el.plate.style.cssText = `aspect-ratio:${crop.aspect};background-image:url("${TEXTURE}");background-size:${crop.sizeX}% ${crop.sizeY}%;background-position:${crop.posX}% ${crop.posY}%`;
  const compass = h(document, "div", { class: "sound-compass", dir: "ltr", "aria-hidden": "true" },
    h(document, "span", { class: "w", text: "← " + c.west }), h(document, "span", { class: "n", text: "↑ " + c.north }), h(document, "span", { class: "e", text: c.east + " →" }));
  const south = h(document, "div", { class: "sound-compass south", dir: "ltr", "aria-hidden": "true" }, h(document, "span", { text: "↓ " + c.south }));
  const gridPanel = h(document, "section", { class: "panel sound-map", "aria-labelledby": "sound-grid-title" },
    h(document, "h2", { id: "sound-grid-title", text: c.gridTitle }), levelPicker, h(document, "div", { class: "sound-map-frame" }, compass, el.plate, south),
    h(document, "p", { class: "small", id: "sound-grid-help", text: c.gridHelp }));

  function describe(row, col) {
    const b = cellBounds(data.bounds, data.levels[state.level], row, col);
    return { b, id: cellId(row, col) };
  }

  function drawGrid() {
    const { rows, cols } = data.levels[state.level];
    el.grid.style.cssText = `grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)`;
    el.grid.replaceChildren();
    for (let row = 0; row < rows; row++) {
      const rowNode = h(document, "div", { class: "sound-row", role: "row" });
      for (let col = 0; col < cols; col++) {
        const { b, id } = describe(row, col);
        const selected = state.cell?.row === row && state.cell?.col === col;
        const first = state.cell ? selected : row === 0 && col === 0;
        const button = h(document, "button", {
          type: "button", role: "gridcell", class: "sound-cell", tabindex: first ? "0" : "-1", "aria-selected": selected, "aria-describedby": "sound-grid-help",
          "aria-label": fill(c.cellLabel, { id, lat: formatLat(b.north) + " – " + formatLat(b.south), lon: formatLon(b.west) + " – " + formatLon(b.east) }),
          "data-row": row, "data-col": col, text: id,
        });
        rowNode.append(button);
      }
      el.grid.append(rowNode);
    }
  }
  el.grid.addEventListener("click", (event) => {
    const button = event.target.closest(".sound-cell");
    if (button) choose(Number(button.dataset.row), Number(button.dataset.col), true);
  });
  const steps = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  el.grid.addEventListener("keydown", (event) => {
    const button = event.target.closest(".sound-cell");
    if (!button) return;
    const { rows, cols } = data.levels[state.level];
    let row = Number(button.dataset.row);
    let col = Number(button.dataset.col);
    if (steps[event.key]) {
      // Geography never mirrors: ArrowLeft always means west, even in Arabic.
      row = Math.max(0, Math.min(rows - 1, row + steps[event.key][0]));
      col = Math.max(0, Math.min(cols - 1, col + steps[event.key][1]));
    } else if (event.key === "Home") col = 0;
    else if (event.key === "End") col = cols - 1;
    else return;
    event.preventDefault();
    for (const cell of el.grid.querySelectorAll(".sound-cell")) cell.tabIndex = -1;
    const next = el.grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    next.tabIndex = 0;
    next.focus();
  });

  // Player
  el.state = h(document, "span", { class: "player-state", role: "status" });
  el.time = h(document, "span", { class: "player-time ltr" });
  el.label = h(document, "span", { class: "player-cell", text: c.player.none });
  const playButton = h(document, "button", { type: "button", class: "button", text: c.player.play });
  const rowButton = h(document, "button", { type: "button", class: "button ghost", text: c.player.row });
  const legendButton = h(document, "button", { type: "button", class: "button ghost", text: c.player.legend });
  const stopButton = h(document, "button", { type: "button", class: "button ghost", text: c.player.stop });
  el.volume = h(document, "input", { type: "range", min: 0, max: 100, step: 1, value: Math.round(settings.volume * 100), id: "sound-volume" });
  el.wave = h(document, "canvas", { width: 640, height: 90, role: "img", "aria-label": c.player.wave + ". " + c.player.flat });
  el.spec = h(document, "canvas", { width: 640, height: 120, role: "img", "aria-label": fill(c.player.spectrogram, { maxHz: SPECTROGRAM_MAX_HZ }) });
  el.spec.getContext("2d")?.fillRect(0, 0, 0, 0);
  el.captions = h(document, "p", { class: "captions", id: "sound-captions", role: "status", "aria-live": "polite" });
  el.captions.classList.toggle("visually-hidden", !settings.captions);
  const playerPanel = h(document, "section", { class: "panel sound-player", "aria-labelledby": "sound-player-title" },
    h(document, "h2", { id: "sound-player-title", text: c.player.title }),
    h(document, "div", { class: "player-line" }, el.label, el.state, el.time),
    h(document, "div", { class: "player-buttons" }, playButton, rowButton, legendButton, stopButton),
    h(document, "label", { class: "volume", for: "sound-volume" }, h(document, "span", { text: c.player.volume }), el.volume),
    el.wave, el.spec, el.captions);

  // Details + output
  el.details = h(document, "section", { class: "panel sound-details", "aria-labelledby": "sound-details-title" });
  el.output = h(document, "section", { class: "panel sound-output", "aria-labelledby": "sound-output-title" });

  // How it works + rules (from the real calibration plan)
  const how = h(document, "section", { class: "panel sound-how" }, h(document, "h2", { text: c.how.title }));
  const flow = h(document, "ol", { class: "flow" });
  for (const [title, text] of c.how.steps) flow.append(h(document, "li", {}, h(document, "h3", { text: title }), h(document, "p", { text: text })));
  how.append(flow);
  const rules = h(document, "section", { class: "panel sound-rules" }, h(document, "h2", { text: c.rules.title }),
    h(document, "p", { class: "small", text: fill(c.rules.note, { version: mappingVersion }) }));
  const list = h(document, "ul", { class: "rules" });
  const hz = (value) => trimNumber(value, 0);
  const rule = (title, detail) => list.append(h(document, "li", {}, h(document, "h3", { text: title }), h(document, "p", { text: detail })));
  rule(c.rules.pan, fill(c.rules.panDetail, { left: trimNumber(cal.left, 2), right: "+" + trimNumber(cal.right, 2) }));
  rule(c.rules.pitch, fill(c.rules.pitchDetail, { high: hz(cal.high), low: hz(cal.low) }));
  rule(c.rules.loudness, fill(c.rules.loudnessDetail, { quiet: trimNumber(cal.quiet, 3), loud: trimNumber(cal.loud, 3) }));
  rule(c.rules.voice, fill(c.rules.voiceDetail, { behavior: cal.behavior === "continuous" ? c.rules.voiceContinuous : c.rules.voiceIntermittent }));
  rules.append(list, h(document, "p", { class: "small", text: c.rules.scaleNote }));

  root.replaceChildren(hero, h(document, "div", { class: "sound-grid-layout" }, gridPanel, playerPanel),
    h(document, "div", { class: "sound-two" }, el.details, el.output), h(document, "div", { class: "sound-two" }, how, rules),
    h(document, "p", { class: "credit", text: c.credit }));

  function renderDetails() {
    const cell = state.cell;
    const details = [h(document, "h2", { id: "sound-details-title", text: c.details.title })];
    const output = [h(document, "h2", { id: "sound-output-title", text: c.output.title })];
    if (!cell) {
      details.push(h(document, "p", { text: c.details.none }));
      output.push(h(document, "p", { text: c.details.none }));
      el.label.textContent = c.player.none;
    } else {
      const { b, id } = describe(cell.row, cell.col);
      el.label.textContent = c.player.selected + ": " + id;
      const dl = h(document, "dl", { class: "kv" });
      dl.append(h(document, "dt", { text: c.details.id }), h(document, "dd", { text: id }),
        h(document, "dt", { text: c.details.location }), h(document, "dd", { class: "ltr", text: fill(c.details.bounds, { south: formatLat(b.south), north: formatLat(b.north), west: formatLon(b.west), east: formatLon(b.east) }) }));
      if (state.unlocked) {
        const record = lookup(data, state.level, cell.row, cell.col);
        const threshold = data.levels[state.level].truth.threshold;
        dl.append(h(document, "dt", { text: c.details.value }), h(document, "dd", { class: "ltr", text: record.value === null ? "—" : trimNumber(record.value, 3) }),
          h(document, "dt", { text: c.details.threshold }), h(document, "dd", { text: fill(record.status === "measured" ? c.details.above : c.details.below, { threshold }) }));
        details.push(dl);
      } else {
        const show = h(document, "button", { type: "button", class: "button ghost", text: c.details.show });
        show.addEventListener("click", () => { allowSpoilersThisVisit(); state.unlocked = true; renderDetails(); });
        details.push(dl, h(document, "p", { class: "callout", text: c.details.locked }), show);
      }
      const sound = cellSound(data, state.level, cell.row, cell.col);
      const out = h(document, "dl", { class: "kv" });
      if (!sound.tone) {
        output.push(h(document, "p", { text: c.output.silent }));
      } else {
        out.append(h(document, "dt", { text: c.output.frequency }), h(document, "dd", { class: "ltr", text: fill(c.output.hz, { value: hz(sound.tone.frequencyHz) }) }),
          h(document, "dt", { text: c.output.pan }), h(document, "dd", { text: panWord(sound.tone.pan, c) + " (" + trimNumber(sound.tone.pan, 2) + ")" }),
          h(document, "dt", { text: c.output.duration }), h(document, "dd", { class: "ltr", text: fill(c.output.seconds, { value: trimNumber(sound.tone.durationS, 2) }) + (sound.tone.pulses ? " · " + c.output.crackle : "") }),
          h(document, "dt", { text: c.output.loudness }),
          h(document, "dd", { class: state.unlocked ? "ltr" : "", text: state.unlocked ? trimNumber(sound.tone.gain, 3) : c.output.lockedGain }));
        output.push(out);
      }
    }
    el.details.replaceChildren(...details);
    el.output.replaceChildren(...output);
  }

  function caption(text) {
    el.captions.textContent = text;
  }

  function choose(row, col, play) {
    state.cell = { row, col };
    drawGrid();
    renderDetails();
    el.grid.querySelector(`[data-row="${row}"][data-col="${col}"]`)?.focus();
    if (play) playCell();
  }

  function start(plan, message) {
    transport.pause();
    state.duration = plan.durationS;
    transport.load(plan);
    transport.play();
    caption(message);
  }
  function playCell() {
    if (!state.cell) { caption(c.player.needCell); return; }
    const sound = cellSound(data, state.level, state.cell.row, state.cell.col);
    state.mode = "cell";
    start(sound.plan, sound.tone ? fill(c.captions.playing, { id: cellId(state.cell.row, state.cell.col), hz: hz(sound.tone.frequencyHz), pan: panWord(sound.tone.pan, c) }) : c.output.silent);
  }
  playButton.addEventListener("click", playCell);
  rowButton.addEventListener("click", () => {
    if (!state.cell) { caption(c.player.needCell); return; }
    state.mode = "row";
    start(makeSpatialPlan(data, { level: state.level, mode: "row", row: state.cell.row }), fill(c.captions.row, { id: cellId(state.cell.row, 0).charAt(0) }));
  });
  legendButton.addEventListener("click", () => { state.mode = "legend"; start(cal.plan, c.captions.legend); });
  stopButton.addEventListener("click", () => { transport.pause(); caption(c.captions.stopped); });
  el.volume.addEventListener("input", () => { const volume = Number(el.volume.value) / 100; transport.setVolume(volume); saveSettings({ volume }); });

  transport.subscribe((snap) => {
    const label = snap.audioUnavailable && snap.status === "playing" ? c.player.silentMode : c.player.states[snap.status] ?? snap.status;
    el.state.textContent = label;
    el.time.textContent = trimNumber(snap.positionS, 1) + (state.duration ? " / " + trimNumber(state.duration, 1) : "") + " s";
    if (snap.status === "playing" && state.mode === "legend") {
      const event = cal.plan.events.findLast((ev) => ev.id === snap.activeEventId);
      if (event) caption(fill("{step}", { step: c.captions.legendStep[event.evidence.calibration] }));
    }
  });

  // Live waveform and spectrogram from the real analyser.
  let frame;
  const loop = () => {
    drawWaveform(el.wave, tap.analyser, { color: "#68e0d0" });
    drawSpectrogramColumn(el.spec, tap.analyser, { maxHz: SPECTROGRAM_MAX_HZ });
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = undefined; } else if (frame === undefined) frame = requestAnimationFrame(loop);
  });

  drawGrid();
  renderDetails();
  if (new URL(document.URL).searchParams.has("debug")) window.__sound = { transport, state, tap };
}
