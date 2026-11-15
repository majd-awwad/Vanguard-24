import { mapCopy } from "./earthmap-copy.js";

// Copy added by the final UI pass: the map-app chrome (tool rail, inspector, help sheet, timeline). Merged over mapCopy.
const ui = {
  en: {
    tools: { explore: "Explore", area: "Area", path: "Path", compare: "Compare", hunter: "Find signals", echo: "Find similar" },
    phen: { short: { dust: "Dust", rainfall: "Rain", wind: "Wind", forests: "Forests" } },
    help: {
      mapping: "What the sound means",
      levelRule: "Plays the low, mid or high recording: low up to {low}, mid up to {high}, high above ({unit}).", rainRule: "Below 0.1 mm per hour: silence.",
      keyboard: "Keyboard",
      data: "About the data",
      mapHint: "Map. Arrow keys move one cell, R reads the value, Space replays the sound, plus and minus zoom, Home resets the view.",
      shortcuts: [["← ↑ → ↓", "move one cell (left is always west)"], ["Enter", "select the cell and play it"], ["R", "read the value aloud"], ["Space", "replay the sound"], ["+ −", "zoom"], ["Shift + arrows", "pan the map"], ["Home", "reset the view"], ["Esc", "stop speech, close a panel"], ["?", "open this help"]],
      notes: ["Each square is one model cell, {cellLat}° × {cellLon}°. Colours are blended for clarity; the value always belongs to the square.", "Values come from NASA's GEOS-FP model analysis, not from a direct observation.", "Hatched squares have no value.", "Coverage is North Africa and the Mediterranean only."],
    },
    info: { how: "How was this computed?", collapse: "Collapse details", modelBadge: "model (GEOS-FP)", panelShow: "Show the side panel", panelHide: "Hide the side panel" },
    mobile: { expand: "Resize panel" },
    cards: { title: ["Earth", "Sound Studio"], eyebrow: "Real NASA model data", lede: "Explore real NASA model data as colour on the Earth and as sound: move over the map, play an area, draw a path, compare dates and find signals.", data: "Data", sound: "Sound", place: "Selected place", tools: "Tools", how: "How it works" },
    dry: { rainfall: { notice: "Little or no measurable rain on this date. Try a wetter date:", cell: "no measurable rain (< 0.1 mm/h)", unit: "mm/h" }, wind: { notice: "Almost no wind signal on this date. Try a windier date:", cell: "calm (< 0.3 m/s)", unit: "m/s" }, share: "{n}% of cells", pick: "{date}, {n}% of cells" },
    layer: { change: "change", clear: "Back to the snapshot", lockFoot: "Two dust dates stay locked until you finish Decode." },
    sound: { timePlay: "Play through the dates", timePause: "Pause the date sequence", pill: "Sound", volume: "Sound volume", note: "Sounds are recordings chosen by the real value: low / mid / high. The level follows the data; the recordings themselves are illustrative.", silence: "Silence", levelText: "Plays the {level} recording.", levelLine: "Recording level: {level}", levels: { low: "low", mid: "mid", high: "high" } },
  },
  ar: {
    tools: { explore: "استكشاف", area: "منطقة", path: "مسار", compare: "مقارنة", hunter: "البحث عن إشارات", echo: "البحث عن أماكن مشابهة" },
    phen: { short: { dust: "غبار", rainfall: "مطر", wind: "رياح", forests: "غابات" } },
    help: {
      mapping: "ماذا يعني الصوت",
      levelRule: "يُشغَّل تسجيل منخفض أو متوسط أو مرتفع: منخفض حتى {low}، ومتوسط حتى {high}، ومرتفع فوق ذلك ({unit}).", rainRule: "أقل من 0.1 ملم في الساعة: صمت.",
      keyboard: "لوحة المفاتيح",
      data: "عن البيانات",
      mapHint: "الخريطة. مفاتيح الأسهم تحرّك خلية واحدة، وR تقرأ القيمة، والمسافة تعيد الصوت، وزائد وناقص للتكبير، وHome لإعادة العرض.",
      shortcuts: [["← ↑ → ↓", "تحريك خلية واحدة (اليسار دائمًا غرب)"], ["Enter", "اختيار الخلية وتشغيلها"], ["R", "قراءة القيمة بصوت مسموع"], ["Space", "إعادة تشغيل الصوت"], ["+ −", "تكبير وتصغير"], ["Shift + الأسهم", "تحريك الخريطة"], ["Home", "إعادة ضبط العرض"], ["Esc", "إيقاف الصوت وإغلاق اللوحة"], ["?", "فتح هذه المساعدة"]],
      notes: ["كل مربع هو خلية نموذج واحدة، {cellLat}° × {cellLon}°. الألوان ممزوجة للوضوح، والقيمة تخص المربع دائمًا.", "القيم من تحليل نموذج GEOS-FP التابع لناسا، وليست رصدًا مباشرًا.", "المربعات المخططة بلا قيمة.", "التغطية: شمال أفريقيا والمتوسط فقط."],
    },
    info: { how: "كيف حُسبت هذه القيمة؟", collapse: "طيّ التفاصيل", modelBadge: "نموذج (GEOS-FP)", panelShow: "إظهار اللوحة الجانبية", panelHide: "إخفاء اللوحة الجانبية" },
    mobile: { expand: "تغيير حجم اللوحة" },
    cards: { title: ["استوديو", "صوت الأرض"], eyebrow: "بيانات نموذج ناسا الحقيقية", lede: "استكشف بيانات نموذج ناسا الحقيقية كلونًا على الأرض وكصوت: حرّك المؤشر فوق الخريطة، شغّل منطقة، ارسم مسارًا، قارن التواريخ وابحث عن الإشارات.", data: "البيانات", sound: "الصوت", place: "المكان المحدد", tools: "الأدوات", how: "كيف يعمل" },
    dry: { rainfall: { notice: "قلّما يوجد مطر قابل للقياس في هذا التاريخ. جرّب تاريخًا أكثر مطرًا:", cell: "لا مطر قابل للقياس (< 0.1 ملم/س)", unit: "ملم/س" }, wind: { notice: "لا إشارة رياح تُذكر في هذا التاريخ. جرّب تاريخًا أكثر رياحًا:", cell: "هدوء (< 0.3 م/ث)", unit: "م/ث" }, share: "{n}% من الخلايا", pick: "{date}، {n}% من الخلايا" },
    layer: { change: "تغيّر", clear: "العودة إلى اللقطة", lockFoot: "تاريخان للغبار يبقيان مقفلين حتى تنهي فك الشيفرة." },
    sound: { timePlay: "تشغيل التواريخ بالتتابع", timePause: "إيقاف التتابع مؤقتًا", pill: "الصوت", volume: "مستوى الصوت", note: "الأصوات تسجيلات تُختار بالقيمة الحقيقية: منخفض / متوسط / مرتفع. المستوى يتبع البيانات؛ أما التسجيلات نفسها فتوضيحية.", silence: "صمت", levelText: "يُشغَّل تسجيل المستوى {level}.", levelLine: "مستوى التسجيل: {level}", levels: { low: "منخفض", mid: "متوسط", high: "مرتفع" } },
  },
};

const merge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? merge(a[k], v) : v;
  return out;
};

export const copyFor = (language) => merge(mapCopy[language], ui[language]);
