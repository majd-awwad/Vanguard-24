import { bandCount, loadFrame, totalsOf, shareOf } from "./science.js";
import { ceiling, gainFor, makeScore, scale, voices } from "./score.js";
import { createPlayer } from "./player.js";
import { createLanguage } from "./i18n.js";
import { createCanvas } from "./canvas.js";

const byId = id => document.getElementById(id);
const set = (id, value) => { byId(id).textContent = value; };
const lang = createLanguage();
const t = lang.say;
const display = (value, options) => new Intl.NumberFormat(lang.locale, options).format(value);
const percent = value => display(value, { style: "percent", maximumFractionDigits: 2 });
const number = value => display(value);
const status = byId("play-status");
const regionField = byId("region");
const first = byId("first"), second = byId("second");
const timeline = byId("slice");
const viewport = createCanvas({
  frame: byId("frame"), overlay: byId("overlays"), inset: byId("inset"),
  insetImage: byId("inset-image"), sweep: byId("sweep"),
  targets: byId("region-targets"), onSeek: setBand,
});

let source, active, muted = false, playback = "audio", phase = "ready", output = "silent";
let program = "single", tableRegion, missingImage = false;
const region = id => source.regions.find(item => item.id === id);
const compared = () => [region(first.value), region(second.value)];
const statusKey = () => phase === "playing" ? (output === "audio" ? "playing" : output) : phase;
const busy = () => ["playing", "starting"].includes(phase);

function renderStatus() {
  const label = (missingImage ? t("imageError") + " " : "") + t(statusKey());
  if (status.textContent !== label) status.textContent = label;
  byId("play").disabled = busy();
  byId("pause").disabled = !busy();
  byId("compare").disabled = first.value === second.value;
  set("mute", t(muted ? "unmute" : "mute"));
  byId("mute").setAttribute("aria-pressed", String(muted));
}

function eventLabel(region, index, band) {
  const bright = percent(shareOf(band, "bright")), dim = percent(shareOf(band, "dim"));
  return lang.arabic
    ? `${t(region.id)}، الشريط ${number(index + 1)} من ${number(bandCount)}. بنفسجي ${bright}، برتقالي ${dim}.`
    : `${t(region.id)}, band ${index + 1} of ${bandCount}. Purple ${bright}, orange ${dim}.`;
}

function renderTable(activeRegion) {
  set("table-caption", lang.arabic ? `قياسات البكسلات · ${t(activeRegion.id)}` : `Pixel measurements · ${t(activeRegion.id)}`);
  byId("data-rows").replaceChildren(...activeRegion.bands.map((band, index) => {
    const row = document.createElement("tr");
    const fractions = ["bright", "dim"].map(key => shareOf(band, key));
    const values = [
      number(index + 1),
      ...["bright", "dim"].map((key, index) => `${percent(fractions[index])} · ${number(band[key])}/${number(band.pixels)}`),
      ...["bright", "dim"].map((key, index) => `${number(voices[key].hz)} Hz · ${t("gain")} ${gainFor(fractions[index]).toFixed(3)}`),
    ];
    for (const [index, value] of [values[0], values[1], values[2], values.slice(3).join(" / ")].entries()) {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
  tableRegion = activeRegion.id;
}

function updateFocusMarks() {
  const key = active.region.id + ":" + active.index;
  for (const button of byId("fingerprints").querySelectorAll("button")) {
    if (button.dataset.band === key) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  }
  for (const [index, row] of [...byId("data-rows").rows].entries()) {
    if (index === active.index) row.setAttribute("aria-current", "true"); else row.removeAttribute("aria-current");
  }
}

function renderFrame(event) {
  if (active?.region.id !== event.region.id) missingImage = byId("nasa-frame").complete && byId("nasa-frame").naturalWidth === 0;
  active = event;
  const { region: activeRegion, index, counts } = event;
  viewport.render(event, source);
  regionField.value = activeRegion.id;
  timeline.value = index + 1;
  timeline.setAttribute("aria-valuetext", eventLabel(activeRegion, index, counts));
  set("current-slice", lang.arabic ? `الشريط ${number(index + 1)} من ${number(bandCount)}` : `Band ${index + 1} / ${bandCount}`);
  set("bright-value", percent(shareOf(counts, "bright")));
  set("dim-value", percent(shareOf(counts, "dim")));
  byId("bright-value").dataset.event = byId("dim-value").dataset.event = activeRegion.id + ":" + (index + 1);
  byId("previous").disabled = index === 0;
  byId("next").disabled = index === bandCount - 1;
  if (tableRegion !== activeRegion.id) renderTable(activeRegion);
  updateFocusMarks();
  renderStatus();
}

const meters = { bright: byId("bright-meter"), dim: byId("dim-meter") };
const player = createPlayer({
  onFrame: renderFrame,
  onStatus(state, mode) { phase = state; output = mode; renderStatus(); },
  onProgress(event, envelope) {
    for (const [key, meter] of Object.entries(meters)) meter.style.transform = `scaleX(${envelope * event.signals[key].gain / ceiling})`;
  },
});

function loadSingle(selected, index = 0) {
  program = "single";
  player.load(makeScore([selected]), index);
}

function setBand(index) {
  if (program === "single") player.seek(index);
  else loadSingle(active.region, index);
}

function renderComparison() {
  const selected = compared();
  const host = byId("fingerprints");
  if (selected[0] === selected[1]) {
    host.replaceChildren();
    set("compare-finding", t("same"));
    renderStatus();
    return;
  }
  const totals = selected.map(totalsOf);
  const [a, b] = selected.map((area, index) => {
    const value = totals[index];
    return lang.arabic
      ? `${t(area.id)}: بنفسجي ${percent(value.bright / value.pixels)} وبرتقالي ${percent(value.dim / value.pixels)}`
      : `${t(area.id)}: ${percent(value.bright / value.pixels)} purple and ${percent(value.dim / value.pixels)} orange`;
  });
  const dominant = totals.map(({ bright, dim }) => Math.sign(bright - dim));
  const finding = dominant[0] * dominant[1] < 0
    ? (lang.arabic ? "ينعكس اللون الغالب بين النافذتين." : "The dominant color reverses between the two windows.")
    : "";
  set("compare-finding", `${a}. ${b}.${finding ? " " + finding : ""}`);
  const plots = selected.map((area) => {
    const row = document.createElement("div");
    row.className = "fingerprint";
    const name = document.createElement("p");
    name.textContent = t(area.id);
    const bands = document.createElement("div");
    bands.className = "bands";
    bands.setAttribute("role", "group");
    bands.setAttribute("aria-label", t(area.id));
    for (const [index, counts] of area.bands.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "band-column";
      button.dataset.band = area.id + ":" + index;
      button.tabIndex = index === (active?.region.id === area.id ? active.index : 0) ? 0 : -1;
      button.setAttribute("aria-label", eventLabel(area, index, counts));
      for (const [key, className, property] of [["bright", "top", "--up"], ["dim", "bottom", "--down"]]) {
        const marker = document.createElement("i");
        marker.className = className;
        marker.setAttribute("aria-hidden", "true");
        button.style.setProperty(property, (50 * Math.min(1, shareOf(counts, key) / scale)) + "%");
        button.append(marker);
      }
      button.addEventListener("click", () => loadSingle(area, index));
      button.addEventListener("focus", () => {
        for (const child of bands.children) child.tabIndex = child === button ? 0 : -1;
      });
      button.addEventListener("keydown", event => {
        const targets = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: bandCount - 1 };
        if (!Object.hasOwn(targets, event.key)) return;
        event.preventDefault();
        bands.children[Math.max(0, Math.min(bandCount - 1, targets[event.key]))].focus();
      });
      bands.append(button);
    }
    row.append(name, bands);
    return row;
  });
  host.replaceChildren(...plots);
  if (active) updateFocusMarks();
  renderStatus();
}

function options(field, selected) {
  field.replaceChildren(...source.regions.map(({ id }) => new Option(t(id), id)));
  field.value = selected;
}

function enter(silent) {
  playback = silent ? "silent" : "audio";
  byId("use-audio").checked = !silent;
  if (source && busy()) player.pause();
  byId("lab-title").focus({ preventScroll: true });
  byId("lab").scrollIntoView({ block: "start" });
  if (!silent && source) player.play(playback);
}

byId("language").addEventListener("click", () => {
  lang.toggle();
  if (!source) {
    if (!byId("retry").hidden) set("loading", t("error"));
    return;
  }
  options(regionField, regionField.value);
  options(first, first.value);
  options(second, second.value);
  tableRegion = undefined;
  viewport.placeRegions(source, t, loadSingle);
  renderComparison();
  renderFrame(active);
});

byId("listen").addEventListener("click", () => enter(false));
byId("silent-entry").addEventListener("click", (event) => {
  event.preventDefault();
  enter(true);
});
byId("play").addEventListener("click", () => player.play(playback));
byId("pause").addEventListener("click", () => player.pause());
byId("replay").addEventListener("click", () => {
  if (program === "single") loadSingle(active.region);
  else player.load(makeScore(compared()));
  player.play(playback);
});
byId("mute").addEventListener("click", () => {
  muted = !muted;
  player.setMuted(muted);
  renderStatus();
});
regionField.addEventListener("change", () => loadSingle(region(regionField.value)));
timeline.addEventListener("input", () => setBand(Number(timeline.value) - 1));
byId("previous").addEventListener("click", () => setBand(active.index - 1));
byId("next").addEventListener("click", () => setBand(active.index + 1));
byId("compare").addEventListener("click", () => {
  program = "compare";
  player.load(makeScore(compared()));
  player.play(playback);
});
for (const field of [first, second]) field.addEventListener("change", () => {
  if (program === "compare") loadSingle(active.region, active.index);
  renderComparison();
});
byId("volume").addEventListener("input", event => player.setVolume(Number(event.target.value) / 100));
byId("speed").addEventListener("change", event => player.setSpeed(Number(event.target.value)));
byId("stereo").addEventListener("change", event => player.setStereo(event.target.checked));
byId("use-audio").addEventListener("change", event => {
  playback = event.target.checked ? "audio" : "silent";
  if (busy()) {
    player.pause();
    player.play(playback);
  }
});
for (const id of ["nasa-frame", "inset-image"]) {
  byId(id).addEventListener("error", () => { missingImage = true; renderStatus(); });
}
window.addEventListener("pagehide", () => { if (busy()) player.pause(); });

async function initialize() {
  byId("retry").hidden = true;
  try {
    source = await loadFrame();
    options(regionField, "europe");
    options(first, "europe");
    options(second, "india");
    byId("instrument").hidden = false;
    byId("loading").hidden = true;
    byId("listen").disabled = false;
    viewport.placeRegions(source, t, loadSingle);
    loadSingle(region("europe"));
    renderComparison();
  } catch {
    byId("loading").hidden = false;
    set("loading", t("error"));
    byId("retry").hidden = false;
  }
}
byId("retry").addEventListener("click", initialize);
initialize();
