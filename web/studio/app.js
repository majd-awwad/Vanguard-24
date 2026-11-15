import { createStudioMap } from "./map.js?v=5";
import { loadStudioManifest, serpentinePath } from "./data.js";
import { createStudioSonifier, mapStudioSample, STUDIO_MAPPING_VERSION } from "../audio/studio-sonification.js";
import { createStudioPlayback } from "./playback.js";
import { createTranslator } from "./i18n.js";
import { drawProfile } from "./profile.js";

const byId = (id) => document.getElementById(id);
const initialLanguage = new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en";
const translator = createTranslator(initialLanguage);
const sonifier = createStudioSonifier();
let map;
let manifest;
let selected;
let activeSample;
let compare = [];
let compareMode = false;
let route = [];
let sequence = [];
let sequenceCoordinates = [];
let sequenceKind = "";
let soundReady = false;
let hoverFrame;
let pendingHover;
let profileIndex = -1;

function t(key) { return translator.t(key); }
function number(value, digits = 3) {
  return new Intl.NumberFormat(translator.language, { maximumFractionDigits: digits, useGrouping: false }).format(value);
}
function coordinate(value, positive, negative) {
  return `${number(Math.abs(value), 3)}° ${value >= 0 ? positive : negative}`;
}
function announce(message) { byId("studio-live").textContent = message; }

function translate() {
  document.documentElement.lang = translator.language;
  document.documentElement.dir = translator.language === "ar" ? "rtl" : "ltr";
  for (const element of document.querySelectorAll("[data-i18n]")) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll("[data-i18n-aria]")) element.setAttribute("aria-label", t(element.dataset.i18nAria));
  byId("studio-language").textContent = t("lang");
  byId("studio-map").setAttribute("aria-label", `${t("title")}. ${t("keyboard")}`);
  renderInspector(activeSample ?? selected);
  renderComparison();
  renderPlayback(playback.snapshot());
  const url = new URL(location.href);
  url.searchParams.set("lang", translator.language);
  history.replaceState(null, "", url);
}

function directionKey(sample) {
  return sample?.changeDirection === "increase" ? "increase" : sample?.changeDirection === "decrease" ? "decrease" :
    sample?.changeDirection === "stable" ? "stable" : sample?.changeDirection === "annual-brightness" ? "annual" : "noSignal";
}

function renderInspector(sample) {
  const empty = byId("inspector-empty");
  const content = byId("inspector-content");
  empty.hidden = Boolean(sample);
  content.hidden = !sample;
  if (!sample) return;
  activeSample = sample;
  byId("inspect-lon").textContent = coordinate(sample.longitude, "E", "W");
  byId("inspect-lat").textContent = coordinate(sample.latitude, "N", "S");
  for (const id of ["inspect-2012", "inspect-2023", "inspect-delta"]) byId(id).textContent = t("unavailable");
  byId("inspect-brightness").textContent = `${number(sample.renderedBrightness * 100, 1)}%`;
  byId("inspect-strength").textContent = `${number(sample.visualMagnitude * 100, 1)}%`;
  byId("inspect-direction").textContent = t(directionKey(sample));
  byId("inspect-quality").textContent = t("qualityReference");
  const mapping = mapStudioSample(sample, { mode: byId("sound-filter").value });
  byId("inspect-audio").textContent = mapping.audible
    ? `${mapping.direction} · ${number(mapping.frequencyHz, 1)} Hz · gain ${number(mapping.gain, 3)} · ${STUDIO_MAPPING_VERSION}`
    : `${t("noSignal")} · ${STUDIO_MAPPING_VERSION}`;
  byId("inspect-pixel").textContent = `RGB ${sample.referencePixel.r}, ${sample.referencePixel.g}, ${sample.referencePixel.b}`;
}

function setSelected(sample, { hover = false } = {}) {
  if (!sample) {
    if (hover && soundReady && playback.snapshot().status !== "playing") sonifier.stop();
    return;
  }
  if (!hover) selected = sample;
  renderInspector(sample);
  map.setCursor(sample, playback.snapshot().status === "playing");
}

function panForSample(sample) {
  if (!sequenceCoordinates.length) return 0;
  const west = Math.min(...sequenceCoordinates.map((point) => point.longitude));
  const east = Math.max(...sequenceCoordinates.map((point) => point.longitude));
  return west === east ? 0 : ((sample.longitude - west) / (east - west) * 2 - 1) * 0.42;
}

const playback = createStudioPlayback({
  onStep(sample, index) {
    profileIndex = index;
    setSelected(sample);
    map.setCursor(sample, true);
    sonifier.update(sample, { pan: panForSample(sample) });
    drawProfile(byId("path-profile"), sequence, profileIndex);
  },
  onState(state) {
    renderPlayback(state);
    if (state.status === "ended" || state.status === "idle") sonifier.stop();
  },
});

function renderPlayback(state) {
  if (!byId("playback-progress")) return;
  byId("playback-progress").value = Math.round(state.progress * 1000);
  byId("playback-progress").disabled = state.count === 0;
  byId("transport-play").disabled = state.count === 0 || state.status === "playing";
  byId("transport-pause").disabled = state.status !== "playing";
  byId("transport-restart").disabled = state.count === 0;
  const statusKey = state.status === "ended" ? "complete" : state.status === "playing" ? "playing" : state.status === "paused" ? "paused" : "ready";
  byId("playback-status").textContent = `${sequenceKind ? t(sequenceKind) : t("ready")} · ${t(statusKey)}${state.count ? ` · ${Math.max(0, state.index + 1)}/${state.count}` : ""}`;
}

async function ensureSound() {
  if (soundReady) return true;
  try {
    await sonifier.enable();
    soundReady = true;
    byId("enable-sound").querySelector("[data-i18n]").textContent = t("soundOn");
    byId("enable-sound").dataset.enabled = "true";
    announce(t("soundOn"));
    return true;
  } catch {
    byId("enable-sound").querySelector("[data-i18n]").textContent = t("soundUnavailable");
    announce(t("soundUnavailable"));
    return false;
  }
}

function hover(sample, position) {
  pendingHover = { sample, position };
  if (hoverFrame !== undefined) return;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = undefined;
    const next = pendingHover;
    pendingHover = undefined;
    if (!next?.sample || playback.snapshot().status === "playing" || map.mode !== "navigate") {
      if (!next?.sample) sonifier.stop();
      return;
    }
    setSelected(next.sample, { hover: true });
    if (soundReady) sonifier.update(next.sample, { pan: (next.position * 2 - 1) * 0.32 });
  });
}

function choose(sample) {
  if (!sample) return;
  if (compareMode) {
    if (compare.length >= 2) compare = [];
    compare.push(sample);
    map.setCompare(compare);
    renderComparison();
    announce(compare.length === 1 ? t("chooseB") : t("compareTitle"));
    return;
  }
  selected = sample;
  setSelected(sample);
  if (soundReady) sonifier.update(sample);
}

function loadSequence(samples, coordinates, kind, slotSeconds = 0.18) {
  sequence = samples.filter(Boolean);
  sequenceCoordinates = coordinates.filter((_, index) => samples[index]);
  sequenceKind = kind;
  profileIndex = -1;
  playback.load(sequence, { label: kind, slotSeconds });
  drawProfile(byId("path-profile"), sequence, -1);
}

async function playVisible() {
  await ensureSound();
  const bounds = map.getVisibleBounds();
  const coordinates = serpentinePath(bounds, innerWidth < 650 ? 14 : 22, innerWidth < 650 ? 8 : 10);
  const samples = map.samplePath(coordinates);
  map.setScanPath(coordinates);
  loadSequence(samples, coordinates, "scan", 0.15);
  playback.play();
  announce(`${t("scanAnnounce")}. ${t("layerLocked")}`);
}

function routeCompleted(points) {
  route = points;
  const samples = map.samplePath(route);
  map.setScanPath([]);
  loadSequence(samples, route, "trail", 0.18);
  map.setMode("navigate");
  byId("draw-path").setAttribute("aria-pressed", "false");
  byId("path-empty").hidden = true;
  byId("path-tools").hidden = false;
  announce(t("pathAnnounce"));
}

async function previewSample(sample) {
  if (!sample || !(await ensureSound())) return;
  sonifier.update(sample);
  setSelected(sample);
  setTimeout(() => { if (playback.snapshot().status !== "playing") sonifier.stop(); }, 850);
}

function renderComparison() {
  const status = byId("compare-status");
  const table = byId("compare-table");
  status.textContent = compare.length === 0 ? t("chooseA") : compare.length === 1 ? t("chooseB") : t("compareTitle");
  table.hidden = compare.length < 2;
  if (compare.length < 2) return;
  for (const [index, sample] of compare.entries()) {
    const prefix = index === 0 ? "a" : "b";
    byId(`compare-${prefix}-coord`).textContent = `${coordinate(sample.latitude, "N", "S")} · ${coordinate(sample.longitude, "E", "W")}`;
    byId(`compare-${prefix}-class`).textContent = t(directionKey(sample));
    byId(`compare-${prefix}-value`).textContent = `${number(sample.visualMagnitude * 100, 1)}%`;
  }
}

function setLayer(next) {
  map.setLayer(next);
  for (const button of document.querySelectorAll("button[data-layer]")) button.setAttribute("aria-pressed", String(button.dataset.layer === next));
  if (selected) selected = map.sampleAt(selected.longitude, selected.latitude);
  if (selected) setSelected(selected);
  if (route.length) routeCompleted(route);
  if (compare.length) {
    compare = compare.map((sample) => map.sampleAt(sample.longitude, sample.latitude));
    map.setCompare(compare);
    renderComparison();
  }
}

function saveRoute() {
  if (!route.length) return;
  const payload = {
    schema: "earthpulse-studio-session-v1",
    source: manifest.schema,
    layer: map.layer,
    mappingVersion: STUDIO_MAPPING_VERSION,
    speed: Number(byId("playback-speed").value),
    coordinates: route.map(({ longitude, latitude }) => [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))]),
  };
  localStorage.setItem("earthpulse-studio-session", JSON.stringify(payload));
  announce(t("saved"));
}

function restoreRoute() {
  try {
    const payload = JSON.parse(localStorage.getItem("earthpulse-studio-session"));
    if (payload?.schema !== "earthpulse-studio-session-v1" || !Array.isArray(payload.coordinates)) return;
    setLayer(payload.layer ?? "change");
    route = payload.coordinates.map(([longitude, latitude]) => ({ longitude, latitude }));
    map.setRoute(route);
    byId("playback-speed").value = String(payload.speed ?? 1);
    playback.setSpeed(Number(byId("playback-speed").value));
    routeCompleted(route);
    announce(t("restored"));
  } catch { /* A corrupt local session is ignored. */ }
}

function bind() {
  byId("studio-language").addEventListener("click", () => {
    translator.language = translator.language === "en" ? "ar" : "en";
    translate();
  });
  for (const button of document.querySelectorAll("button[data-layer]")) button.addEventListener("click", () => setLayer(button.dataset.layer));
  byId("enable-sound").addEventListener("click", ensureSound);
  byId("play-visible").addEventListener("click", playVisible);
  byId("draw-path").addEventListener("click", () => {
    const active = map.mode !== "draw";
    map.setMode(active ? "draw" : "navigate");
    byId("draw-path").setAttribute("aria-pressed", String(active));
    announce(active ? t("drawHelp") : t("probeMode"));
  });
  byId("compare-mode").addEventListener("click", () => {
    compareMode = !compareMode;
    byId("compare-mode").setAttribute("aria-pressed", String(compareMode));
    map.setMode("navigate");
    announce(compareMode ? t(compare.length ? "chooseB" : "chooseA") : t("probeMode"));
  });
  byId("clear-path").addEventListener("click", () => {
    route = []; sequence = []; sequenceCoordinates = []; sequenceKind = "";
    map.clearRoute(); map.setScanPath([]); playback.stop(); sonifier.stop();
    byId("path-empty").hidden = false; byId("path-tools").hidden = true;
    drawProfile(byId("path-profile"), []);
  });
  byId("transport-play").addEventListener("click", async () => { await ensureSound(); playback.play(); });
  byId("transport-pause").addEventListener("click", () => { playback.pause(); sonifier.stop(); });
  byId("transport-restart").addEventListener("click", () => { playback.restart(); playback.play(); });
  byId("transport-stop").addEventListener("click", () => { playback.stop(); sonifier.stop(); map.setCursor(selected); });
  byId("playback-progress").addEventListener("input", (event) => playback.seek(Number(event.target.value) / 1000));
  byId("playback-speed").addEventListener("change", (event) => playback.setSpeed(Number(event.target.value)));
  byId("studio-volume").addEventListener("input", (event) => sonifier.setVolume(Number(event.target.value) / 100));
  byId("sound-filter").addEventListener("change", (event) => { sonifier.setMode(event.target.value); renderInspector(activeSample); });
  byId("repeat-path").addEventListener("change", (event) => playback.setRepeat(event.target.checked));
  byId("reverse-path").addEventListener("click", () => {
    route.reverse(); map.setRoute(route); routeCompleted(route);
  });
  byId("save-path").addEventListener("click", saveRoute);
  byId("hear-a").addEventListener("click", () => previewSample(compare[0]));
  byId("hear-b").addEventListener("click", () => previewSample(compare[1]));
  byId("hear-alternate").addEventListener("click", async () => {
    if (compare.length < 2) return;
    await ensureSound();
    const coordinates = [compare[0], compare[1], compare[0], compare[1]];
    loadSequence(coordinates, coordinates, "compareTitle", 0.72);
    playback.play();
  });
  byId("map-world").addEventListener("click", () => map.reset());
  byId("map-india").addEventListener("click", () => map.focus());
  byId("map-plus").addEventListener("click", () => map.zoom(1.35));
  byId("map-minus").addEventListener("click", () => map.zoom(1 / 1.35));
  byId("studio-map").addEventListener("keydown", (event) => {
    const actions = {
      ArrowLeft: () => map.move(-0.12, 0), ArrowRight: () => map.move(0.12, 0),
      ArrowUp: () => map.move(0, -0.12), ArrowDown: () => map.move(0, 0.12),
      "+": () => map.zoom(1.3), "=": () => map.zoom(1.3), "-": () => map.zoom(1 / 1.3),
      Enter: () => { const bounds = map.getVisibleBounds(); choose(map.sampleAt((bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2)); },
      s: playVisible, S: playVisible,
      d: () => byId("draw-path").click(), D: () => byId("draw-path").click(),
      " ": () => playback.snapshot().status === "playing" ? byId("transport-pause").click() : byId("transport-play").click(),
    };
    if (!actions[event.key]) return;
    event.preventDefault(); actions[event.key]();
  });
  byId("open-method").addEventListener("click", () => byId("method-dialog").showModal());
  byId("close-method").addEventListener("click", () => byId("method-dialog").close());
  window.addEventListener("resize", () => drawProfile(byId("path-profile"), sequence, profileIndex));
  window.addEventListener("pagehide", () => { playback.dispose(); sonifier.dispose(); map.dispose(); });
}

async function start() {
  manifest = await loadStudioManifest();
  map = await createStudioMap(byId("studio-map"), { onHover: hover, onSelect: choose, onDraw: routeCompleted });
  bind();
  setLayer("change");
  translate();
  byId("studio-loading").hidden = true;
  byId("studio-interface").hidden = false;
  byId("studio-map").focus({ preventScroll: true });
  const bounds = map.getVisibleBounds();
  selected = map.sampleAt((bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2);
  setSelected(selected);
  restoreRoute();
}

start().catch((error) => {
  console.error(error);
  byId("studio-loading").textContent = error.message;
  byId("studio-loading").dataset.error = "true";
});
