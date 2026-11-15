import { cellAt, cellRect, diffS, layerT, rampTable, splineWeights } from "./field.js";

// Numeric-grid layer for the shared map engine (map-core.js): NASA GEOS-FP dust optical depth over a Blue Marble
// base map. Everything painted here is display only:
//   - the smooth colour field is a cubic B-spline of the per-cell colour-scale positions (field.js), drawn with the
//     same fixed log scale as the legend;
//   - values are never interpolated: sampleAt() returns the real value of the grid cell that contains the point,
//     `null` for a missing cell, and `inside: false` (no value at all) outside the grid;
//   - outside the grid the Earth is dimmed and hatched so it is obvious where data exists;
//   - coastlines are traced from the Blue Marble image itself (dark water vs. land), for orientation only.

const FIELD_SCALE = 24;            // field pixels per grid cell
const COAST_MARGIN = { lon: 28, lat: 14 };
const COAST_THRESHOLD = 13;        // red channel: open water in Blue Marble is ~2, the darkest forest ~25
const GRATICULE_STEPS = [30, 20, 10, 5, 2, 1, 0.5];
const TEAL = "104, 224, 208";

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image failed: ${url}`));
    image.src = url;
  });
}

function hatchPattern(context, color, gap = 8, width = 1.2) {
  const tile = document.createElement("canvas");
  tile.width = gap;
  tile.height = gap;
  const c = tile.getContext("2d");
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  for (const offset of [-gap, 0, gap]) { c.moveTo(offset, gap); c.lineTo(offset + gap, 0); }
  c.stroke();
  return context.createPattern(tile, "repeat");
}

/** Smooth colour field for one layer, as a canvas registered to the grid bounds. Missing cells stay transparent. */
export function buildFieldCanvas(values, grid, mode) {
  const { rows, cols } = grid;
  const width = cols * FIELD_SCALE;
  const height = rows * FIELD_SCALE;
  const surface = document.createElement("canvas");
  surface.width = width;
  surface.height = height;
  const context = surface.getContext("2d");
  const image = context.createImageData(width, height);
  const { t, mask } = layerT(values, grid, mode);
  const table = rampTable(mode === "diff" ? "diff" : "value");
  // Separable cubic B-spline: weights and clamped source indices per output column / row.
  const axis = (count, cells) => {
    const index = new Int32Array(count * 4);
    const weight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const g = (i + 0.5) / FIELD_SCALE - 0.5;
      const base = Math.floor(g);
      const w = splineWeights(g - base);
      for (let k = 0; k < 4; k++) { index[i * 4 + k] = clamp(base - 1 + k, 0, cells - 1); weight[i * 4 + k] = w[k]; }
    }
    return { index, weight };
  };
  const ax = axis(width, cols);
  const ay = axis(height, rows);
  const data = image.data;
  for (let y = 0; y < height; y++) {
    const cellRow = Math.min(rows - 1, Math.floor(y / FIELD_SCALE));
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (mask[cellRow * cols + Math.min(cols - 1, Math.floor(x / FIELD_SCALE))]) continue;
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const row = ay.index[y * 4 + j] * cols;
        const wy = ay.weight[y * 4 + j];
        for (let i = 0; i < 4; i++) sum += t[row + ax.index[x * 4 + i]] * ax.weight[x * 4 + i] * wy;
      }
      const position = clamp(sum, 0, 1);
      const entry = Math.round(position * 255) * 4;
      data[o] = table[entry];
      data[o + 1] = table[entry + 1];
      data[o + 2] = table[entry + 2];
      // More dust (or a bigger change) is more opaque, so coasts stay readable where there is little to show.
      data[o + 3] = Math.round(255 * (mode === "diff" ? 0.3 + 0.62 * Math.min(1, Math.abs(position - 0.5) * 2.4) : 0.5 + 0.42 * position));
    }
  }
  context.putImageData(image, 0, 0);
  return surface;
}

/** Coastline of the area around the grid, traced from the base image with marching squares. Returns a Path2D in degrees. */
function traceCoast(image, bounds) {
  const west = Math.max(-180, bounds.west - COAST_MARGIN.lon);
  const east = Math.min(180, bounds.east + COAST_MARGIN.lon);
  const south = Math.max(-90, bounds.south - COAST_MARGIN.lat);
  const north = Math.min(90, bounds.north + COAST_MARGIN.lat);
  const sx = Math.floor((west + 180) / 360 * image.width);
  const sy = Math.floor((90 - north) / 180 * image.height);
  const w = Math.min(image.width - sx, Math.ceil((east - west) / 360 * image.width));
  const h = Math.min(image.height - sy, Math.ceil((north - south) / 180 * image.height));
  const surface = document.createElement("canvas");
  surface.width = w;
  surface.height = h;
  const context = surface.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, sx, sy, w, h, 0, 0, w, h);
  const pixels = context.getImageData(0, 0, w, h).data;
  // Land-ness: red channel, lightly blurred so JPEG noise does not become islands.
  const raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) raw[i] = pixels[i * 4];
  const field = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += raw[yy * w + xx];
          count++;
        }
      }
      field[y * w + x] = sum / count;
    }
  }
  const lonOf = (x) => (sx + x + 0.5) / image.width * 360 - 180;
  const latOf = (y) => 90 - (sy + y + 0.5) / image.height * 180;
  const path = new Path2D();
  const T = COAST_THRESHOLD;
  const segment = (ax, ay, bx, by) => { path.moveTo(lonOf(ax), latOf(ay)); path.lineTo(lonOf(bx), latOf(by)); };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = field[y * w + x];
      const b = field[y * w + x + 1];
      const c = field[(y + 1) * w + x + 1];
      const d = field[(y + 1) * w + x];
      const code = (a > T ? 1 : 0) | (b > T ? 2 : 0) | (c > T ? 4 : 0) | (d > T ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const top = [x + (T - a) / (b - a), y];
      const right = [x + 1, y + (T - b) / (c - b)];
      const bottom = [x + (T - d) / (c - d), y + 1];
      const left = [x, y + (T - a) / (d - a)];
      switch (code) {
        case 1: case 14: segment(...left, ...top); break;
        case 2: case 13: segment(...top, ...right); break;
        case 3: case 12: segment(...left, ...right); break;
        case 4: case 11: segment(...right, ...bottom); break;
        case 6: case 9: segment(...top, ...bottom); break;
        case 7: case 8: segment(...left, ...bottom); break;
        case 5: segment(...left, ...top); segment(...right, ...bottom); break;
        case 10: segment(...top, ...right); segment(...left, ...bottom); break;
        default: break;
      }
    }
  }
  return path;
}

export function createDustLayer({
  grid,
  earthUrl,
  formatValue = (value) => String(value),
  formatLatitude = (value) => `${value}°`,
  formatLongitude = (value) => `${value}°`,
  labels = { region: "", outside: "" },
  onChange = () => {},
}) {
  const { bounds, rows, cols } = grid;
  const dLon = (bounds.east - bounds.west) / cols;
  const dLat = (bounds.north - bounds.south) / rows;
  let earth = null;
  let coast = null;
  let field = null;
  let values = [];
  let mode = "value";
  let scan = null;       // { rect } while a scan or path is loaded
  let finder = null;     // bounds "Play visible area" would read right now
  let outlines = [];     // rectangles of area places (A / B)
  let patterns = null;

  loadImage(earthUrl).then((image) => {
    earth = image;
    onChange();
    const trace = () => { try { coast = traceCoast(image, bounds); onChange(); } catch (error) { console.warn("Coastline trace skipped", error); } };
    (globalThis.requestIdleCallback ?? ((run) => setTimeout(run, 60)))(trace, { timeout: 800 });
  }).catch((error) => { console.warn(error); onChange(); });

  function sampleAt(longitude, latitude) {
    const cell = cellAt(grid, longitude, latitude);
    if (!cell) return Object.freeze({ longitude, latitude, inside: false, cell: null, value: undefined, kind: mode === "diff" ? "change" : "dust" });
    const value = values[cell.index];
    return Object.freeze({
      longitude, latitude, inside: true, cell, kind: mode === "diff" ? "change" : "dust",
      value: value === null || value === undefined || !Number.isFinite(value) ? null : value,
    });
  }

  function ensurePatterns(context) {
    patterns ??= {
      outside: hatchPattern(context, "rgba(190, 205, 215, .13)", 10, 1),
      missing: hatchPattern(context, "rgba(215, 222, 230, .62)", 7, 1.6),
    };
    return patterns;
  }

  function haloText(context, text, x, y, { color = "rgba(240, 244, 250, .92)", halo = "rgba(3, 7, 11, .85)", width = 3.5 } = {}) {
    context.lineJoin = "round";
    context.lineWidth = width;
    context.strokeStyle = halo;
    context.strokeText(text, x, y);
    context.fillStyle = color;
    context.fillText(text, x, y);
  }

  function regionBox(frame) {
    const a = frame.toScreen({ longitude: bounds.west, latitude: bounds.north });
    const b = frame.toScreen({ longitude: bounds.east, latitude: bounds.south });
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  }

  function draw(context, frame) {
    const { view, width, height } = frame;
    const pattern = ensurePatterns(context);
    context.fillStyle = "#03070b";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (earth) {
      context.drawImage(earth, view.x * earth.width, view.y * earth.height, view.width * earth.width, view.height * earth.height, 0, 0, width, height);
    }
    const box = regionBox(frame);
    // Outside the grid: dimmed and hatched. There is no data there and none is implied.
    context.save();
    context.beginPath();
    context.rect(0, 0, width, height);
    context.rect(box.x, box.y, box.width, box.height);
    context.clip("evenodd");
    context.fillStyle = "rgba(3, 7, 11, .56)";
    context.fillRect(0, 0, width, height);
    context.fillStyle = pattern.outside;
    context.fillRect(0, 0, width, height);
    context.restore();
    // Inside: a light veil so the colour field reads the same over sea and desert.
    context.fillStyle = "rgba(3, 7, 11, .22)";
    context.fillRect(box.x, box.y, box.width, box.height);
    if (field) context.drawImage(field, box.x, box.y, box.width, box.height);

    const ppd = frame.pixelsPerDegree;
    const cellWidth = dLon * ppd;
    const cellHeight = dLat * ppd;
    const visible = frame.bounds;
    const col0 = clamp(Math.floor((visible.west - bounds.west) / dLon), 0, cols - 1);
    const col1 = clamp(Math.floor((visible.east - bounds.west) / dLon), 0, cols - 1);
    const row0 = clamp(Math.floor((bounds.north - visible.north) / dLat), 0, rows - 1);
    const row1 = clamp(Math.floor((bounds.north - visible.south) / dLat), 0, rows - 1);
    const onScreen = visible.east > bounds.west && visible.west < bounds.east && visible.north > bounds.south && visible.south < bounds.north;

    // Missing cells: hatched, never coloured.
    if (onScreen) {
      for (let row = row0; row <= row1; row++) {
        for (let col = col0; col <= col1; col++) {
          const value = values[row * cols + col];
          if (value !== null && value !== undefined) continue;
          const x = box.x + col * cellWidth;
          const y = box.y + row * cellHeight;
          context.fillStyle = "rgba(20, 26, 34, .78)";
          context.fillRect(x, y, cellWidth, cellHeight);
          context.fillStyle = pattern.missing;
          context.fillRect(x, y, cellWidth, cellHeight);
        }
      }
    }

    if (coast) {
      context.save();
      // Path is in degrees: map degrees to pixels, keep the stroke width in pixels.
      const origin = frame.toScreen({ longitude: 0, latitude: 0 });
      context.translate(origin.x, origin.y);
      context.scale(ppd, -ppd);
      context.lineJoin = "round";
      context.lineCap = "round";
      context.lineWidth = 2.6 / ppd;
      context.strokeStyle = "rgba(3, 7, 11, .5)";
      context.stroke(coast);
      context.lineWidth = 1 / ppd;
      context.strokeStyle = "rgba(244, 246, 240, .78)";
      context.stroke(coast);
      context.restore();
    }

    // Real cell boundaries and values appear once cells are large enough to read: the smoothing never hides them.
    if (onScreen && cellWidth >= 34) {
      const strength = clamp((cellWidth - 34) / 40, 0.25, 1);
      context.beginPath();
      for (let col = col0; col <= col1 + 1; col++) { const x = Math.round(box.x + col * cellWidth) + 0.5; context.moveTo(x, Math.max(0, box.y)); context.lineTo(x, Math.min(height, box.y + box.height)); }
      for (let row = row0; row <= row1 + 1; row++) { const y = Math.round(box.y + row * cellHeight) + 0.5; context.moveTo(Math.max(0, box.x), y); context.lineTo(Math.min(width, box.x + box.width), y); }
      context.strokeStyle = `rgba(240, 244, 250, ${0.2 * strength})`;
      context.lineWidth = 1;
      context.stroke();
      if (cellWidth >= 62) {
        context.font = `500 ${cellWidth >= 96 ? 14 : 12}px IBM Plex Mono, Plex Mono, ui-monospace, monospace`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.direction = "ltr";
        for (let row = row0; row <= row1; row++) {
          for (let col = col0; col <= col1; col++) {
            const value = values[row * cols + col];
            if (value === null || value === undefined) continue;
            haloText(context, formatValue(value, mode), box.x + (col + 0.5) * cellWidth, box.y + (row + 0.5) * cellHeight, { width: 3 });
          }
        }
      }
    }

    // Graticule with labels along the edges of the usable viewport.
    const step = GRATICULE_STEPS.find((candidate) => candidate * ppd <= 150) ?? 0.5;
    const safe = frame.safe;
    context.beginPath();
    const lons = [];
    const lats = [];
    for (let lon = Math.ceil(visible.west / step) * step; lon <= visible.east; lon += step) {
      const x = Math.round(frame.toScreen({ longitude: lon, latitude: 0 }).x) + 0.5;
      context.moveTo(x, 0); context.lineTo(x, height);
      lons.push([lon, x]);
    }
    for (let lat = Math.ceil(visible.south / step) * step; lat <= visible.north; lat += step) {
      const y = Math.round(frame.toScreen({ longitude: 0, latitude: lat }).y) + 0.5;
      context.moveTo(0, y); context.lineTo(width, y);
      lats.push([lat, y]);
    }
    context.strokeStyle = "rgba(240, 244, 250, .13)";
    context.lineWidth = 1;
    context.stroke();
    context.font = "500 12px IBM Plex Mono, Plex Mono, ui-monospace, monospace";
    context.direction = "ltr";
    context.textBaseline = "bottom";
    context.textAlign = "left";
    for (const [lon, x] of lons) {
      if (x < safe.x + 46 || x > safe.x + safe.width - 40) continue;
      haloText(context, formatLongitude(Number(lon.toFixed(2))), x + 5, safe.y + safe.height - 6, { color: "rgba(226, 232, 238, .86)" });
    }
    context.textBaseline = "bottom";
    for (const [lat, y] of lats) {
      if (y < safe.y + 26 || y > safe.y + safe.height - 30) continue;
      haloText(context, formatLatitude(Number(lat.toFixed(2))), safe.x + 8, y - 4, { color: "rgba(226, 232, 238, .86)" });
    }

    // The grid frame, with its name.
    context.strokeStyle = `rgba(${TEAL}, .85)`;
    context.lineWidth = 1.5;
    context.strokeRect(box.x, box.y, box.width, box.height);
    if (labels.region && box.width > 260) {
      context.font = "600 12px IBM Plex Mono, Plex Mono, ui-monospace, monospace";
      context.textAlign = "left";
      context.textBaseline = "bottom";
      const x = clamp(box.x + 4, safe.x + 8, Math.max(safe.x + 8, box.x + box.width - 260));
      const y = box.y - 6;
      if (y > safe.y + 14 && y < safe.y + safe.height) haloText(context, labels.region, x, y, { color: `rgba(${TEAL}, .98)` });
    }
  }

  function bracket(context, x, y, dx, dy, size) {
    context.moveTo(x + dx * size, y);
    context.lineTo(x, y);
    context.lineTo(x, y + dy * size);
  }

  function decorate(context, frame, { cursor }) {
    const corner = (rect) => {
      const a = frame.toScreen({ longitude: rect.west, latitude: rect.north });
      const b = frame.toScreen({ longitude: rect.east, latitude: rect.south });
      return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
    };
    if (scan?.rect) {
      // A scan is loaded: everything it will not read is dimmed, and its frame is drawn solid.
      const r = corner(scan.rect);
      context.save();
      context.beginPath();
      context.rect(0, 0, frame.width, frame.height);
      context.rect(r.x, r.y, r.width, r.height);
      context.clip("evenodd");
      context.fillStyle = "rgba(3, 7, 11, .42)";
      context.fillRect(0, 0, frame.width, frame.height);
      context.restore();
      context.strokeStyle = "rgba(3, 7, 11, .7)";
      context.lineWidth = 5;
      context.strokeRect(r.x, r.y, r.width, r.height);
      context.strokeStyle = `rgba(${TEAL}, 1)`;
      context.lineWidth = 2.2;
      context.strokeRect(r.x, r.y, r.width, r.height);
      if (scan.label) {
        context.font = "600 12px IBM Plex Mono, Plex Mono, ui-monospace, monospace";
        context.textAlign = "left";
        context.textBaseline = "top";
        context.direction = "ltr";
        haloText(context, scan.label, r.x + 8, r.y + 8, { color: `rgba(${TEAL}, 1)` });
      }
      if (cursor?.playing && cursor.cell) {
        const c = cellRect(grid, cursor.cell.row, cursor.cell.col);
        const y = frame.toScreen({ longitude: 0, latitude: (c.north + c.south) / 2 }).y;
        context.beginPath();
        context.moveTo(r.x, y);
        context.lineTo(r.x + r.width, y);
        context.strokeStyle = `rgba(${TEAL}, .55)`;
        context.lineWidth = 1.2;
        context.stroke();
      }
    } else if (finder) {
      // Viewfinder: the corners of what "Play visible area" would read right now.
      const r = corner(finder);
      const size = Math.min(22, r.width / 4, r.height / 4);
      if (size > 4) {
        const inset = 3;
        context.beginPath();
        bracket(context, r.x + inset, r.y + inset, 1, 1, size);
        bracket(context, r.x + r.width - inset, r.y + inset, -1, 1, size);
        bracket(context, r.x + inset, r.y + r.height - inset, 1, -1, size);
        bracket(context, r.x + r.width - inset, r.y + r.height - inset, -1, -1, size);
        context.lineJoin = "miter";
        context.strokeStyle = "rgba(3, 7, 11, .75)";
        context.lineWidth = 5;
        context.stroke();
        context.strokeStyle = `rgba(${TEAL}, 1)`;
        context.lineWidth = 2.4;
        context.stroke();
      }
    }
    for (const rect of outlines) {
      const r = corner(rect);
      context.setLineDash([2, 4]);
      context.strokeStyle = "rgba(244, 246, 240, .9)";
      context.lineWidth = 1.4;
      context.strokeRect(r.x, r.y, r.width, r.height);
      context.setLineDash([]);
    }
    // The footprint of the cell whose real value is being read. The reticle itself stays pixel-precise.
    if (cursor?.cell) {
      const c = cellRect(grid, cursor.cell.row, cursor.cell.col);
      const r = corner(c);
      if (cursor.playing) {
        context.fillStyle = `rgba(${TEAL}, .2)`;
        context.fillRect(r.x, r.y, r.width, r.height);
      }
      context.strokeStyle = "rgba(3, 7, 11, .55)";
      context.lineWidth = 3;
      context.strokeRect(r.x, r.y, r.width, r.height);
      context.strokeStyle = cursor.playing ? `rgba(${TEAL}, 1)` : "rgba(244, 246, 240, .8)";
      context.lineWidth = cursor.playing ? 2 : 1;
      if (!cursor.playing) context.setLineDash([5, 4]);
      context.strokeRect(r.x, r.y, r.width, r.height);
      context.setLineDash([]);
    }
  }

  function drawCursor(context, frame, cursor) {
    const { x, y } = frame.toScreen(cursor);
    if (x < -40 || y < -40 || x > frame.width + 40 || y > frame.height + 40) return;
    const radius = cursor.playing ? 13 : 10;
    const stroke = (color, width) => {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        context.moveTo(x + dx * (radius + 4), y + dy * (radius + 4));
        context.lineTo(x + dx * (radius + 12), y + dy * (radius + 12));
      }
      if (cursor.inside === false || cursor.value === null) context.setLineDash([3, 3]);
      context.stroke();
      context.setLineDash([]);
    };
    stroke("rgba(3, 7, 11, .8)", 4.5);
    stroke(cursor.playing ? `rgb(${TEAL})` : "#ffffff", cursor.playing ? 2.4 : 1.6);
    context.beginPath();
    context.arc(x, y, 2.4, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = "rgba(3, 7, 11, .9)";
    context.stroke();
  }

  return {
    aspect: 2,
    bounds,
    draw,
    decorate,
    drawCursor,
    sampleAt,
    /** `next`: { mode: "value" | "diff", values }. */
    setField(next) {
      values = next.values;
      mode = next.mode === "diff" ? "diff" : "value";
      field = buildFieldCanvas(values, grid, mode);
      onChange();
    },
    get mode() { return mode; },
    setScan(next) { scan = next; onChange(); },
    setOutlines(next) { outlines = next ?? []; onChange(); },
    setFinder(next) {
      const same = (!next && !finder) || (next && finder && ["west", "east", "south", "north"].every((key) => Math.abs(next[key] - finder[key]) < 1e-9));
      finder = next;
      if (!same) onChange();
    },
    /** Signed colour-scale position of a change, exposed for tests and the legend marker. */
    changePosition: (change) => 0.5 + 0.5 * diffS(change),
  };
}
