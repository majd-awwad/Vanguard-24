import { createTransport } from "./audio/transport.js";
import { bandIds, buildBandPlayback, compareDustBands } from "./experiences/decode/guided-dust.js";
import { decodeMessage } from "./i18n/decode-messages.js";
import { loadDecodeCase } from "./sources/decode/index.js";
import { land } from "./visual/land.js";

const caseId = "dust-geos-fp-20250819-1930-north-africa-med";
const messages = {
  guide: ["Guided Discovery", "استكشاف موجّه"],
  question: ["Which region has the strongest modeled dust signal?", "أي منطقة فيها أقوى إشارة غبار في النموذج؟"],
  intro: ["Listen to three latitude bands across North Africa and the Mediterranean. Compare north, middle and south, then check your guess against the model.",
    "استمع إلى ثلاثة نطاقات عرضية عبر شمال أفريقيا والبحر المتوسّط. قارن الشمال والوسط والجنوب، ثم تحقّق من تخمينك بالرجوع إلى النموذج."],
  region: ["North Africa & Mediterranean", "شمال أفريقيا والبحر المتوسّط"],
  mapCredit: ["Coastlines: Natural Earth. The bands run west to east.", "السواحل من Natural Earth. تمتد النطاقات من الغرب إلى الشرق."],
  listen: ["Listen and compare", "استمع وقارن"],
  mapping: ["More notes mean a higher rank in this comparison. Pitch and loudness stay fixed. The note count gives the order only, not an optical-depth value.",
    "كلما زاد عدد النغمات ارتفعت مرتبة النطاق في المقارنة. تبقى حدّة النغمة وشدّتها ثابتتين. عدد النغمات يعبّر عن الترتيب فقط، ولا يمثّل قيمة العمق البصري."],
  compare: ["Compare all three", "قارن النطاقات الثلاثة"],
  example: ["Play a practice example", "شغّل مثالًا تدريبيًا"],
  practice: ["Practice only: one, two, then three notes. The example uses no measurements.", "مثال تدريبي: نغمة واحدة، ثم نغمتان، ثم ثلاث. المثال لا يستخدم قياسات."],
  replay: ["Replay", "إعادة التشغيل"],
  mute: ["Mute", "كتم الصوت"],
  transcript: ["Read the sound cues", "اقرأ الإشارات الصوتية"],
  cue: ["{band}: notes heard — {count}", "{band}: عدد النغمات — {count}"],
  cueMissing: ["{band}: no usable readings", "{band}: لا توجد قراءات صالحة"],
  noClip: ["Play a region or the comparison first.", "شغّل صوت منطقة أو المقارنة أولًا."],
  guess: ["Choose the strongest region", "اختَر المنطقة الأقوى"],
  unknown: ["Reveal without guessing", "اكشف النتيجة بدون تخمين"],
  reveal: ["Reveal the comparison", "اكشف نتيجة المقارنة"],
  reset: ["Try the comparison again", "جرّب المقارنة مرة ثانية"],
  north: ["North", "الشمال"],
  middle: ["Middle", "الوسط"],
  south: ["South", "الجنوب"],
  ended: ["Playback complete.", "انتهى التشغيل."],
  unavailable: ["Audio unavailable. You can still reveal the comparison.", "الصوت غير متاح. بإمكانك كشف نتيجة المقارنة."],
  missing: ["No usable readings", "لا توجد قراءات صالحة"],
  incomplete: ["Some bands have no usable readings. The result compares the available bands.", "بعض النطاقات بلا قراءات صالحة. تقارن النتيجة النطاقات المتاحة."],
  strongest: ["Strongest modeled band", "أقوى نطاق في النموذج"],
  average: ["Mean dust optical depth", "متوسط العمق البصري للغبار"],
  tie: ["Bands tied for strongest", "نطاقات تعادلت في المرتبة الأولى"],
  correct: ["Your choice matched the comparison.", "اختيارك طابق نتيجة المقارنة."],
  incorrect: ["Your choice was {band}. See the band averages below.", "اخترت {band}. راجع متوسطات النطاقات بالأسفل."],
  coverage: ["{count} of {total} cells", "{count} من أصل {total} خلايا"],
  method: ["Each figure is an arithmetic mean of the available Quick-grid cells in that band. Every available cell has equal weight, including zero and readings below the grid cutoff. Missing cells are excluded.",
    "كل نتيجة هي المتوسط الحسابي لخلايا الشبكة السريعة المتاحة في النطاق. كل خلية متاحة إلها نفس الوزن، بما فيها الصفر والقراءات تحت حدّ الشبكة. الخلايا المفقودة مستبعدة."],
  limits: ["Dust optical depth describes how dust dims light through the whole atmospheric column. It does not measure ground-level PM2.5 or health risk.",
    "العمق البصري للغبار يصف كيف يخفّف الغبار الضوء عبر عمود الغلاف الجوي كاملًا. لا يقيس جسيمات PM2.5 عند سطح الأرض أو المخاطر الصحية."],
  provenance: ["Data and NASA image provenance", "مصدر البيانات وعلاقتها بصورة ناسا"],
  source: ["NASA GEOS-FP data", "بيانات NASA GEOS-FP"],
  svs: ["NASA SVS 5669 context image", "صورة NASA SVS 5669 للسياق"],
  alignment: ["The separate SVS Replay frame is scientific context and is not pixel-aligned to this map.", "صورة SVS من تشغيل منفصل للسياق العلمي ولا تطابق بكسلات هذه الخريطة."],
  detective: ["Go deeper with Earth Detective", "تعمّق مع محقّق الأرض"],
  detectiveDescription: ["In the grid challenge, higher pitch means farther north, left and right mean west and east, and louder means more dust among cells that meet the cutoff. The {threshold} optical-depth cutoff is a game rule. A quiet cell can still contain dust.",
    "في تحدّي الشبكة، النغمة الأعلى بتدلّك على الشمال، واليسار واليمين على الغرب والشرق، والصوت الأشد يعني غبارًا أكثر بين الخلايا اللي حقّقت الشرط. حدّ العمق البصري {threshold} قاعدة للتحدّي. سكوت الخلية ما يعني إنّها بلا غبار."],
  quick: ["Quick grid · 3 × 4", "الشبكة السريعة · 3 × 4"],
  advanced: ["Advanced grid · 6 × 8", "الشبكة المتقدّمة · 6 × 8"],
};

const language = new URL(location.href).searchParams.get("lang") === "ar" ? "ar" : "en";
const t = key => messages[key][language === "ar" ? 1 : 0];
const byId = id => document.getElementById("guided-" + id);
const number = new Intl.NumberFormat(language, { maximumSignificantDigits: 6 }).format;
const fill = (text, fields) => text.replace(/\{(\w+)\}/g, (_, key) => fields[key]);
const appMessage = key => decodeMessage(language, key);
const svgNS = "http://www.w3.org/2000/svg";

function svg(tag, attributes) {
  const element = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function renderCoast(bounds) {
  // Natural Earth land.fires uses the Atlas Plate Carrée viewport documented
  // in platform.js and fires.js. Invert its affine projection to reuse it.
  const x = lon => 48 + (lon - 13) * 612 / 29;
  const y = lat => 27 + (54 - lat) * 288 / 16;
  const coast = byId("coast");
  coast.setAttribute("viewBox", [x(bounds.west), y(bounds.north),
    x(bounds.east) - x(bounds.west), y(bounds.south) - y(bounds.north)].join(" "));
  coast.setAttribute("preserveAspectRatio", "none");
  coast.append(svg("path", { d: land.fires }));
}

function mountGuided(data) {
  const result = compareDustBands(data);
  const transport = createTransport();
  const status = byId("status");
  const form = byId("guess");
  const zones = new Map();
  const formOptions = [...bandIds, "unknown"];
  const transcript = byId("transcript");
  const transcriptLines = byId("transcript-lines");
  let plan;
  let example = false;
  let lastBands = [];
  let previousStatus;
  const showStatus = text => { if (status.textContent !== text) status.textContent = text; };

  function renderTranscript() {
    if (!transcript.open) {
      transcriptLines.replaceChildren();
      return;
    }
    const lines = !plan ? [t("noClip")] : example ? [t("practice")] : lastBands.map(band =>
      fill(t(band.notes ? "cue" : "cueMissing"), { band: t(band.id), count: number(band.notes) }));
    transcriptLines.replaceChildren(...lines.map(text => {
      const line = document.createElement("li");
      line.textContent = text;
      return line;
    }));
  }

  renderCoast(data.bounds);
  const date = new Date(data.source.time.start);
  byId("date").dateTime = data.source.time.start;
  byId("date").textContent = new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(date);
  const threshold = new Intl.NumberFormat(language, { minimumFractionDigits: 2 }).format(data.levels.quick.truth.threshold);
  byId("detective-description").textContent = fill(t("detectiveDescription"), { threshold });

  for (const band of result.bands) {
    const zone = document.createElement("div");
    zone.className = "guided-zone";
    const label = document.createElement("span");
    label.lang = language;
    label.textContent = t(band.id);
    zone.append(label);
    byId("zones").append(zone);
    zones.set(band.id, zone);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "outline";
    button.textContent = t(band.id);
    button.dataset.band = band.id;
    button.setAttribute("aria-label", (language === "ar" ? "استمع إلى " : "Listen to ") + t(band.id));
    button.addEventListener("click", () => playBands([band]));
    byId("listen-bands").append(button);
  }
  for (const option of formOptions) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "band";
    radio.value = option;
    radio.required = true;
    label.append(radio, t(option));
    byId("options").append(label);
  }

  function playBands(bands, practice = false) {
    example = practice;
    lastBands = bands;
    plan = buildBandPlayback(bands, { caseId: data.id, example });
    transport.load(plan);
    byId("replay").disabled = false;
    showStatus(example ? t("practice") : "");
    renderTranscript();
    return transport.play(transport.snapshot().muted ? "silent" : "audio");
  }

  transport.subscribe(snapshot => {
    const event = !example && snapshot.status === "playing" && !snapshot.awaitingOnset &&
      plan?.events.find(({ id }) => id === snapshot.activeEventId);
    const active = event ? bandIds[event.row] : undefined;
    for (const [id, zone] of zones) zone.toggleAttribute("data-active", id === active);
    if (event && !event.tone) showStatus(fill(t("cueMissing"), { band: t(active) }));
    if (snapshot.status === "ended" && previousStatus === "playing") showStatus(t("ended"));
    if (snapshot.audioUnavailable) showStatus(t("unavailable"));
    previousStatus = snapshot.status;
  });

  byId("compare").addEventListener("click", () => playBands(result.bands));
  transcript.addEventListener("toggle", renderTranscript);
  byId("example").addEventListener("click", () => playBands([1, 2, 3].map(notes => ({ notes })), true));
  byId("replay").addEventListener("click", () => {
    if (example) showStatus(t("practice"));
    return transport.replay(transport.snapshot().muted ? "silent" : "audio");
  });
  byId("mute").addEventListener("click", event => {
    const muted = !transport.snapshot().muted;
    transport.setMuted(muted);
    event.currentTarget.setAttribute("aria-pressed", String(muted));
  });
  window.addEventListener("pagehide", () => transport.pause());

  form.addEventListener("submit", event => {
    event.preventDefault();
    const guess = new FormData(form).get("band");
    transport.pause();
    showStatus("");
    for (const [id, zone] of zones) zone.toggleAttribute("data-strongest", result.strongest.includes(id));
    const strongest = result.strongest.map(t).join(language === "ar" ? "، " : ", ");
    const heading = byId("result-title");
    heading.textContent = strongest
      ? (result.strongest.length > 1 ? t("tie") : t("strongest")) + " · " + strongest
      : t("missing");
    const feedback = guess !== "unknown" && strongest
      ? result.strongest.includes(guess) ? t("correct") : fill(t("incorrect"), { band: t(guess) })
      : "";
    const incomplete = strongest && result.bands.some(band => band.mean === null);
    byId("feedback").textContent = [feedback, incomplete && t("incomplete")]
      .filter(Boolean).join(" ");
    byId("readings").replaceChildren(...result.bands.map(band => {
      const block = document.createElement("div");
      const label = document.createElement("dt");
      const reading = document.createElement("dd");
      label.textContent = t(band.id);
      reading.textContent = band.mean === null ? t("missing") : t("average") + " · " + number(band.mean) + " · " +
        fill(t("coverage"), { count: number(band.count), total: number(data.levels.quick.cols) });
      block.append(label, reading);
      return block;
    }));
    const interval = new Intl.DateTimeFormat(language, {
      dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
    }).formatRange(date, new Date(data.source.time.end));
    byId("source").textContent = data.source.product + " · " + data.source.version + " · " + interval + " UTC";
    byId("note").textContent = (language === "ar" ? appMessage("note." + data.id) : data.visualLink.note) +
      " " + t("alignment");
    byId("sources").replaceChildren();
    for (const [key, href] of [["source", data.source.url], ["svs", data.visualLink.svs]]) {
      const link = document.createElement("a");
      link.textContent = t(key);
      link.href = href;
      byId("sources").append(link);
    }
    form.hidden = true;
    byId("result").hidden = false;
    heading.focus();
  });

  byId("reset").addEventListener("click", () => {
    transport.pause();
    plan = undefined;
    byId("result").hidden = true;
    byId("result-title").textContent = byId("feedback").textContent =
      byId("source").textContent = byId("note").textContent = "";
    byId("readings").replaceChildren();
    byId("sources").replaceChildren();
    byId("result").querySelector("details").open = true;
    for (const zone of zones.values()) zone.removeAttribute("data-strongest");
    form.reset();
    form.hidden = false;
    byId("replay").disabled = true;
    transcript.open = false;
    transcriptLines.replaceChildren();
    showStatus("");
    byId("compare").focus();
  });
}

document.documentElement.lang = language;
document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
document.title = t("guide") + " · EARTHPULSE";
for (const element of document.querySelectorAll("[data-message]")) element.textContent = t(element.dataset.message);
const alternate = language === "ar" ? "en" : "ar";
const switchLanguage = byId("language");
switchLanguage.lang = switchLanguage.hreflang = alternate;
switchLanguage.href = "?lang=" + alternate;
switchLanguage.textContent = alternate === "ar" ? "العربية" : "English";
byId("home").href = "./?lang=" + language;
byId("quick").href = "./decode.html?lang=" + language;
byId("advanced").href = "./decode.html?level=advanced&lang=" + language;
byId("load").textContent = appMessage("general.loading");
try {
  const data = await loadDecodeCase(caseId);
  mountGuided(data);
  byId("interface").hidden = false;
  byId("load").textContent = "";
} catch (error) {
  console.error(error);
  byId("load").textContent = appMessage("general.error");
}
