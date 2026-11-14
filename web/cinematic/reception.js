import { message } from "../i18n/platform-messages.js";

const root = document.querySelector("#reception-globe");
const regions = {
  dust: { lon: 15, lat: 30, coordinates: "30° N · 15° E", copy: "globeDust", href: "./decode-3d.html" },
  forest: { lon: -44.13, lat: -13.74, coordinates: "13.74° S · 44.13° W", copy: "globeForest", href: "./forest.html" },
  rain: { lon: -84.95, lat: 27.05, coordinates: "27.05° N · 84.95° W", copy: "globeRain", href: "./index.html?signal=rain#lens" },
};
const controls = [...root.querySelectorAll("[data-region]")];
const surface = root.querySelector(".reception-earth");
const caption = root.querySelector("#reception-region");
const coords = root.querySelector("#reception-coordinates");
const open = root.querySelector("#reception-open");
let current = "dust";
let scene;
let visible = false;
let initializing = false;

function render(move = false) {
  const region = regions[current];
  const lang = document.documentElement.lang;
  caption.textContent = message(lang, region.copy);
  coords.textContent = region.coordinates;
  const target = new URL(region.href, document.URL);
  if (lang === "ar") target.searchParams.set("lang", lang);
  open.href = target.href;
  for (const button of controls) button.setAttribute("aria-pressed", String(button.dataset.region === current));
  root.dataset.reception = current;
  if (move) scene?.orient(region.lon, region.lat);
}

async function initialize() {
  if (initializing || !visible) return;
  initializing = true;
  try {
    const { createScene } = await import("./scene.js");
    const renderer = createScene({ document, surface });
    scene = renderer;
    renderer.onLost(() => {
      renderer.dispose();
      scene = undefined;
      root.dataset.renderer = "image";
    });
    surface.append(renderer.canvas);
    root.dataset.renderer = "webgl";
    render(true);
  } catch {
    root.dataset.renderer = "image";
  }
}

for (const button of controls) {
  button.addEventListener("click", () => {
    current = button.dataset.region;
    render(true);
  });
}
new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
if ("IntersectionObserver" in window) {
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      intersection.disconnect();
      initialize();
    }
  });
  intersection.observe(root);
} else {
  visible = true;
  initialize();
}
render();
