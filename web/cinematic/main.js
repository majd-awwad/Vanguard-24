import { createTransport } from "../audio/transport.js";
import { mountDecode } from "../decode.js";
import { decodeMessage } from "../i18n/decode-messages.js";
import { loadDecodeCase } from "../sources/decode/index.js";
import { mountDecodeVisual } from "../visual/decode-visual.js";
import { createAudioTap } from "./audio-tap.js";
import { copy } from "./copy.js";
import { createGlobeMount } from "./globe.js";
import { createHero } from "./hero.js";
import { createScene } from "./scene.js";

// Mirrors startDecode() in web/decode.js (read-only): the same session, transport, spatial plan and accessible
// grid run underneath, with a cinematic scene, hero and dock around them. The only interactive grid is still the
// shared HTML one; the 3D layer draws what the session snapshot allows and nothing else.

export async function startCinematic(root) {
  const document = root.ownerDocument;
  const language = new URL(document.URL).searchParams.get("lang") === "ar" ? "ar" : "en";
  const text = copy[language];
  const body = document.body;
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = text.pageTitle + " · EARTHPULSE";
  body.classList.add("cine");
  body.dataset.view = "hero";

  // Navigation and language switch.
  const links = { "#cine-nav-decode": text.nav.decode, "#cine-nav-about": text.nav.about, "#cine-nav-science": text.nav.science, "#cine-nav-dataset": text.nav.dataset };
  for (const [selector, label] of Object.entries(links)) document.querySelector(selector).textContent = label;
  document.querySelector(".cine-links").setAttribute("aria-label", text.nav.label);
  document.querySelector("#decode-home").href = language === "ar" ? "./?lang=ar" : "./";
  document.querySelector(".cine-lang").setAttribute("aria-label", text.language);
  for (const code of ["en", "ar"]) {
    const link = document.querySelector("#cine-lang-" + code);
    if (code === language) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
  }

  // The scene is one fixed canvas behind the page, so the hero Earth shows while the case is still loading.
  let scene = null;
  try {
    scene = createScene({ document });
    scene.setDirection(language === "ar");
    body.prepend(scene.canvas);
    body.dataset.renderer = "webgl";
    body.dataset.flight = "hero";
    // The registered map fades in only once the camera has finished flying (see cinematic.css).
    scene.onFrame(({ progress, target }) => {
      const flight = progress !== target ? "flying" : target === 1 ? "done" : "hero";
      if (body.dataset.flight !== flight) body.dataset.flight = flight;
    });
    scene.onLost(() => { body.dataset.renderer = "svg"; });
  } catch (error) {
    console.warn("WebGL is unavailable; using the flat map.", error);
    body.dataset.renderer = "svg";
  }

  const tap = createAudioTap();
  const transport = createTransport({ createContext: () => tap.createContext() });
  const hero = createHero({ root, language, scene, transport, analyser: () => tap.analyser });
  let caseInfo = null;

  const state = root.querySelector("#decode-state");
  const retry = root.querySelector("#decode-retry");
  const t = (key) => decodeMessage(language, key);
  retry.textContent = t("general.retry");

  const mountVisual = createGlobeMount({
    scene,
    fallback: mountDecodeVisual,
    captionFor: () => text.caption[caseInfo?.phenomenon === "dust" ? "dust" : "generic"],
    onLost: () => { body.dataset.renderer = "svg"; },
  });

  async function loadCase(id) {
    caseInfo = await loadDecodeCase(id);
    hero.setCase(caseInfo);
    return caseInfo;
  }

  async function start() {
    retry.hidden = true;
    state.textContent = t("general.loading");
    try {
      let sound;
      try {
        sound = await import("../audio/spatial-plan.js");
      } catch (error) {
        if (error instanceof TypeError) {
          state.textContent = decodeMessage(language, "general.error");
          return;
        }
        throw error;
      }
      if (typeof sound.makeSpatialPlan !== "function" || typeof sound.heardClass !== "function") {
        throw new Error("Decode spatial plan exports do not conform to v2.");
      }
      const mounted = await mountDecode(root, {
        language, makePlan: sound.makeSpatialPlan, heardClass: sound.heardClass, mountVisual, transport, loadCase,
      });
      hero.bind(mounted.session);
      // Test and inspection hook, off unless the URL asks for it.
      if (new URL(document.URL).searchParams.has("cine-debug")) window.__cineDebug = { session: mounted.session, transport, scene };
      state.textContent = "";
    } catch (error) {
      console.error(error);
      state.textContent = t("general.error");
      retry.hidden = false;
    }
  }

  retry.addEventListener("click", start);
  await start();
}
