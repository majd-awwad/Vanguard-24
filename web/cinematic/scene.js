import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Scene, ShaderMaterial, SphereGeometry,
  SRGBColorSpace, TextureLoader, Vector2, Vector3, Vector4, WebGLRenderer,
} from "../vendor/three/three.module.min.js";
import {
  DEG, HERO_DISTANCE, HERO_SHIFT, bracketTriangles, cameraMatrices, cellRect, createFrame, fillTriangles,
  flightSpin, gridLines, ringTriangles, unroll,
} from "./geo.js";
import { guideState, meridianStrip, parallelStrip } from "./guide.js";
import { overlayModel } from "./overlay.js";
import { buildDustParticles } from "./particles.js";

const FLY_SECONDS = 3.2;
const REVEAL_SECONDS = 2.8;
const RIPPLE_SECONDS = 1.1;
const SPIN_RAD_PER_SECOND = 0.05;
const LIFT = 0.004;
const SHOWN_PHASES = new Set(["listen", "decode", "reveal"]);
const GLYPHS = { correct: "✓", incorrect: "×", missed: "–" };
const FALLBACK_FRAME = { west: -20, east: 50, south: 15, north: 45 };

const STYLE = {
  grid: 0xe6f1f8,
  active: 0xffe29a,
  bracket: 0x38e8d0,
  correct: 0x2dd4bf,
  incorrect: 0xff4d8d,
  missed: 0xd9dcff,
  guide: 0x5eead4,
};

const earthVertex = /* glsl */ `
  uniform float uT;
  uniform float uSpin;
  uniform vec3 uNormal;
  uniform vec3 uEast;
  uniform vec3 uNorth;
  uniform vec2 uCenter;
  attribute vec2 aLonLat;
  varying vec2 vUv;
  varying vec2 vLonLat;
  varying vec3 vSphere;
  varying float vFacing;
  void main() {
    float lon = radians(aLonLat.x) + uSpin;
    float lat = radians(aLonLat.y);
    vec3 onSphere = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
    vec3 onPlane = uNormal + uEast * radians(aLonLat.x - uCenter.x) + uNorth * radians(aLonLat.y - uCenter.y);
    vUv = vec2((aLonLat.x + 180.0) / 360.0, (aLonLat.y + 90.0) / 180.0);
    vLonLat = aLonLat;
    vSphere = onSphere;
    vFacing = dot(onSphere, normalize(cameraPosition - onSphere));
    gl_Position = projectionMatrix * viewMatrix * vec4(mix(onSphere, onPlane, uT), 1.0);
  }
`;
const earthFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform float uHasDay;
  uniform float uHasNight;
  uniform float uT;
  uniform vec3 uSun;
  uniform vec4 uBounds; // west, east, south, north
  uniform vec3 uRim;
  varying vec2 vUv;
  varying vec2 vLonLat;
  varying vec3 vSphere;
  varying float vFacing;
  void main() {
    vec3 day = mix(vec3(0.02, 0.05, 0.1), texture2D(uDay, vUv).rgb, uHasDay);
    vec3 lights = texture2D(uNight, vUv).rgb * uHasNight;
    float ndl = dot(normalize(vSphere), uSun);
    float lit = smoothstep(-0.08, 0.28, ndl);
    float twilight = exp(-pow((ndl - 0.03) / 0.11, 2.0));
    vec3 dayColor = day * (0.2 + 0.95 * clamp(ndl + 0.12, 0.0, 1.0));
    vec3 nightColor = day * 0.04 + vec3(1.0, 0.84, 0.55) * pow(lights, vec3(1.1)) * 1.7;
    vec3 color = mix(nightColor, dayColor, lit) + vec3(0.95, 0.5, 0.25) * twilight * 0.07;
    // Thin atmospheric rim, teal, identical for every case.
    float rim = pow(1.0 - clamp(vFacing, 0.0, 1.0), 3.0);
    vec3 rimColor = mix(uRim, vec3(1.0, 0.84, 0.62), smoothstep(0.15, 0.85, ndl));
    color += rimColor * rim * 0.6;
    // The decoding map is fully lit and readable; outside the region it falls away into space.
    float dx = max(max(uBounds.x - vLonLat.x, vLonLat.x - uBounds.y), 0.0);
    float dy = max(max(uBounds.z - vLonLat.y, vLonLat.y - uBounds.w), 0.0);
    float inside = 1.0 - smoothstep(0.0, 3.5, length(vec2(dx, dy)));
    vec3 mapColor = day * (0.015 + 0.985 * inside);
    gl_FragColor = vec4(mix(color, mapColor, uT), 1.0);
    #include <colorspace_fragment>
  }
`;
const haloVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  void main() {
    vWorld = position;
    vNormalWorld = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;
const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  uniform float uBoost;
  uniform float uInner;
  uniform vec3 uSun;
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  void main() {
    vec3 toCamera = normalize(cameraPosition - vWorld);
    float f = clamp(-dot(normalize(vNormalWorld), toCamera) / uInner, 0.0, 1.0);
    float a = pow(f, 1.7) * (0.55 + 0.9 * uBoost) * uFade;
    vec3 tint = mix(uColor, vec3(1.0, 0.86, 0.64), smoothstep(0.1, 0.9, dot(normalize(vNormalWorld), uSun)) * 0.8);
    gl_FragColor = vec4(tint * a, a);
  }
`;
const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixels;
  attribute float aSize;
  attribute float aPhase;
  varying float vTwinkle;
  void main() {
    vTwinkle = 0.65 + 0.35 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0);
    gl_PointSize = aSize * uPixels;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;
const starFragment = /* glsl */ `
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d) * vTwinkle;
    gl_FragColor = vec4(vec3(0.82, 0.93, 1.0) * a * 1.25, a);
  }
`;
const dustVertex = /* glsl */ `
  uniform float uT;
  uniform vec3 uNormal;
  uniform vec3 uEast;
  uniform vec3 uNorth;
  uniform vec2 uCenter;
  uniform float uReveal;
  uniform float uTime;
  uniform float uScale;
  attribute vec2 aLonLat;
  attribute float aAltitude;
  attribute vec3 aSeed;
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float breathe = 0.5 + 0.5 * sin(uTime * 0.9 + aSeed.x * 6.2831);
    // Artistic motion only: a slow drift inside the cell's neighbourhood.
    vec2 drift = vec2(sin(uTime * 0.35 + aSeed.y * 6.2831), cos(uTime * 0.3 + aSeed.z * 6.2831)) * 0.12;
    float lon = aLonLat.x + drift.x;
    float lat = aLonLat.y + drift.y;
    vec3 onPlane = uNormal + uEast * radians(lon - uCenter.x) + uNorth * radians(lat - uCenter.y);
    float rise = uReveal * (0.012 + 0.07 * pow(aAltitude, 1.4)) * (0.85 + 0.3 * breathe);
    // The dust lifts off the surface: toward the camera, and up the screen as it rises.
    vec3 pos = onPlane + uNormal * (0.01 + rise) + uNorth * rise * 0.55 + uEast * rise * 0.18 * sin(aSeed.x * 6.2831);
    vec4 view = viewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * view;
    // aSize is a world size; projectionMatrix[1][1] and the viewport height turn it into pixels for any frustum.
    gl_PointSize = aSize * projectionMatrix[1][1] * uScale * (0.8 + 0.4 * breathe) * (0.4 + 0.6 * uReveal) / max(0.5, -view.z);
    vAlpha = aAlpha * uReveal * (0.85 + 0.3 * breathe);
    vHeat = aAltitude;
  }
`;
const dustFragment = /* glsl */ `
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = smoothstep(1.0, 0.0, d);
    vec3 amber = mix(vec3(1.0, 0.62, 0.18), vec3(0.96, 0.4, 0.08), vHeat);
    float a = soft * vAlpha;
    gl_FragColor = vec4(amber * a, a);
  }
`;

function glyphTexture(document, symbol) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.font = "700 96px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(0, 0, 0, 0.7)";
  context.shadowBlur = 8;
  context.fillText(symbol, 64, 70);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function earthGeometry(columns = 180, rows = 90) {
  const lonLat = [];
  const index = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) lonLat.push(-180 + (360 * i) / columns, 90 - (180 * j) / rows);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i;
      index.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("aLonLat", new BufferAttribute(new Float32Array(lonLat), 2));
  geometry.setAttribute("position", new BufferAttribute(new Float32Array((columns + 1) * (rows + 1) * 3), 3));
  geometry.setIndex(index);
  return geometry;
}

function starGeometry(count = 2200) {
  const position = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  let seed = 1234567;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const u = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    position.set([r * Math.cos(angle) * 24, u * 24, r * Math.sin(angle) * 24], i * 3);
    size[i] = random() < 0.05 ? 3.2 + random() * 2.2 : 1.5 + random() * 1.6;
    phase[i] = random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("aSize", new BufferAttribute(size, 1));
  geometry.setAttribute("aPhase", new BufferAttribute(phase, 1));
  return geometry;
}

const defaultRenderer = (document) => new WebGLRenderer({
  canvas: document.createElement("canvas"), antialias: true, alpha: true, powerPreference: "high-performance",
});

function textureUrls(window) {
  const small = window.matchMedia?.("(max-width: 700px)")?.matches ||
    window.navigator?.connection?.saveData === true || (window.navigator?.deviceMemory ?? 8) <= 2;
  const base = (name) => new URL(`../assets/earth/${name}`, import.meta.url).href;
  return small
    ? { day: base("blue-marble-2048.jpg"), night: base("black-marble-2048.jpg") }
    : { day: base("blue-marble-4096.jpg"), night: base("black-marble-3600.jpg") };
}

/**
 * The cinematic scene: one fixed full-viewport canvas behind the page. It shows the hero Earth until a region is
 * chosen, then flies to it and unrolls onto the stage element's rectangle, so the interactive HTML grid and the 3D
 * grid are the same pixels. It reads only what its setters are given: geography, the public session snapshot, and
 * the revealed snapshot after Reveal.
 */
export function createScene({
  document, createRenderer = defaultRenderer, reducedMotion, textures = textureUrls, now = () => performance.now(),
}) {
  const window = document.defaultView;
  const isReduced = reducedMotion ?? (() => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true);
  const renderer = createRenderer(document);
  const canvas = renderer.domElement;
  canvas.className = "cine-canvas";
  canvas.setAttribute("aria-hidden", "true");
  renderer.setClearColor(0x050b12, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;

  const shared = {
    uT: { value: 0 }, uNormal: { value: new Vector3(0, 0, 1) }, uEast: { value: new Vector3(1, 0, 0) },
    uNorth: { value: new Vector3(0, 1, 0) }, uCenter: { value: new Vector2() },
  };
  const earth = new Mesh(earthGeometry(), new ShaderMaterial({
    vertexShader: earthVertex,
    fragmentShader: earthFragment,
    uniforms: {
      ...shared, uSpin: { value: 0 }, uDay: { value: null }, uNight: { value: null }, uHasDay: { value: 0 }, uHasNight: { value: 0 },
      uSun: { value: new Vector3(-0.74, 0.34, 0.58).normalize() }, uBounds: { value: new Vector4(-20, 50, 15, 45) },
      uRim: { value: new Vector3(0.18, 0.78, 0.74) },
    },
  }));
  earth.uniforms = earth.material.uniforms;
  earth.frustumCulled = false;
  earth.renderOrder = 0;
  scene.add(earth);

  const haloUniforms = {
    uColor: { value: new Vector3(0.22, 0.86, 0.8) }, uFade: { value: 1 }, uBoost: { value: 0 }, uInner: { value: 0.36 },
    uSun: { value: new Vector3(-0.74, 0.34, 0.58).normalize() },
  };
  const halo = new Mesh(new SphereGeometry(1.07, 96, 64), new ShaderMaterial({
    vertexShader: haloVertex, fragmentShader: haloFragment, uniforms: haloUniforms,
    side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending,
  }));
  halo.frustumCulled = false;
  halo.renderOrder = 1;
  scene.add(halo);

  const starUniforms = { uTime: { value: 0 }, uPixels: { value: 1 } };
  const stars = new Points(starGeometry(), new ShaderMaterial({
    vertexShader: starVertex, fragmentShader: starFragment, uniforms: starUniforms,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = -1;
  scene.add(stars);

  const loader = new TextureLoader();
  let disposed = false;
  const urls = textures(window);
  const load = (url, slot, flag) => loader.load(url, (texture) => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    earth.uniforms[slot].value = texture;
    earth.uniforms[flag].value = 1;
    invalidate();
  }, undefined, () => { /* the dark sphere and the overlays still work */ });
  load(urls.day, "uDay", "uHasDay");
  load(urls.night, "uNight", "uHasNight");

  const decal = (color, opacity, additive = false) => new MeshBasicMaterial({
    color, opacity, transparent: true, depthWrite: false, side: DoubleSide,
    ...(additive ? { blending: AdditiveBlending } : {}),
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const materials = {
    grid: new LineBasicMaterial({ color: STYLE.grid, transparent: true, opacity: 0.3, depthWrite: false }),
    active: decal(STYLE.active, 1),
    ripple: decal(STYLE.active, 0.6, true),
    bracket: decal(STYLE.bracket, 1),
    correct: decal(STYLE.correct, 0.12),
    incorrect: decal(STYLE.incorrect, 0.11),
    missed: decal(STYLE.missed, 0.06),
    correctRing: decal(STYLE.correct, 0.95),
    incorrectRing: decal(STYLE.incorrect, 0.95),
    missedRing: decal(STYLE.missed, 0.85),
    guide: decal(STYLE.guide, 1, true),
  };
  const glyphMaterials = Object.fromEntries(Object.entries(GLYPHS).map(([outcome, symbol]) => [
    outcome, new MeshBasicMaterial({
      map: glyphTexture(document, symbol), transparent: true, depthWrite: false, side: DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    }),
  ]));

  const dustUniforms = {
    ...shared, uReveal: { value: 0 }, uTime: { value: 0 }, uScale: { value: 100 },
  };
  const dustMaterial = new ShaderMaterial({
    vertexShader: dustVertex, fragmentShader: dustFragment, uniforms: dustUniforms,
    transparent: true, depthWrite: false, premultipliedAlpha: true,
  });

  const layers = new Map();
  function setLayer(name, object) {
    const previous = layers.get(name);
    if (previous) { scene.remove(previous); previous.geometry.dispose(); }
    if (object) { scene.add(object); layers.set(name, object); } else layers.delete(name);
  }
  const mesh = (positions, material, uvs, order = 2) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    if (uvs) geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    const object = new Mesh(geometry, material);
    object.frustumCulled = false;
    object.renderOrder = order;
    return object;
  };

  // ---- state ----
  let frame = null;
  let geography = null;
  let stage = null;
  let snapshot = null;
  let model = overlayModel(null);
  let outcomes = [];
  let guide = null;
  let progress = 0;
  let target = 0;
  let flightFrom = 0;
  let flightStart = 0;
  let flightTarget = 0;
  let spin = 0; // radians, hero rotation
  let spinStartDeg = 0;
  let heroZoom = 1;
  let heroZoomTarget = 1;
  let rtl = false;
  let overlaysDirty = true;
  let lastBuild = { t: -1, spin: NaN, guide: "" };
  let frameRequest = 0;
  let lastTime = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let maxPixelRatio = 1;
  let slowFrames = 0;
  let fastFrames = 0;
  let activeKey = "";
  let rippleStart = -1;
  let dust = null;
  let dustKey = "";
  let revealStart = 0;
  let lostHandler = null;
  let onFrame = null;
  let frames = 0;

  const frameFor = () => frame ?? createFrame(FALLBACK_FRAME);
  const mobileLayout = () => width / Math.max(1, height) < 0.9;

  function setSize() {
    const w = Math.max(1, Math.round(window.innerWidth));
    const h = Math.max(1, Math.round(window.innerHeight));
    maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    pixelRatio = Math.min(pixelRatio || maxPixelRatio, maxPixelRatio);
    if (w === width && h === height && renderer.getPixelRatio() === pixelRatio) return;
    width = w;
    height = h;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block";
    starUniforms.uPixels.value = pixelRatio;
    dustUniforms.uScale.value = (height * pixelRatio) / 2;
    invalidate();
  }

  function adaptPixelRatio(dt) {
    // Back off when frames are slow, creep back up when there is headroom. Never above the device ratio or 2.
    if (dt > 0.034) { slowFrames++; fastFrames = 0; } else if (dt < 0.02) { fastFrames++; slowFrames = 0; } else { slowFrames = fastFrames = 0; }
    if (slowFrames > 20 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); slowFrames = 0; setSize(); }
    else if (fastFrames > 120 && pixelRatio < maxPixelRatio) { pixelRatio = Math.min(maxPixelRatio, pixelRatio + 0.25); fastFrames = 0; setSize(); }
  }

  function stageRect() {
    const rect = stage?.getBoundingClientRect?.();
    if (!rect || rect.width < 2 || rect.height < 2) return null;
    return { x0: rect.left, y0: rect.top, x1: rect.right, y1: rect.bottom };
  }

  function useGeography(next) {
    const bounds = next?.bounds;
    const changed = JSON.stringify(bounds) !== JSON.stringify(geography?.bounds);
    geography = next;
    if (!changed) return;
    frame = bounds ? createFrame(bounds) : null;
    overlaysDirty = true;
    if (!frame) return;
    shared.uNormal.value.copy(frame.normal);
    shared.uEast.value.copy(frame.east);
    shared.uNorth.value.copy(frame.north);
    shared.uCenter.value.set(frame.lon0, frame.lat0);
    earth.uniforms.uBounds.value.set(frame.bounds.west, frame.bounds.east, frame.bounds.south, frame.bounds.north);
  }

  // ---- overlays ----
  function rebuildOverlays(t, spinDeg, now_) {
    for (const name of [...layers.keys()]) setLayer(name, null);
    const f = frameFor();
    if (guide) {
      const w = { t, lift: LIFT * 5, spin: spinDeg };
      const bounds = f.bounds;
      if (guide.step === "sweep") {
        const lon = bounds.west + (bounds.east - bounds.west) * guide.amount;
        setLayer("guideSweep", mesh(meridianStrip(f, lon, -88, 88, { ...w, halfWidthDeg: 0.6 }), materials.guide, null, 9));
      } else if (guide.step === "pitch") {
        const lat = bounds.south + (bounds.north - bounds.south) * guide.amount;
        const full = t < 0.5;
        setLayer("guidePitch", mesh(parallelStrip(f, lat, full ? -180 : bounds.west, full ? 180 : bounds.east, { ...w, halfWidthDeg: 0.6, segments: full ? 180 : 96 }), materials.guide, null, 9));
      }
      materials.guide.opacity = 0.9 * guide.opacity;
    }
    if (!frame || !model.rows || !model.cols || progress <= 0) return;
    const rect = ([row, col]) => cellRect(frame.bounds, model.rows, model.cols, row, col);
    setLayer("grid", Object.assign(
      new LineSegments(new BufferGeometry().setAttribute("position",
        new BufferAttribute(gridLines(frame, model.rows, model.cols, { t, lift: LIFT }), 3)), materials.grid),
      { frustumCulled: false, renderOrder: 2 }));
    if (model.selected.length) {
      setLayer("brackets", mesh(bracketTriangles(frame, model.selected.map(rect), { t, lift: LIFT * 2, spin: spinDeg }), materials.bracket, null, 4));
    }
    for (const outcome of ["correct", "incorrect", "missed"]) {
      const rects = model.outcomes.filter((entry) => entry.outcome === outcome).map(({ row, col }) => rect([row, col]));
      if (!rects.length) continue;
      setLayer(outcome, mesh(fillTriangles(frame, rects, { t, lift: LIFT * 2.5 }).positions, materials[outcome], null, 5));
      setLayer(outcome + "Ring", mesh(ringTriangles(frame, rects, { t, lift: LIFT * 3, insetDeg: 0.8, thicknessDeg: 0.3 }), materials[outcome + "Ring"], null, 6));
      const glyph = fillTriangles(frame, rects.map((r) => ({
        west: (r.west + r.east) / 2 - (r.east - r.west) * 0.2, east: (r.west + r.east) / 2 + (r.east - r.west) * 0.2,
        north: (r.north + r.south) / 2 + (r.north - r.south) * 0.2, south: (r.north + r.south) / 2 - (r.north - r.south) * 0.2,
      })), { t, lift: LIFT * 3.5, subdiv: 1 });
      setLayer(outcome + "Glyph", mesh(glyph.positions, glyphMaterials[outcome], glyph.uvs, 7));
    }
    if (model.active) {
      setLayer("active", mesh(ringTriangles(frame, [rect(model.active)], { t, lift: LIFT * 4, insetDeg: 0.35, thicknessDeg: 0.55 }), materials.active, null, 8));
      const age = (now_ - rippleStart) / 1000;
      if (rippleStart >= 0 && age < RIPPLE_SECONDS) {
        const k = age / RIPPLE_SECONDS;
        materials.ripple.opacity = 0.55 * (1 - k) * (1 - k);
        setLayer("ripple", mesh(ringTriangles(frame, [rect(model.active)], {
          t, lift: LIFT * 4.5, insetDeg: -0.2 - 3.2 * k, thicknessDeg: 0.3,
        }), materials.ripple, null, 8));
      }
    }
  }

  function syncDust() {
    const key = snapshot?.phase === "reveal" && frame ? `${snapshot.caseId}|${snapshot.level}|${snapshot.grid.rows}x${snapshot.grid.cols}` : "";
    if (key === dustKey) return;
    dustKey = key;
    if (dust) { scene.remove(dust); dust.geometry.dispose(); dust = null; }
    if (!key) { dustUniforms.uReveal.value = 0; return; }
    const data = buildDustParticles(snapshot, frame.bounds);
    if (!data || !data.count) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(data.count * 3), 3));
    geometry.setAttribute("aLonLat", new BufferAttribute(data.lonLat, 2));
    geometry.setAttribute("aAltitude", new BufferAttribute(data.altitude, 1));
    geometry.setAttribute("aSeed", new BufferAttribute(data.seed, 3));
    geometry.setAttribute("aSize", new BufferAttribute(data.size, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(data.alpha, 1));
    dust = new Points(geometry, dustMaterial);
    dust.frustumCulled = false;
    dust.renderOrder = 10;
    scene.add(dust);
    revealStart = now();
    scene.userData.dustStats = { count: data.count, haze: data.haze };
  }

  // ---- loop ----
  const heroActive = () => target === 0 && progress === 0;
  const continuous = () => !document.hidden && width > 0 && (
    heroActive() || progress !== target || Boolean(guide) || rippleStart >= 0 && now() - rippleStart < RIPPLE_SECONDS * 1000 ||
    (dust !== null && dustUniforms.uReveal.value < 1) || model.active !== null || dust !== null);

  function draw() {
    frameRequest = 0;
    if (disposed || document.hidden) return;
    const time = now();
    const dt = lastTime ? Math.min(0.25, (time - lastTime) / 1000) : 0;
    lastTime = time;
    setSize();
    if (!width || !height) return;
    if (dt > 0) adaptPixelRatio(dt);

    if (progress !== target) {
      if (flightTarget !== target) {
        flightTarget = target;
        flightFrom = progress;
        flightStart = time;
        if (target === 1 && progress === 0) spinStartDeg = ((((spin / DEG) % 360) + 540) % 360) - 180;
      }
      const done = Math.min(1, (time - flightStart) / 1000 / FLY_SECONDS);
      progress = isReduced() || done >= 1 ? target : flightFrom + (target - flightFrom) * done;
      if (progress === 0 && target === 0) spin = spinStartDeg * DEG;
    } else if (heroActive() && !isReduced()) {
      spin += SPIN_RAD_PER_SECOND * dt;
    }
    heroZoom += (heroZoomTarget - heroZoom) * Math.min(1, dt * 7 || 1);

    const f = frameFor();
    const t = unroll(progress);
    const spinDeg = progress > 0 ? flightSpin(spinStartDeg, progress) : (spin / DEG);
    const rect = progress > 0 ? stageRect() : null;
    const aspect = width / height;
    const heroDistance = (aspect > 1.3 ? HERO_DISTANCE : aspect > 0.9 ? HERO_DISTANCE + 0.6 : HERO_DISTANCE + 1.5) / heroZoom;
    const heroShift = mobileLayout() ? 0 : (rtl ? -HERO_SHIFT : HERO_SHIFT);
    const { view, world, projection } = cameraMatrices(f, progress, aspect, {
      rect, canvas: { width, height }, hero: { distance: heroDistance, shift: heroShift },
    });
    camera.matrixWorld.copy(world);
    camera.matrixWorldInverse.copy(view);
    camera.projectionMatrix.copy(projection);
    camera.projectionMatrixInverse.copy(projection).invert();

    earth.uniforms.uSpin.value = (progress > 0 ? flightSpin(spinStartDeg, progress) : spin / DEG) * DEG;
    shared.uT.value = frame ? t : 0;
    haloUniforms.uFade.value = 1 - t;
    starUniforms.uTime.value = time / 1000;
    dustUniforms.uTime.value = time / 1000;
    if (dust) dustUniforms.uReveal.value = isReduced() ? 1 : Math.min(1, (time - revealStart) / 1000 / REVEAL_SECONDS);

    guide = guideState(snapshot);
    haloUniforms.uBoost.value = guide?.step === "loudness"
      ? guide.opacity * (0.2 + 0.8 * guide.amount + 0.12 * Math.sin(time / 90)) : 0;
    const guideKey = guide ? `${guide.step}:${guide.amount.toFixed(3)}` : "";
    const rippling = rippleStart >= 0 && time - rippleStart < RIPPLE_SECONDS * 1000;
    if (overlaysDirty || t !== lastBuild.t || spinDeg !== lastBuild.spin || guideKey !== lastBuild.guide || rippling) {
      rebuildOverlays(frame ? t : 0, progress > 0 ? spinDeg : spin / DEG, time);
      lastBuild = { t, spin: spinDeg, guide: guideKey };
      overlaysDirty = false;
    }
    syncDust();
    renderer.render(scene, camera);
    frames++;
    onFrame?.({ dt, progress, target, pixelRatio });
    if (continuous()) frameRequest = window.requestAnimationFrame(draw);
  }

  function invalidate() {
    if (!frameRequest && !disposed && !document.hidden) frameRequest = window.requestAnimationFrame(draw);
  }

  const onVisibility = () => { lastTime = 0; if (!document.hidden) invalidate(); else if (frameRequest) { window.cancelAnimationFrame(frameRequest); frameRequest = 0; } };
  document.addEventListener("visibilitychange", onVisibility);
  const onResize = () => invalidate();
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onResize, { passive: true });
  canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); lostHandler?.(); });
  const observer = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(onResize) : null;

  const controller = {
    canvas,
    get progress() { return progress; },
    get target() { return target; },
    get stats() { return { pixelRatio, frames, dust: scene.userData.dustStats ?? null }; },
    onLost(handler) { lostHandler = handler; },
    onFrame(handler) { onFrame = handler; },
    setDirection(isRtl) { if (rtl !== isRtl) { rtl = isRtl; invalidate(); } },
    zoom(factor) { heroZoomTarget = Math.min(1.6, Math.max(0.7, heroZoomTarget * factor)); invalidate(); },
    resetView() { heroZoomTarget = 1; invalidate(); },
    setStage(element) {
      observer?.disconnect();
      stage = element;
      if (stage) observer?.observe(stage);
      invalidate();
    },
    setGeography(next) { useGeography(next); invalidate(); },
    /** The public session snapshot: everything the scene may know about the session. */
    setSnapshot(next) {
      const gridChanged = !snapshot || next.caseId !== snapshot.caseId || next.level !== snapshot.level ||
        next.grid.rows !== snapshot.grid.rows || next.grid.cols !== snapshot.grid.cols;
      if (gridChanged || next.phase !== "reveal") outcomes = [];
      snapshot = next;
      const previousKey = JSON.stringify(model);
      model = overlayModel(next, outcomes);
      if (JSON.stringify(model) !== previousKey) overlaysDirty = true;
      const activeNow = model.active ? model.active.join(",") : "";
      if (activeNow !== activeKey) {
        activeKey = activeNow;
        if (activeNow && !isReduced()) rippleStart = now();
        overlaysDirty = true;
      }
      target = SHOWN_PHASES.has(next.phase) && frame ? 1 : 0;
      invalidate();
    },
    setOutcomes(list) {
      outcomes = list;
      model = overlayModel(snapshot, outcomes);
      overlaysDirty = true;
      invalidate();
    },
    clearOutcomes() {
      if (!outcomes.length) return;
      outcomes = [];
      model = overlayModel(snapshot, outcomes);
      overlaysDirty = true;
      invalidate();
    },
    invalidate,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frameRequest) window.cancelAnimationFrame(frameRequest);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
      for (const name of [...layers.keys()]) setLayer(name, null);
      if (dust) { dust.geometry.dispose(); dust = null; }
      for (const geometry of [earth.geometry, halo.geometry, stars.geometry]) geometry.dispose();
      for (const material of [earth.material, halo.material, stars.material, dustMaterial, ...Object.values(materials)]) material.dispose();
      earth.uniforms.uDay.value?.dispose();
      earth.uniforms.uNight.value?.dispose();
      for (const material of Object.values(glyphMaterials)) { material.map.dispose(); material.dispose(); }
      renderer.dispose();
      canvas.remove();
    },
  };
  return controller;
}
