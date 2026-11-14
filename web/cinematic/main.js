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
import { NAV_ITEMS, SETTINGS_PATH, hrefFor, navText } from "./site/nav.js";
import { markDecodeCompleted } from "./site/progress.js";
import { applySettings, loadSettings, resolveLanguage, saveSettings } from "./site/settings.js";

// Mirrors startDecode() in web/decode.js (read-only): the same session, transport, spatial plan and accessible
// grid run underneath, with a cinematic scene, hero and dock around them. The only interactive grid is still the
// shared HTML one; the 3D layer draws what the session snapshot allows and nothing else.

export async function startCinematic(root) {
  const document = root.ownerDocument;
  // Shared settings (language, contrast, text size, volume, speed) are read here, the same way as on every site page.
  const settings = loadSettings();
  const language = resolveLanguage(document.URL, settings);
  if (new URL(document.URL).searchParams.has("lang") && language !== settings.language) saveSettings({ language });
  const text = copy[language];
  const body = document.body;
  applySettings(document, settings, language);
  document.title = text.pageTitle + " · EARTHPULSE";
  body.classList.add("cine");
  body.dataset.view = "hero";

  // Navigation: the same six pages and settings link as every site page.
  const nav = navText[language];
  const navHost = document.querySelector(".cine-links");
  navHost.setAttribute("aria-label", nav.label);
  navHost.replaceChildren(...NAV_ITEMS.map((item) => {
    const link = document.createElement("a");
    link.href = hrefFor(item.path, "root");
    link.textContent = nav[item.id];
    if (item.id === "decode") link.setAttribute("aria-current", "page");
    return link;
  }));
  const gear = document.createElement("a");
  gear.className = "cine-icon-button";
  gear.href = hrefFor(SETTINGS_PATH, "root");
  gear.setAttribute("aria-label", nav.settings);
  gear.title = nav.settings;
  gear.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="2.2" fill="currentColor"/><path d="M5 9.5h14M12 9.5V14m0 0-3.5 6M12 14l3.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.querySelector(".cine-tools").prepend(gear);
  document.querySelector("#decode-home").href = language === "ar" ? "./?lang=ar" : "./";
  for (const [selector, relative] of Object.entries({
    "#cine-flat": "./decode.html",
    "#cine-text": "./decode.html?condition=text",
  })) {
    const target = new URL(relative, document.URL);
    if (language === "ar") target.searchParams.set("lang", language);
    document.querySelector(selector).href = target.href;
  }
  document.querySelector("#cine-flat").textContent = text.flat;
  document.querySelector("#cine-text").textContent = text.text;
  document.querySelector("#cine-skip").textContent = text.skip;
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
  transport.setVolume(settings.volume);
  transport.setSpeed(settings.speed);
  for (const [index, id] of ["cine-mix-title", "cine-mix-label", "cine-mix-help"].entries()) root.querySelector("#" + id).textContent = text.mix[index];
  root.querySelector("#cine-instrument-type").textContent = text.instrumentType;
  root.querySelector("#cine-mix").addEventListener("input", (event) => transport.setAtmosphereVolume(Number(event.target.value) / 100));
  document.defaultView.addEventListener("pagehide", () => transport.pause());
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
          retry.hidden = false;
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
      // Remember that Decode was finished once, so Explore Earth and Sound Lab may show the answers.
      mounted.session.subscribe((snapshot) => { if (snapshot.phase === "reveal" && snapshot.mode === "discovery") markDecodeCompleted(); });
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
