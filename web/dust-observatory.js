import { createTransport } from "./audio/transport.js";
import { cellSound, compatibleDates, fieldColor, fieldPalette, moveCell, opticalDepthLimit } from "./experiences/decode/observatory-field.js";
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
  source: ["Data and provenance", "البيانات ومصدرها"],
  coverage: ["Usable cells: {n} of {total}", "الخلايا الصالحة: {n} من {total}"],
  method: ["NASA GEOS-FP DUEXTTAU at 550 nm, dimensionless. Each of the 25 × 40 cells is an area-weighted mean of overlapping native model cells. Any invalid contributor makes the cell missing.", "العمق البصري لغبار NASA GEOS-FP (‏DUEXTTAU عند ٥٥٠ نانومتر) بلا وحدة. كل خلية من شبكة ٢٥ × ٤٠ هي متوسط موزون بالمساحة لخلايا النموذج المتداخلة. أي قيمة غير صالحة تجعل الخلية مفقودة."],
  temporal: ["Each date represents one selected three-hour UTC mean. Subtracting two dates shows a difference between those intervals only.", "يمثّل كل تاريخ متوسط فترة مختارة من ثلاث ساعات بالتوقيت العالمي المنسّق. طرح تاريخين يبيّن الفرق بين الفترتين فقط."],
  health: ["Optical depth describes how dust dims light through the atmosphere. These values do not measure ground-level PM2.5 or health risk.", "يصف العمق البصري كيف يخفت الضوء بسبب الغبار عبر الغلاف الجوي. هذه القيم لا تقيس جسيمات PM2.5 عند سطح الأرض ولا المخاطر الصحية."],
  svs: ["NASA SVS 5669", "NASA SVS 5669"],
  svsContext: ["The August 19 frame is related context from a separate GEOS-FP 2 km Replay at 20:00 UTC. Its pixels are not aligned to these modeled cells.", "صورة ١٩ أغسطس سياق علمي من تشغيل GEOS-FP Replay منفصل بدقة ٢ كم عند ٢٠:٠٠ بالتوقيت العالمي. بكسلاتها غير محاذاة لخلايا النموذج هنا."],
};

const language = new URL(location.href).searchParams.get("lang") === "ar" ? "ar" : "en";
const t = (key, params = {}) => copy[key][language === "ar" ? 1 : 0].replace(/\{(\w+)\}/g, (_, name) => params[name]);
const number = new Intl.NumberFormat(language, { maximumSignificantDigits: 5 }).format;
const date = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" });
const time = new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
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
let grid;
let entries = [];
let data;
let sources = [];
let cellPosition = { row: 14, col: 15 };
let renderedCells = [];
let selection = 0;

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

function syncDates() {
  const comparing = differenceMode();
  byId("second-field").hidden = !comparing;
  byId("first-label").textContent = t(comparing ? "first" : "date");
  if (!comparing) return;
  const selected = entries.find(entry => entry.id === first.value);
  fillDates(second, compatibleDates(entries, selected), second.value);
}

function snapshot(id) {
  if (!snapshotRequests.has(id)) {
    snapshotRequests.set(id, loadDustSnapshot(id).catch(error => {
      snapshotRequests.delete(id);
      throw error;
    }));
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
}

function selectCell(position) {
  if (position.row === cellPosition.row && position.col === cellPosition.col) return;
  transport.pause();
  audioStatus.textContent = "";
  cellPosition = position;
  renderCell(true);
}

async function bootstrap() {
  status.textContent = t("loading");
  retry.hidden = true;
  try {
    const [catalog, geometry] = await Promise.all([loadDustCatalog(), loadDustGrid()]);
    grid = geometry;
    entries = catalog.snapshots.toSorted((a, b) => a.time.center.localeCompare(b.time.center));
    const preferred = entries.find(item => item.phase === "reference")?.id;
    fillDates(first, entries, preferred);
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
const languageLink = byId("language");
languageLink.lang = languageLink.hreflang = language === "ar" ? "en" : "ar";
languageLink.href = `?lang=${languageLink.lang}`;
languageLink.textContent = language === "ar" ? "English" : "العربية";
byId("directions").setAttribute("aria-label", t("direction"));
for (const input of [mode, first]) input.addEventListener("change", () => {
  syncDates();
  readSelection();
});
second.addEventListener("change", readSelection);
retry.addEventListener("click", () => entries.length ? readSelection() : bootstrap());
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
