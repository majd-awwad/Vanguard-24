import {
  DataTexture, FloatType, LinearFilter, LinearMipmapLinearFilter, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, RGBAFormat,
  RedFormat, Scene, ShaderMaterial, SRGBColorSpace, TextureLoader, UnsignedByteType, Vector2, Vector3, Vector4, WebGLRenderer,
} from "../vendor/three/three.module.min.js";
import { layerT, rampTable } from "./field.js";

// WebGL map renderer: one full-screen quad. The fragment shader converts every pixel to longitude/latitude (plate
// carrée), looks up the NASA Blue Marble texture by longitude/latitude, and blends the dust field on top by sampling
// the cell values with smoothstep-weighted interpolation. Because both layers are sampled from the same geographic
// coordinates, the dust is registered to the Earth at every zoom and pan, and no grid lines or tiles are drawn.

const vertexShader = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uEarth;
uniform sampler2D uValues;
uniform sampler2D uMask;
uniform sampler2D uRamp;
uniform vec2 uRes;
uniform vec3 uView;     // centre lon, centre lat, device pixels per degree
uniform vec4 uBounds;   // west, east, south, north
uniform vec2 uGrid;     // cols, rows
uniform float uAlpha;
uniform float uLayer;
uniform float uDpr;

void main() {
  vec2 p = gl_FragCoord.xy;
  float lon = uView.x + (p.x - uRes.x * 0.5) / uView.z;
  float lat = uView.y + (p.y - uRes.y * 0.5) / uView.z;
  vec3 col = texture2D(uEarth, vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0)).rgb * 0.8;
  bool inside = lon >= uBounds.x && lon <= uBounds.y && lat >= uBounds.z && lat <= uBounds.w;
  if (inside && uLayer > 0.5) {
    vec2 g = vec2((lon - uBounds.x) / (uBounds.y - uBounds.x) * uGrid.x, (uBounds.w - lat) / (uBounds.w - uBounds.z) * uGrid.y);
    vec2 q = g - 0.5;
    vec2 base = floor(q);
    vec2 x = q - base;
    vec4 wx = vec4(pow(1.0 - x.x, 3.0), 3.0 * x.x * x.x * x.x - 6.0 * x.x * x.x + 4.0, -3.0 * x.x * x.x * x.x + 3.0 * x.x * x.x + 3.0 * x.x + 1.0, x.x * x.x * x.x) / 6.0;
    vec4 wy = vec4(pow(1.0 - x.y, 3.0), 3.0 * x.y * x.y * x.y - 6.0 * x.y * x.y + 4.0, -3.0 * x.y * x.y * x.y + 3.0 * x.y * x.y + 3.0 * x.y + 1.0, x.y * x.y * x.y) / 6.0;
    ivec2 hi = ivec2(uGrid) - 1;
    float t = 0.0;
    for (int j = 0; j < 4; j++) {
      for (int i = 0; i < 4; i++) {
        ivec2 at = clamp(ivec2(base) + ivec2(i - 1, j - 1), ivec2(0), hi);
        t += texelFetch(uValues, at, 0).r * wx[i] * wy[j];
      }
    }
    ivec2 cell = ivec2(clamp(floor(g), vec2(0.0), uGrid - 1.0));
    float missing = texelFetch(uMask, cell, 0).r;
    vec3 ramp = texture2D(uRamp, vec2(clamp(t, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb;
    if (missing > 0.5) {
      float stripe = step(0.5, fract((p.x + p.y) / (9.0 * uDpr)));
      ramp = mix(vec3(0.42, 0.45, 0.5), vec3(0.16, 0.18, 0.22), stripe);
      col = mix(col, ramp, 0.9);
    } else {
      col = mix(col, ramp, uAlpha);
    }
  }
  float edge = min(min(abs(lon - uBounds.x), abs(lon - uBounds.y)), min(abs(lat - uBounds.z), abs(lat - uBounds.w))) * uView.z;
  bool near = lon >= uBounds.x - 0.2 && lon <= uBounds.y + 0.2 && lat >= uBounds.z - 0.2 && lat <= uBounds.w + 0.2;
  if (near && edge < 1.2 * uDpr) col = mix(col, vec3(0.41, 0.88, 0.82), 0.7);
  gl_FragColor = vec4(col, 1.0);
}
`;

const texture = (data, width, height, format, type, filter) => {
  const tex = new DataTexture(data, width, height, format, type);
  tex.minFilter = tex.magFilter = filter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
};

export function createGlRenderer({ document, container, earthUrl, onReady = () => {}, onLost = () => {} }) {
  const renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  const canvas = renderer.domElement;
  canvas.className = "studio-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uEarth: { value: null }, uValues: { value: null }, uMask: { value: null }, uRamp: { value: null },
    uRes: { value: new Vector2(1, 1) }, uView: { value: new Vector3(0, 0, 1) }, uBounds: { value: new Vector4() }, uGrid: { value: new Vector2(1, 1) },
    uAlpha: { value: 0.66 }, uLayer: { value: 0 }, uDpr: { value: 1 },
  };
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  scene.add(Object.assign(new Mesh(new PlaneGeometry(2, 2), material), { frustumCulled: false }));
  const rampTextures = { value: texture(rampTable("value"), 256, 1, RGBAFormat, UnsignedByteType, LinearFilter), diff: texture(rampTable("diff"), 256, 1, RGBAFormat, UnsignedByteType, LinearFilter) };
  uniforms.uRamp.value = rampTextures.value;
  new TextureLoader().load(earthUrl, (earth) => {
    earth.colorSpace = SRGBColorSpace;
    earth.minFilter = LinearMipmapLinearFilter;
    earth.magFilter = LinearFilter;
    earth.anisotropy = renderer.capabilities.getMaxAnisotropy();
    uniforms.uEarth.value = earth;
    onReady();
  });
  canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); onLost(); });

  let width = 1;
  let height = 1;
  let dpr = 1;
  let layerTextures = [];
  let state = { view: { lon: 0, lat: 0, zoom: 1 }, bounds: null };

  return {
    kind: "webgl",
    canvas,
    resize(w, h, ratio) {
      width = w; height = h; dpr = ratio;
      renderer.setPixelRatio(ratio);
      renderer.setSize(w, h, false);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      uniforms.uRes.value.set(w * ratio, h * ratio);
      uniforms.uDpr.value = ratio;
    },
    /** `ppd` is CSS pixels per degree for this view. */
    setView(view, ppd, bounds) {
      state = { view, bounds };
      uniforms.uView.value.set(view.lon, view.lat, ppd * dpr);
      uniforms.uBounds.value.set(bounds.west, bounds.east, bounds.south, bounds.north);
    },
    setLayer(layer, grid) {
      for (const tex of layerTextures) tex.dispose();
      layerTextures = [];
      if (!layer) { uniforms.uLayer.value = 0; return; }
      const { t, mask } = layerT(layer.values, grid, layer.mode);
      layerTextures = [texture(t, grid.cols, grid.rows, RedFormat, FloatType, NearestFilter), texture(mask, grid.cols, grid.rows, RedFormat, UnsignedByteType, NearestFilter)];
      uniforms.uValues.value = layerTextures[0];
      uniforms.uMask.value = layerTextures[1];
      uniforms.uRamp.value = rampTextures[layer.mode === "diff" ? "diff" : "value"];
      uniforms.uGrid.value.set(grid.cols, grid.rows);
      uniforms.uLayer.value = 1;
    },
    setAlpha(value) { uniforms.uAlpha.value = value; },
    render() { renderer.render(scene, camera); },
    get ready() { return uniforms.uEarth.value !== null; },
    dispose() { for (const tex of layerTextures) tex.dispose(); renderer.dispose(); canvas.remove(); },
  };
}
