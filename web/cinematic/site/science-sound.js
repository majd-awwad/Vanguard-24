import { h } from "./dom.js";
import { mapCopy } from "../../studio/earthmap-copy.js";
import { PHENOMENON_IDS, openPackage } from "../../studio/datasets.js";
import { DOCUMENTED_BREAKPOINTS, MIN_VALUE, levelFor } from "../../studio/ambience-core.js";
import { createRecordings } from "../../studio/recordings.js";
import { loadSettings } from "./settings.js";

// "How it sounds": the Studio's sound is the user's recordings, chosen by the real value (low / mid / high). The buttons
// below play the same recordings for the lowest and the highest real value of a sampled date.

const words = {
  en: {
    title: "How it sounds",
    lede: "Sounds are recordings chosen by the real value: low / mid / high. The level follows the data; the recordings themselves are illustrative. Press a button to hear the recording for the lowest or the highest real value on the sampled date {date}.",
    low: "Hear low", high: "Hear high", loading: "Loading the data…", playing: "Playing {name}: the {which} recording for a real value of {value}.", error: "Could not load this example.", lowName: "low", highName: "high",
    rule: "Low up to {low}, mid up to {high}, high above ({unit}).", rain: " Below 0.1 mm per hour there is no measurable rain: silence.",
  },
  ar: {
    title: "كيف يبدو الصوت",
    lede: "الأصوات تسجيلات تُختار بالقيمة الحقيقية: منخفض / متوسط / مرتفع. المستوى يتبع البيانات؛ أما التسجيلات نفسها فتوضيحية. اضغط زرًا لتسمع التسجيل الموافق لأدنى أو أعلى قيمة حقيقية في التاريخ المأخوذ {date}.",
    low: "اسمع الأدنى", high: "اسمع الأعلى", loading: "جارٍ تحميل البيانات…", playing: "يُشغَّل {name}: تسجيل المستوى {which} لقيمة حقيقية قدرها {value}.", error: "تعذّر تحميل هذا المثال.", lowName: "المنخفض", highName: "المرتفع",
    rule: "منخفض حتى {low}، ومتوسط حتى {high}، ومرتفع فوق ذلك ({unit}).", rain: " أقل من 0.1 ملم في الساعة لا مطر قابل للقياس: صمت.",
  },
};
const credits = {
  en: { title: "Sound recordings (credits)", note: "Sounds are recordings chosen by the real value: low / mid / high. The level follows the data; the recordings themselves are illustrative. Rain below 0.1 mm per hour counts as no measurable rain (silence); the rain levels use the 33rd and 66th percentiles of the values at or above 0.1 mm per hour.", licence: "Licence: to verify. Not confirmed yet.", failed: "The credits list could not be loaded." },
  ar: { title: "التسجيلات الصوتية (الاعتمادات)", note: "الأصوات تسجيلات تُختار بالقيمة الحقيقية: منخفض / متوسط / مرتفع. المستوى يتبع البيانات؛ أما التسجيلات نفسها فتوضيحية. المطر الأقل من 0.1 ملم في الساعة يُعدّ بلا مطر قابل للقياس (صمت)، وتستخدم مستويات المطر المئين 33 و66 للقيم التي تساوي 0.1 ملم في الساعة أو أكثر.", licence: "الترخيص: قيد التحقق. لم يُؤكَّد بعد.", failed: "تعذّر تحميل قائمة الاعتمادات." },
};
const DATE = "2025-04-15";

export function howItSounds(document, language) {
  const w = words[language];
  const m = mapCopy[language];
  const status = h(document, "p", { class: "small", role: "status", "aria-live": "polite" });
  let rec = null;
  let pkg = null;
  const cache = new Map();
  async function play(id, which, button) {
    button.setAttribute("aria-busy", "true");
    status.textContent = w.loading;
    try {
      rec ??= createRecordings({ baseUrl: new URL("../../assets/ambient/", import.meta.url), reduced: () => matchMedia?.("(prefers-reduced-motion: reduce)").matches === true });
      rec.setVolume(loadSettings().volume);
      const unlocking = rec.unlock(); // inside the click
      pkg ??= await openPackage();
      if (!cache.has(id)) cache.set(id, await pkg.openPhenomenon(id));
      const phen = cache.get(id);
      const snap = phen.byDate(DATE) ?? phen.list[0];
      const min = MIN_VALUE[id] ?? -Infinity;
      let best = -1;
      snap.values.forEach((v, i) => { if (v === null || Number.isNaN(v) || v < min) return; if (best < 0 || (which === "low" ? v < snap.values[best] : v > snap.values[best])) best = i; });
      const grid = phen.grid;
      const cell = { row: Math.floor(best / grid.cols), col: best % grid.cols };
      const lon = grid.bounds.west + ((cell.col + 0.5) / grid.cols) * (grid.bounds.east - grid.bounds.west);
      const pan = Math.max(-1, Math.min(1, (2 * (lon - grid.bounds.west)) / (grid.bounds.east - grid.bounds.west) - 1));
      const value = snap.values[best];
      const level = levelFor({ phenomenon: id, value, breakpoints: DOCUMENTED_BREAKPOINTS[id] });
      await unlocking;
      rec.preview(id, level, pan, 2.6);
      status.textContent = w.playing.replace("{name}", m.phen[id]).replace("{which}", which === "low" ? w.lowName : w.highName).replace("{value}", phen.spec.unitLabel ? `${Number(value.toPrecision(3))} ${phen.spec.unitLabel}` : String(Number(value.toPrecision(3))));
    } catch (error) {
      console.error(error);
      status.textContent = w.error;
    } finally {
      button.removeAttribute("aria-busy");
    }
  }
  const rows = PHENOMENON_IDS.map((id) => {
    const bp = DOCUMENTED_BREAKPOINTS[id];
    const text = w.rule.replace("{low}", Number(bp.low.toPrecision(4))).replace("{high}", Number(bp.high.toPrecision(4))).replace("{unit}", m.phen.unitName[id]) + (id === "rainfall" ? w.rain : "");
    const actions = h(document, "div", { class: "sound-row-actions" });
    const low = h(document, "button", { type: "button", class: "button ghost small-button", text: w.low, "aria-label": w.low + " · " + m.phen[id] });
    const high = h(document, "button", { type: "button", class: "button small-button", text: w.high, "aria-label": w.high + " · " + m.phen[id] });
    low.addEventListener("click", () => play(id, "low", low));
    high.addEventListener("click", () => play(id, "high", high));
    actions.append(low, high);
    return h(document, "div", { class: "sound-row" }, h(document, "h3", { text: m.phen[id] }), h(document, "p", { text }), actions);
  });
  const cr = credits[language];
  const list = h(document, "ul", { class: "ambient-credits small" });
  const details = h(document, "details", { class: "ambient-details" }, h(document, "summary", { text: cr.title }), h(document, "p", { class: "small", text: cr.note + " " + cr.licence }), list);
  fetch(new URL("../../assets/ambient/manifest.json", import.meta.url)).then((r) => r.json()).then((manifest) => {
    for (const item of manifest.items) list.append(h(document, "li", {}, h(document, "span", { class: "mono ltr", text: item.file }), " · ", h(document, "span", { class: "ltr", text: item.original }), " · ", h(document, "span", { text: cr.licence.split(".")[0] })));
  }).catch(() => { list.append(h(document, "li", { text: cr.failed })); });
  return h(document, "section", { class: "panel sound-how", id: "sound", "aria-labelledby": "sound-how-title" },
    h(document, "h2", { id: "sound-how-title", text: w.title }), h(document, "p", { text: w.lede.replace("{date}", DATE) }), ...rows, status, details);
}
