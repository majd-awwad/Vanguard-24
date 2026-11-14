import { drawWaveform } from "./audio-tap.js";
import { copy, fill } from "./copy.js";
import { guideState } from "./guide.js";

const DECODING = new Set(["listen", "decode", "reveal"]);

/**
 * The hero and chrome around the globe: copy, the live-waveform sound-guide button, the case information bar,
 * Start Decoding, zoom and compass, and the hero-to-dock switch. Everything about the case (source, date,
 * threshold) comes from the loaded case; nothing is hardcoded here.
 */
export function createHero({ root, language, scene, transport, analyser = () => null }) {
  const document = root.ownerDocument;
  const body = document.body;
  const text = copy[language];
  const query = (selector) => root.ownerDocument.querySelector(selector);
  const el = {
    eyebrow: query("#cine-eyebrow"), lead: query("#cine-title-lead"), accent: query("#cine-title-accent"),
    lede: query("#cine-lede"), lede2: query("#cine-lede2"), play: query("#cine-play-guide"), playLabel: query("#cine-play-label"),
    wave: query("#cine-wave"), caption: query("#cine-guide-caption"), steps: query("#cine-steps"), start: query("#cine-start"),
    startLabel: query("#cine-start-label"), source: query("#cine-source"), challenge: query("#cine-challenge"),
    zoomIn: query("#cine-zoom-in"), zoomOut: query("#cine-zoom-out"), compass: query("#cine-compass"),
    sound: query("#cine-sound"), dock: query("#cine-dock-label"),
  };
  let session = null;
  let caseData = null;
  let phase = "intro";
  let snapshot = null;
  let waveFrame = 0;
  let unsubscribe = () => {};
  const controller = new AbortController();
  const { signal } = controller;

  // ---- static copy ----
  el.eyebrow.textContent = text.eyebrow;
  el.lead.textContent = text.titleLead;
  el.accent.textContent = text.titleAccent;
  el.lede.textContent = text.lede;
  el.lede2.textContent = text.lede2;
  el.playLabel.textContent = text.playGuide;
  el.startLabel.textContent = text.start;
  el.steps.setAttribute("aria-label", text.stepsLabel);
  [...el.steps.querySelectorAll("[data-step]")].forEach((item, index) => {
    item.querySelector("span").textContent = text.steps[index];
  });
  el.zoomIn.setAttribute("aria-label", text.zoomIn);
  el.zoomOut.setAttribute("aria-label", text.zoomOut);
  el.compass.setAttribute("aria-label", text.compass);
  el.sound.setAttribute("aria-label", text.sound);
  el.dock?.replaceChildren(document.createTextNode(text.dockLabel));
  el.challenge.textContent = text.loading;

  // ---- case facts, read from the loaded case ----
  function setCase(data) {
    caseData = data;
    const threshold = data.levels.quick.truth.threshold;
    const measure = data.phenomenon === "dust" ? text.measureDust : text.measureGeneric;
    el.challenge.textContent = fill(text.challenge, {
      measure, threshold: new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 10 }).format(threshold),
    });
    // "GEOS FP 2d time-averaged ..." -> "GEOS-FP"; anything else is shown as its first words.
    const product = String(data.source.product ?? "").trim();
    const short = /^GEOS[ -]FP\b/i.test(product) ? "GEOS-FP" : product.split(/\s+/).slice(0, 3).join(" ");
    el.source.textContent = short;
    el.source.title = text.sourceLabel + ": " + product;
    body.dataset.caseReady = "";
  }

  // ---- view: hero vs decode dock ----
  function setView(next) {
    const view = DECODING.has(next) ? "decode" : "hero";
    if (body.dataset.view !== view) body.dataset.view = view;
  }

  function bind(nextSession) {
    session = nextSession;
    unsubscribe();
    unsubscribe = session.subscribe((state) => {
      snapshot = state;
      phase = state.phase;
      setView(phase);
      const guidePlaying = state.playMode === "legend" && ["playing", "starting"].includes(state.transport.status);
      el.play.setAttribute("aria-pressed", guidePlaying ? "true" : "false");
      el.playLabel.textContent = guidePlaying ? text.stopGuide : text.playGuide;
      const step = guideState(state)?.step;
      el.caption.textContent = step ? text.guide[step] : "";
      el.caption.hidden = !step;
      el.sound.setAttribute("aria-pressed", state.transport.muted ? "true" : "false");
      startWave();
    });
  }

  // ---- controls ----
  el.play.addEventListener("click", () => {
    if (!session) return;
    const playing = snapshot?.playMode === "legend" && ["playing", "starting"].includes(snapshot.transport.status);
    if (playing) session.dispatch({ type: "pause" });
    else session.dispatch({ type: "play", mode: "legend" });
  }, { signal });

  el.start.addEventListener("click", () => {
    if (!session) return;
    // intro -> legend -> listen: one click, because the sound guide already plays from the hero.
    for (let guard = 0; guard < 3 && !DECODING.has(session.getState().phase); guard++) {
      session.dispatch({ type: "next" });
    }
  }, { signal });

  el.zoomIn.addEventListener("click", () => scene?.zoom(1.18), { signal });
  el.zoomOut.addEventListener("click", () => scene?.zoom(1 / 1.18), { signal });
  el.compass.addEventListener("click", () => scene?.resetView(), { signal });
  el.sound.addEventListener("click", () => transport.setMuted(!transport.snapshot().muted), { signal });

  // ---- live waveform from the real audio output ----
  function startWave() {
    if (waveFrame || document.hidden || body.dataset.view !== "hero") return;
    const tick = () => {
      waveFrame = 0;
      if (document.hidden || body.dataset.view !== "hero") return;
      drawWaveform(el.wave, analyser(), { color: "#5eead4" });
      waveFrame = document.defaultView.requestAnimationFrame(tick);
    };
    waveFrame = document.defaultView.requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", startWave, { signal });
  new MutationObserver(startWave).observe(body, { attributes: true, attributeFilter: ["data-view"] });
  startWave();

  return {
    bind,
    setCase,
    get caseData() { return caseData; },
    dispose() {
      controller.abort();
      unsubscribe();
      if (waveFrame) document.defaultView.cancelAnimationFrame(waveFrame);
    },
  };
}
