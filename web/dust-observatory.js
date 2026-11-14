import { createTransport } from "./audio/transport.js";
import {
  cellHistory, cellSound, compatibleDates, fieldColor, fieldPalette, historyPlot, moveCell, opticalDepthLimit,
} from "./experiences/decode/observatory-field.js";
import { compareDustSnapshots, getDustCells, loadDustCatalog, loadDustGrid, loadDustSnapshot } from "./sources/decode/dust-visual.js";
import { drawDustMapBase } from "./visual/dust-basemap.js";

const copy = {
  skip: ["Skip to the map", "انتقل إلى الخريطة"],
  guided: ["Guided Discovery", "استكشاف موجّه"],
  region: ["North Africa & Mediterranean", "شمال أفريقيا والبحر المتوسّط"],
  title: ["Dust Observatory", "مرصد الغبار"],
  intro: ["Explore modeled dust across 13 verified snapshots. Pick a date, inspect or listen to a map cell, or compare two dates from the same model build.", "استكشف الغبار المحاكى عبر ١٣ لقطة متحقّقة. اختَر تاريخًا وافحص خلية على الخريطة أو استمع إليها، أو قارن تاريخين من الإصدار نفسه للنموذج."],
  view: ["View", "العرض"],
  snapshot: ["One date", "تاريخ واحد"],
  comparison: ["Difference between dates", "الفرق بين تاريخين"],
  date: ["Observation date", "تاريخ الرصد"],
  first: ["Baseline date", "التاريخ المرجعي"],
  second: ["Comparison date", "تاريخ المقارنة"],
  loading: ["Loading modeled dust…", "جارٍ تحميل بيانات الغبار المحاكى…"],
  loadError: ["This view could not be loaded. Retry or select another date.", "تعذّر تحميل هذا العرض. أعد المحاولة أو اختَر تاريخًا آخر."],
  retry: ["Retry", "أعِد المحاولة"],
  quantity: ["Dust optical depth", "العمق البصري للغبار"],
  change: ["Change in dust optical depth", "تغيّر العمق البصري للغبار"],
  missing: ["Missing data", "بيانات مفقودة"],
  levelScale: ["Fixed square-root color scale gives more contrast to smaller values. Values beyond the scale use its end color.", "مقياس لوني ثابت بالجذر التربيعي يُظهر الفروق بين القيم الصغيرة بوضوح أكبر. تأخذ القيم خارج المقياس لون طرفه."],
  changeScale: ["Blue: decrease. Orange: increase. Gray: near zero. The square-root scale emphasizes smaller changes. End colors include larger changes.", "الأزرق: انخفاض. البرتقالي: ارتفاع. الرمادي: قريب من الصفر. مقياس الجذر التربيعي يبرز التغيّرات الصغيرة، وتضم ألوان الطرفين التغيّرات الأكبر."],
  coast: ["Natural Earth coastlines. North is up and west is left.", "السواحل من Natural Earth. الشمال للأعلى والغرب لليسار."],
  inspect: ["Inspect a cell", "افحص خلية"],
  keyboard: ["Choose a cell on the map, or focus it and use the arrow keys. Home and End move to the row edges.", "اختَر خلية على الخريطة، أو ركّز عليها واستخدم الأسهم. مفتاحا Home وEnd ينقلان التركيز إلى طرفَي الصف."],
  cell: ["Row {row}, column {col}", "الصف {row}، العمود {col}"],
  cellLevel: ["Modeled depth", "العمق المحاكى"],
  cellChange: ["Comparison minus baseline", "المقارنة ناقص المرجع"],
  values: ["Baseline {a} · Comparison {b}", "المرجع {a} · المقارنة {b}"],
  direction: ["Move on the map", "تحرّك على الخريطة"],
  north: ["North", "شمال"],
  east: ["East", "شرق"],
  south: ["South", "جنوب"],
  west: ["West", "غرب"],
  listen: ["Listen to cell", "استمع إلى الخلية"],
  mute: ["Mute", "كتم الصوت"],
  pitch: ["A higher pitch means higher depth. Loudness is fixed. Depths outside the displayed scale share its highest pitch.", "النغمة الأعلى تعني عمقًا بصريًا أكبر. شدّة الصوت ثابتة. القيم فوق المقياس المعروض تستخدم أعلى نغمة فيه."],
  interval: ["Two notes: rising means an increase, falling means a decrease, repeated means unchanged. A wider interval means a larger change, up to the displayed scale.", "نغمتان: صعودهما يعني زيادة، وهبوطهما يعني انخفاضًا، وتكرارهما يعني عدم تغيّر. اتساع المسافة بينهما يعني تغيّرًا أكبر حتى طرف المقياس المعروض."],
  muted: ["Sound is muted.", "الصوت مكتوم."],
  audioUnavailable: ["Audio is unavailable. Use the map and numeric reading.", "الصوت غير متاح. استخدم الخريطة والقراءة الرقمية."],
  share: ["Copy link to this view", "انسخ رابط هذا العرض"],
  link: ["Link to the selected dates and cell", "رابط التواريخ والخلية المختارة"],
  copied: ["Link copied.", "تم نسخ الرابط."],
  copyManually: ["Copy the selected link to share this view.", "انسخ الرابط المحدّد لمشاركة هذا العرض."],
  source: ["Data and provenance", "البيانات ومصدرها"],
  coverage: ["Usable cells: {n} of {total}", "الخلايا الصالحة: {n} من {total}"],
  method: ["NASA GEOS-FP DUEXTTAU at 550 nm, dimensionless. Each of the 25 × 40 cells is an area-weighted mean of overlapping native model cells. Any invalid contributor makes the cell missing.", "العمق البصري لغبار NASA GEOS-FP (‏DUEXTTAU عند ٥٥٠ نانومتر) بلا وحدة. كل خلية من شبكة ٢٥ × ٤٠ هي متوسط موزون بالمساحة لخلايا النموذج المتداخلة. أي قيمة غير صالحة تجعل الخلية مفقودة."],
  temporal: ["Each date represents one selected three-hour UTC mean. Subtracting two dates shows a difference between those intervals only.", "يمثّل كل تاريخ متوسط فترة مختارة من ثلاث ساعات بالتوقيت العالمي المنسّق. طرح تاريخين يبيّن الفرق بين الفترتين فقط."],
  history: ["Explore this cell across dates", "استكشف هذه الخلية عبر التواريخ"],
  historyMethod: ["Each dot is a selected three-hour sample. The plot uses the active baseline’s model build. All dates appear in the table, with gaps and different model builds marked. The dots do not establish a trend or show what happened between samples.", "كل نقطة تمثّل عيّنة مختارة من ثلاث ساعات. الرسم يستخدم إصدار النموذج للتاريخ المرجعي الحالي. كل التواريخ موجودة بالجدول، مع الإشارة للقيم المفقودة وللإصدارات المختلفة. النقاط ما بتثبت اتجاهًا زمنيًا وما بتبيّن شو صار بين العيّنات."],
  historySamples: ["Sampled dust optical depth for this cell", "عيّنات العمق البصري للغبار في هذه الخلية"],
  historyWindow: ["Averaging window (UTC)", "فترة حساب المتوسط (UTC)"],
  historyBuild: ["Model build", "إصدار النموذج"],
  historyView: ["Use this date", "استخدم هذا التاريخ"],
  historyLoading: ["Loading verified samples…", "جارٍ تحميل العيّنات المتحقّق منها…"],
  historyPartial: ["Some samples could not be loaded. Retry to fetch the unavailable dates.", "تعذّر تحميل بعض العيّنات. أعِد المحاولة لجلب التواريخ غير المتاحة."],
  historyUnavailable: ["Could not load", "تعذّر التحميل"],
  historyEmpty: ["There are no plottable readings for this build and cell. See the table for coverage.", "ما في قراءات قابلة للرسم لهذا الإصدار ولهذه الخلية. راجع الجدول للتغطية."],
  historyScale: ["{start} to {end} (UTC) · Depth scale 0 to {max}. Dots without connecting lines represent available same-build samples.", "من {start} إلى {end} (UTC) · مقياس العمق من ٠ إلى {max}. النقاط المنفصلة تمثّل العيّنات المتاحة من الإصدار نفسه."],
  historySame: ["Same build", "نفس الإصدار"],
  historyDifferent: ["Different build", "إصدار مختلف"],
  historyBaseline: ["Baseline", "المرجع"],
  historyComparison: ["Comparison", "المقارنة"],
  historySelected: ["On the map", "معروض عالخريطة"],
  historyOpen: ["Show on map", "اعرض عالخريطة"],
  historyCompare: ["Compare with baseline", "قارن مع المرجع"],
  historySource: ["NASA source", "مصدر ناسا"],
  health: ["Optical depth describes how dust dims light through the atmosphere. These values do not measure ground-level PM2.5 or health risk.", "يصف العمق البصري كيف يخفت الضوء بسبب الغبار عبر الغلاف الجوي. هذه القيم لا تقيس جسيمات PM2.5 عند سطح الأرض ولا المخاطر الصحية."],
  svs: ["NASA SVS 5669", "NASA SVS 5669"],
  svsContext: ["The August 19 frame is related context from a separate GEOS-FP 2 km Replay at 20:00 UTC. Its pixels are not aligned to these modeled cells.", "صورة ١٩ أغسطس سياق علمي من تشغيل GEOS-FP Replay منفصل بدقة ٢ كم عند ٢٠:٠٠ بالتوقيت العالمي. بكسلاتها غير محاذاة لخلايا النموذج هنا."],
};

const initialParams = new URLSearchParams(location.search);
const language = initialParams.get("lang") === "ar" ? "ar" : "en";
const t = (key, params = {}) => copy[key][language === "ar" ? 1 : 0].replace(/\{(\w+)\}/g, (_, name) => params[name]);
const number = new Intl.NumberFormat(language, { maximumSignificantDigits: 5 }).format;
const date = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" });
const time = new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat(language, { month: "short", day: "numeric", timeZone: "UTC" });
const byId = name => document.getElementById(`observatory-${name}`);
const map = byId("map");
const cursor = byId("cursor");
const mode = byId("mode");
const first = byId("first");
const second = byId("second");
const field = byId("field");
const mapArea = map.parentElement;
const status = byId("status");
const retry = byId("retry");
const transport = createTransport();
const audioStatus = byId("audio-status");
const snapshotRequests = new Map();
const history = byId("history");
const historyStatus = byId("history-status");
const historyRetry = byId("history-retry");
const shareStatus = byId("share-status");
const shareFallback = byId("share-fallback");
const shareUrl = byId("share-url");
const languageLink = byId("language");
const loadedHistory = new Map();
let grid;
let entries = [];
let data;
let sources = [];
let cellPosition = { row: 14, col: 15 };
let renderedCells = [];
let selection = 0;
let shareAttempt = 0;
let historyLoading;
let historyLoaded = false;

const differenceMode = () => mode.value === "comparison";
const cellIndex = ({ row, col }) => row * grid.cols + col;
const formatDate = value => date.format(new Date(value));
const formatValue = value => value === null ? t("missing") : number(value);

function setAttributes(element, attributes) {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

function rectangle(cellBounds) {
  const { west, east, north, south } = grid.bounds;
  return {
    x: (cellBounds.west - west) / (east - west),
    y: (north - cellBounds.north) / (north - south),
    width: (cellBounds.east - cellBounds.west) / (east - west),
    height: (cellBounds.north - cellBounds.south) / (north - south),
  };
}

function fillDates(select, available, preferred) {
  const options = available.map(entry => new Option(formatDate(entry.time.center), entry.id));
  select.replaceChildren(...options);
  if (available.some(entry => entry.id === preferred)) select.value = preferred;
}

function syncDates(preferred = second.value) {
  const comparing = differenceMode();
  byId("second-field").hidden = !comparing;
  byId("first-label").textContent = t(comparing ? "first" : "date");
  if (!comparing) return;
  const selected = entries.find(entry => entry.id === first.value);
  fillDates(second, compatibleDates(entries, selected), preferred);
}

function boundedIndex(name, length, fallback) {
  const raw = initialParams.get(name);
  if (raw === null || !/^\d{1,2}$/.test(raw)) return Math.min(fallback, length - 1);
  const value = Number(raw);
  return value < length ? value : Math.min(fallback, length - 1);
}

function restoreView() {
  const requestedFirst = entries.find(entry => entry.id === initialParams.get("first"));
  const baseline = requestedFirst ?? entries.find(entry => entry.phase === "reference") ?? entries[0];
  const requestedSecond = requestedFirst && compatibleDates(entries, baseline)
    .find(entry => entry.id === initialParams.get("second"));
  fillDates(first, entries, baseline.id);
  mode.value = requestedSecond ? "comparison" : "snapshot";
  syncDates(requestedSecond?.id);
  cellPosition = {
    row: boundedIndex("row", grid.rows, cellPosition.row),
    col: boundedIndex("col", grid.cols, cellPosition.col),
  };
}

function syncShareView() {
  ++shareAttempt;
  const params = new URLSearchParams({
    lang: language, first: sources[0].id, row: cellPosition.row, col: cellPosition.col,
  });
  if (sources[1]) params.set("second", sources[1].id);
  const url = new URL(location.href);
  url.search = params;
  if (url.href !== location.href) window.history.replaceState(window.history.state, "", url);
  shareUrl.value = url.href;
  params.set("lang", languageLink.lang);
  languageLink.href = "?" + params;
  shareStatus.textContent = "";
  shareFallback.hidden = true;
}

function snapshot(id) {
  if (!snapshotRequests.has(id)) {
    const entry = entries.find(entry => entry.id === id);
    const request = loadDustSnapshot(id).then(record => {
      if (record.source.modelSource !== entry?.modelSource ||
          record.source.sha256 !== entry.sourceSha256 || record.time.center !== entry.time.center) {
        throw new Error("Snapshot provenance does not match its catalog entry.");
      }
      return record;
    });
    snapshotRequests.set(id, request);
    request.catch(() => snapshotRequests.delete(id));
  }
  return snapshotRequests.get(id);
}

async function readSelection() {
  const revision = ++selection;
  const comparing = differenceMode();
  const chosen = comparing ? [first.value, second.value] : [first.value];
  transport.pause();
  audioStatus.textContent = "";
  field.hidden = retry.hidden = true;
  status.textContent = t("loading");
  try {
    const snapshots = await Promise.all(chosen.map(snapshot));
    if (selection !== revision) return;
    data = comparing ? compareDustSnapshots(...snapshots) : snapshots[0];
    sources = snapshots;
    renderField(comparing);
    field.hidden = false;
    syncShareView();
    if (history.open) renderHistory();
    status.textContent = t("coverage", { n: number(data.statistics.valid), total: number(grid.cells.length) });
  } catch {
    if (selection !== revision) return;
    status.textContent = t("loadError");
    retry.hidden = false;
  }
}

function renderField(comparing) {
  const heading = byId("map-heading");
  heading.textContent = t(comparing ? "change" : "quantity");
  byId("sound-key").textContent = t(comparing ? "interval" : "pitch");
  byId("scale").textContent = t(comparing ? "changeScale" : "levelScale");
  const ticks = comparing ? [-opticalDepthLimit, -opticalDepthLimit / 4, 0, opticalDepthLimit / 4, opticalDepthLimit]
    : [0, opticalDepthLimit / 16, opticalDepthLimit / 4, opticalDepthLimit * 9 / 16, opticalDepthLimit];
  byId("labels").replaceChildren(...ticks.map(tick => {
    const label = document.createElement("span");
    label.textContent = number(tick);
    return label;
  }));
  byId("palette").replaceChildren(...fieldPalette(comparing).map(color => {
    const swatch = document.createElement("i");
    swatch.style.background = color;
    return swatch;
  }));
  renderedCells = getDustCells(data, grid);
  byId("values").replaceChildren(...renderedCells.map(cell => {
    const tile = document.createElementNS(map.namespaceURI, "rect");
    setAttributes(tile, { ...rectangle(cell.bounds), fill: fieldColor(cell.value, comparing) ?? "url(#observatory-missing)" });
    return tile;
  }));
  byId("method").textContent = `${t("method")} ${t("temporal")}`;
  byId("granules").replaceChildren(...sources.map(item => {
    const line = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.source.url;
    link.dir = "ltr";
    link.lang = "en";
    link.textContent = item.source.granule;
    const details = document.createElement("p");
    details.textContent = `${formatDate(item.time.center)} · ${time.format(new Date(item.time.start))}–${time.format(new Date(item.time.end))} UTC`;
    const build = document.createElement("code");
    build.dir = "ltr";
    build.textContent = item.source.modelSource;
    line.append(details, link, build);
    return line;
  }));
  const context = byId("context");
  const visualLink = comparing ? null : sources[0].visualLink;
  context.hidden = !visualLink;
  context.replaceChildren();
  if (visualLink) {
    const link = document.createElement("a");
    link.href = visualLink.svs;
    link.textContent = t("svs");
    context.append(link, " · ", t("svsContext"));
  }
  renderCell();
}

function renderCell(announce = false) {
  const index = cellIndex(cellPosition);
  const cell = renderedCells[index];
  const comparing = differenceMode();
  const position = t("cell", { row: number(cell.row + 1), col: number(cell.col + 1) });
  const coordinates = [number(Math.abs(cell.lat)) + "° " + t(cell.lat < 0 ? "south" : "north"),
    number(Math.abs(cell.lon)) + "° " + t(cell.lon < 0 ? "west" : "east")].join(" · ");
  const reading = `${t(comparing ? "cellChange" : "cellLevel")} · ${formatValue(cell.value)}`;
  byId("cell-position").textContent = `${position} · ${coordinates}`;
  byId("cell-value").textContent = reading;
  const detail = comparing ? t("values", { a: formatValue(sources[0].values[index]), b: formatValue(sources[1].values[index]) }) : "";
  byId("cell-detail").textContent = detail;
  if (announce) byId("cell-speech").textContent = [position, coordinates, reading, detail].filter(Boolean).join(". ");
  byId("listen").disabled = cell.value === null;
  setAttributes(cursor, rectangle(cell.bounds));
  byId("history-location").textContent = `${position} · ${coordinates}`;
}

function loadHistory() {
  if (historyLoading) return;
  historyRetry.hidden = true;
  historyStatus.textContent = t("historyLoading");
  const missing = entries.filter(entry => !loadedHistory.has(entry.id));
  historyLoading = Promise.allSettled(missing.map(async ({ id }) => {
    loadedHistory.set(id, await snapshot(id));
  })).then(() => {
    historyLoading = undefined;
    historyLoaded = true;
    renderHistory();
  });
}

function historyAction(entry, key, dataKey) {
  const button = document.createElement("button");
  button.className = "outline";
  button.type = "button";
  button.dataset[dataKey] = entry.id;
  button.textContent = t(key);
  button.setAttribute("aria-label", `${t(key)} · ${formatDate(entry.time.center)}`);
  return button;
}

function historyRow(sample) {
  const { entry, value, available, comparable } = sample;
  const row = document.createElement("tr");
  row.dataset.dateId = entry.id;
  const heading = document.createElement("th");
  heading.scope = "row";
  heading.textContent = formatDate(entry.time.center);
  const marker = entry.id === sources[0].id ? (differenceMode() ? "historyBaseline" : "historySelected")
    : entry.id === sources[1]?.id ? "historyComparison" : null;
  if (marker) {
    const label = document.createElement("small");
    label.textContent = t(marker);
    heading.append(label);
    row.dataset.activeSample = marker;
  }
  const interval = document.createElement("td");
  interval.textContent = `${time.format(new Date(entry.time.start))}–${time.format(new Date(entry.time.end))} UTC`;
  const reading = document.createElement("td");
  reading.textContent = available ? formatValue(value) : t("historyUnavailable");
  const compatibility = document.createElement("td");
  compatibility.textContent = t(comparable ? "historySame" : "historyDifferent");
  const model = document.createElement("code");
  model.dir = "ltr";
  model.lang = "en";
  model.textContent = entry.modelSource;
  compatibility.append(model);
  const actions = document.createElement("td");
  actions.append(historyAction(entry, "historyOpen", "openDate"));
  if (comparable && available && entry.id !== sources[0].id) {
    actions.append(historyAction(entry, "historyCompare", "compareDate"));
  }
  if (available) {
    const link = document.createElement("a");
    link.href = loadedHistory.get(entry.id).source.url;
    link.textContent = t("historySource");
    actions.append(link);
  }
  row.append(heading, interval, reading, compatibility, actions);
  return row;
}

function renderHistoryChart(samples) {
  const plot = historyPlot(samples);
  byId("history-figure").hidden = !plot.points.length;
  const chart = byId("history-chart");
  const width = 560;
  const height = 190;
  const left = 42;
  const right = 526;
  const top = 16;
  const bottom = 154;
  const nodes = [];
  const svg = (tag, attrs, text = "") => {
    const element = document.createElementNS(chart.namespaceURI, tag);
    setAttributes(element, attrs);
    if (text) element.textContent = text;
    nodes.push(element);
  };
  setAttributes(chart, { viewBox: `0 0 ${width} ${height}`, dir: "ltr" });
  for (const fraction of [0, .5, 1]) {
    const y = bottom - fraction * (bottom - top);
    svg("line", { x1: left, x2: right, y1: y, y2: y });
    svg("text", { x: left - 8, y: y + 4, "text-anchor": "end" }, number(plot.max * fraction));
  }
  for (const [timestamp, x, anchor] of [[plot.start, left, "start"], [plot.end, right, "end"]]) {
    svg("text", { x, y: height - 11, "text-anchor": anchor }, shortDate.format(timestamp));
  }
  for (const point of plot.points) {
    svg("circle", { cx: left + point.x * (right - left), cy: bottom - point.y * (bottom - top),
      r: 5, class: sources.some(src => src.id === point.entry.id) ? "observatory-history-current" : "observatory-history-point" });
  }
  chart.replaceChildren(...nodes);
  byId("history-scale").textContent = t("historyScale", {
    start: formatDate(plot.start), end: formatDate(plot.end), max: number(plot.max),
  });
  return Boolean(plot.points.length);
}

function renderHistory() {
  if (!history.open || field.hidden || !historyLoaded) return;
  const samples = cellHistory(entries, loadedHistory, {
    modelSource: sources[0].source.modelSource,
    index: cellIndex(cellPosition),
  });
  byId("history-rows").replaceChildren(...samples.map(historyRow));
  const hasPoints = renderHistoryChart(samples);
  const incomplete = samples.some(sample => !sample.available);
  historyRetry.hidden = !incomplete || Boolean(historyLoading);
  if (!historyLoading) {
    const message = incomplete ? t("historyPartial") : hasPoints ? "" : t("historyEmpty");
    if (historyStatus.textContent !== message) historyStatus.textContent = message;
  }
  byId("history-content").hidden = false;
}

function selectCell(position) {
  if (position.row === cellPosition.row && position.col === cellPosition.col) return;
  transport.pause();
  audioStatus.textContent = "";
  cellPosition = position;
  renderCell(true);
  syncShareView();
  renderHistory();
}

async function bootstrap() {
  status.textContent = t("loading");
  retry.hidden = true;
  try {
    const [catalog, geometry] = await Promise.all([loadDustCatalog(), loadDustGrid()]);
    grid = geometry;
    entries = catalog.snapshots.toSorted((a, b) => a.time.center.localeCompare(b.time.center));
    restoreView();
    // The contour overlays the lightly opaque filled grid so the regional
    // geometry remains visible in both the snapshot and difference views.
    drawDustMapBase(byId("coast"), grid.bounds);
    byId("controls").hidden = false;
    await readSelection();
  } catch {
    status.textContent = t("loadError");
    retry.hidden = false;
  }
}

document.documentElement.lang = language;
document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
document.title = `${t("title")} · EARTHPULSE`;
for (const element of document.querySelectorAll("[data-observatory]")) element.textContent = t(element.dataset.observatory);
byId("home").href = `./?lang=${language}`;
byId("guided").href = `./dust.html?lang=${language}`;
languageLink.lang = languageLink.hreflang = language === "ar" ? "en" : "ar";
const alternateParams = new URLSearchParams(initialParams);
alternateParams.set("lang", languageLink.lang);
languageLink.href = "?" + alternateParams;
languageLink.textContent = language === "ar" ? "English" : "العربية";
byId("directions").setAttribute("aria-label", t("direction"));
for (const input of [mode, first]) input.addEventListener("change", () => {
  syncDates();
  readSelection();
});
second.addEventListener("change", readSelection);
byId("share").addEventListener("click", async event => {
  const button = event.currentTarget;
  const attempt = ++shareAttempt;
  const url = shareUrl.value;
  const revision = selection;
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      copied = true;
    }
  } catch {
    // Some hosts disallow clipboard access. Keep the copyable URL available.
  }
  if (shareAttempt !== attempt || selection !== revision || field.hidden) return;
  shareStatus.textContent = t(copied ? "copied" : "copyManually");
  shareFallback.hidden = copied;
  if (!copied && document.activeElement === button) {
    shareUrl.focus();
    shareUrl.select();
  }
});
retry.addEventListener("click", () => entries.length ? readSelection() : bootstrap());
history.addEventListener("toggle", () => {
  if (!history.open) return;
  if (historyLoaded) renderHistory();
  else loadHistory();
});
historyRetry.addEventListener("click", () => {
  history.querySelector("summary").focus();
  loadHistory();
});
byId("history-rows").addEventListener("click", event => {
  const { openDate, compareDate } = event.target.dataset;
  if (!openDate && !compareDate) return;
  mode.value = openDate ? "snapshot" : "comparison";
  if (openDate) first.value = openDate;
  syncDates();
  if (compareDate) second.value = compareDate;
  (openDate ? first : second).focus();
  readSelection();
});
mapArea.addEventListener("keydown", event => {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  selectCell(moveCell(cellPosition, event.key, grid));
});
mapArea.addEventListener("focus", () => renderCell(true));
map.addEventListener("click", event => {
  const bounds = map.getBoundingClientRect();
  const row = Math.max(0, Math.min(grid.rows - 1, Math.floor((event.clientY - bounds.top) / bounds.height * grid.rows)));
  const col = Math.max(0, Math.min(grid.cols - 1, Math.floor((event.clientX - bounds.left) / bounds.width * grid.cols)));
  selectCell({ row, col });
});
for (const button of document.querySelectorAll("[data-step]")) {
  button.addEventListener("click", () => selectCell(moveCell(cellPosition, button.dataset.step, grid)));
}
byId("listen").addEventListener("click", () => {
  if (transport.snapshot().muted) {
    audioStatus.textContent = t("muted");
    return;
  }
  const events = cellSound(renderedCells[cellIndex(cellPosition)], differenceMode());
  if (!events.length) return;
  audioStatus.textContent = "";
  transport.load({ events, durationS: 1 });
  transport.play();
});
byId("mute").addEventListener("click", event => {
  const mute = !transport.snapshot().muted;
  if (mute) transport.pause();
  transport.setMuted(mute);
  event.currentTarget.setAttribute("aria-pressed", String(mute));
  audioStatus.textContent = mute ? t("muted") : "";
});
transport.subscribe(snapshot => {
  if (snapshot.audioUnavailable && audioStatus.textContent !== t("audioUnavailable")) {
    audioStatus.textContent = t("audioUnavailable");
  }
});
window.addEventListener("pagehide", () => transport.pause());
bootstrap();
