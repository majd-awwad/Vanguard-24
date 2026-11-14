import { loadForest } from "./sources/forest.js";
import { createTransport } from "./audio/transport.js";
import { createSession } from "./experiences/invisible-forest/session.js";
import { mountVisual } from "./visual/plot.js";
import { mountAccessible } from "./accessibility/controls.js";
import { localizePage, messages } from "./i18n/messages.js";

let language = new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en";
let controls, plot;
const text = (key) => messages(language)(key);
const errorMessage = document.querySelector("#load-error");
const loading = document.querySelector("#loading");
const retry = document.querySelector("#retry");
const experience = document.querySelector("#experience");
const entryButtons = document.querySelectorAll("#begin, #begin-silent");

function applyLanguage() {
  language = language === "en" ? "ar" : "en";
  localizePage(language);
  const url = new URL(location.href);
  if (language === "ar") url.searchParams.set("lang", "ar");
  else url.searchParams.delete("lang");
  history.replaceState(null, "", url);
  updateAtlasLinks();
  controls?.refresh();
  plot?.refresh();
  if (!errorMessage.hidden) errorMessage.textContent = text("error");
}

function updateAtlasLinks() {
  for (const link of document.querySelectorAll("[data-atlas-link]")) {
    const url = new URL(link.href);
    if (language === "ar") url.searchParams.set("lang", "ar");
    else url.searchParams.delete("lang");
    link.href = url;
  }
}

document.querySelector("#locale").addEventListener("click", applyLanguage);
localizePage(language);
updateAtlasLinks();

async function initialize() {
  const retrying = document.activeElement === retry;
  retry.disabled = true;
  loading.hidden = false;
  errorMessage.hidden = true;
  try {
    const { gedi, science } = await loadForest();
    const transport = createTransport();
    window.addEventListener("pagehide", transport.pause);
    const session = createSession(gedi, transport);
    controls = mountAccessible(session, () => language, text);
    plot = mountVisual(document.querySelector("#plot"), session, text);
    experience.dataset.sourceStatus = science.source.status;
    experience.hidden = false;
    for (const button of entryButtons) button.disabled = false;
    retry.hidden = true;
    if (retrying) document.querySelector("#lens").focus();
  } catch (error) {
    console.error(error);
    errorMessage.textContent = text("error");
    errorMessage.hidden = false;
    retry.hidden = false;
    retry.disabled = false;
    if (retrying) retry.focus();
  } finally {
    loading.hidden = true;
  }
}

retry.addEventListener("click", initialize);
await initialize();
