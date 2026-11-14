import { sources, svsUrl } from "./sources/catalog.js";
import { loadOcean } from "./sources/ocean.js";
import { loadRain } from "./sources/rain.js";
import { loadFires, regionDetections } from "./sources/fires.js";
import { createTransport } from "./audio/transport.js";
import { makeTemporalPlan, slotSeconds } from "./audio/temporal-plan.js";
import { message } from "./i18n/platform-messages.js";
import { createAtlasMap, nearestSample, svg } from "./visual/atlas-map.js";
import { atmosphereFor } from "./audio/atmosphere.js";

const byId = (id) => document.getElementById(id);
const transport = createTransport();
transport.setVolume(0.54);
let language = new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en";
const t = (key) => message(language, key);
let data, plan, comparePlan, active, rendered, requested, failed = false, requestNumber = 0;
let sites = [];
let previewing = false;
let locationPlans = new Map();
const loaders = { ocean: loadOcean, rain: loadRain, fires: loadFires };
const cache = new Map();
const contextAssets = { ocean: "svs-5101.jpg", rain: "svs-4285.jpg", fires: "svs-5113.jpg" };
const siteOf = () => sites.find((site) => site.id === byId("site").value);
const comparisonOf = () => sites.find((site) => site.id === byId("compare-site").value);
const number = (value, digits = 2) => new Intl.NumberFormat(language, { maximumFractionDigits: digits, useGrouping: false }).format(value);
const display = (value, digits = 2) => value === null ? t("missing") : `${number(value, digits)} ${t(data.unit)}`;
const dateLabel = (time) => {
  const date = new Intl.DateTimeFormat(language, { month: "short", day: "numeric", timeZone: "UTC" });
  if (data.id === "fires") return date.formatRange(new Date(time.start), new Date(Date.parse(time.end) - 1));
  return date.format(new Date(time.start));
};
const scienceCopy = (suffix) => t(data.id + suffix);
const mode = () => byId("visual-only").checked ? "silent" : "audio";
const siteLabel = (site) => site.id.startsWith("cell:")
  ? `${number(site.lat)}°, ${number(site.lon)}°` : t(site.id);
const coords = ({ lat, lon }) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
const classification = (event) => event.value === null ? t("classMissing") : t({ ocean: "classOcean", rain: "classRain", fires: "classFires" }[data.id]);
const map = createAtlasMap(byId("data-map"), {
  onSelect(id) {
    if (byId("site").value === id) return;
    byId("site").value = id;
    chooseSite();
  },
  onZoom(scale) {
    byId("map-minus").disabled = scale <= 1;
    byId("map-plus").disabled = scale >= 5;
    byId("map-reset").disabled = scale <= 1;
    byId("map-pan").hidden = scale <= 1;
    byId("data-map").classList.toggle("is-zoomed", scale > 1);
  },
  onCoordinates(point) { text("map-coordinates", point ? coords(point) : ""); },
});

function mapSites(source) {
  if (source.kind === "windowed-events") return source.sites;
  const named = new Map(source.sites.map((site) => [`${site.lat},${site.lon}`, site.id]));
  const observed = source.cells.map((cell) => ({
    ...cell, id: named.get(`${cell.lat},${cell.lon}`) ?? `cell:${cell.lat},${cell.lon}`,
  }));
  const namedSites = source.sites.map(({ id }) => observed.find((site) => site.id === id));
  return [...namedSites, ...observed.filter((site) => site.id.startsWith("cell:"))];
}

function planFor(site) {
  if (!locationPlans.has(site.id)) locationPlans.set(site.id, makeTemporalPlan(data, site, byId("timbre").value));
  return locationPlans.get(site.id);
}

function text(id, value) { byId(id).textContent = value; }

function link(href, label, className = "") {
  const element = document.createElement("a");
  element.href = href;
  element.className = className;
  element.textContent = label;
  return element;
}

function urlWithLanguage(href) {
  const url = new URL(href, location.href);
  if (language === "ar") url.searchParams.set("lang", language);
  else url.searchParams.delete("lang");
  return url.href;
}

function renderPreview() {
  const source = sources.find(({ id }) => id === byId("preview-source").value);
  byId("preview-image").src = source.image;
  byId("preview-image").alt = `${t(source.id)} · ${t("context")}`;
  text("preview-caption", `${t(source.id)} · ${t("context")}`);
  byId("preview-credit").href = svsUrl(source);
  text("preview-credit", `NASA SVS ${source.svs} ↗`);
}

function renderAtlas() {
  const worlds = sources.map((source) => {
    const article = document.createElement("article");
    article.className = `world world-${source.id}`;
    article.style.setProperty("--world", source.color);
    const image = document.createElement("img");
    image.src = source.image;
    image.alt = "";
    image.loading = "lazy";
    const label = document.createElement("p");
    label.className = "world-product";
    label.textContent = `${source.product} · ${source.version}`;
    const title = document.createElement("h3");
    title.textContent = t(source.id);
    const detail = document.createElement("p");
    detail.textContent = t(`${source.id}Desc`);
    const status = document.createElement("p");
    status.className = "world-status";
    status.textContent = t(source.status);
    const body = document.createElement("div");
    body.className = "world-body";
    body.append(label, title, detail, status);
    if (source.range) {
      const dates = document.createElement("bdi");
      dates.className = "world-dates";
      dates.textContent = source.range;
      body.append(dates);
    }
    if (loaders[source.id]) {
      const open = link(urlWithLanguage(`?signal=${source.id}#lens`), t("open"), "text-action");
      open.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.pushState(null, "", open.href);
        show(source.id, true);
      });
      body.append(open);
    } else if (source.id === "forest") {
      body.append(link(urlWithLanguage("./forest.html"), t("open"), "text-action"));
    } else {
      body.append(link(svsUrl(source), t("view"), "text-action"));
    }
    article.append(image, body);
    return article;
  });
  byId("atlas-worlds").replaceChildren(...worlds);
}

function translate() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = `EARTHPULSE · ${t("atlas")}`;
  for (const element of document.querySelectorAll("[data-copy]")) {
    const lines = t(element.dataset.copy).split("|");
    element.replaceChildren(...lines.flatMap((line, index) => index ? [document.createElement("br"), line] : [line]));
  }
  for (const element of document.querySelectorAll("[data-alt]")) element.alt = t(element.dataset.alt);
  for (const element of document.querySelectorAll("[data-label]")) element.setAttribute("aria-label", t(element.dataset.label));
  byId("map-camera").setAttribute("aria-label", t("mapNavigation"));
  byId("map-pan").setAttribute("aria-label", t("mapPan"));
  for (const button of byId("map-pan").children) button.setAttribute("aria-label", t(button.dataset.mapLabel));
  byId("cinematic-entry").href = urlWithLanguage("./decode-3d.html");
  byId("forest-entry").href = urlWithLanguage("./forest.html");
  byId("flat-entry").href = urlWithLanguage("./decode.html");
  byId("dust-text-entry").href = urlWithLanguage("./decode.html?condition=text");
  byId("dust-path-guided").href = urlWithLanguage("./dust.html");
  byId("dust-path-observatory").href = urlWithLanguage("./dust-observatory.html");
  byId("dust-path-decode").href = urlWithLanguage("./decode.html");
  byId("language").lang = language === "ar" ? "en" : "ar";
  text("language", language === "ar" ? "English" : "العربية");
  const selection = byId("signal").value || "ocean";
  byId("signal").replaceChildren(...sources.filter(({ id }) => loaders[id] || id === "forest").map(({ id }) => new Option(t(id), id)));
  byId("signal").value = selection;
  const preview = byId("preview-source");
  const previewId = preview.value || "ocean";
  preview.replaceChildren(...sources.filter(({ id }) => loaders[id]).map(({ id }) => new Option(t(id), id)));
  preview.value = previewId;
  renderPreview();
  text("preview", t(previewing ? "previewStop" : "preview"));
  renderAtlas();
  text("load-message", t(failed ? "error" : "loading"));
  if (!data) return;
  renderLabels();
  rendered = undefined;
  render(transport.snapshot());
  if (byId("evidence").open) renderEvidence();
  if (!byId("mission-result").hidden) revealMission(false);
}

function siteOptions() {
  const main = byId("site");
  const compare = byId("compare-site");
  const primary = main.value;
  const secondary = compare.value;
  main.replaceChildren(...sites.map((site) => new Option(siteLabel(site), site.id)));
  main.value = sites.some(({ id }) => id === primary) ? primary : sites[0].id;
  compare.replaceChildren(new Option(t("none"), ""), ...sites.filter(({ id }) => id !== main.value).map((site) => new Option(siteLabel(site), site.id)));
  compare.value = secondary !== main.value && sites.some(({ id }) => id === secondary) ? secondary : "";
}

function renderLabels() {
  const ranges = { ocean: [12, 17, 22, 27, 32], rain: [0, 15, 30, 45, 60], fires: [0, 75, 150, 225, 300] };
  text("lens-title", t(data.id));
  text("map-title", scienceCopy("Map"));
  text("map-note", scienceCopy("MapNote"));
  text("reading-label", scienceCopy("Reading"));
  text("detective-title", scienceCopy("MissionTitle"));
  text("mission", scienceCopy("Mission"));
  text("mapping", scienceCopy("Mapping"));
  byId("atlas-atmosphere").hidden = data.id !== "rain";
  byId("atlas-atmosphere-note").hidden = data.id !== "rain";
  byId("map-search").hidden = data.kind === "windowed-events";
  text("coordinate-status", "");
  const context = byId("context-link");
  context.href = svsUrl(data.source);
  context.textContent = `NASA SVS ${data.source.svs} ↗`;
  byId("context-image").src = new URL(`./assets/atlas/${contextAssets[data.id]}`, import.meta.url);
  byId("context-image").alt = t(data.id);
  const dates = data.times.map((time, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const date = document.createElement("span");
    date.textContent = dateLabel(time);
    const value = document.createElement("bdi");
    value.className = "timeline-value";
    button.append(date, value);
    button.dataset.index = index;
    button.addEventListener("click", () => seek(index, true));
    return button;
  });
  byId("date-labels").replaceChildren(...dates);
  byId("date-scrub").max = data.times.length - 1;
  byId("map-legend").replaceChildren(...ranges[data.id].map((value, index, values) => {
    const item = document.createElement("span");
    item.style.setProperty("--swatch", sampleColor(value));
    const limit = index === values.length - 1 ? "≥ " : index === 0 && data.id === "ocean" ? "≤ " : "";
    item.textContent = `${limit}${number(value)} ${t(data.unit)}`;
    return item;
  }));
  if (data.kind !== "windowed-events") {
    const missing = document.createElement("span");
    missing.dataset.missing = "";
    missing.textContent = t("missing");
    byId("map-legend").append(missing);
  }
  siteOptions();
}

async function show(id, focus = false) {
  const request = ++requestNumber;
  window.speechSynthesis?.cancel();
  transport.pause();
  requested = id;
  failed = false;
  data = undefined;
  locationPlans = new Map();
  plan = undefined;
  comparePlan = undefined;
  byId("signal").value = id;
  byId("instrument").hidden = true;
  byId("retry-lens").hidden = true;
  byId("load-message").hidden = false;
  text("lens-title", t(id));
  text("load-message", t("loading"));
  if (focus) byId("lens-title").focus();
  try {
    const loaded = cache.get(id) ?? await loaders[id]();
    if (request !== requestNumber) return;
    data = loaded;
    sites = mapSites(loaded);
    cache.set(id, data);
    byId("lens").dataset.signal = id;
    byId("site").replaceChildren();
    byId("compare-site").replaceChildren();
    byId("mission-result").hidden = true;
    byId("reveal-mission").setAttribute("aria-expanded", "false");
    renderLabels();
    setPlan(0);
    byId("instrument").hidden = false;
    byId("load-message").hidden = true;
  } catch (error) {
    if (request !== requestNumber) return;
    console.error(error);
    failed = true;
    byId("retry-lens").hidden = false;
    text("load-message", t("error"));
  }
}

function setPlan(index) {
  comparePlan = undefined;
  plan = planFor(siteOf());
  rendered = undefined;
  transport.load(plan, plan.events[index].onsetS);
}

function seek(index, preview = false) {
  if (!plan || !plan.events[index]) return;
  if (comparePlan) setPlan(index);
  else transport.seek(plan.events[index].onsetS);
  if (preview) transport.play(mode(), slotSeconds - 0.002);
}

function play(replay = false) {
  if (comparePlan) setPlan(active.index);
  if (replay) transport.replay(mode());
  else transport.play(mode());
}

function sampleColor(value) {
  if (value === null) return "#54615e";
  if (data.id === "fires") return `hsl(${12 + Math.min(1, value / 300) * 35} 95% 65%)`;
  const rain = data.id === "rain";
  const normalized = Math.max(0, Math.min(1, rain ? value / 60 : (value - 12) / 20));
  return rain
    ? `hsl(${203 + normalized * 38} 82% ${63 + normalized * 24}%)`
    : `hsl(${197 - normalized * 168} 82% ${48 + normalized * 10}%)`;
}

function renderMap(event) {
  map.render({
    data, event, sites, comparisonId: comparisonOf()?.id,
    label: number, color: sampleColor, detections: regionDetections,
  });
}

function renderTrend(event) {
  const timeline = svg("svg", { viewBox: "0 0 700 44", preserveAspectRatio: "none", focusable: "false" });
  const sequence = planFor(event.evidence.site).events;
  const allValues = data.kind === "windowed-events"
    ? data.sites.flatMap((site) => planFor(site).events.map(({ evidence }) => evidence.value)).filter((value) => value !== null)
    : data.cells.flatMap(({ samples }) => samples.map(({ value }) => value)).filter((value) => value !== null);
  const lower = data.id === "ocean" ? Math.floor(Math.min(...allValues) / 5) * 5 : 0;
  const step = data.id === "ocean" ? 5 : 10;
  const upper = Math.max(lower + step, Math.ceil(Math.max(...allValues) / step) * step);
  const x = (index) => language === "ar" ? 692 - index / (sequence.length - 1) * 684 : 8 + index / (sequence.length - 1) * 684;
  const y = (value) => 37 - (value - lower) / (upper - lower) * 28;
  const cursor = x(event.index);
  timeline.append(svg("line", { x1: cursor, x2: cursor, y1: 0, y2: 44, class: "trend-guide" }));
  let segment = [];
  for (const { evidence, index } of sequence) {
    if (evidence.value === null) {
      if (segment.length > 1) timeline.append(svg("polyline", { points: segment.join(" ") }));
      segment = [];
      continue;
    }
    segment.push(`${x(index)},${y(evidence.value)}`);
    timeline.append(svg("circle", { cx: x(index), cy: y(evidence.value), r: index === event.index ? 4 : 2, class: "trend-value" }));
  }
  if (segment.length > 1) timeline.append(svg("polyline", { points: segment.join(" ") }));
  byId("date-trend").replaceChildren(timeline);
}

function render(state) {
  if (!data || !plan) return;
  const currentPlan = comparePlan ?? plan;
  active = currentPlan.events.find(({ id }) => id === state.activeEventId) ?? currentPlan.events[0];
  const key = [active.id, state.status, state.playback, state.audioUnavailable, state.muted, state.volume === 0, comparisonOf()?.id, language].join("|");
  if (key === rendered) return;
  rendered = key;
  const { evidence, index } = active;
  const reading = display(evidence.value);
  text("reading-value", reading);
  byId("reading-value").dataset.event = active.id;
  text("reading-location", siteLabel(evidence.site));
  text("reading-detail", evidence.count === undefined ? "" : `${number(evidence.count, 0)} · ${t("detections")}`);
  text("reading-class", classification(evidence));
  const point = evidence.site.bounds ? evidence.peak : evidence.site;
  text("reading-geo", point ? coords(point) : "");
  text("map-date", `${dateLabel(evidence.time)} · ${evidence.time.start.slice(0, 4)} UTC`);
  byId("date-scrub").value = index;
  byId("date-scrub").setAttribute("aria-valuetext", dateLabel(evidence.time));
  for (const button of byId("date-labels").children) {
    const dateIndex = Number(button.dataset.index);
    const point = planFor(evidence.site).events[dateIndex].evidence;
    const value = button.lastElementChild;
    value.textContent = display(point.value);
    if (dateIndex === index) button.setAttribute("aria-current", "date");
    else button.removeAttribute("aria-current");
  }
  const compare = comparisonOf();
  byId("hear-comparison").hidden = !compare;
  const other = evidence.site.id === compare?.id ? siteOf() : compare;
  const compareSample = other && planFor(other).events[index].evidence;
  text("compare-reading", other ? `${siteLabel(other)} · ${display(compareSample.value)}` : "");
  const busy = state.status === "playing" || state.status === "starting";
  if (previewing && (state.status === "ended" || state.status === "paused")) {
    previewing = false;
    text("preview", t("preview"));
  }
  let status = t(state.status);
  if (state.status === "playing") {
    if (state.audioUnavailable) status = t("fallback");
    else if (state.playback === "silent") status = t("silent");
    else if (state.muted || state.volume === 0) status = `${status} · ${t("mute")}`;
  }
  text("playback", status);
  byId("play").disabled = busy;
  byId("pause").disabled = !busy;
  renderMap(active);
  renderTrend(active);
}

function renderEvidence() {
  if (!active) return;
  const evidence = active.evidence;
  const rain = data.id === "rain";
  const fires = data.id === "fires";
  const entries = [
    ["measurement", display(evidence.value, 5)],
    ["evidenceClass", classification(evidence)],
    ["scientificTime", evidence.time.start === evidence.time.end ? evidence.time.start : `${evidence.time.start} → ${evidence.time.end}`],
    ["product", `${data.source.product} ${data.source.version}`],
    ["mappingVersion", evidence.mappingVersion],
  ];
  const tone = active.tone;
  if (tone) {
    entries.push(["eventPitch", `${number(tone.frequencyHz, 3)} Hz`], ["eventGain", number(tone.gain, 5)],
      ["eventTimbre", t(tone.waveform === "triangle" ? "soft" : "pure")]);
    if (tone.pulses) entries.push(["eventPulses", tone.pulses.length]);
  } else entries.push(["eventPitch", t("noTone")]);
  if (fires) {
    const box = evidence.site.bounds;
    entries.push(["regionBounds", `${box.south}–${box.north}°N / ${box.west}–${box.east}°E`], ["detections", evidence.count]);
    if (evidence.peak) entries.push(["peakTime", evidence.peak.acquisitionTime], ["coordinates", `${evidence.peak.lat}°, ${evidence.peak.lon}°`], ["confidence", t(evidence.peak.confidence)]);
  } else {
    entries.push(["coordinates", `${evidence.site.lat}°, ${evidence.site.lon}°`], rain ? ["validHours", evidence.mask] : ["analysisError", display(evidence.error)]);
    if (!rain) entries.push(["mask", evidence.mask === 1 ? t("openSea") : evidence.mask]);
  }
  const list = document.createElement("dl");
  for (const [key, value] of entries) {
    const term = document.createElement("dt");
    term.textContent = t(key);
    const definition = document.createElement("dd");
    const isolated = document.createElement("bdi");
    isolated.textContent = String(value);
    definition.append(isolated);
    list.append(term, definition);
  }
  const note = document.createElement("p");
  note.textContent = scienceCopy("Meaning");
  const mapping = document.createElement("p");
  mapping.textContent = scienceCopy("Mapping");
  const links = document.createElement("p");
  links.className = "evidence-links";
  links.append(link(data.source.url, t("dataset")), link(evidence.time.granule, t(fires ? "rollingFeed" : "granule")));
  if (data.id === "ocean") links.append(link(data.subsetUrl, t("sourceQuery")));
  links.append(link(new URL(`./assets/atlas/${rain ? "imerg.csv" : fires ? "firms-noaa21-europe.csv" : "mur-sst.csv"}`, import.meta.url), t("retained")));
  byId("evidence-body").replaceChildren(list, note, mapping, links);
}

function revealMission(focus = true) {
  const rain = data.id === "rain";
  const outcome = data.sites.map((site) => {
    const values = planFor(site).events.map((event) => event.evidence);
    if (data.id === "fires") return `${t(site.id)} · ${values.map((event) => `${dateLabel(event.time)}: ${number(event.count, 0)} ${t("detections")} · ${display(event.value)}`).join(" → ")}`;
    if (rain) {
      const peak = values.reduce((best, next, index) => next.value !== null && (best < 0 || next.value > values[best].value) ? index : best, -1);
      return peak >= 0 ? `${t(site.id)} · ${dateLabel(data.times[peak])} · ${display(values[peak].value)}` : `${t(site.id)} · ${t("missing")}`;
    }
    const first = values[0].value;
    const last = values.at(-1).value;
    return first === null || last === null ? `${siteLabel(site)} · ${t("missing")}`
      : `${siteLabel(site)} · ${display(first)} → ${display(last)} (${number(last - first)} °C)`;
  });
  text("mission-result", outcome.join(" / "));
  byId("mission-result").hidden = false;
  byId("reveal-mission").setAttribute("aria-expanded", "true");
  if (focus) byId("mission-result").focus();
}

byId("language").addEventListener("click", () => {
  language = language === "ar" ? "en" : "ar";
  history.replaceState(null, "", urlWithLanguage(location.href));
  translate();
});
byId("signal").addEventListener("change", (event) => {
  const id = event.target.value;
  transport.pause();
  if (id === "forest") {
    location.href = urlWithLanguage("./forest.html#lens");
    return;
  }
  history.replaceState(null, "", urlWithLanguage(`?signal=${id}#lens`));
  show(id);
});
byId("play").addEventListener("click", () => play());
byId("pause").addEventListener("click", () => transport.pause());
byId("replay").addEventListener("click", () => play(true));
byId("date-scrub").addEventListener("input", (event) => seek(+event.target.value));
byId("date-scrub").addEventListener("change", (event) => seek(+event.target.value, true));
function chooseSite() {
  siteOptions();
  setPlan(active.index);
  seek(active.index, true);
}
byId("site").addEventListener("change", chooseSite);
byId("map-plus").addEventListener("click", () => map.zoom(1.5));
byId("map-minus").addEventListener("click", () => map.zoom(1 / 1.5));
byId("map-reset").addEventListener("click", () => map.reset());
byId("map-center").addEventListener("click", () => map.center());
byId("coordinate-search").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!data || data.kind === "windowed-events") return;
  const result = nearestSample(data.bounds, sites, byId("map-latitude").valueAsNumber, byId("map-longitude").valueAsNumber);
  if (!result) {
    text("coordinate-status", t("mapOutside"));
    return;
  }
  byId("site").value = result.id;
  chooseSite();
  map.center();
  text("coordinate-status", `${t("mapNearest")} · ${coords(result)}`);
});
byId("map-layer").addEventListener("change", (event) => map.showLayer(event.target.checked));
for (const button of byId("map-pan").children) {
  button.addEventListener("click", () => map.move(+button.dataset.x, +button.dataset.y));
}
byId("compare-site").addEventListener("change", () => {
  if (comparePlan) setPlan(active.index);
  render(transport.snapshot());
});
byId("hear-comparison").addEventListener("click", () => {
  const compare = comparisonOf();
  if (!compare) return;
  const first = plan.events[active.index];
  const second = planFor(compare).events[active.index];
  const events = [{ ...first, onsetS: 0 }, { ...second, onsetS: slotSeconds }];
  comparePlan = { events, durationS: slotSeconds * 2,
    ...(data.id === "rain" ? { texture: atmosphereFor("rain", events, slotSeconds) } : {}) };
  transport.load(comparePlan);
  transport.play(mode());
});
byId("read-measurement").addEventListener("click", () => {
  if (!active) return;
  transport.pause();
  const { evidence } = active;
  const reading = `${siteLabel(evidence.site)}. ${dateLabel(evidence.time)}. ${display(evidence.value)}.${evidence.count === undefined ? "" : ` ${number(evidence.count, 0)} ${t("detections")}.`}`;
  if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(reading);
    speech.lang = language === "ar" ? "ar" : "en";
    speechSynthesis.speak(speech);
  } else {
    text("announcer", "");
    requestAnimationFrame(() => text("announcer", reading));
  }
});
byId("open-evidence").addEventListener("click", () => {
  transport.pause();
  window.speechSynthesis?.cancel();
  renderEvidence();
  byId("evidence").showModal();
});
byId("reveal-mission").addEventListener("click", () => revealMission());
byId("retry-lens").addEventListener("click", () => show(requested, true));
byId("speed").addEventListener("change", (event) => transport.setSpeed(+event.target.value));
byId("timbre").addEventListener("change", () => {
  locationPlans.clear();
  setPlan(active.index);
  seek(active.index, true);
});
byId("mute").addEventListener("change", (event) => transport.setMuted(event.target.checked));
byId("visual-only").addEventListener("change", () => transport.pause());
byId("volume").addEventListener("input", (event) => transport.setVolume(+event.target.value / 100));
byId("atmosphere").addEventListener("input", (event) => transport.setAtmosphereVolume(+event.target.value / 100));
byId("preview").addEventListener("click", async () => {
  if (previewing) {
    transport.pause();
    return;
  }
  const id = byId("preview-source").value;
  if (data?.id !== id) {
    history.replaceState(null, "", urlWithLanguage(`?signal=${id}${location.hash}`));
    await show(id);
  }
  if (data?.id !== id) return;
  if (comparePlan) setPlan(0);
  transport.seek(0);
  previewing = true;
  text("preview", t("previewStop"));
  text("preview-note", `${t(id)} · ${dateLabel(data.times[0])} → ${dateLabel(data.times.at(-1))}`);
  play();
});
byId("preview-source").addEventListener("change", () => {
  if (previewing) transport.pause();
  text("preview-note", "");
  renderPreview();
});
window.addEventListener("pagehide", () => {
  transport.pause();
  window.speechSynthesis?.cancel();
});
window.addEventListener("popstate", () => {
  const params = new URLSearchParams(location.search);
  language = params.get("lang") === "ar" ? "ar" : "en";
  translate();
  const id = params.get("signal");
  if (data?.id !== (loaders[id] ? id : "ocean")) show(loaders[id] ? id : "ocean");
});
transport.subscribe(render);
translate();
const initial = new URLSearchParams(location.search).get("signal");
await show(loaders[initial] ? initial : "ocean");
byId("preview").disabled = false;
