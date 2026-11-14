const validNumber = (value) => typeof value === "number" && Number.isFinite(value);

export function parseGediCase(sample, provenance) {
  const selection = sample?.selection;
  const edges = sample?.DERIVED?.height_bin_edges_m_ascending;
  const rows = sample?.footprints;
  if (sample?.schema_version !== 1 || !sample.case_id || sample.case_id !== provenance?.case_id
      || provenance?.source_status !== "VERIFIED"
      || !selection || selection.collection_release !== "V001"
      || Object.entries(selection).some(([name, value]) =>
        JSON.stringify(value) !== JSON.stringify(provenance.selection?.[name]))
      || !Array.isArray(edges) || edges.length < 2
      || edges.some((edge, index) => !Number.isInteger(edge) || (index > 0 && edge !== edges[index - 1] + 1))
      || !Array.isArray(rows) || rows.length < 2
      || !["L1B", "L2A"].every((level) => provenance.sources?.[level]?.original_granule
        && provenance.sources[level].url && provenance.sources[level].doi)
      || !provenance.eic?.url) {
    throw new Error("GEDI sample and provenance do not agree.");
  }
  const unique = new Set();
  let distance = -1;
  let timestamp = -Infinity;
  const footprints = rows.map((row, index) => {
    const id = row.shot_number;
    const raw = row.VERIFIED;
    const derived = row.DERIVED;
    const profile = derived?.relative_return_share_by_ascending_height_bin;
    const positive = derived?.positive_residual_bin_indices_0_based;
    const flags = raw?.flags;
    const coordinates = raw?.l2a_center_lat_lon_deg;
    if (typeof id !== "string" || !/^\d{16,18}$/.test(id) || unique.has(id)
        || !validNumber(raw?.delta_time_s) || raw.delta_time_s <= timestamp
        || !validNumber(derived?.cumulative_distance_m) || derived.cumulative_distance_m <= distance
        || !Array.isArray(profile) || profile.length !== edges.length - 1
        || profile.some((value) => !validNumber(value) || value < 0 || value > 1)
        || Math.abs(profile.reduce((sum, value) => sum + value, 0) - 1) > 1e-8
        || !Array.isArray(positive) || positive.some((bin) => !Number.isInteger(bin) || bin < 0 || bin >= profile.length)
        || profile.some((value, bin) => value > 0 && !positive.includes(bin))
        || flags?.quality_flag !== 1 || flags?.l1b_degrade !== 0 || flags?.degrade_flag !== 0
        || flags?.stale_return_flag !== 0 || flags?.rx_clipbin_count !== 0
        || !validNumber(raw.l2a_sensitivity) || raw.l2a_sensitivity < selection.minimum_sensitivity
        || !Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(validNumber)
        || Math.abs(coordinates[0]) > 90 || Math.abs(coordinates[1]) > 180
        || !Number.isFinite(Date.parse(derived.utc)) || !validNumber(raw.l2a_rh100_m)
        || !validNumber(raw.l2a_elev_lowestmode_m_ellipsoid)
        || !Number.isInteger(raw.l1b_rx_sample_start_index_1_based) || raw.l1b_rx_sample_start_index_1_based < 1
        || !Array.isArray(raw.l1b_rxwaveform_adc_descending_height)
        || raw.l1b_rxwaveform_adc_descending_height.length !== raw.l1b_rx_sample_count) {
      throw new Error(`Invalid verified GEDI footprint at index ${index}.`);
    }
    unique.add(id);
    distance = derived.cumulative_distance_m;
    timestamp = raw.delta_time_s;
    return {
      id, index, profile, positive, raw, utc: derived.utc, coordinates,
      distance, rh100: raw.l2a_rh100_m,
    };
  });
  if (!unique.has(selection.comparison_low_shot) || !unique.has(selection.comparison_high_shot)
      || !Array.isArray(selection.comparison_height_m)
      || selection.comparison_height_m.length !== 2
      || !selection.comparison_height_m.every((edge) => edges.includes(edge))
      || selection.comparison_height_m[0] >= selection.comparison_height_m[1]) {
    throw new Error("The authenticated comparison is missing from the case.");
  }
  return Object.freeze({
    id: sample.case_id, release: selection.collection_release, edges, footprints,
    selection, provenance, derived: sample.DERIVED,
    guide: Object.freeze({
      low: selection.comparison_low_shot, high: selection.comparison_high_shot,
      band: selection.comparison_height_m,
      margin: sample.DERIVED.min_contrast_margin_fraction.comparison_selected_ground_stress,
    }),
  });
}

export async function loadGediCase({ sampleUrl, provenanceUrl }) {
  async function load(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not read ${url} (${response.status}).`);
    return response.json();
  }
  return parseGediCase(...await Promise.all([load(sampleUrl), load(provenanceUrl)]));
}
