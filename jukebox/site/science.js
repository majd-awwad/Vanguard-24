export const bandCount = 12;
export const regionalIds = ["europe", "med", "ukraine", "india"];
const ownedSources = {
  source: "https://svs.gsfc.nasa.gov/5313/",
  video: "https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4",
  sourceSha256: "fa770691e32961d6670ef22689a63210fd732228fabf4946a8117e96b2bcffd9",
};
const isCount = value => Number.isSafeInteger(value) && value >= 0;

export function validateFrame(data) {
  if (data?.schema !== 1 || data.svs !== 5313 || data.frame !== 1260 || data.second !== 42 ||
      data.width !== 7680 || data.height !== 2160 || data.classifier !== "rgb-visible-change-v1" ||
      Object.keys(ownedSources).some(key => data[key] !== ownedSources[key]) ||
      !/^[a-f\d]{64}$/.test(data.rawRgbSha256) || data.regions?.length !== regionalIds.length) {
    throw new Error("The SVS frame manifest could not be verified.");
  }
  for (const [index, region] of data.regions.entries()) {
    const [x0, y0, x1, y1] = region.box ?? [];
    if (region.id !== regionalIds[index] || region.image !== region.id + ".webp" ||
        region.box?.length !== 4 || !region.box.every(isCount) || x0 >= x1 || y0 >= y1 ||
        x1 > data.width || y1 > data.height || region.bands?.length !== bandCount ||
        !/^[a-f\d]{64}$/.test(data.media?.[region.image])) {
      throw new Error("An SVS region could not be verified.");
    }
    const width = x1 - x0;
    const height = y1 - y0;
    for (const [index, band] of region.bands.entries()) {
      if (!band || band.start !== Math.floor(index * width / bandCount) ||
          band.end !== Math.floor((index + 1) * width / bandCount) ||
          band.pixels !== (band.end - band.start) * height ||
          band.pixels <= 0 || !isCount(band.bright) || !isCount(band.dim) || band.bright + band.dim > band.pixels) {
        throw new Error("An SVS image band could not be verified.");
      }
    }
    for (const threshold of [10, 12, 14]) {
      const counts = region.sensitivity?.[threshold];
      if (counts?.length !== 2 || !counts.every(isCount) || counts[0] + counts[1] > width * height) {
        throw new Error("Missing classification sensitivity checks.");
      }
    }
    const totals = totalsOf(region);
    if (totals.bright !== region.sensitivity[12][0] || totals.dim !== region.sensitivity[12][1]) {
      throw new Error("Band counts disagree with the regional reference.");
    }
  }
  return data;
}

export async function loadFrame() {
  const response = await fetch(new URL("./media/night-lights.json", import.meta.url));
  if (!response.ok) throw new Error("The SVS frame data could not load.");
  return validateFrame(await response.json());
}

export function totalsOf(region) {
  const totals = { pixels: 0, bright: 0, dim: 0 };
  for (const band of region.bands) {
    totals.pixels += band.pixels;
    totals.bright += band.bright;
    totals.dim += band.dim;
  }
  return totals;
}

export const shareOf = (band, tone) => band[tone] / band.pixels;
