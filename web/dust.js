import { createTransport } from "./audio/transport.js";
import { bandIds, buildBandPlayback, compareDustBands, completedBandCount, observatoryReference } from "./experiences/decode/guided-dust.js";
import { decodeMessage } from "./i18n/decode-messages.js";
import { loadDecodeCase } from "./sources/decode/index.js";
import { drawDustMapBase } from "./visual/dust-basemap.js";

const caseId = "dust-geos-fp-20250819-1930-north-africa-med";
const messages = {
  skip: ["Skip to the dust challenge", "انتقل إلى تحدّي الغبار"],
  retry: ["Retry loading the dust data", "أعِد تحميل بيانات الغبار"],
  guide: ["Guided Discovery", "استكشاف موجّه"],
  missionProgress: ["Challenge progress", "تقدّم التحدّي"],
  missionListen: ["Compare", "قارن"],
  missionChoose: ["Predict", "توقّع"],
  missionEvidence: ["Check the evidence", "تحقّق من الدليل"],
  missionListenTitle: ["Follow the notes across the map", "تتبّع النغمات على الخريطة"],
  missionListenHelp: ["Three bands, north to south. Listen for the one with the most notes, or watch the same cues without sound.", "ثلاثة نطاقات من الشمال للجنوب. اسمع أيّ نطاق فيه نغمات أكثر، أو تابع الإشارات نفسها بدون صوت."],
  missionStart: ["Start the comparison", "ابدأ المقارنة"],
  missionText: ["Compare without sound", "قارن بدون صوت"],
  missionRunning: ["Comparison in progress", "المقارنة جارية"],
  missionPaused: ["Continue the comparison", "تابع المقارنة"],
  missionChooseTitle: ["Which band stood out?", "أي نطاق برز أكثر؟"],
  missionChooseHelp: ["Choose the band you think ranked highest. You can replay the comparison before deciding.", "اختَر النطاق اللي بتتوقّع إنّه احتل أعلى مرتبة. بتقدر تعيد المقارنة قبل ما تقرّر."],
  missionPick: ["Choose a band", "اختَر نطاقًا"],
  missionFinished: ["Comparison complete. Choose a band when you're ready.", "اكتملت المقارنة. اختَر نطاقًا لمّا تكون جاهز."],
  missionEvidenceTitle: ["Connect the notes to the numbers", "اربط النغمات بالأرقام"],
  missionEvidenceHelp: ["Compare the band means, then inspect the cells behind the result.", "قارن متوسطات النطاقات، وبعدين افحص الخلايا اللي حسبنا منها النتيجة."],
  missionRead: ["Go to the evidence", "انتقل إلى الدليل"],
  question: ["Which region has the strongest modeled dust signal?", "أي منطقة فيها أقوى إشارة غبار في النموذج؟"],
  intro: ["Trace a real NASA dust case across North Africa and the Mediterranean. Compare three bands by sound or text, make your prediction, then check it against the model.",
    "تتبّع حالة غبار حقيقية من بيانات ناسا عبر شمال أفريقيا والبحر المتوسّط. قارن ثلاثة نطاقات بالصوت أو بالنص، وبعدين اختبر توقّعك مقابل بيانات النموذج."],
  region: ["North Africa & Mediterranean", "شمال أفريقيا والبحر المتوسّط"],
  mediterranean: ["Mediterranean Sea", "البحر المتوسّط"],
  sahara: ["Sahara", "الصحراء الكبرى"],
  atlantic: ["Atlantic", "المحيط الأطلسي"],
  mapReady: ["The map highlights each band as it plays", "الخريطة بتضيء كل نطاق وقت تشغيله"],
  practiceSignal: ["Practice example", "مثال تدريبي"],
  playingBand: ["Now playing: {band}", "التشغيل الآن: {band}"],
  mapCredit: ["Coastlines: Natural Earth. The bands run west to east.", "السواحل من Natural Earth. تمتد النطاقات من الغرب إلى الشرق."],
  listen: ["Listen and compare", "استمع وقارن"],
  mapping: ["Count the notes in each band. More notes means a higher rank among the three. Every note uses the same pitch and loudness, and the count only tells you the order.",
    "عُدّ النغمات بكل نطاق. نغمات أكثر يعني مرتبة أعلى بين النطاقات الثلاثة. كل النغمات إلها نفس الحدّة والشدّة، وعددها بيدلّ على الترتيب بس."],
  compare: ["Compare all three", "قارن النطاقات الثلاثة"],
  example: ["Play a practice example", "شغّل مثالًا تدريبيًا"],
  practice: ["Practice: one, two, then three notes. The example uses no measurements.", "مثال تدريبي: نغمة واحدة، ثم نغمتان، ثم ثلاث. المثال لا يستخدم قياسات."],
  solo: ["Listen to a single band", "استمع لنطاق واحد"],
  pair: ["Compare two bands", "قارن نطاقين"],
  firstBand: ["First band", "النطاق الأول"],
  secondBand: ["Second band", "النطاق الثاني"],
  playPair: ["Play both", "شغّل النطاقين"],
  pairHelp: ["Choose two different bands. Each keeps its rank among all three.", "اختَر نطاقين مختلفين. كل نطاق بيحتفظ بترتيبه بين النطاقات الثلاثة."],
  pause: ["Pause", "إيقاف مؤقت"],
  resume: ["Resume", "تابع التشغيل"],
  paused: ["Playback paused.", "التشغيل متوقّف مؤقتًا."],
  replay: ["Replay", "إعادة التشغيل"],
  mute: ["Mute", "كتم الصوت"],
  transcript: ["Read the sound cues", "اقرأ الإشارات الصوتية"],
  cue: ["{band}: {count} {notes}", "{band}: عدد النغمات {count}"],
  cueOne: ["note", "نغمة"],
  cueMany: ["notes", "نغمات"],
  waitingCue: ["{band}: waiting for playback", "{band}: بانتظار التشغيل"],
  cueMissing: ["{band}: no usable readings", "{band}: لا توجد قراءات صالحة"],
  noClip: ["Play a region or the comparison first.", "شغّل صوت منطقة أو المقارنة أولًا."],
  guess: ["Choose the strongest region", "اختَر المنطقة الأقوى"],
  guessHelp: ["Which band played the most notes?", "أي نطاق شغّل نغمات أكثر؟"],
  unknown: ["Reveal without guessing", "اكشف النتيجة بدون تخمين"],
  reveal: ["Reveal the comparison", "اكشف نتيجة المقارنة"],
  reset: ["Try the comparison again", "جرّب المقارنة مرة ثانية"],
  north: ["North", "الشمال"],
  middle: ["Middle", "الوسط"],
  south: ["South", "الجنوب"],
  ended: ["Playback complete.", "انتهى التشغيل."],
  unavailable: ["Audio unavailable. Follow the map or open the sound cues.", "الصوت غير متاح. تابع الخريطة أو افتح الإشارات الصوتية."],
  missing: ["No usable readings", "لا توجد قراءات صالحة"],
  incomplete: ["Some bands have no usable readings. The result compares the available bands.", "بعض النطاقات بلا قراءات صالحة. تقارن النتيجة النطاقات المتاحة."],
  strongest: ["Strongest modeled band", "أقوى نطاق في النموذج"],
  average: ["Mean dust optical depth", "متوسط العمق البصري للغبار"],
  barScale: ["All bars start at zero and use the same scale. The longest bar marks the highest available mean.", "كل الأشرطة بتبدأ من الصفر وبتستخدم نفس المقياس. أطول شريط بيمثّل أعلى متوسط متاح."],
  gap: ["The strongest band is {difference} above {band} in mean optical depth.", "متوسط العمق البصري في أقوى نطاق أعلى بـ{difference} من نطاق {band}."],
  tie: ["Bands tied for strongest", "نطاقات تعادلت في المرتبة الأولى"],
  correct: ["Your choice matched the comparison.", "اختيارك طابق نتيجة المقارنة."],
  incorrect: ["Your choice was {band}. See the band averages below.", "اخترت {band}. راجع متوسطات النطاقات بالأسفل."],
  coverage: ["{count} of {total} cells", "{count} من أصل {total} خلايا"],
  method: ["Each figure is an arithmetic mean of the available Quick-grid cells in that band. Every available cell has equal weight, including zero and readings below the grid cutoff. Missing cells are excluded.",
    "كل نتيجة هي المتوسط الحسابي لخلايا الشبكة السريعة المتاحة في النطاق. كل خلية متاحة إلها نفس الوزن، بما فيها الصفر والقراءات تحت حدّ الشبكة. الخلايا المفقودة مستبعدة."],
  cellEvidence: ["See the grid values behind each average", "شوف قيم الخلايا اللي حسبنا منها المتوسط"],
  cellExplanation: ["Read each row from west to east. A missing cell is excluded from the average.", "اقرأ كل صف من الغرب للشرق. الخلية المفقودة مستبعدة من حساب المتوسط."],
  cellBand: ["Band", "النطاق"],
  cellColumn: ["Column {number}", "العمود {number}"],
  inspectCentre: ["Inspect centre", "افحص المركز"],
  inspectCentreOf: ["Inspect centre: {band}, column {number}", "افحص المركز: {band}، العمود {number}"],
  centreExplanation: ["Each link opens the Observatory cell at the centre of this Quick cell, using the same three-hour source window. The finer cell covers a different area, so its average can differ.",
    "كل رابط بيفتح خلية المرصد اللي فيها مركز خلية Quick، باستخدام نفس فترة الثلاث ساعات. الخلية الأدق بتغطّي مساحة مختلفة، فممكن يكون متوسطها مختلف."],
  cellMean: ["Mean", "المتوسط"],
  calculationBand: ["Trace the mean for a band", "تتبّع حساب متوسط نطاق"],
  calculationResult: ["{band}: sum of the available cell values {sum}, divided by {count}, gives a mean of {mean}.", "{band}: اقسم مجموع قيم الخلايا المتاحة، {sum}، على عددها، {count}، لتحصل على المتوسط {mean}."],
  calculationRounding: ["Displayed numbers are rounded. The comparison uses the original cell values.", "الأرقام المعروضة مقرّبة. المقارنة بتستخدم قيم الخلايا الأصلية."],
  calculationMissing: ["{band}: no available cells to average.", "{band}: ما في خلايا متاحة لحساب المتوسط."],
  limits: ["Dust optical depth describes how dust dims light through the whole atmospheric column. It does not measure ground-level PM2.5 or health risk.",
    "العمق البصري للغبار يصف كيف يخفّف الغبار الضوء عبر عمود الغلاف الجوي كاملًا. لا يقيس جسيمات PM2.5 عند سطح الأرض أو المخاطر الصحية."],
  provenance: ["Data and NASA image provenance", "مصدر البيانات وعلاقتها بصورة ناسا"],
  source: ["NASA GEOS-FP data", "بيانات NASA GEOS-FP"],
  svs: ["NASA SVS 5669 context image", "صورة NASA SVS 5669 للسياق"],
  contextTitle: ["NASA SVS 5669 · Related scientific context", "NASA SVS 5669 · سياق علمي مرتبط"],
  contextAlt: ["Global NASA aerosol visualization for 19 August 2025, showing modeled dust in pink and magenta.", "تصوّر عالمي من ناسا للهباء الجوي في 19 أغسطس 2025، يظهر فيه الغبار المحاكى باللونين الوردي والأرجواني."],
  alignment: ["The separate SVS Replay frame is scientific context and is not pixel-aligned to this map.", "صورة SVS من تشغيل منفصل للسياق العلمي ولا تطابق بكسلات هذه الخريطة."],
  detective: ["Go deeper with Earth Detective", "تعمّق مع محقّق الأرض"],
  observatory: ["Explore dates in the Dust Observatory", "استكشف التواريخ في مرصد الغبار"],
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
function renderCoast(bounds) {
  const coast = byId("coast");
  coast.setAttribute("viewBox", "0 0 1 1");
  coast.setAttribute("preserveAspectRatio", "none");
  drawDustMapBase(coast, bounds);
  for (const [name, lon, lat] of [["atlantic", -13, 29], ["mediterranean", 22, 37], ["sahara", 15, 23]]) {
    const place = document.createElement("span");
    place.textContent = t(name);
    place.dir = "auto";
    place.style.left = 100 * (lon - bounds.west) / (bounds.east - bounds.west) + "%";
    place.style.top = 100 * (bounds.north - lat) / (bounds.north - bounds.south) + "%";
    byId("places").append(place);
  }
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
  const activeLabel = byId("active-label");
  const pulses = byId("pulses");
  const contextImage = byId("context-image");
  const pauseButton = byId("pause");
  const missionStart = byId("mission-start");
  const missionText = byId("mission-text");
  const missionSteps = byId("mission-steps");
  const missionTitle = byId("mission-title");
  const missionInstructions = byId("mission-instructions");
  const pairFirst = byId("pair-first");
  const pairSecond = byId("pair-second");
  const playPair = byId("play-pair");
  const cellHead = byId("cell-columns");
  const cellRows = byId("cell-rows");
  const calculationBand = byId("calculation-band");
  let plan;
  let example = false;
  let silentComparison = false;
  let comparedAll = false;
  let lastBands = [];
  let completedBands = 0;
  let userPaused = false;
  let previousStatus;
  let activeEvent;
  let activeBand;
  const showStatus = text => { if (status.textContent !== text) status.textContent = text; };
  const describeCue = band => fill(t(band.notes ? "cue" : "cueMissing"), {
    band: t(band.id), count: number(band.notes), notes: t(band.notes === 1 ? "cueOne" : "cueMany"),
  });

  missionSteps.setAttribute("aria-label", t("missionProgress"));

  function renderMission(snapshot = transport.snapshot()) {
    const stage = form.hidden ? "evidence" : comparedAll ? "choose" : "listen";
    const comparingAll = !example && lastBands.length === bandIds.length;
    const running = comparingAll && ["starting", "playing"].includes(snapshot.status);
    const paused = comparingAll && userPaused;
    const stageKeys = {
      listen: ["missionListenTitle", "missionListenHelp", paused ? "missionPaused" : running ? "missionRunning" : "missionStart"],
      choose: ["missionChooseTitle", "missionChooseHelp", "missionPick"],
      evidence: ["missionEvidenceTitle", "missionEvidenceHelp", "missionRead"],
    };
    const [title, instructions, action] = stageKeys[stage];
    for (const [element, key] of [[missionTitle, title], [missionInstructions, instructions], [missionStart, action]]) {
      const label = t(key);
      if (element.textContent !== label) element.textContent = label;
    }
    for (const step of missionSteps.children) {
      if (step.dataset.step === stage) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    }
    missionStart.setAttribute("aria-disabled", String(stage === "listen" && running));
    missionText.hidden = stage === "evidence";
  }

  const playbackMode = () => silentComparison || transport.snapshot().muted ? "silent" : "audio";

  function renderSignal(event) {
    if (event === activeEvent) return;
    activeEvent = event;
    activeLabel.textContent = event ? t(example ? "practiceSignal" : bandIds[event.row]) : t("mapReady");
    const count = event?.tone ? plan.events.filter(note =>
      note.row === event.row && note.onsetS <= event.onsetS && note.tone).length : 0;
    pulses.replaceChildren(...Array.from({ length: count }, () => document.createElement("i")));
  }

  function renderTranscript() {
    if (!transcript.open) {
      transcriptLines.replaceChildren();
      return;
    }
    const lines = !plan ? [t("noClip")] : example ? [t("practice")] : lastBands.map((band, index) =>
      index >= completedBands ? fill(t("waitingCue"), { band: t(band.id) }) : describeCue(band));
    while (transcriptLines.childElementCount > lines.length) transcriptLines.lastElementChild.remove();
    for (const [index, text] of lines.entries()) {
      const line = transcriptLines.children[index] ?? transcriptLines.appendChild(document.createElement("li"));
      if (line.textContent !== text) line.textContent = text;
    }
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
    for (const select of [pairFirst, pairSecond]) select.add(new Option(t(band.id), band.id));
    calculationBand.add(new Option(t(band.id), band.id));
  }
  pairSecond.value = "south";
  const updatePair = () => { playPair.setAttribute("aria-disabled", String(pairFirst.value === pairSecond.value)); };
  pairFirst.addEventListener("change", updatePair);
  pairSecond.addEventListener("change", updatePair);
  updatePair();
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

  form.addEventListener("change", event => {
    for (const [id, zone] of zones) zone.toggleAttribute("data-predicted", id === event.target.value);
  });

  function playBands(bands, practice = false, silent = false) {
    userPaused = false;
    example = practice;
    silentComparison = silent;
    lastBands = bands;
    plan = buildBandPlayback(bands, { caseId: data.id, example });
    transport.load(plan);
    byId("replay").disabled = false;
    showStatus(example ? t("practice") : "");
    renderTranscript();
    return transport.play(playbackMode());
  }

  transport.subscribe(snapshot => {
    const finished = plan ? completedBandCount(lastBands.length, snapshot.positionS) : 0;
    const freshCues = !example && transcript.open ? lastBands.slice(completedBands, finished) : [];
    if (finished !== completedBands) {
      completedBands = finished;
      renderTranscript();
    }
    const event = snapshot.status === "playing" && !snapshot.awaitingOnset
      ? plan?.events.find(({ id }) => id === snapshot.activeEventId) : undefined;
    const active = event && !example ? bandIds[event.row] : undefined;
    renderSignal(event);
    let announcement = "";
    if (active !== activeBand) {
      activeBand = active;
      for (const [id, zone] of zones) zone.toggleAttribute("data-active", id === active);
      if (active) announcement = fill(t(event.tone ? "playingBand" : "cueMissing"), { band: t(active) });
    }
    const running = snapshot.status === "starting" || snapshot.status === "playing";
    pauseButton.setAttribute("aria-disabled", String(!running && !userPaused));
    pauseButton.textContent = t(userPaused ? "resume" : "pause");
    if (snapshot.status === "ended" && previousStatus === "playing") {
      const completedComparison = !example && lastBands.length === bandIds.length;
      if (completedComparison) comparedAll = true;
      announcement = t(completedComparison && !form.hidden ? "missionFinished" : "ended");
    }
    else if (snapshot.audioUnavailable && running && snapshot.status !== previousStatus && transcript.open === false) {
      announcement = t("unavailable");
    }
    if (announcement || freshCues.length) {
      showStatus([...freshCues.map(band => describeCue(band) + "."), announcement].filter(Boolean).join(" "));
    }
    if (previousStatus !== snapshot.status) renderMission(snapshot);
    previousStatus = snapshot.status;
  });

  missionStart.addEventListener("click", () => {
    if (form.hidden) return byId("result-title").focus();
    if (comparedAll) return (form.querySelector("input:checked") ?? form.querySelector("input")).focus();
    if (missionStart.getAttribute("aria-disabled") === "true") return;
    if (userPaused && !example && lastBands.length === bandIds.length) return pauseButton.click();
    return playBands(result.bands);
  });
  missionText.addEventListener("click", () => {
    transcript.open = true;
    return playBands(result.bands, false, true);
  });
  byId("compare").addEventListener("click", () => playBands(result.bands));
  playPair.addEventListener("click", () => {
    if (pairFirst.value === pairSecond.value) return;
    return playBands([pairFirst.value, pairSecond.value].map(id => result.bands.find(band => band.id === id)));
  });
  transcript.addEventListener("toggle", renderTranscript);
  byId("example").addEventListener("click", () => playBands([1, 2, 3].map(notes => ({ notes })), true));
  byId("replay").addEventListener("click", () => {
    userPaused = false;
    showStatus(example ? t("practice") : "");
    return transport.replay(playbackMode());
  });
  pauseButton.addEventListener("click", () => {
    if (pauseButton.getAttribute("aria-disabled") === "true") return;
    if (userPaused) {
      // Restart the current band so the first note is never lost during a pause.
      transport.seek(completedBands * plan.durationS / lastBands.length);
      userPaused = false;
      showStatus(example ? t("practice") : "");
      return transport.play(playbackMode());
    }
    userPaused = true;
    transport.pause();
    showStatus(t("paused"));
  });
  byId("mute").addEventListener("click", event => {
    const muted = !transport.snapshot().muted;
    transport.setMuted(muted);
    event.currentTarget.setAttribute("aria-pressed", String(muted));
  });
  window.addEventListener("pagehide", () => {
    userPaused = false;
    transport.pause();
  });

  function renderCalculation() {
    const row = bandIds.indexOf(calculationBand.value);
    const band = result.bands[row];
    const values = data.levels.quick.cells.filter(cell => cell.row === row && cell.value !== null)
      .map(cell => cell.value);
    const calculation = byId("calculation-result");
    const equation = byId("calculation-equation");
    calculation.textContent = band.count ? fill(t("calculationResult"), {
      band: t(band.id), sum: number(values.reduce((sum, value) => sum + value, 0)),
      count: number(band.count), mean: number(band.mean),
    }) : fill(t("calculationMissing"), { band: t(band.id) });
    equation.textContent = band.count ?
      `(${values.map(number).join(" + ")}) ÷ ${number(band.count)} ≈ ${number(band.mean)}` : "";
    equation.hidden = !equation.textContent;
  }
  calculationBand.addEventListener("change", () => {
    if (form.hidden) renderCalculation();
  });

  function renderCellEvidence() {
    const makeCell = (tag, text, scope) => {
      const cell = document.createElement(tag);
      if (scope) cell.scope = scope;
      cell.textContent = text;
      return cell;
    };
    const head = document.createElement("tr");
    head.append(makeCell("th", t("cellBand"), "col"));
    const { cells, cols } = data.levels.quick;
    for (let col = 0; col < cols; col++) {
      head.append(makeCell("th", fill(t("cellColumn"), { number: number(col + 1) }), "col"));
    }
    head.append(makeCell("th", t("cellMean"), "col"));
    cellHead.replaceChildren(head);
    cellRows.replaceChildren(...result.bands.map((band, index) => {
      const row = document.createElement("tr");
      row.append(makeCell("th", t(band.id), "row"));
      const values = cells.filter(cell => cell.row === index).sort((a, b) => a.col - b.col);
      for (const cell of values) {
        const reading = makeCell("td", cell.value === null ? t("missing") : number(cell.value));
        const reference = observatoryReference(data, cell);
        if (reference && cell.value !== null) {
          const link = document.createElement("a");
          link.className = "guided-cell-link";
          link.textContent = t("inspectCentre");
          link.setAttribute("aria-label", fill(t("inspectCentreOf"), {
            band: t(band.id), number: number(cell.col + 1),
          }));
          link.href = "./dust-observatory.html?" + new URLSearchParams({ lang: language, ...reference });
          reading.append(link);
        }
        row.append(reading);
      }
      row.append(makeCell("td", band.mean === null ? t("missing") : number(band.mean)));
      return row;
    }));
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const guess = new FormData(form).get("band");
    userPaused = false;
    transport.pause();
    pauseButton.setAttribute("aria-disabled", "true");
    pauseButton.textContent = t("pause");
    showStatus("");
    for (const [id, zone] of zones) {
      zone.removeAttribute("data-predicted");
      zone.toggleAttribute("data-strongest", result.strongest.includes(id));
    }
    const strongest = result.strongest.map(t).join(language === "ar" ? "، " : ", ");
    const heading = byId("result-title");
    heading.textContent = strongest
      ? (result.strongest.length > 1 ? t("tie") : t("strongest")) + " · " + strongest
      : t("missing");
    const feedback = guess !== "unknown" && strongest
      ? result.strongest.includes(guess) ? t("correct") : fill(t("incorrect"), { band: t(guess) })
      : "";
    const incomplete = strongest && result.bands.some(band => band.mean === null);
    const ranked = result.bands.filter(band => band.mean !== null).sort((a, b) => b.mean - a.mean);
    const [first, second] = ranked;
    const gap = result.strongest.length === 1 && second ? fill(t("gap"), {
      difference: number(first.mean - second.mean), band: t(second.id),
    }) : "";
    byId("feedback").textContent = [feedback, gap, incomplete && t("incomplete")]
      .filter(Boolean).join(" ");
    byId("readings").replaceChildren(...result.bands.map(band => {
      const block = document.createElement("div");
      const label = document.createElement("dt");
      const reading = document.createElement("dd");
      label.textContent = t(band.id);
      reading.textContent = band.mean === null ? t("missing") : number(band.mean) + " · " +
        fill(t("coverage"), { count: number(band.count), total: number(data.levels.quick.cols) });
      block.append(label, reading);
      if (band.mean !== null) {
        const scale = document.createElement("div");
        scale.className = "guided-bar";
        scale.setAttribute("aria-hidden", "true");
        const bar = document.createElement("div");
        bar.style.inlineSize = (first.mean > 0 ? band.mean / first.mean * 100 : 0) + "%";
        scale.append(bar);
        reading.append(scale);
      }
      return block;
    }));
    renderCellEvidence();
    calculationBand.value = result.strongest[0] ?? bandIds[0];
    renderCalculation();
    const interval = new Intl.DateTimeFormat(language, {
      dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
    }).formatRange(date, new Date(data.source.time.end));
    byId("source").textContent = data.source.product + " · " + data.source.version + " · " + interval + " UTC";
    byId("note").textContent = (language === "ar" ? appMessage("note." + data.id) : data.visualLink.note) +
      " " + t("alignment");
    if (!data.fixture && data.id === caseId && data.visualLink.relation === "RELATED_CONTEXT") {
      contextImage.alt = t("contextAlt");
      contextImage.src = "./assets/decode/svs-5669-context.webp";
      byId("context").hidden = false;
    }
    byId("sources").replaceChildren();
    for (const [key, href] of [["source", data.source.url], ["svs", data.visualLink.svs]]) {
      const link = document.createElement("a");
      link.textContent = t(key);
      link.href = href;
      byId("sources").append(link);
    }
    form.hidden = true;
    byId("result").hidden = false;
    renderMission();
    heading.focus();
  });

  byId("reset").addEventListener("click", () => {
    userPaused = false;
    comparedAll = false;
    transport.pause();
    plan = undefined;
    completedBands = 0;
    byId("result").hidden = true;
    byId("result-title").textContent = byId("feedback").textContent =
      byId("source").textContent = byId("note").textContent = "";
    byId("readings").replaceChildren();
    cellHead.replaceChildren();
    cellRows.replaceChildren();
    byId("calculation-result").textContent = byId("calculation-equation").textContent = "";
    byId("cell-evidence").open = false;
    byId("sources").replaceChildren();
    byId("provenance").open = true;
    byId("context").hidden = true;
    contextImage.removeAttribute("src");
    for (const zone of zones.values()) zone.removeAttribute("data-strongest");
    form.reset();
    form.hidden = false;
    pauseButton.setAttribute("aria-disabled", "true");
    pauseButton.textContent = t("pause");
    byId("replay").disabled = true;
    transcript.open = false;
    transcriptLines.replaceChildren();
    showStatus("");
    renderMission();
    missionStart.focus();
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
byId("observatory").href = "./dust-observatory.html?lang=" + language;
byId("quick").href = "./decode.html?lang=" + language;
byId("advanced").href = "./decode.html?level=advanced&lang=" + language;
async function initialize() {
  const restoreFocus = document.activeElement === byId("retry");
  byId("retry").hidden = true;
  byId("load").textContent = appMessage("general.loading");
  try {
    const data = await loadDecodeCase(caseId);
    mountGuided(data);
    byId("interface").hidden = false;
    byId("load").textContent = "";
    if (restoreFocus) byId("mission-start").focus();
  } catch (error) {
    console.error(error);
    byId("load").textContent = appMessage("general.error");
    byId("retry").hidden = false;
    if (restoreFocus) byId("retry").focus();
  }
}
byId("retry").addEventListener("click", initialize);
await initialize();
