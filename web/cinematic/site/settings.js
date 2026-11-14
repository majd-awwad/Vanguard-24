// User settings shared by every page, including web/decode-3d.html. Stored in localStorage; every storage access is
// wrapped in try/catch because storage can be blocked or throw (private windows, blocked site data).

export const STORAGE_KEY = "earthpulse.settings.v1";
export const SPEEDS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5]);
export const TEXT_SIZES = Object.freeze(["sm", "md", "lg", "xl"]);

export const defaults = Object.freeze({
  language: "en", volume: 0.72, speed: 1, contrast: false, textSize: "md", captions: false, guidance: false,
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/** Coerces anything into a valid settings object; unknown or invalid fields fall back to the defaults. */
export function sanitize(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    language: source.language === "ar" ? "ar" : "en",
    volume: Number.isFinite(source.volume) ? clamp01(source.volume) : defaults.volume,
    speed: SPEEDS.includes(source.speed) ? source.speed : defaults.speed,
    contrast: source.contrast === true,
    textSize: TEXT_SIZES.includes(source.textSize) ? source.textSize : defaults.textSize,
    captions: source.captions === true,
    guidance: source.guidance === true,
  };
}

export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(storage = browserStorage()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitize(null);
  }
}

/** Merges `patch` into the stored settings and returns the result. Failure to persist never throws. */
export function saveSettings(patch, storage = browserStorage()) {
  const next = sanitize({ ...loadSettings(storage), ...patch });
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The settings still apply to this page view.
  }
  return next;
}

/** `?lang=` in the URL wins (and is remembered); otherwise the stored language is used. */
export function resolveLanguage(url, settings) {
  const asked = new URL(url).searchParams.get("lang");
  return asked === "ar" || asked === "en" ? asked : settings.language;
}

/** Reflects settings onto <html> so CSS can react. Geography never mirrors; only text layout does. */
export function applySettings(document, settings, language = settings.language) {
  const root = document.documentElement;
  root.lang = language;
  root.dir = language === "ar" ? "rtl" : "ltr";
  root.dataset.textSize = settings.textSize;
  if (settings.contrast) root.dataset.contrast = "high"; else delete root.dataset.contrast;
  if (settings.captions) root.dataset.captions = "on"; else delete root.dataset.captions;
}
