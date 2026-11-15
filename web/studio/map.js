import { referenceSample, resamplePath, WORLD_BOUNDS } from "./data.js";
import { createMapCore } from "./map-core.js?v=5";

// Night-lights map: the shared engine (map-core.js) with an image layer and a pixel-colour sampler. The published
// NASA renderings are reference images only, so a sample is a visual classification and never a radiance value.

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const layers = ["2012", "2023", "change"];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image failed: ${url}`));
    image.src = url;
  });
}

async function loadVisual(url) {
  const source = await loadImage(url);
  if (typeof createImageBitmap !== "function") return source;
  const bitmap = await createImageBitmap(source, { resizeWidth: 3840, resizeHeight: 2160, resizeQuality: "high" });
  source.src = "";
  return bitmap;
}

export async function createStudioMap(host, {
  onHover = () => {},
  onSelect = () => {},
  onDraw = () => {},
  onView = () => {},
} = {}) {
  const imageUrls = Object.fromEntries(layers.map((layer) => [layer,
    new URL(`../assets/studio/nightlights-${layer}.jpg`, import.meta.url).href]));
  const images = Object.fromEntries(await Promise.all(layers.map(async (layer) => [layer, await loadVisual(imageUrls[layer])])));
  const sampleCanvases = Object.fromEntries(layers.map((layer) => {
    const surface = document.createElement("canvas");
    // A bounded 4:1 downsample avoids keeping three 132 MB canvas backing
    // stores while preserving the published rendering's geographic pattern.
    surface.width = images[layer].width / 4;
    surface.height = images[layer].height / 4;
    surface.getContext("2d", { willReadFrequently: true }).drawImage(images[layer], 0, 0);
    return [layer, surface];
  }));

  let layer = "change";

  function sampleAt(longitude, latitude, requestedLayer = layer) {
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
    const surface = sampleCanvases[requestedLayer];
    const x = clamp(Math.floor((longitude + 180) / 360 * surface.width), 0, surface.width - 1);
    const y = clamp(Math.floor((90 - latitude) / 180 * surface.height), 0, surface.height - 1);
    const [r, g, b, a] = surface.getContext("2d", { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
    return referenceSample({ longitude, latitude, pixel: { r, g, b, a }, layer: requestedLayer });
  }

  const imageLayer = {
    get aspect() { return images[layer].width / images[layer].height; },
    draw(context, { view, width, height }) {
      const image = images[layer];
      context.drawImage(image,
        view.x * image.width, view.y * image.height, view.width * image.width, view.height * image.height,
        0, 0, width, height);
      const vignette = context.createRadialGradient(width * 0.5, height * 0.46, height * 0.16,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      vignette.addColorStop(0, "rgba(1, 4, 8, 0)");
      vignette.addColorStop(1, "rgba(1, 4, 8, .46)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
    },
  };

  host.dataset.layer = layer;
  const core = createMapCore(host, {
    layer: imageLayer,
    sampleAt: (longitude, latitude) => sampleAt(longitude, latitude),
    initialView: { longitude: 78.5, latitude: 24.5, zoom: 5.6 },
    minZoom: 1,
    maxZoom: 24,
    wheel: "step",
    resampleRoute: (points) => resamplePath(points, Math.max(36, Math.min(180, points.length * 2))),
    cursorColor: (sample) => sample?.changeDirection === "decrease" ? "#f5a556" :
      sample?.changeDirection === "increase" ? "#a889ff" : "#f0eee5",
    onHover: (sample, position) => onHover(sample, position),
    onSelect: (sample) => onSelect(sample),
    onDraw,
    onView: (view) => onView({ bounds: view.bounds, zoom: view.zoom, layer }),
  });

  return {
    sampleAt,
    samplePath(points) { return points.map((point) => sampleAt(point.longitude, point.latitude)); },
    getVisibleBounds: () => core.getVisibleBounds(),
    setLayer(next) {
      if (layers.includes(next)) {
        layer = next;
        host.dataset.layer = layer;
        core.render();
        onView({ bounds: core.getVisibleBounds(), zoom: core.zoomLevel, layer });
      }
    },
    get layer() { return layer; },
    setMode(next) { core.setMode(next); },
    get mode() { return core.mode; },
    setCursor(sample, playing = false) { core.setCursor(sample, playing); },
    setRoute(points) { core.setRoute(points); },
    getRoute() { return core.getRoute(); },
    clearRoute() { core.clearRoute(); },
    setScanPath(points) { core.setScanPath(points); },
    setCompare(points) {
      core.setMarkers(points.filter(Boolean).map((sample, index) => ({
        longitude: sample.longitude, latitude: sample.latitude, label: index === 0 ? "A" : "B", color: index === 0 ? "#9d7cff" : "#f5a556",
      })));
    },
    zoom(ratio) { core.zoom(ratio); },
    move(dx, dy) { core.move(dx, dy); },
    focus(longitude = 78.5, latitude = 24.5, nextZoom = 5.6) { core.focus(longitude, latitude, nextZoom); },
    reset() { core.reset(); },
    render: core.render,
    dispose() {
      core.dispose();
      for (const image of Object.values(images)) image.close?.();
      host.replaceChildren();
    },
    bounds: WORLD_BOUNDS,
  };
}
