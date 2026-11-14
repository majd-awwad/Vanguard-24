import { mappingVersion } from "../audio/gedi-plan.js";

export function formatEvidence(language) {
  const number = (value, digits = 2) => new Intl.NumberFormat(language, {
    maximumFractionDigits: digits, useGrouping: false,
  }).format(value);
  const percent = new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 2 });
  return { number, percent: (value) => percent.format(value) };
}

export function renderEvidence(root, evidence, data, language, text) {
  const { observation, band, value, observationStatus } = evidence;
  const { number, percent } = formatEvidence(language);
  const { raw } = observation;
  const metre = text("meters");
  const label = {
    measured: "measured", below_threshold: "below", missing: "missing", excluded: "excluded",
  }[observationStatus];
  const values = [
    ["observationId", observation.id, true],
    ["heightBand", `[${number(band[0])}, ${number(band[1])}) ${metre}`, true],
    ["returnShare", value === null ? text(label) : percent(value)],
    ["exactFraction", value === null ? "—" : String(value), true],
    ["evidenceStatus", text(label)],
    ["time", observation.utc, true],
    ["center", observation.coordinates.join(", "), true],
    ["orbit", `O${String(data.selection.orbit).padStart(5, "0")} / T${String(data.selection.track).padStart(5, "0")} / ${data.selection.beam_group}`, true],
    ["distance", `${number(observation.distance, 4)} ${metre}`],
    ["rh100", `${number(observation.rh100)} ${metre}`],
    ["ground", `${number(raw.l2a_elev_lowestmode_m_ellipsoid, 4)} ${metre}`],
    ["acquisitionQuality", `${raw.flags.quality_flag} / ${raw.flags.degrade_flag} / ${raw.l2a_sensitivity}`, true],
    ["rxIndex", `${raw.l1b_rx_sample_start_index_1_based} / ${raw.l1b_rx_sample_count}`, true],
    ["granuleRows", `${raw.l1b_row_0_based} / ${raw.l2a_row_0_based}`, true],
    ["mappingVersion", mappingVersion, true],
  ];
  const list = document.createElement("dl");
  list.className = "evidence-list";
  for (const [key, value, ltr] of values) {
    const term = document.createElement("dt");
    term.textContent = text(key);
    const definition = document.createElement("dd");
    const content = document.createElement("bdi");
    if (ltr) content.dir = "ltr";
    content.textContent = value;
    definition.append(content);
    list.append(term, definition);
  }
  const note = document.createElement("p");
  note.textContent = `${text("windowNote")} ${text("sourceNote")}`;
  const sources = document.createElement("ul");
  sources.className = "sources";
  const links = Object.values(data.provenance.sources).map((source) => [source.original_granule, source.url, source.doi]);
  links.push([text("sampleLink"), "./assets/gedi/sample.json"], [text("manifestLink"), "./assets/gedi/provenance.json"]);
  for (const [name, href, doi] of links) {
    const line = document.createElement("li");
    const link = document.createElement("a");
    link.textContent = name;
    link.href = href;
    line.append(link);
    if (doi) {
      link.dir = "ltr";
      const citation = document.createElement("a");
      citation.href = `https://doi.org/${doi}`;
      citation.textContent = "DOI";
      citation.lang = "en";
      citation.dir = "ltr";
      citation.setAttribute("aria-label", `DOI ${doi}`);
      line.append(" · ", citation);
    }
    sources.append(line);
  }
  root.replaceChildren(list, note, sources);
  root.dataset.shot = observation.id;
}
