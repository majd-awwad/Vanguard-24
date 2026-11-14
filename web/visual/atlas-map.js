import { land } from "./land.js";

const namespace = "http://www.w3.org/2000/svg";
const viewport = Object.freeze({ x: 48, y: 27, width: 612, height: 288 });
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function cameraFor({ scale = 1, x = 0, y = 0 } = {}) {
  const zoom = clamp(scale, 1, 5);
  return {
    scale: zoom,
    x: clamp(x, viewport.width * (1 - zoom), 0),
    y: clamp(y, viewport.height * (1 - zoom), 0),
  };
}

export function svg(name, attrs, text) {
  const node = document.createElementNS(namespace, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createAtlasMap(host, { onSelect, onZoom }) {
  const v = viewport;
  const middle = [v.width / 2, v.height / 2];
  const map = svg("svg", { viewBox: "0 0 706 342", "aria-hidden": "true", focusable: "false" });
  const clip = svg("clipPath", { id: "atlas-map-extent" });
  clip.append(svg("rect", { x: v.x, y: v.y, width: v.width, height: v.height }));
  const layer = svg("g", { "clip-path": "url(#atlas-map-extent)" });
  const geography = svg("g", {});
  const base = svg("g", {});
  const grid = svg("g", {});
  const dataLayer = svg("g", { class: "atlas-observations" });
  const ticks = svg("g", {});
  geography.append(base, grid, dataLayer);
  layer.append(geography);
  map.append(clip, layer, ticks);
  host.replaceChildren(map);
  let camera = cameraFor();
  let previousCase;
  let drag;
  let ignoreClick = false;

  function update(next) {
    camera = cameraFor(next);
    geography.setAttribute("transform", `translate(${v.x + camera.x} ${v.y + camera.y}) scale(${camera.scale}) translate(${-v.x} ${-v.y})`);
    ticks.style.visibility = camera.scale === 1 ? "visible" : "hidden";
    host.dataset.zoom = String(camera.scale);
    host.dataset.panX = String(camera.x);
    host.dataset.panY = String(camera.y);
    onZoom?.(camera.scale);
  }

  function zoom(ratio, atX = middle[0], atY = middle[1]) {
    const scale = clamp(camera.scale * ratio, 1, 5);
    const change = scale / camera.scale;
    update({
      scale, x: atX - (atX - camera.x) * change,
      y: atY - (atY - camera.y) * change,
    });
  }

  function point(event) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(map.getScreenCTM().inverse());
  }

  map.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const { x, y } = point(event);
    zoom(event.deltaY < 0 ? 1.16 : 1 / 1.16, x - v.x, y - v.y);
  }, { passive: false });
  map.addEventListener("pointerdown", (event) => {
    ignoreClick = false;
    if (camera.scale === 1 || event.button !== 0) return;
    drag = { start: point(event), camera, pointer: event.pointerId };
  });
  map.addEventListener("pointermove", (event) => {
    if (drag?.pointer !== event.pointerId) return;
    const { x, y } = point(event);
    const dx = x - drag.start.x;
    const dy = y - drag.start.y;
    if (Math.hypot(dx, dy) < 3 && !ignoreClick) return;
    ignoreClick = true;
    if (!map.hasPointerCapture(event.pointerId)) map.setPointerCapture(event.pointerId);
    update({ ...drag.camera, x: drag.camera.x + dx, y: drag.camera.y + dy });
  });
  for (const type of ["pointercancel", "pointerup", "lostpointercapture", "pointerleave"]) {
    map.addEventListener(type, (event) => {
      if (type === "pointerleave" && map.hasPointerCapture(event.pointerId)) return;
      if (drag?.pointer === event.pointerId) drag = null;
    });
  }
  map.addEventListener("click", (event) => {
    if (ignoreClick) return;
    const id = event.target.closest("[data-site]")?.dataset.site;
    if (id) onSelect(id);
  });

  function render({ data, event, sites, comparisonId, label, color, detections }) {
    const { west, east, north, south } = data.bounds;
    const x = (lon) => v.x + (lon - west) / (east - west) * v.width;
    const y = (lat) => v.y + (north - lat) / (north - south) * v.height;
    const isFire = data.kind === "windowed-events";
    const latitudes = isFire ? [40, 43, 46, 49, 52] : [...new Set(data.cells.map((cell) => cell.lat))];
    const longitudes = isFire ? [15, 20, 25, 30, 35, 40] : [...new Set(data.cells.map((cell) => cell.lon))];
    if (previousCase !== data.id) {
      previousCase = data.id;
      update({});
      const image = svg("image", {
        href: new URL(`../assets/map/${data.id}.jpg`, import.meta.url).href,
        x: v.x, y: v.y, width: v.width, height: v.height, preserveAspectRatio: "none", opacity: 0.66,
      });
      base.replaceChildren(svg("path", { d: land[data.id], class: "map-land" }), image, svg("path", {
        d: land[data.id], class: "map-coast", "pointer-events": "none",
      }));
    }
    grid.replaceChildren();
    ticks.replaceChildren();
    for (const [index, lat] of latitudes.entries()) {
      grid.append(svg("line", { x1: v.x, x2: v.x + v.width, y1: y(lat), y2: y(lat), class: "gridline" }));
      if (index % 2 === 0) ticks.append(svg("text", { x: v.x - 9, y: y(lat) + 4, class: "gridlabel", "text-anchor": "end" }, `${label(lat)}°`));
    }
    for (const [index, lon] of longitudes.entries()) {
      grid.append(svg("line", { x1: x(lon), y1: v.y, x2: x(lon), y2: v.y + v.height, class: "gridline" }));
      if (index % 2 === 0) ticks.append(svg("text", { x: x(lon), y: v.y + v.height + 18, class: "gridlabel", "text-anchor": "middle" }, `${label(lon)}°`));
    }
    const nodes = [];
    const { index, evidence } = event;
    if (isFire) {
      for (const site of sites) {
        const bounds = site.bounds;
        nodes.push(svg("rect", { x: x(bounds.west), y: y(bounds.north),
          width: x(bounds.east) - x(bounds.west), height: y(bounds.south) - y(bounds.north), "data-site": site.id,
          class: site.id === evidence.site.id ? "fire-box active" : "fire-box" }));
        for (const detection of detections(data, site, index)) {
          nodes.push(svg("circle", { cx: x(detection.lon), cy: y(detection.lat), r: 2.5 + Math.sqrt(Math.min(1, detection.frpMW / 300)) * 6,
            fill: color(detection.frpMW), class: "fire-dot", "data-site": site.id }));
        }
      }
      if (evidence.peak) nodes.push(svg("circle", { cx: x(evidence.peak.lon), cy: y(evidence.peak.lat), r: 11, class: "fire-peak", "pointer-events": "none" }));
    } else {
      for (const site of sites) {
        const reading = site.samples[index]?.value ?? null;
        const primary = site.id === evidence.site.id;
        const mark = svg("g", { class: `map-site${primary ? " active" : comparisonId === site.id ? " comparison" : ""}` });
        const cx = x(site.lon), cy = y(site.lat);
        if (primary || comparisonId === site.id) mark.append(svg("circle", { cx, cy, r: 12, class: "site-ring" }));
        mark.append(svg("circle", { cx, cy, r: 6, fill: color(reading), class: "sample-dot" }),
          svg("circle", { cx, cy, r: 12, class: "site-hit", "data-site": site.id }));
        nodes.push(mark);
      }
    }
    dataLayer.replaceChildren(...nodes);
    host.dataset.event = event.id;
  }

  update({});
  return {
    render, zoom,
    move(x, y) { update({ ...camera, x: camera.x + x, y: camera.y + y }); },
    reset() { update({}); },
    showLayer(show) { dataLayer.style.display = show ? "" : "none"; },
  };
}
