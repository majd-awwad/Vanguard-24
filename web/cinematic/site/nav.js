import { h } from "./dom.js";
import { TEXT_SIZES, applySettings, loadSettings, resolveLanguage, saveSettings } from "./settings.js";

// The one shell for every page: header (five links, accessibility icon that opens the settings drawer, EN | العربية),
// the full-screen menu on small screens, the settings drawer, and the footer. Paths are given relative to web/ and
// re-based for the page that renders them.

export const NAV_ITEMS = Object.freeze([
  { id: "decode", path: "index.html" },
  { id: "explore", path: "pages/explore.html" },
  { id: "studio", path: "pages/studio.html" },
  { id: "science", path: "pages/science.html" },
  { id: "about", path: "pages/about.html" },
]);
/** The path through the site: Decode, then the data, then the Studio. The Studio itself is the end of the path. */
export const NEXT_STEPS = Object.freeze({
  decode: { path: "pages/explore.html", en: ["Explore the data", "You listened and decoded. Now look at the real data, cell by cell."], ar: ["استكشف البيانات", "استمعت وفككت الشيفرة. الآن انظر إلى البيانات الحقيقية خلية بخلية."] },
  explore: { path: "pages/studio.html", en: ["Open the Sound Studio", "Compare dates, find signals and listen across the whole map."], ar: ["افتح استوديو الصوت", "قارن التواريخ وابحث عن الإشارات واستمع عبر الخريطة كلها."] },
  science: { path: "pages/studio.html", en: ["Open the Sound Studio", "Now hear these numbers on the map, for dust, rain and wind."], ar: ["افتح استوديو الصوت", "والآن استمع إلى هذه الأرقام على الخريطة: غبار ومطر ورياح."] },
  about: { path: "index.html", en: ["Start with Decode", "The best way to understand EARTHPULSE is to listen to it."], ar: ["ابدأ بفك الشيفرة", "أفضل طريقة لفهم EARTHPULSE هي أن تستمع إليه."] },
  settings: { path: "index.html", en: ["Back to Decode", "Your settings are saved on this device."], ar: ["العودة إلى فك الشيفرة", "إعداداتك محفوظة على هذا الجهاز."] },
});

export function mountNext(document, { language, from = "root", active, host = document.getElementById("site-footer") } = {}) {
  const step = NEXT_STEPS[active];
  if (!step) return null;
  const [label, text] = step[language] ?? step.en;
  const band = h(document, "section", { class: "next-step", "aria-label": label },
    h(document, "p", { class: "next-text", text }), h(document, "a", { class: "button next-button", href: hrefFor(step.path, from), text: label + (language === "ar" ? " ←" : " →") }));
  if (host) host.before(band); else document.body.append(band);
  return band;
}

export const SETTINGS_PATH = "pages/settings.html";
export const ARCHIVE_PATH = "atlas.html";

export const navText = {
  en: {
    label: "Main", menu: "Menu", close: "Close", decode: "Decode", explore: "Explore Earth", studio: "Sound Studio", science: "Science", about: "About", settings: "Accessibility and settings", language: "Language",
    guidance: "Spoken instructions", skip: "Skip to the content", drawerTitle: "Settings", allSettings: "All settings", volume: "Sound volume", voiceVolume: "Voice volume", contrast: "High contrast", textSize: "Text size", captions: "Captions",
    sizes: { sm: "Small", md: "Medium", lg: "Large", xl: "Extra large" }, speeds: "Playback speed",
    footer: { data: "Data: NASA GMAO GEOS-FP (model). Earth imagery: NASA Earth Observatory, Blue Marble.", notEndorsed: "EARTHPULSE is not endorsed by NASA.", archive: "Archive: Sound Atlas v1", team: "Team Vanguard · An-Najah National University, Palestine" },
  },
  ar: {
    label: "التنقل الرئيسي", menu: "القائمة", close: "إغلاق", decode: "فك الشيفرة", explore: "استكشف الأرض", studio: "استوديو الصوت", science: "العلوم", about: "حول", settings: "إمكانية الوصول والإعدادات", language: "اللغة",
    guidance: "التعليمات المنطوقة", skip: "تخطَّ إلى المحتوى", drawerTitle: "الإعدادات", allSettings: "كل الإعدادات", volume: "مستوى الصوت", voiceVolume: "مستوى صوت الكلام", contrast: "تباين عالٍ", textSize: "حجم النص", captions: "التعليقات النصية",
    sizes: { sm: "صغير", md: "متوسط", lg: "كبير", xl: "كبير جدًا" }, speeds: "سرعة التشغيل",
    footer: { data: "البيانات: NASA GMAO GEOS-FP (نموذج). صور الأرض: مرصد الأرض التابع لناسا، Blue Marble.", notEndorsed: "EARTHPULSE لا تتبنّاه ناسا.", archive: "الأرشيف: أطلس الصوت v1", team: "فريق Vanguard · جامعة النجاح الوطنية، فلسطين" },
  },
};

/** `from` is where the current page lives: "root" (web/) or "pages" (web/pages/). */
export function hrefFor(path, from) {
  if (from === "root") return "./" + (path === "index.html" ? "" : path);
  if (path === "index.html") return "../";
  return path.startsWith("pages/") ? "./" + path.slice(6) : "../" + path;
}

const GEAR = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="2.2" fill="currentColor"/><path d="M5 9.5h14M12 9.5V14m0 0-3.5 6M12 14l3.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const MENU = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const langHref = (url, code) => { const next = new URL(url); next.searchParams.set("lang", code); return next.pathname.split("/").pop() + next.search + next.hash; };
const emit = (document, settings) => document.defaultView?.dispatchEvent(new document.defaultView.CustomEvent("earthpulse:settings", { detail: settings }));

/** A panel that slides in, closes with Escape or a click outside, and gives focus back to what opened it. */
function overlay(document, { node, backdrop, trigger, initialFocus }) {
  let open = false;
  const onKey = (event) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
  function show() {
    if (open) return;
    open = true;
    node.hidden = false;
    if (backdrop) backdrop.hidden = false;
    document.defaultView.requestAnimationFrame(() => { node.dataset.open = "true"; if (backdrop) backdrop.dataset.open = "true"; });
    trigger?.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onKey);
    (initialFocus?.() ?? node.querySelector("button, a, input"))?.focus?.();
  }
  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false;
    delete node.dataset.open;
    if (backdrop) delete backdrop.dataset.open;
    trigger?.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKey);
    const done = () => { node.hidden = true; if (backdrop) backdrop.hidden = true; };
    if (document.defaultView.matchMedia?.("(prefers-reduced-motion: reduce)").matches) done(); else document.defaultView.setTimeout(done, 240);
    if (restoreFocus) trigger?.focus?.();
  }
  backdrop?.addEventListener("click", () => close());
  return { show, close, get isOpen() { return open; } };
}

/** The settings drawer: the six most used settings, live and persistent, with a link to the full page. */
export function createSettingsDrawer(document, { language, from = "root", storage, url = document.URL, trigger = null } = {}) {
  const t = navText[language];
  let settings = loadSettings(storage);
  const apply = (patch) => { settings = saveSettings(patch, storage); applySettings(document, settings, language); emit(document, settings); };
  const backdrop = h(document, "div", { class: "drawer-backdrop", hidden: true });
  const close = h(document, "button", { type: "button", class: "icon-btn", "aria-label": t.close });
  close.innerHTML = CLOSE;
  const switches = {};
  const toggle = (label, key) => {
    const button = h(document, "button", { type: "button", role: "switch", class: "switch", "aria-checked": String(settings[key]), "aria-label": label }, h(document, "span", { class: "knob", "aria-hidden": "true" }));
    button.addEventListener("click", () => { const next = button.getAttribute("aria-checked") !== "true"; button.setAttribute("aria-checked", String(next)); apply({ [key]: next }); });
    switches[key] = button;
    return h(document, "div", { class: "setting-inline" }, h(document, "span", { text: label }), button);
  };
  const slider = (label, key) => {
    const input = h(document, "input", { type: "range", min: 0, max: 100, step: 1, id: "drawer-" + key, value: Math.round((settings[key] ?? 1) * 100) });
    input.addEventListener("input", () => apply({ [key]: Number(input.value) / 100 }));
    return h(document, "div", { class: "setting-row" }, h(document, "label", { for: input.id, text: label }), input);
  };
  const languageRow = h(document, "div", { class: "setting-row" }, h(document, "span", { class: "setting-label", text: t.language }),
    h(document, "div", { class: "seg", role: "group", "aria-label": t.language },
      h(document, "a", { href: langHref(url, "en"), lang: "en", hreflang: "en", "aria-current": language === "en" ? "true" : null, text: "EN" }),
      h(document, "a", { href: langHref(url, "ar"), lang: "ar", hreflang: "ar", "aria-current": language === "ar" ? "true" : null, text: "العربية" })));
  const sizeButtons = TEXT_SIZES.map((size, index) => {
    const b = h(document, "button", { type: "button", "aria-pressed": size === settings.textSize, "aria-label": t.sizes[size], text: "Aa" });
    b.style.fontSize = 0.8 + index * 0.17 + "rem";
    b.addEventListener("click", () => { apply({ textSize: size }); for (const x of sizeButtons) x.setAttribute("aria-pressed", String(x === b)); });
    return b;
  });
  const sizeRow = h(document, "div", { class: "setting-row" }, h(document, "span", { class: "setting-label", text: t.textSize }), h(document, "div", { class: "seg", role: "group", "aria-label": t.textSize }, ...sizeButtons));
  // Another part of the page (for example the Studio's Guided / Pure switch) changed a setting: keep the switches true to it.
  document.defaultView?.addEventListener("earthpulse:settings", (event) => { for (const [key, button] of Object.entries(switches)) if (typeof event.detail?.[key] === "boolean") button.setAttribute("aria-checked", String(event.detail[key])); });
  const node = h(document, "aside", { class: "drawer", id: "settings-drawer", role: "dialog", "aria-modal": "false", "aria-labelledby": "drawer-title", hidden: true },
    h(document, "div", { class: "drawer-head" }, h(document, "h2", { id: "drawer-title", text: t.drawerTitle }), close),
    h(document, "div", { class: "drawer-body" }, languageRow, slider(t.volume, "volume"), slider(t.voiceVolume, "speechVolume"), toggle(t.contrast, "contrast"), sizeRow, toggle(t.captions, "captions"), toggle(t.guidance, "guidance")),
    h(document, "div", { class: "drawer-foot" }, h(document, "a", { class: "button ghost", href: hrefFor(SETTINGS_PATH, from), text: t.allSettings })));
  document.body.append(backdrop, node);
  const ctl = overlay(document, { node, backdrop, trigger, initialFocus: () => close });
  close.addEventListener("click", () => ctl.close());
  return { node, open: ctl.show, close: ctl.close, toggle: () => (ctl.isOpen ? ctl.close() : ctl.show()), get isOpen() { return ctl.isOpen; } };
}

export function mountFooter(document, { language, from = "root", host = document.getElementById("site-footer") } = {}) {
  const t = navText[language].footer;
  const footer = host ?? h(document, "footer", { id: "site-footer" });
  footer.className = "site-footer";
  footer.replaceChildren(
    h(document, "div", {}, h(document, "p", { text: t.data }), h(document, "p", { text: t.notEndorsed })),
    h(document, "div", {}, h(document, "p", {}, h(document, "a", { href: hrefFor(ARCHIVE_PATH, from).replace("../", "../").replace(/^\.\/\.\//, "./"), text: t.archive })), h(document, "p", { text: t.team })));
  if (!host) document.body.append(footer);
  return footer;
}

/**
 * Builds the header into `host`, applies the stored settings to <html>, builds the drawer and footer, and returns the
 * active language. `active` is a NAV_ITEMS id (or "settings" for the full settings page).
 */
export function mountNav(document, host, { active, from = "pages", url = document.URL, storage, variant = "bar", footer = true, skipTo = "#site-main" } = {}) {
  const settings = loadSettings(storage);
  const language = resolveLanguage(url, settings);
  if (new URL(url).searchParams.has("lang") && language !== settings.language) saveSettings({ language }, storage);
  applySettings(document, settings, language);
  const t = navText[language];

  const skip = h(document, "a", { class: "site-skip", href: skipTo, text: t.skip });
  const logo = h(document, "a", { class: "site-logo", href: hrefFor("index.html", from) }, document.createTextNode("EARTH"), h(document, "span", { text: "PULSE" }));
  const links = h(document, "nav", { id: "site-links", class: "site-links", "aria-label": t.label });
  for (const item of NAV_ITEMS) links.append(h(document, "a", { href: hrefFor(item.path, from), "aria-current": item.id === active ? "page" : null, text: t[item.id] }));

  const gear = h(document, "button", { type: "button", class: "icon-btn", id: "site-settings", "aria-label": t.settings, "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "settings-drawer" });
  gear.innerHTML = GEAR;
  const menuButton = h(document, "button", { type: "button", class: "icon-btn site-menu-button", "aria-label": t.menu, "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "site-sheet" });
  menuButton.innerHTML = MENU;
  const lang = h(document, "span", { class: "site-lang site-lang-desktop", role: "group", "aria-label": t.language },
    h(document, "a", { href: langHref(url, "en"), lang: "en", hreflang: "en", "aria-current": language === "en" ? "true" : null, text: "EN" }), h(document, "span", { "aria-hidden": "true", text: "|" }),
    h(document, "a", { href: langHref(url, "ar"), lang: "ar", hreflang: "ar", "aria-current": language === "ar" ? "true" : null, text: "العربية" }));
  const shortLang = h(document, "a", { class: "site-lang", href: langHref(url, language === "ar" ? "en" : "ar"), lang: language === "ar" ? "en" : "ar", hreflang: language === "ar" ? "en" : "ar", text: language === "ar" ? "EN" : "العربية" });
  shortLang.classList.add("site-lang-mobile");

  // Full-screen menu (small screens).
  const sheetClose = h(document, "button", { type: "button", class: "icon-btn", "aria-label": t.close });
  sheetClose.innerHTML = CLOSE;
  const sheetLinks = h(document, "nav", { "aria-label": t.label });
  for (const item of NAV_ITEMS) sheetLinks.append(h(document, "a", { href: hrefFor(item.path, from), "aria-current": item.id === active ? "page" : null, text: t[item.id] }));
  const sheet = h(document, "div", { class: "site-sheet", id: "site-sheet", role: "dialog", "aria-modal": "true", "aria-label": t.menu, hidden: true },
    h(document, "div", { class: "site-sheet-head" }, h(document, "span", { class: "site-logo", "aria-hidden": "true" }, document.createTextNode("EARTH"), h(document, "span", { text: "PULSE" })), sheetClose), sheetLinks);
  document.body.append(sheet);
  const menu = overlay(document, { node: sheet, trigger: menuButton, initialFocus: () => sheetClose });
  menuButton.addEventListener("click", () => menu.show());
  sheetClose.addEventListener("click", () => menu.close());

  const drawer = createSettingsDrawer(document, { language, from, storage, url, trigger: gear });
  gear.addEventListener("click", () => drawer.toggle());

  host.classList.add("site-nav");
  host.dataset.variant = variant;
  host.replaceChildren(skip, logo, links, h(document, "div", { class: "site-tools" }, lang, shortLang, gear, menuButton));
  if (footer) { mountNext(document, { language, from, active }); mountFooter(document, { language, from }); }
  return language;
}
