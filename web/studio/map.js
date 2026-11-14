import { referenceSample, resamplePath, WORLD_BOUNDS } from "./data.js";

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
  const canvas = document.createElement("canvas");
  canvas.className = "studio-map-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const context = canvas.getContext("2d", { alpha: false });
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

  let cssWidth = 1;
  let cssHeight = 1;
  let ratio = 1;
  let layer = "change";
  let zoom = 5.6;
  let center = { x: (78.5 + 180) / 360, y: (90 - 24.5) / 180 };
  let mode = "navigate";
  let cursor;
  let route = [];
  let scanPath = [];
  let compare = [];
  let drawing = [];
  let drag;
  let pinch;
  const pointers = new Map();

  function sourceRect() {
    const image = images[layer];
    const imageAspect = image.width / image.height;
    const viewAspect = cssWidth / cssHeight;
    let width = 1 / zoom;
    let height = width * imageAspect / viewAspect;
    if (height > 1) {
      height = 1;
      width = height * viewAspect / imageAspect;
    }
    const x = clamp(center.x - width / 2, 0, 1 - width);
    const y = clamp(center.y - height / 2, 0, 1 - height);
    return { x, y, width, height };
  }

  function geographicAt(x, y) {
    const view = sourceRect();
    const u = view.x + clamp(x / cssWidth, 0, 1) * view.width;
    const v = view.y + clamp(y / cssHeight, 0, 1) * view.height;
    return { longitude: u * 360 - 180, latitude: 90 - v * 180 };
  }

  function screenAt({ longitude, latitude }) {
    const view = sourceRect();
    const u = (longitude + 180) / 360;
    const v = (90 - latitude) / 180;
    return { x: (u - view.x) / view.width * cssWidth, y: (v - view.y) / view.height * cssHeight };
  }

  function sampleAt(longitude, latitude, requestedLayer = layer) {
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
    const surface = sampleCanvases[requestedLayer];
    const x = clamp(Math.floor((longitude + 180) / 360 * surface.width), 0, surface.width - 1);
    const y = clamp(Math.floor((90 - latitude) / 180 * surface.height), 0, surface.height - 1);
    const [r, g, b, a] = surface.getContext("2d", { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
    return referenceSample({ longitude, latitude, pixel: { r, g, b, a }, layer: requestedLayer });
  }

  function pathStroke(points, color, width = 1.4, dash = []) {
    if (points.length < 2) return;
    context.beginPath();
    points.forEach((point, index) => {
      const screen = screenAt(point);
      if (index === 0) context.moveTo(screen.x, screen.y);
      else context.lineTo(screen.x, screen.y);
    });
    context.strokeStyle = color;
    context.lineWidth = width;
    context.setLineDash(dash);
    context.stroke();
    context.setLineDash([]);
  }

  function drawMarker(point, label, color) {
    if (!point) return;
    const screen = screenAt(point);
    if (screen.x < -30 || screen.y < -30 || screen.x > cssWidth + 30 || screen.y > cssHeight + 30) return;
    context.beginPath();
    context.arc(screen.x, screen.y, 10, 0, Math.PI * 2);
    context.fillStyle = "rgba(4, 8, 13, .78)";
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = "#f5f2ec";
    context.font = "600 10px IBM Plex Mono, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, screen.x, screen.y + 0.5);
  }

  function render() {
    const view = sourceRect();
    const image = images[layer];
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.drawImage(image,
      view.x * image.width, view.y * image.height, view.width * image.width, view.height * image.height,
      0, 0, cssWidth, cssHeight);
    const vignette = context.createRadialGradient(cssWidth * 0.5, cssHeight * 0.46, cssHeight * 0.16,
      cssWidth * 0.5, cssHeight * 0.5, Math.max(cssWidth, cssHeight) * 0.72);
    vignette.addColorStop(0, "rgba(1, 4, 8, 0)");
    vignette.addColorStop(1, "rgba(1, 4, 8, .46)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, cssWidth, cssHeight);
    pathStroke(scanPath, "rgba(198, 221, 214, .28)", 1, [3, 7]);
    pathStroke(route, "rgba(240, 238, 219, .92)", 2.2);
    pathStroke(drawing, "rgba(240, 238, 219, .7)", 1.6);
    drawMarker(compare[0], "A", "#9d7cff");
    drawMarker(compare[1], "B", "#f5a556");
    if (cursor) {
      const point = screenAt(cursor);
      context.beginPath();
      context.arc(point.x, point.y, cursor.playing ? 13 : 8, 0, Math.PI * 2);
      context.strokeStyle = cursor.sample?.changeDirection === "decrease" ? "#f5a556" :
        cursor.sample?.changeDirection === "increase" ? "#a889ff" : "#f0eee5";
      context.lineWidth = cursor.playing ? 2.3 : 1.4;
      context.stroke();
      context.beginPath();
      context.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
      context.fillStyle = "#fff";
      context.fill();
    }
    host.dataset.layer = layer;
    host.dataset.zoom = zoom.toFixed(3);
  }

  function resize() {
    const box = host.getBoundingClientRect();
    cssWidth = Math.max(1, box.width);
    cssHeight = Math.max(1, box.height);
    ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    render();
  }

  function visibleBounds() {
    const view = sourceRect();
    return {
      west: view.x * 360 - 180,
      east: (view.x + view.width) * 360 - 180,
      north: 90 - view.y * 180,
      south: 90 - (view.y + view.height) * 180,
    };
  }

  function notifyView() { onView({ bounds: visibleBounds(), zoom, layer }); }

  function zoomAt(next, x = cssWidth / 2, y = cssHeight / 2) {
    const before = geographicAt(x, y);
    zoom = clamp(next, 1, 24);
    const after = geographicAt(x, y);
    center.x = clamp(center.x + (before.longitude - after.longitude) / 360, 0, 1);
    center.y = clamp(center.y - (before.latitude - after.latitude) / 180, 0, 1);
    render();
    notifyView();
  }

  function point(event) {
    const box = host.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  host.addEventListener("wheel", (event) => {
    event.preventDefault();
    const at = point(event);
    zoomAt(zoom * (event.deltaY < 0 ? 1.18 : 1 / 1.18), at.x, at.y);
  }, { passive: false });

  host.addEventListener("pointerdown", (event) => {
    // The map contains its own camera and year controls. Do not steal their
    // pointer sequence with capture; doing so retargets the eventual click to
    // the map host instead of the control.
    if (event.target.closest("button, a, input, select, summary")) return;
    const at = point(event);
    pointers.set(event.pointerId, at);
    host.setPointerCapture(event.pointerId);
    if (pointers.size === 2 && mode === "navigate") {
      const values = [...pointers.values()];
      pinch = { distance: Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y), zoom };
      return;
    }
    if (mode === "draw") {
      drawing = [geographicAt(at.x, at.y)];
      render();
      return;
    }
    drag = { at, center: { ...center }, moved: false, pointer: event.pointerId };
  });

  host.addEventListener("pointermove", (event) => {
    const at = point(event);
    pointers.set(event.pointerId, at);
    if (pinch && pointers.size >= 2) {
      const values = [...pointers.values()];
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      const middle = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };
      zoomAt(pinch.zoom * distance / Math.max(1, pinch.distance), middle.x, middle.y);
      return;
    }
    if (mode === "draw" && drawing.length && event.buttons) {
      const coordinate = geographicAt(at.x, at.y);
      const prior = drawing.at(-1);
      if (Math.hypot(coordinate.longitude - prior.longitude, coordinate.latitude - prior.latitude) > 0.08 / zoom) {
        drawing.push(coordinate);
        render();
      }
      return;
    }
    if (drag?.pointer === event.pointerId && event.buttons) {
      const dx = at.x - drag.at.x;
      const dy = at.y - drag.at.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      const view = sourceRect();
      center.x = clamp(drag.center.x - dx / cssWidth * view.width, 0, 1);
      center.y = clamp(drag.center.y - dy / cssHeight * view.height, 0, 1);
      render();
      return;
    }
    if (event.pointerType === "mouse" && event.buttons === 0) {
      const coordinate = geographicAt(at.x, at.y);
      onHover(sampleAt(coordinate.longitude, coordinate.latitude), at.x / cssWidth);
    }
  });

  function finishPointer(event) {
    const at = point(event);
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = undefined;
    if (mode === "draw" && drawing.length) {
      route = resamplePath(drawing, Math.max(36, Math.min(180, drawing.length * 2)));
      drawing = [];
      onDraw([...route]);
      render();
    } else if (drag?.pointer === event.pointerId && !drag.moved) {
      const coordinate = geographicAt(at.x, at.y);
      onSelect(sampleAt(coordinate.longitude, coordinate.latitude));
    }
    if (drag?.pointer === event.pointerId) drag = undefined;
    notifyView();
  }
  host.addEventListener("pointerup", finishPointer);
  host.addEventListener("pointercancel", finishPointer);
  host.addEventListener("pointerleave", () => { if (!drag) onHover(null); });

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  notifyView();

  return {
    sampleAt,
    samplePath(points) { return points.map((point) => sampleAt(point.longitude, point.latitude)); },
    getVisibleBounds: visibleBounds,
    setLayer(next) {
      if (layers.includes(next)) {
        layer = next;
        host.dataset.layer = layer;
        render();
        notifyView();
      }
    },
    get layer() { return layer; },
    setMode(next) { mode = next; host.dataset.interaction = next; if (next !== "draw") drawing = []; render(); },
    get mode() { return mode; },
    setCursor(sample, playing = false) { cursor = sample ? { ...sample, sample, playing } : undefined; render(); },
    setRoute(points) { route = points ? [...points] : []; render(); },
    getRoute() { return [...route]; },
    clearRoute() { route = []; drawing = []; render(); },
    setScanPath(points) { scanPath = points ? [...points] : []; render(); },
    setCompare(points) { compare = points.filter(Boolean).map((sample) => ({ longitude: sample.longitude, latitude: sample.latitude })); render(); },
    zoom(ratio) { zoomAt(zoom * ratio); },
    move(dx, dy) {
      const view = sourceRect();
      center.x = clamp(center.x + dx * view.width, 0, 1);
      center.y = clamp(center.y + dy * view.height, 0, 1);
      render(); notifyView();
    },
    focus(longitude = 78.5, latitude = 24.5, nextZoom = 5.6) {
      center = { x: (longitude + 180) / 360, y: (90 - latitude) / 180 };
      zoom = clamp(nextZoom, 1, 24);
      render(); notifyView();
    },
    reset() { center = { x: 0.5, y: 0.5 }; zoom = 1; render(); notifyView(); },
    render,
    dispose() {
      observer.disconnect();
      for (const image of Object.values(images)) image.close?.();
      host.replaceChildren();
    },
    bounds: WORLD_BOUNDS,
  };
}
