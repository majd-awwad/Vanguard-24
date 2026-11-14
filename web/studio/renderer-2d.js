import { layerT, rampTable, smoothT } from "./field.js";

// Canvas 2D fallback with the same layer: the Blue Marble crop for the view, and a smooth dust field pre-rendered at
// 8 pixels per cell (smoothstep interpolation, no grid lines) drawn registered to the region corners.

const SCALE = 8;

export function createCanvasRenderer({ document, container, earthUrl, onReady = () => {} }) {
  const canvas = document.createElement("canvas");
  canvas.className = "studio-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);
  const context = canvas.getContext("2d");
  const image = new document.defaultView.Image();
  let loaded = false;
  image.onload = () => { loaded = true; onReady(); };
  image.src = earthUrl;
  let width = 1;
  let height = 1;
  let state = { view: { lon: 0, lat: 0, zoom: 1 }, ppd: 1, bounds: null };
  let field = null;
  let alpha = 0.66;

  function buildField(layer, grid) {
    const w = grid.cols * SCALE;
    const h = grid.rows * SCALE;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    const data = ctx.createImageData(w, h);
    const { bounds } = grid;
    const { t, mask } = layerT(layer.values, grid, layer.mode);
    const table = rampTable(layer.mode === "diff" ? "diff" : "value");
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const lon = bounds.west + ((x + 0.5) / w) * (bounds.east - bounds.west);
        const lat = bounds.north - ((y + 0.5) / h) * (bounds.north - bounds.south);
        const cell = Math.min(grid.rows - 1, Math.floor(y / SCALE)) * grid.cols + Math.min(grid.cols - 1, Math.floor(x / SCALE));
        const o = (y * w + x) * 4;
        if (mask[cell]) { data.data.set(((x + y) >> 2) % 2 ? [42, 46, 56, 235] : [107, 116, 128, 235], o); continue; }
        const index = Math.round(Math.min(1, Math.max(0, smoothT(t, grid, lon, lat))) * 255) * 4;
        data.data.set([table[index], table[index + 1], table[index + 2], Math.round(alpha * 255)], o);
      }
    }
    ctx.putImageData(data, 0, 0);
    return off;
  }

  return {
    kind: "canvas2d",
    canvas,
    resize(w, h, ratio) {
      width = w; height = h;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    },
    setView(view, ppd, bounds) { state = { view, ppd, bounds }; },
    setLayer(layer, grid) { field = layer ? { canvas: buildField(layer, grid), grid } : null; },
    setAlpha(value) { alpha = value; },
    render() {
      context.fillStyle = "#050b12";
      context.fillRect(0, 0, width, height);
      if (!loaded) return;
      const { view, ppd, bounds } = state;
      const west = view.lon - width / (2 * ppd);
      const north = view.lat + height / (2 * ppd);
      const sx = ((west + 180) / 360) * image.naturalWidth;
      const sy = ((90 - north) / 180) * image.naturalHeight;
      const sw = (width / ppd / 360) * image.naturalWidth;
      const sh = (height / ppd / 180) * image.naturalHeight;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
      context.fillStyle = "rgba(5,11,18,0.2)";
      context.fillRect(0, 0, width, height);
      const x0 = width / 2 + (bounds.west - view.lon) * ppd;
      const y0 = height / 2 - (bounds.north - view.lat) * ppd;
      const w = (bounds.east - bounds.west) * ppd;
      const h = (bounds.north - bounds.south) * ppd;
      if (field) context.drawImage(field.canvas, x0, y0, w, h);
      context.strokeStyle = "rgba(104,224,208,0.7)";
      context.lineWidth = 1.2;
      context.strokeRect(x0, y0, w, h);
    },
    get ready() { return loaded; },
    dispose() { canvas.remove(); },
  };
}
