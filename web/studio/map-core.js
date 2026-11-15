// Dataset-agnostic map engine shared by both Earth Sound Studio experiences.
//
// The engine owns the canvas, the plate-carree camera (centre + zoom over a 360 x 180 degree world), every pointer /
// wheel / pinch gesture, and the shared overlays (cursor, drawn route, scan path, A/B markers, selection rectangle).
// It knows nothing about the data it shows:
//   - a `layer` paints the picture (an image for night lights, a numeric grid for dust), and
//   - a `sampleAt(longitude, latitude)` function turns a geographic point into whatever the app calls a sample.
// web/studio/map.js (night lights) and web/studio/dust-layer.js (GEOS-FP dust) are the two thin users.

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const NO_INSETS = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

export function createMapCore(host, {
  layer,
  sampleAt = () => null,
  initialView = { longitude: 0, latitude: 0, zoom: 1 },
  minZoom = 1,
  maxZoom = 24,
  wheel = "step",           // "step": one fixed step per wheel event; "smooth": proportional to the wheel delta
  inertia = false,          // kinetic panning after a drag
  animate = 0,              // milliseconds for programmatic camera moves (0 = instant)
  deferred = false,         // true: coalesce redraws into one animation frame
  insets = () => NO_INSETS, // pixels of the map covered by floating panels; defines the "usable" viewport
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  resampleRoute = (points) => points,
  drawClickSelects = false, // true: a click (no stroke) in draw mode calls onSelect instead of finishing a route
  cursorColor = () => "#f0eee5",
  routeHalo = false,        // dark under-stroke so a route stays readable on bright layers
  canvasClass = "studio-map-canvas",
  onHover = () => {},
  onSelect = () => {},
  onDraw = () => {},
  onRect = () => {},
  onView = () => {},
} = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = canvasClass;
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const context = canvas.getContext("2d", { alpha: false });

  let cssWidth = 1;
  let cssHeight = 1;
  let ratio = 1;
  let zoom = clamp(initialView.zoom ?? 1, minZoom, maxZoom);
  let center = { x: (initialView.longitude + 180) / 360, y: (90 - initialView.latitude) / 180 };
  let mode = "navigate";
  let cursor;
  let route = [];
  let scanPath = [];
  let markers = [];
  let rect = null;
  let drawing = [];
  let rectStart = null;
  let drag;
  let pinch;
  let frameRequest = 0;
  let motion = 0;
  let disposed = false;
  const pointers = new Map();

  function sourceRect() {
    const imageAspect = layer.aspect ?? 2;
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

  function screenAt({ longitude, latitude }, view = sourceRect()) {
    const u = (longitude + 180) / 360;
    const v = (90 - latitude) / 180;
    return { x: (u - view.x) / view.width * cssWidth, y: (v - view.y) / view.height * cssHeight };
  }

  /** The part of the canvas that no floating panel covers, in CSS pixels. */
  function safeRect() {
    const inset = insets() ?? NO_INSETS;
    const left = clamp(inset.left ?? 0, 0, cssWidth * 0.6);
    const right = clamp(inset.right ?? 0, 0, cssWidth * 0.6);
    const top = clamp(inset.top ?? 0, 0, cssHeight * 0.6);
    const bottom = clamp(inset.bottom ?? 0, 0, cssHeight * 0.6);
    return { x: left, y: top, width: Math.max(1, cssWidth - left - right), height: Math.max(1, cssHeight - top - bottom) };
  }

  function boundsOf(area) {
    const a = geographicAt(area.x, area.y);
    const b = geographicAt(area.x + area.width, area.y + area.height);
    return { west: a.longitude, east: b.longitude, north: a.latitude, south: b.latitude };
  }

  /** `safe: true` returns only what is not hidden behind floating panels. */
  function visibleBounds({ safe = false } = {}) {
    return boundsOf(safe ? safeRect() : { x: 0, y: 0, width: cssWidth, height: cssHeight });
  }

  function makeFrame() {
    const view = sourceRect();
    return {
      view, width: cssWidth, height: cssHeight, ratio, zoom,
      pixelsPerDegree: cssWidth / (view.width * 360),
      safe: safeRect(),
      bounds: visibleBounds(),
      toScreen: (point) => screenAt(point, view),
      toGeo: geographicAt,
    };
  }

  function pathStroke(points, color, width = 1.4, dash = []) {
    if (points.length < 2) return;
    const view = sourceRect();
    context.beginPath();
    points.forEach((point, index) => {
      const screen = screenAt(point, view);
      if (index === 0) context.moveTo(screen.x, screen.y);
      else context.lineTo(screen.x, screen.y);
    });
    context.strokeStyle = color;
    context.lineWidth = width;
    context.setLineDash(dash);
    context.stroke();
    context.setLineDash([]);
  }

  function drawMarker(marker) {
    const screen = screenAt(marker);
    if (screen.x < -30 || screen.y < -30 || screen.x > cssWidth + 30 || screen.y > cssHeight + 30) return;
    const radius = marker.radius ?? 10;
    context.beginPath();
    context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(4, 8, 13, .78)";
    context.fill();
    context.strokeStyle = marker.color ?? "#f0eee5";
    context.lineWidth = marker.active ? 3 : 1.5;
    context.stroke();
    context.fillStyle = "#f5f2ec";
    context.font = `600 ${Math.round(radius)}px IBM Plex Mono, Plex Mono, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(marker.label ?? "", screen.x, screen.y + 0.5);
  }

  function drawDefaultCursor(frame) {
    const point = frame.toScreen(cursor);
    context.beginPath();
    context.arc(point.x, point.y, cursor.playing ? 13 : 8, 0, Math.PI * 2);
    context.strokeStyle = cursorColor(cursor.sample);
    context.lineWidth = cursor.playing ? 2.3 : 1.4;
    context.stroke();
    context.beginPath();
    context.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
  }

  function render() {
    if (disposed) return;
    if (frameRequest) { cancelAnimationFrame(frameRequest); frameRequest = 0; }
    const frame = makeFrame();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    layer.draw(context, frame);
    layer.decorate?.(context, frame, { cursor, mode });
    pathStroke(scanPath, "rgba(198, 221, 214, .28)", 1, [3, 7]);
    if (rect) {
      const a = frame.toScreen({ longitude: rect.west, latitude: rect.north });
      const b = frame.toScreen({ longitude: rect.east, latitude: rect.south });
      context.fillStyle = "rgba(240, 238, 219, .08)";
      context.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      context.strokeStyle = "rgba(240, 238, 219, .95)";
      context.lineWidth = 1.6;
      context.setLineDash([7, 5]);
      context.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      context.setLineDash([]);
    }
    if (routeHalo) pathStroke(route, "rgba(4, 8, 13, .55)", 4.6);
    pathStroke(route, "rgba(240, 238, 219, .92)", 2.2);
    pathStroke(drawing, "rgba(240, 238, 219, .7)", 1.6);
    for (const marker of markers) drawMarker(marker);
    if (cursor) (layer.drawCursor ?? ((_, f) => drawDefaultCursor(f)))(context, frame, cursor);
    host.dataset.zoom = zoom.toFixed(3);
  }

  function invalidate() {
    if (!deferred) { render(); return; }
    if (!frameRequest) frameRequest = requestAnimationFrame(() => { frameRequest = 0; render(); });
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
    notifyView();
  }

  function notifyView() { onView({ bounds: visibleBounds(), safeBounds: visibleBounds({ safe: true }), zoom }); }

  function stopMotion() {
    if (motion) cancelAnimationFrame(motion);
    motion = 0;
  }

  function zoomAt(next, x = cssWidth / 2, y = cssHeight / 2) {
    const before = geographicAt(x, y);
    zoom = clamp(next, minZoom, maxZoom);
    const after = geographicAt(x, y);
    center.x = clamp(center.x + (before.longitude - after.longitude) / 360, 0, 1);
    center.y = clamp(center.y - (before.latitude - after.latitude) / 180, 0, 1);
    invalidate();
    notifyView();
  }

  /** Runs `change` on the camera and animates from the old camera to the new one (instant when motion is reduced). */
  function transition(change) {
    stopMotion();
    const from = { x: center.x, y: center.y, zoom };
    change();
    if (!animate || reducedMotion()) { invalidate(); notifyView(); return; }
    const to = { x: center.x, y: center.y, zoom };
    const start = performance.now();
    const step = (now) => {
      const t = clamp((now - start) / animate, 0, 1);
      const eased = 1 - (1 - t) ** 3;
      center = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
      zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * eased);
      invalidate();
      notifyView();
      motion = t < 1 ? requestAnimationFrame(step) : 0;
    };
    center = { x: from.x, y: from.y };
    zoom = from.zoom;
    motion = requestAnimationFrame(step);
  }

  function silentZoomAt(next, x, y) {
    const before = geographicAt(x, y);
    zoom = clamp(next, minZoom, maxZoom);
    const after = geographicAt(x, y);
    center.x = clamp(center.x + (before.longitude - after.longitude) / 360, 0, 1);
    center.y = clamp(center.y - (before.latitude - after.latitude) / 180, 0, 1);
  }

  function glide(velocity) {
    // velocity: normalised world units per millisecond, already in "centre" direction.
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      center.x = clamp(center.x + velocity.x * dt, 0, 1);
      center.y = clamp(center.y + velocity.y * dt, 0, 1);
      const decay = Math.exp(-dt / 240);
      velocity.x *= decay;
      velocity.y *= decay;
      invalidate();
      notifyView();
      const view = sourceRect();
      const speed = Math.hypot(velocity.x / view.width * cssWidth, velocity.y / view.height * cssHeight);
      motion = speed > 0.02 ? requestAnimationFrame(step) : 0;
    };
    motion = requestAnimationFrame(step);
  }

  function point(event) {
    const box = host.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  host.addEventListener("wheel", (event) => {
    event.preventDefault();
    stopMotion();
    const at = point(event);
    const factor = wheel === "smooth"
      ? Math.exp(-clamp(event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0016), -0.6, 0.6))
      : (event.deltaY < 0 ? 1.18 : 1 / 1.18);
    zoomAt(zoom * factor, at.x, at.y);
    if (event.buttons === 0 && mode === "navigate") {
      const coordinate = geographicAt(at.x, at.y);
      onHover(sampleAt(coordinate.longitude, coordinate.latitude), at.x / cssWidth, at);
    }
  }, { passive: false });

  host.addEventListener("pointerdown", (event) => {
    // The map may contain its own controls. Do not steal their pointer sequence with capture; doing so retargets
    // the eventual click to the map host instead of the control.
    if (event.target.closest("button, a, input, select, summary")) return;
    stopMotion();
    const at = point(event);
    pointers.set(event.pointerId, at);
    host.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      // Two fingers always navigate, whatever tool is active; an unfinished stroke is abandoned.
      const values = [...pointers.values()];
      pinch = { distance: Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y), zoom };
      drawing = [];
      rectStart = null;
      drag = undefined;
      invalidate();
      return;
    }
    if (mode === "draw") {
      drawing = [geographicAt(at.x, at.y)];
      invalidate();
      return;
    }
    if (mode === "rect") {
      rectStart = { at, geo: geographicAt(at.x, at.y) };
      return;
    }
    drag = { at, center: { ...center }, moved: false, pointer: event.pointerId, trail: [{ t: performance.now(), x: at.x, y: at.y }] };
  });

  host.addEventListener("pointermove", (event) => {
    const at = point(event);
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, at);
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
        invalidate();
      }
      return;
    }
    if (mode === "rect" && rectStart && event.buttons) {
      const here = geographicAt(at.x, at.y);
      rect = {
        west: Math.min(rectStart.geo.longitude, here.longitude), east: Math.max(rectStart.geo.longitude, here.longitude),
        south: Math.min(rectStart.geo.latitude, here.latitude), north: Math.max(rectStart.geo.latitude, here.latitude),
      };
      invalidate();
      return;
    }
    if (drag?.pointer === event.pointerId && event.buttons) {
      const dx = at.x - drag.at.x;
      const dy = at.y - drag.at.y;
      if (Math.hypot(dx, dy) > 3) { drag.moved = true; host.dataset.dragging = "true"; }
      const view = sourceRect();
      center.x = clamp(drag.center.x - dx / cssWidth * view.width, 0, 1);
      center.y = clamp(drag.center.y - dy / cssHeight * view.height, 0, 1);
      drag.trail.push({ t: performance.now(), x: at.x, y: at.y });
      if (drag.trail.length > 6) drag.trail.shift();
      invalidate();
      if (deferred) notifyView();
      return;
    }
    if (event.pointerType === "mouse" && event.buttons === 0) {
      const coordinate = geographicAt(at.x, at.y);
      onHover(sampleAt(coordinate.longitude, coordinate.latitude), at.x / cssWidth, at);
    }
  });

  function finishPointer(event) {
    const at = point(event);
    const tracked = pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = undefined;
    if (mode === "draw" && drawing.length) {
      const stroke = drawing;
      drawing = [];
      if (stroke.length > 1 || !drawClickSelects) {
        route = resampleRoute(stroke);
        onDraw([...route]);
      } else if (tracked) {
        // A click without a stroke: let the app add a single vertex.
        onSelect(sampleAt(stroke[0].longitude, stroke[0].latitude), { mode });
      }
      invalidate();
    } else if (mode === "rect" && rectStart) {
      const moved = Math.hypot(at.x - rectStart.at.x, at.y - rectStart.at.y);
      const start = rectStart;
      rectStart = null;
      if (moved < 6) {
        onSelect(sampleAt(start.geo.longitude, start.geo.latitude), { mode });
      } else if (rect) {
        onRect({ ...rect });
      }
      invalidate();
    } else if (drag?.pointer === event.pointerId && !drag.moved && event.type === "pointerup") {
      const coordinate = geographicAt(at.x, at.y);
      onSelect(sampleAt(coordinate.longitude, coordinate.latitude), { mode });
    }
    if (drag?.pointer === event.pointerId) {
      const finished = drag;
      drag = undefined;
      delete host.dataset.dragging;
      if (inertia && finished.moved && event.type === "pointerup" && !reducedMotion()) {
        const now = performance.now();
        const recent = finished.trail.filter((entry) => now - entry.t < 90);
        const first = recent[0];
        const last = recent.at(-1);
        if (first && last && last.t - first.t > 8) {
          const view = sourceRect();
          const vx = -(last.x - first.x) / (last.t - first.t) / cssWidth * view.width;
          const vy = -(last.y - first.y) / (last.t - first.t) / cssHeight * view.height;
          if (Math.hypot(last.x - first.x, last.y - first.y) / (last.t - first.t) > 0.25) glide({ x: vx, y: vy });
        }
      }
    }
    notifyView();
  }
  host.addEventListener("pointerup", finishPointer);
  host.addEventListener("pointercancel", finishPointer);
  host.addEventListener("pointerleave", () => { if (!drag) onHover(null); });

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  function setCamera(longitude, latitude, nextZoom) {
    center = { x: clamp((longitude + 180) / 360, 0, 1), y: clamp((90 - latitude) / 180, 0, 1) };
    zoom = clamp(nextZoom, minZoom, maxZoom);
  }

  /** Camera that shows `bounds` as large as possible inside the usable viewport. */
  function fitCamera(bounds, margin = 0.06) {
    const safe = safeRect();
    const spanLon = (bounds.east - bounds.west) * (1 + margin * 2);
    const spanLat = (bounds.north - bounds.south) * (1 + margin * 2);
    const aspect = layer.aspect ?? 2;
    const ppdX = safe.width / spanLon;
    const ppdY = safe.height / spanLat;
    // Horizontal pixels per degree at zoom z: cssWidth * z / 360. Vertical: cssWidth * z / (aspect * 180).
    const nextZoom = clamp(Math.min(ppdX * 360 / cssWidth, ppdY * aspect * 180 / cssWidth), minZoom, maxZoom);
    const ppdLon = cssWidth * nextZoom / 360;
    const ppdLat = cssWidth * nextZoom / (aspect * 180);
    const longitude = (bounds.west + bounds.east) / 2 - (safe.x + safe.width / 2 - cssWidth / 2) / ppdLon;
    const latitude = (bounds.south + bounds.north) / 2 + (safe.y + safe.height / 2 - cssHeight / 2) / ppdLat;
    setCamera(longitude, latitude, nextZoom);
  }

  return {
    canvas,
    sampleAt,
    samplePath(points) { return points.map((entry) => sampleAt(entry.longitude, entry.latitude)); },
    getVisibleBounds: visibleBounds,
    getSafeRect: safeRect,
    geographicAt,
    screenAt: (entry) => screenAt(entry),
    get zoomLevel() { return zoom; },
    get pixelsPerDegree() { return cssWidth / (sourceRect().width * 360); },
    get size() { return { width: cssWidth, height: cssHeight }; },
    setMode(next) {
      mode = next;
      host.dataset.interaction = next;
      if (next !== "draw") drawing = [];
      if (next !== "rect") rectStart = null;
      invalidate();
    },
    get mode() { return mode; },
    setCursor(sample, playing = false) { cursor = sample ? { ...sample, sample, playing } : undefined; invalidate(); },
    setRoute(points) { route = points ? [...points] : []; invalidate(); },
    getRoute() { return [...route]; },
    clearRoute() { route = []; drawing = []; invalidate(); },
    setScanPath(points) { scanPath = points ? [...points] : []; invalidate(); },
    setMarkers(next) { markers = (next ?? []).filter(Boolean); invalidate(); },
    setRect(next) { rect = next ? { ...next } : null; invalidate(); },
    getRect() { return rect ? { ...rect } : null; },
    zoom(factor) {
      const safe = safeRect();
      const x = safe.x + safe.width / 2;
      const y = safe.y + safe.height / 2;
      transition(() => silentZoomAt(zoom * factor, x, y));
    },
    move(dx, dy) {
      transition(() => {
        const view = sourceRect();
        center.x = clamp(center.x + dx * view.width, 0, 1);
        center.y = clamp(center.y + dy * view.height, 0, 1);
      });
    },
    /** Pans by a geographic offset in degrees. */
    moveBy(longitude, latitude) {
      transition(() => {
        const view = sourceRect();
        center.x = clamp(view.x + view.width / 2 + longitude / 360, 0, 1);
        center.y = clamp(view.y + view.height / 2 - latitude / 180, 0, 1);
      });
    },
    focus(longitude, latitude, nextZoom) { transition(() => setCamera(longitude, latitude, nextZoom)); },
    fit(bounds, margin, { instant = false } = {}) {
      if (instant) { stopMotion(); fitCamera(bounds, margin); invalidate(); notifyView(); } else transition(() => fitCamera(bounds, margin));
    },
    reset() { transition(() => { center = { x: 0.5, y: 0.5 }; zoom = minZoom; }); },
    render,
    invalidate,
    dispose() {
      disposed = true;
      stopMotion();
      if (frameRequest) cancelAnimationFrame(frameRequest);
      observer.disconnect();
      canvas.remove();
    },
  };
}
