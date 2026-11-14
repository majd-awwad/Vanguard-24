import { loadDecodeCase } from "../../sources/decode/index.js";
import { badge, h } from "./dom.js";
import {
  cellId, cellSize, fill, formatLat, formatLon, formatUtcDate, formatUtcTime, textureCrop, transmission, trimNumber, windowStats,
} from "./cells.js";
import { mountNav } from "./nav.js";
import { NATIVE, RAW_SHA256, REFERENCES, scienceCopy } from "./science-copy.js";

export const CASE_ID = "dust-geos-fp-20250819-1930-north-africa-med";
const TEXTURE = "../assets/earth/blue-marble-4096.jpg";
const SVS_THUMB = "../assets/decode/svs-5669-context.webp";

/** Everything the page says about the numbers, derived from the case file. No DOM, so it is unit-tested. */
export function scienceModel(data, language = "en") {
  const advanced = data.levels.advanced;
  const quick = data.levels.quick;
  const { bounds } = data;
  const time = windowStats(data.source.time);
  const threshold = advanced.truth.threshold;
  const through = transmission(threshold);
  const aSize = cellSize(bounds, advanced);
  const qSize = cellSize(bounds, quick);
  return {
    variable: /[A-Z]{2}[A-Z0-9]{5,}(?= at )/.exec(data.source.product)?.[0] ?? "",
    wavelength: /(\d+)\s*nm/.exec(data.source.product)?.[1] ?? "",
    unit: data.unit,
    threshold: trimNumber(threshold, 4),
    rule: advanced.truth.rule === "value >= threshold" ? "value ≥ threshold" : advanced.truth.rule,
    attenuation: trimNumber((1 - through) * 100, 1),
    transmission: trimNumber(through, 4),
    hours: trimNumber(time.hours, 2),
    from: formatUtcTime(data.source.time.start),
    to: formatUtcTime(data.source.time.end),
    centre: formatUtcTime(time.centre),
    date: formatUtcDate(data.source.time.start, language),
    north: formatLat(bounds.north), south: formatLat(bounds.south), east: formatLon(bounds.east), west: formatLon(bounds.west),
    nativeLat: trimNumber(NATIVE.lat), nativeLon: trimNumber(NATIVE.lon),
    advanced: { rows: advanced.rows, cols: advanced.cols, lat: trimNumber(aSize.lat), lon: trimNumber(aSize.lon) },
    quick: { rows: quick.rows, cols: quick.cols, lat: trimNumber(qSize.lat), lon: trimNumber(qSize.lon), aggregation: quick.aggregation },
    relation: data.visualLink.relation,
    granule: data.source.granules[0],
    sha256: RAW_SHA256,
  };
}

function section(document, className, title, kind, kindLabel) {
  return h(document, "section", { class: "panel " + className },
    h(document, "h2", {}, h(document, "span", { text: title }), kind ? badge(document, kind, kindLabel) : null));
}

function externalLink(document, href, label, note) {
  return h(document, "a", { href, target: "_blank", rel: "noopener noreferrer", "aria-label": label + " (" + note + ")" }, label, " ↗");
}

function regionMap(document, data, c, level, size) {
  const crop = textureCrop(data.bounds);
  const { rows, cols } = data.levels[level];
  const frame = h(document, "div", { class: "region-map", dir: "ltr", role: "img", "aria-label": c.glance.mapLabel });
  const plate = h(document, "div", {
    class: "region-plate",
    style: `aspect-ratio:${crop.aspect};background-image:url("${TEXTURE}");background-size:${crop.sizeX}% ${crop.sizeY}%;background-position:${crop.posX}% ${crop.posY}%`,
  });
  const grid = h(document, "div", { class: "region-grid", style: `grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)` });
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) grid.append(h(document, "span", { class: "region-cell", "data-cell": cellId(row, col) }));
  plate.append(grid);
  const top = h(document, "div", { class: "region-cols", style: `grid-template-columns:repeat(${cols},1fr)`, "aria-hidden": "true" });
  for (let col = 0; col < cols; col++) top.append(h(document, "span", { text: String(col + 1) }));
  const left = h(document, "div", { class: "region-rows", style: `grid-template-rows:repeat(${rows},1fr)`, "aria-hidden": "true" });
  for (let row = 0; row < rows; row++) left.append(h(document, "span", { text: cellId(row, 0)[0] }));
  frame.append(h(document, "span", { class: "region-corner", "aria-hidden": "true" }), top, left, plate);
  frame.dataset.level = level;
  frame.dataset.size = size;
  return frame;
}

export function renderScience(document, root, data, language = "en") {
  const c = scienceCopy[language];
  const m = scienceModel(data, language);
  // In Arabic, numbers and Latin codes are isolated left-to-right so "15°N" and "18:00 UTC" keep their order.
  const iso = (value) => (language === "ar" ? "⁦" + value + "⁩" : String(value));
  const L = (template, extra = {}) => {
    const values = { ...m, ...extra };
    const out = {};
    for (const [key, value] of Object.entries(values)) out[key] = typeof value === "object" ? value : iso(value);
    out.region = c.region;
    return fill(template, out);
  };
  const levelTokens = (level) => ({ rows: m[level].rows, cols: m[level].cols, cellLat: m[level].lat, cellLon: m[level].lon, aggregation: m.quick.aggregation });
  root.replaceChildren();

  // Hero
  const hero = h(document, "section", { class: "science-hero", "aria-labelledby": "science-title" },
    h(document, "div", { class: "science-hero-copy" },
      h(document, "p", { class: "eyebrow", text: c.eyebrow }),
      h(document, "h1", { id: "science-title" }, c.titleLead + " ", h(document, "em", { text: c.titleAccent })),
      h(document, "p", { class: "lede", text: L(c.lede) })),
    h(document, "figure", { class: "hero-globe-wrap" },
      h(document, "div", { class: "hero-globe", "aria-hidden": "true", style: `background-image:url("${TEXTURE}")` }),
      h(document, "figcaption", {}, badge(document, "decor", c.decor.label), h(document, "span", { text: c.decor.globe }))));

  // Legend of content kinds
  const kinds = h(document, "ul", { class: "kinds", "aria-label": c.kinds.label });
  for (const [kind, label, text] of [["data", c.kinds.data, c.kinds.dataText], ["related", c.kinds.related, c.kinds.relatedText], ["decor", c.kinds.decor, c.kinds.decorText]]) {
    kinds.append(h(document, "li", {}, badge(document, kind, label), h(document, "span", { text })));
  }

  // Four key facts
  const facts = h(document, "ul", { class: "facts" });
  const addFact = (icon, label, value, sub) => facts.append(h(document, "li", { class: "panel fact" },
    h(document, "span", { class: "fact-icon", "aria-hidden": "true", text: icon }),
    h(document, "div", {}, h(document, "h3", { text: label }), h(document, "p", { class: "fact-value", text: value }), h(document, "p", { class: "fact-sub", text: sub }))));
  addFact("◈", c.facts.source.label, c.facts.source.value, data.source.product);
  addFact("◌", c.facts.variable.label, c.facts.variable.value, L(c.facts.variable.sub));
  addFact("⌖", c.facts.coverage.label, c.region, L(c.facts.coverage.sub));
  addFact("◷", c.facts.window.label, m.date, L(c.facts.window.sub));

  // What is DOD + scale
  const dod = section(document, "dod", c.dod.title, "data", c.kinds.data);
  dod.append(h(document, "p", { text: L(c.dod.p1) }), h(document, "p", { text: L(c.dod.p2) }),
    h(document, "div", { class: "scale", role: "img", "aria-label": L(c.dod.scale + ": 0, " + c.dod.thresholdMark) },
      h(document, "div", { class: "scale-bar", "aria-hidden": "true" }, h(document, "span", { class: "scale-mark" })),
      h(document, "div", { class: "scale-labels", "aria-hidden": "true" }, h(document, "span", { text: "0" }), h(document, "span", { class: "scale-threshold", text: L(c.dod.thresholdMark) }), h(document, "span", { text: "→" }))),
    h(document, "p", { class: "small", text: L(c.dod.only) }));

  // Threshold
  const threshold = section(document, "threshold", L(c.threshold.title), "data", c.kinds.data);
  threshold.append(h(document, "p", { text: L(c.threshold.p1) }), h(document, "p", { text: L(c.threshold.p2) }),
    h(document, "p", { class: "callout" }, h(document, "strong", { text: c.threshold.strong }), " " + c.threshold.p3),
    h(document, "p", { class: "small", text: c.threshold.p4 }));

  // Method
  const method = section(document, "method", c.method.title, "data", c.kinds.data);
  const steps = h(document, "ol", { class: "steps" });
  steps.append(h(document, "li", { text: L(c.method.s1) }));
  if (data.fixture) steps.append(h(document, "li", { class: "warn", text: c.method.s1fixture }));
  steps.append(h(document, "li", { text: L(c.method.s2) }), h(document, "li", { text: L(c.method.s3, levelTokens("advanced")) }), h(document, "li", { text: L(c.method.s4, levelTokens("quick")) }));
  method.append(steps, h(document, "p", { class: "small", text: L(c.method.rule) }));

  // Dataset at a glance (table + registered map)
  const glance = section(document, "glance", c.glance.title, "data", c.kinds.data);
  const table = h(document, "dl", { class: "glance-table" });
  const row = (label, value, ltr = false) => table.append(h(document, "dt", { text: label }), h(document, "dd", { class: ltr ? "ltr" : "", text: value }));
  const r = c.glance.rows;
  row(r.model, c.glance.model, true); row(r.product, data.source.product, true); row(r.version, data.source.version, true);
  row(r.variable, m.variable + " · " + m.wavelength + " nm", true); row(r.unit, L(c.glance.unitValue));
  row(r.native, L(c.glance.nativeValue, { lat: m.nativeLat, lon: m.nativeLon })); row(r.window, L(c.glance.windowValue));
  row(r.bounds, L(c.glance.boundsValue)); row(r.advanced, L(c.glance.gridValue, m.advanced)); row(r.quick, L(c.glance.gridValue, m.quick)); row(r.kind, data.fixture ? "Fixture" : c.glance.kindValue);
  const mapBox = h(document, "div", { class: "map-box" });
  const levelGroup = h(document, "fieldset", { class: "level-picker" }, h(document, "legend", { text: c.glance.level }));
  const mapSlot = h(document, "div", { class: "map-slot" });
  const showMap = (level) => mapSlot.replaceChildren(regionMap(document, data, c, level, level));
  for (const level of ["advanced", "quick"]) {
    const id = "level-" + level;
    const input = h(document, "input", { type: "radio", name: "level", id, value: level, checked: level === "advanced" });
    input.addEventListener("change", () => showMap(level));
    levelGroup.append(h(document, "label", { for: id }, input, h(document, "span", { text: c.glance[level] + " " + data.levels[level].rows + "×" + data.levels[level].cols })));
  }
  showMap("advanced");
  mapBox.append(h(document, "h3", { text: c.glance.mapTitle }), levelGroup, mapSlot, h(document, "p", { class: "small", text: c.glance.mapNote }));
  glance.append(h(document, "div", { class: "glance-body" }, table, mapBox));

  // Provenance
  const provenance = section(document, "provenance", c.provenance.title, "data", c.kinds.data);
  const prov = h(document, "dl", { class: "glance-table" });
  prov.append(
    h(document, "dt", { text: c.provenance.product }), h(document, "dd", { class: "ltr", text: data.source.product }),
    h(document, "dt", { text: c.provenance.granule }), h(document, "dd", { class: "ltr mono" }, m.granule),
    h(document, "dt", { text: c.provenance.file }), h(document, "dd", { class: "ltr mono wrap", text: m.sha256 }),
    h(document, "dt", { text: c.provenance.id }), h(document, "dd", { class: "ltr mono", text: data.id }));
  provenance.append(prov, h(document, "p", { class: "small" }, externalLink(document, data.source.url, c.provenance.download, c.references.external)), h(document, "p", { class: "small", text: c.provenance.note }));

  // Related visualization (separate, never projected)
  const related = section(document, "related", c.related.title, "related", c.kinds.related);
  related.append(
    h(document, "figure", { class: "svs" }, h(document, "img", { src: SVS_THUMB, alt: c.related.alt, loading: "lazy", width: 480, height: 270 }), h(document, "figcaption", { text: c.related.caption })),
    h(document, "p", { text: L(c.related.note) }),
    h(document, "p", { class: "small" }, h(document, "bdi", { class: "ltr", text: L(c.related.relation) })));

  // References
  const references = section(document, "references", c.references.title);
  const list = h(document, "ul", { class: "refs" });
  for (const ref of REFERENCES) {
    const href = ref.key === "svs" ? data.visualLink.svs : ref.href;
    list.append(h(document, "li", {}, externalLink(document, href, c.references[ref.key], c.references.external)));
  }
  references.append(list);

  const grid = h(document, "div", { class: "science-grid" }, dod, threshold, method, glance, provenance, related, references);
  root.append(hero, kinds, facts, grid, h(document, "p", { class: "credit", text: c.credit }));
  return m;
}

export async function startScience(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "science", from: "pages" });
  const c = scienceCopy[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("science-root");
  const load = async () => {
    root.replaceChildren(h(document, "p", { class: "status", role: "status", text: c.loading }));
    try {
      renderScience(document, root, await loadDecodeCase(CASE_ID), language);
    } catch (error) {
      console.error(error);
      const retry = h(document, "button", { type: "button", class: "button", text: c.retry });
      retry.addEventListener("click", load);
      root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: c.error }), retry);
    }
  };
  await load();
}
