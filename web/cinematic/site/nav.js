import { applySettings, loadSettings, resolveLanguage, saveSettings } from "./settings.js";

// One shared header for every page: Home, Decode, Explore Earth, Sound Lab, Science & Dataset, About, Accessibility
// (icon), EN | العربية. Paths are given relative to web/, then re-based for the page that renders them.

export const NAV_ITEMS = Object.freeze([
  { id: "home", path: "index.html" },
  { id: "decode", path: "decode-3d.html" },
  { id: "explore", path: "pages/explore.html" },
  { id: "studio", path: "pages/studio.html" },
  { id: "sound", path: "pages/sound-lab.html" },
  { id: "science", path: "pages/science.html" },
  { id: "about", path: "pages/about.html" },
]);
export const SETTINGS_PATH = "pages/settings.html";

export const navText = {
  en: { label: "Main", menu: "Menu", home: "Home", decode: "Decode", explore: "Explore Earth", studio: "Sound Studio", sound: "Sound Lab", science: "Science & Dataset", about: "About", settings: "Accessibility & Settings", language: "Language", skip: "Skip to the content" },
  ar: { label: "التنقل الرئيسي", menu: "القائمة", home: "الرئيسية", decode: "فك الشيفرة", explore: "استكشف الأرض", studio: "استوديو الصوت", sound: "مختبر الصوت", science: "العلوم والبيانات", about: "حول", settings: "إمكانية الوصول والإعدادات", language: "اللغة", skip: "تخطَّ إلى المحتوى" },
};

/** `from` is where the current page lives: "root" (web/) or "pages" (web/pages/). */
export function hrefFor(path, from) {
  if (from === "root") return "./" + (path === "index.html" ? "" : path);
  if (path === "index.html") return "../";
  return path.startsWith("pages/") ? "./" + path.slice(6) : "../" + path;
}

const GEAR = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="2.2" fill="currentColor"/><path d="M5 9.5h14M12 9.5V14m0 0-3.5 6M12 14l3.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Builds the header into `host`, applies the stored settings to <html>, and returns the active language.
 * `active` is a NAV_ITEMS id, or "settings".
 */
export function mountNav(document, host, { active, from = "pages", url = document.URL, storage } = {}) {
  const settings = loadSettings(storage);
  const language = resolveLanguage(url, settings);
  if (new URL(url).searchParams.has("lang") && language !== settings.language) saveSettings({ language }, storage);
  applySettings(document, settings, language);
  const text = navText[language];
  const make = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === "text") node.textContent = value; else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  };

  const skip = make("a", { class: "site-skip", href: "#site-main", text: text.skip });
  const logo = make("a", { class: "site-logo", href: hrefFor("index.html", from) }, [document.createTextNode("EARTH"), make("span", { text: "PULSE" })]);
  const toggle = make("button", { type: "button", class: "site-menu-button", "aria-expanded": "false", "aria-controls": "site-links", text: text.menu });
  const links = make("nav", { id: "site-links", class: "site-links", "aria-label": text.label });
  for (const item of NAV_ITEMS) {
    const link = make("a", { href: hrefFor(item.path, from), text: text[item.id] });
    if (item.id === active) link.setAttribute("aria-current", "page");
    links.append(link);
  }

  const gear = make("a", { class: "site-icon-link", href: hrefFor(SETTINGS_PATH, from), "aria-label": text.settings, title: text.settings });
  gear.innerHTML = GEAR;
  if (active === "settings") gear.setAttribute("aria-current", "page");

  const langLink = (code, label) => {
    const next = new URL(url);
    next.searchParams.set("lang", code);
    const link = make("a", { href: next.pathname.split("/").pop() + next.search + next.hash, lang: code, hreflang: code, text: label });
    if (code === language) link.setAttribute("aria-current", "true");
    return link;
  };
  const switcher = make("span", { class: "site-lang", role: "group", "aria-label": text.language }, [langLink("en", "EN"), make("span", { "aria-hidden": "true", text: "|" }), langLink("ar", "العربية")]);

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    host.dataset.open = String(open);
  });
  host.classList.add("site-nav");
  host.replaceChildren(skip, logo, toggle, links, make("div", { class: "site-tools" }, [gear, switcher]));
  return language;
}
