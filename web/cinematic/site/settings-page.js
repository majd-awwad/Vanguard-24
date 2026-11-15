import { createTransport } from "../../audio/transport.js";
import { makeSpatialPlan } from "../../audio/spatial-plan.js";
import { decodeMessage } from "../../i18n/decode-messages.js";
import { loadDecodeCase } from "../../sources/decode/index.js";
import { h } from "./dom.js";
import { mountNav } from "./nav.js";
import { applySettings, browserStorage, defaults, loadSettings, resolveLanguage, saveSettings, SPEEDS, STORAGE_KEY, TEXT_SIZES } from "./settings.js";
import { settingsCopy } from "./settings-copy.js";
import { soundCopy } from "./sound-copy.js";
import { CASE_ID } from "./sound.js";

const SHORTCUT_KEYS = ["arrows", "space", "enter", "p", "l", "r", "s"];

/** True when a speech voice for `language` is installed. Pure given a voice list, so it can be tested. */
export function hasVoice(voices, language) {
  return voices.some((voice) => String(voice.lang).toLowerCase().startsWith(language));
}

export async function startSettings(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "settings", from: "pages" });
  const c = settingsCopy[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("settings-root");
  let settings = loadSettings();
  const storageWorks = (() => { try { const s = browserStorage(); s.setItem(STORAGE_KEY + ".probe", "1"); s.removeItem(STORAGE_KEY + ".probe"); return true; } catch { return false; } })();
  const live = h(document, "p", { class: "settings-live", role: "status", "aria-live": "polite" });
  const say = (text) => { live.textContent = text; };
  const update = (patch) => {
    settings = saveSettings(patch);
    applySettings(document, settings, language);
    say(storageWorks ? c.saved : c.noStorage);
  };
  const panel = (id, title, help, ...children) => h(document, "section", { class: "panel setting", "aria-labelledby": id },
    h(document, "h2", { id, text: title }), help ? h(document, "p", { class: "small", text: help }) : null, ...children);

  // Language: links, so the URL carries the language and every page agrees.
  const langLinks = h(document, "div", { class: "choice-row", role: "group", "aria-label": c.language.title });
  for (const code of ["en", "ar"]) {
    const url = new URL(document.URL);
    url.searchParams.set("lang", code);
    langLinks.append(h(document, "a", { class: "choice", href: "settings.html" + url.search, lang: code, hreflang: code, "aria-current": code === language ? "true" : null, text: c.language[code] }));
  }
  langLinks.addEventListener("click", (event) => { const link = event.target.closest("a"); if (link) saveSettings({ language: link.lang }); });

  // Volume + sample sound through the real transport.
  const volume = h(document, "input", { type: "range", min: 0, max: 100, step: 1, id: "set-volume", value: Math.round(settings.volume * 100) });
  const volumeOut = h(document, "output", { for: "set-volume", class: "ltr", text: Math.round(settings.volume * 100) + "%" });
  const transport = createTransport();
  transport.setVolume(settings.volume);
  transport.setSpeed(settings.speed);
  const captionLine = h(document, "p", { class: "captions", role: "status", "aria-live": "polite", text: c.captions.preview });
  const sample = h(document, "button", { type: "button", class: "button ghost", text: c.volume.sample });
  let data = null;
  const sampleCaption = () => soundCopy[language].captions.legend;
  sample.addEventListener("click", async () => {
    try {
      data ??= await loadDecodeCase(CASE_ID);
      transport.pause();
      transport.load(makeSpatialPlan(data, { level: "quick", mode: "legend" }));
      await transport.play("audio", 1);
      if (settings.captions) captionLine.textContent = sampleCaption(); else say(c.volume.playing);
    } catch (error) { console.error(error); }
  });
  volume.addEventListener("input", () => {
    const value = Number(volume.value) / 100;
    transport.setVolume(value);
    volumeOut.textContent = volume.value + "%";
    update({ volume: value });
  });

  // Speed, only offered because the transport really has setSpeed.
  const speedRow = h(document, "div", { class: "choice-row", role: "group", "aria-label": c.speed.label });
  const speedButtons = SPEEDS.map((speed) => {
    const button = h(document, "button", { type: "button", class: "choice", "aria-pressed": speed === settings.speed, text: speed + c.speed.unit });
    button.addEventListener("click", () => { transport.setSpeed(speed); update({ speed }); for (const b of speedButtons) b.setAttribute("aria-pressed", String(b === button)); });
    return button;
  });
  speedRow.append(...speedButtons);

  const toggle = (id, label, value, onChange) => {
    const button = h(document, "button", { type: "button", role: "switch", class: "switch", id, "aria-checked": String(value), "aria-label": label }, h(document, "span", { class: "knob", "aria-hidden": "true" }));
    button.addEventListener("click", () => { const next = button.getAttribute("aria-checked") !== "true"; button.setAttribute("aria-checked", String(next)); onChange(next); });
    return button;
  };
  const contrast = toggle("set-contrast", c.contrast.label, settings.contrast, (value) => update({ contrast: value }));
  const captions = toggle("set-captions", c.captions.label, settings.captions, (value) => { update({ captions: value }); captionLine.classList.toggle("visually-hidden", !value); });
  captionLine.classList.toggle("visually-hidden", !settings.captions);

  const sizeRow = h(document, "div", { class: "choice-row", role: "group", "aria-label": c.text.label });
  const sizeButtons = TEXT_SIZES.map((size, index) => {
    const button = h(document, "button", { type: "button", class: "choice size-" + size, "aria-pressed": size === settings.textSize, "aria-label": c.text.sizes[size], text: "Aa" });
    button.style.fontSize = (0.85 + index * 0.18) + "rem";
    button.addEventListener("click", () => { update({ textSize: size }); for (const b of sizeButtons) b.setAttribute("aria-pressed", String(b === button)); });
    return button;
  });
  sizeRow.append(...sizeButtons);

  const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  // Instructions as text; spoken only when a voice exists for this language.
  const instructions = h(document, "ol", { class: "instructions" }, c.instructions.map((line) => h(document, "li", { text: line })));
  const speech = globalThis.speechSynthesis;
  const guidanceSwitch = toggle("set-guidance", c.guidance.label, settings.guidance, (value) => update({ guidance: value }));
  const guidanceRow = h(document, "div", { class: "switch-row" }, h(document, "span", { text: c.guidance.label }), guidanceSwitch);
  const guidanceBody = h(document, "div", {});
  const refreshGuidance = () => {
    const available = Boolean(speech) && hasVoice(speech.getVoices(), language);
    if (!available) { guidanceBody.replaceChildren(guidanceRow, h(document, "p", { class: "callout", text: c.guidance.unavailable })); return; }
    const read = h(document, "button", { type: "button", class: "button ghost", text: c.guidance.read });
    const stop = h(document, "button", { type: "button", class: "button ghost", text: c.guidance.stop });
    read.addEventListener("click", () => { speech.cancel(); const utterance = new SpeechSynthesisUtterance(c.instructions.join(" ")); utterance.lang = language; speech.speak(utterance); });
    stop.addEventListener("click", () => speech.cancel());
    guidanceBody.replaceChildren(guidanceRow, h(document, "div", { class: "player-buttons" }, read, stop));
  };
  refreshGuidance();
  speech?.addEventListener?.("voiceschanged", refreshGuidance);

  // Keyboard guide: the Decode grid's own shortcut messages, plus this site's grids.
  const decodeKeys = h(document, "ul", { class: "keys" });
  for (const key of SHORTCUT_KEYS) decodeKeys.append(h(document, "li", { text: decodeMessage(language, "grid.shortcut." + key) }));
  const siteKeys = h(document, "ul", { class: "keys" }, c.keys.items.map((line) => h(document, "li", { text: line })));

  const reset = h(document, "button", { type: "button", class: "button ghost", text: c.reset.label });
  reset.addEventListener("click", () => {
    settings = saveSettings({ ...defaults, language });
    applySettings(document, settings, language);
    volume.value = Math.round(settings.volume * 100); volumeOut.textContent = volume.value + "%";
    transport.setVolume(settings.volume); transport.setSpeed(settings.speed);
    contrast.setAttribute("aria-checked", "false"); captions.setAttribute("aria-checked", "false"); captionLine.classList.add("visually-hidden");
    speedButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(SPEEDS[i] === settings.speed)));
    sizeButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(TEXT_SIZES[i] === settings.textSize)));
    say(c.reset.done);
  });

  const grid = h(document, "div", { class: "settings-grid" },
    panel("set-lang-title", c.language.title, c.language.help, langLinks),
    panel("set-vol-title", c.volume.title, c.volume.help, h(document, "label", { class: "volume", for: "set-volume" }, h(document, "span", { text: c.volume.label }), volume, volumeOut), sample, h(document, "p", { class: "small", text: c.volume.sampleHelp })),
    panel("set-speed-title", c.speed.title, c.speed.help, speedRow),
    panel("set-contrast-title", c.contrast.title, c.contrast.help, h(document, "div", { class: "switch-row" }, h(document, "span", { text: c.contrast.label }), contrast)),
    panel("set-text-title", c.text.title, c.text.help, sizeRow),
    panel("set-captions-title", c.captions.title, c.captions.help, h(document, "div", { class: "switch-row" }, h(document, "span", { text: c.captions.label }), captions), captionLine),
    panel("set-motion-title", c.motion.title, c.motion.help, h(document, "p", { class: "callout", text: reduced ? c.motion.on : c.motion.off })),
    panel("set-guidance-title", c.guidance.title, c.guidance.help, guidanceBody),
    panel("set-instr-title", c.instructionsTitle, null, instructions),
    panel("set-keys-title", c.keys.title, c.keys.note, h(document, "h3", { text: c.keys.decode }), decodeKeys, h(document, "h3", { text: c.keys.sound }), siteKeys));

  root.replaceChildren(
    h(document, "section", { class: "settings-intro" }, h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", {}, h(document, "em", { text: c.titleLead })), h(document, "p", { class: "lede", text: c.lede })),
    grid, h(document, "div", { class: "settings-foot" }, reset, live), h(document, "p", { class: "credit", text: c.credit }));
  if (!storageWorks) say(c.noStorage);
}
