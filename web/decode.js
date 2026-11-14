import { mountDecodeGrid } from "./accessibility/decode-grid.js";
import { createTransport } from "./audio/transport.js";
import { createDecodeSession } from "./experiences/decode/session.js";
import { decodeMessage } from "./i18n/decode-messages.js";
import { loadDecodeCase } from "./sources/decode/index.js";

const dustCaseId = "dust-geos-fp-20250819-1930-north-africa-med";
const stages = { intro: "explore", legend: "legend", listen: "listen", decode: "decode", reveal: "reveal" };
const phaseOrder = Object.keys(stages);
// Lossless WebP of the NASA GMAO/SVS 1920 × 1080 frame, with decoded RGB verified
// against the original PNG (SHA-256 0c6a8f6c46fb52a2f9a636bbd804fc6e5e23454dcb2f0d3fe04c653c772e8a7a).
const dustFrame = new URL("./assets/decode/svs-5669-context.webp", import.meta.url);
const copy = {
  en: {
    title: "Decode the Dust",
    region: "North Africa · Mediterranean",
    question: "Where on the map was the modeled dust signal strong?",
    method: "Find the cells where modeled dust aerosol optical depth reached {threshold} or more. Listen for a tone in each cell.",
    instructions: {
      intro: "Listen to a map made from NASA model data, then mark the cells you think reached the challenge threshold.",
      legend: "Play three pairs of examples: left and right, low and high pitch, then quiet and loud.",
      listen: "The scan moves west to east, visiting cells north to south within each column. Follow the highlighted cell and listen for a tone.",
      decode: "Select the cells where you heard a tone. Use the arrow keys to move, Space to select, and Enter to hear a cell again.",
      reveal: "Compare your choices with the model and explore the NASA visualization below.",
    },
    next: { intro: "Start with the sound guide", legend: "Go to the scan", listen: "Make your guesses" },
    shortSteps: ["Explore", "Sound guide", "Listen", "Guess", "Reveal"],
    stepList: "Challenge steps",
    cues: [["↔", "Left is west, right is east"], ["↕", "Higher pitch points north"], ["◖", "Louder means higher optical depth"]],
    directions: ["West", "North", "East", "South"],
    probe: "Listen to focused cell",
    choices: "Selected cells: {count}",
    evidenceTitle: "What the model shows",
    mapKey: "Teal cells reached the challenge threshold.",
    findings: "{above} of {available} cells with data reached {threshold}. Counts by row, north to south: {counts}.",
    limits: "Optical depth describes how much dust in the full atmospheric column dims light at 550 nm. The cutoff is for this challenge. Quiet cells can still contain dust.",
    details: "Cell values and data provenance",
    contextTitle: "NASA’s view of the same event",
    contextAlt: "Global NASA aerosol visualization for 19 August 2025, with modeled dust in pink and magenta.",
    credit: "NASA GMAO and NASA SVS · Joseph V. Ardizzone and Helen-Nicole Kostis",
    playbackLabel: "Playback progress",
    playbackStatus: { idle: "Ready", starting: "Starting", playing: "Playing", paused: "Paused", ended: "Complete" },
    calibration: "Play sound guide",
    mute: "Mute",
  },
  ar: {
    title: "اسمع خريطة الغبار",
    region: "شمال أفريقيا · البحر المتوسط",
    question: "بأي مناطق كانت إشارة الغبار قوية؟",
    method: "دَوّر على الخلايا اللي وصل فيها العمق البصري للغبار في النموذج لـ{threshold} أو أكثر. اسمع إذا في نغمة بكل خلية.",
    instructions: {
      intro: "اسمع خريطة مبنيّة على بيانات نموذج من ناسا، وبعدين اختار الخلايا اللي بتتوقع إنها وصلت لحدّ التحدّي.",
      legend: "شغّل ثلاثة أزواج من النغمات. اسمع اليسار ثم اليمين، والنغمة الواطية ثم العالية، والصوت الخافت ثم الأقوى.",
      listen: "المسح بمشي من الغرب للشرق، وبكل عمود من الشمال للجنوب. تابع الخلية المضيئة وانتبه إذا سمعت نغمة.",
      decode: "اختار الخلايا اللي سمعت فيها نغمة. تنقّل بالأسهم، اختار بمفتاح المسافة، واضغط Enter لتسمع الخلية مرة ثانية.",
      reveal: "قارن اختياراتك بنتيجة النموذج وشوف عرض ناسا للحدث تحت.",
    },
    next: { intro: "ابدأ بدليل الصوت", legend: "انتقل للمسح", listen: "خمّن الخلايا" },
    shortSteps: ["استكشف", "دليل الصوت", "اسمع", "خمّن", "اكشف"],
    stepList: "مراحل التحدّي",
    cues: [["↔", "اليسار غرب واليمين شرق"], ["↕", "النغمة الأعلى جاية من الشمال"], ["◖", "الصوت الأقوى يعني عمق بصري أعلى"]],
    directions: ["غرب", "شمال", "شرق", "جنوب"],
    probe: "اسمع الخلية الحالية",
    choices: "الخلايا المختارة: {count}",
    evidenceTitle: "شو أظهر النموذج؟",
    mapKey: "الخلايا باللون الفيروزي وصلت لحدّ التحدّي.",
    findings: "من بين {available} خلية فيها بيانات، {above} وصلت لحدّ {threshold} أو تجاوزته. عددها بكل صف من الشمال للجنوب: {counts}.",
    limits: "العمق البصري بيوصف قديش الغبار بكل عمود الجو بيخفّف الضوء عند طول موجي ٥٥٠ نانومتر. الحدّ مخصّص للتحدّي، وممكن تضل الخلايا الصامتة فيها غبار.",
    details: "قيم الخلايا ومصدر البيانات",
    contextTitle: "عرض ناسا لنفس الحدث",
    contextAlt: "عرض عالمي للهباء الجوي من ناسا في ١٩ آب ٢٠٢٥، ويظهر الغبار المحسوب بالنموذج بالوردي والأرجواني.",
    credit: "NASA GMAO وNASA SVS · Joseph V. Ardizzone وHelen-Nicole Kostis",
    playbackLabel: "تقدّم التشغيل",
    playbackStatus: { idle: "جاهز", starting: "جارٍ البدء", playing: "يعمل", paused: "متوقّف مؤقتًا", ended: "اكتمل" },
    calibration: "شغّل دليل الصوت",
    mute: "كتم الصوت",
  },
};

const systemCopy = {
  en: {
    awaitingAudio: "The dust case is ready. This experience is waiting for the spatial audio module.",
    fixtureNote: "Synthetic test data only. The case has no NASA frame or measurements.",
    unavailable: "Audio could not start. Check your audio settings and try again.",
    testAudio: "Integration test: simulated playback. It does not represent the sound of NASA data.",


    positions: "Cell",
    values: "Dust optical depth (dimensionless)",
    classifications: "Classification",
    measured: "At or above the challenge threshold",
    below_threshold: "Below the challenge threshold",
    missing: "Missing reading",
    source: "NASA GEOS-FP source granule",
    context: "NASA SVS 5669 context",
    frame: "Open the separate SVS frame",
    evidence: "GEOS-FP model results, {start} to {end} (UTC).",
    contextNote: "SVS 5669 shows a separate 2 km GEOS-FP Replay frame at 20:00 UTC. The grid and sound use the standard GEOS-FP three-hour mean.",
  },
  ar: {
    awaitingAudio: "حالة الغبار جاهزة. التجربة بانتظار توصيل وحدة الصوت المكاني.",
    fixtureNote: "بيانات اصطناعية للاختبار فقط. الحالة ما فيها صورة أو قياسات من ناسا.",
    unavailable: "تعذّر تشغيل الصوت. تحقّق من إعدادات الصوت وحاول مرة ثانية.",
    testAudio: "اختبار دمج: التشغيل محاكى. هذا التشغيل لا يمثّل صوت بيانات ناسا.",


    positions: "الخلية",
    values: "العمق البصري للغبار (بلا وحدة)",
    classifications: "التصنيف",
    measured: "عند حدّ التحدّي أو أعلى",
    below_threshold: "أقل من حدّ التحدّي",
    missing: "القراءة مفقودة",
    source: "ملف بيانات GEOS-FP من ناسا",
    context: "سياق الحدث من NASA SVS 5669",
    frame: "افتح إطار SVS المنفصل",
    evidence: "نتائج نموذج GEOS-FP من {start} إلى {end} بالتوقيت العالمي UTC.",
  },
};

// Mount after the session has published its initial case snapshot.
export function mountDecodeAccessibility(gridRoot, session, { language = "en" } = {}) {
  return mountDecodeGrid(gridRoot, session, {
    t: (key, params) => decodeMessage(language, key, params),
  });
}

/**
 * Keep the plan and its evidence inside integration. Renderers get just the
 * revision-checked coordinates from the same transport that schedules audio.
 */
export function createDecodePlayback(transport) {
  let plan;
  let revision;
  let positions;
  const unsubscribe = new Set();
  return {
    transport: {
      ...transport,
      subscribe(listener) {
        const stop = transport.subscribe(listener);
        unsubscribe.add(stop);
        return () => {
          unsubscribe.delete(stop);
          stop();
        };
      },
      load(next, start) {
        plan = next;
        positions = new Map(next.events.map(({ id, row, col }) => [id, Object.freeze([row, col])]));
        // load() publishes a paused snapshot synchronously.
        revision = null;
        transport.load(next, start);
        revision = transport.snapshot().planRevision;
      },
    },
    get durationS() { return plan?.durationS ?? 0; },
    get mode() { return plan?.mode; },
    withActiveCell(snapshot) {
      const state = snapshot.transport;
      const current = plan && plan.mode !== "legend" && plan.caseId === snapshot.caseId &&
        plan.level === snapshot.level && revision === snapshot.planRevision &&
        revision === state.planRevision && state.status === "playing" && !state.awaitingOnset &&
        state.positionS < plan.durationS;
      const position = current ? positions.get(state.activeEventId) : null;
      const activeCell = position && position[0] >= 0 && position[0] < snapshot.grid.rows &&
        position[1] >= 0 && position[1] < snapshot.grid.cols ? position : null;
      return { ...snapshot, activeCell };
    },
    dispose() {
      for (const stop of unsubscribe) stop();
      unsubscribe.clear();
    },
  };
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key]);
}

const revealLabels = {
  correct: "reveal.selection.correct",
  incorrect: "reveal.selection.false",
  missed: "reveal.selection.missed",
};

function revealOutcomes(snapshot) {
  const guesses = new Set(snapshot.guesses.map(([row, col]) => row * snapshot.grid.cols + col));
  const outcomes = [];
  for (const { row, col, status } of snapshot.grid.cells) {
    const chosen = guesses.has(row * snapshot.grid.cols + col);
    if (status === "measured") {
      outcomes.push({ row, col, outcome: chosen ? "correct" : "missed" });
    } else if (chosen) {
      outcomes.push({ row, col, outcome: "incorrect" });
    }
  }
  return outcomes;
}

function evidenceRows(document, cells, text, t, format) {
  return cells.map(({ row, col, value, status }) => {
    const tr = document.createElement("tr");
    for (const label of [
      t("grid.position", { row: row + 1, col: col + 1 }),
      value === null ? "—" : format(value),
      text[status],
    ]) {
      const td = document.createElement("td");
      td.textContent = label;
      tr.append(td);
    }
    return tr;
  });
}

export async function mountDecode(root, {
  language = "en", makePlan, heardClass, mountVisual, transport = createTransport(),
  loadCase = loadDecodeCase, caseId = dustCaseId, testPlayback = false,
}) {
  const t = (key, params) => decodeMessage(language, key, params);
  const text = { ...systemCopy[language], ...copy[language] };
  const document = root.ownerDocument;
  const byId = id => root.querySelector("#decode-" + id);
  const busy = byId("state");
  const notice = byId("notice");
  const interfaceRoot = byId("interface");
  const heading = byId("phase");
  const description = byId("description");
  const stage = byId("stage");
  const next = byId("next");
  const play = byId("play");
  const pause = byId("pause");
  const replay = byId("replay");
  const mute = byId("mute");
  const submit = byId("submit");
  const restart = byId("restart");
  const evidence = byId("evidence");
  const outcomeLabels = byId("outcome-labels");
  const playbackPanel = byId("playback");
  const source = byId("source");
  const context = byId("context");
  const frame = byId("frame");
  const progress = byId("progress");
  const selectionLabel = byId("selections");
  const probeReading = byId("probe-reading");
  const playbackLabel = byId("playback-label");
  const map = byId("map");
  const mapTop = map.querySelector(".decode-map-top");
  const cellActions = map.querySelector(".decode-cell-actions");
  const image = byId("context-image");
  const figure = byId("context-figure");
  const details = byId("details");
  const steps = byId("steps");
  const format = new Intl.NumberFormat(language, { maximumSignificantDigits: 17 }).format;
  const thresholdFormat = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 10 }).format;
  const cellNumber = new Intl.NumberFormat(language).format;
  let activeButton;
  const cellButtons = [];
  let lastTransportLabel;
  let lastChoiceText;
  let lastProbeText;
  let caseData;
  let grid, visual, stopRendering;
  const handlers = new AbortController();
  const playback = createDecodePlayback(transport);
  const session = createDecodeSession({
    cases: [caseId], makePlan, heardClass, transport: playback.transport,
    level: "quick", mode: "discovery", condition: "sound",
    async loadCase(id) {
      caseData = await loadCase(id);
      return caseData;
    },
  });

  function setPhase(snapshot) {
    const { phase } = snapshot;
    const phaseIndex = phaseOrder.indexOf(phase);
    for (const [index, li] of Array.from(steps.children).entries()) {
      li.classList.toggle("decode-progress-complete", index < phaseIndex);
      if (index === phaseIndex) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    }
    heading.textContent = t("stage." + stages[phase]);
    description.textContent = text.instructions[phase];
    stage.hidden = !["listen", "decode", "reveal"].includes(phase);
    cellActions.hidden = phase !== "decode";
    byId("legend").hidden = phase !== "legend";
    play.hidden = !["legend", "listen", "decode"].includes(phase);
    play.textContent = phase === "legend" ? text.calibration : t("listen.start");
    next.hidden = !text.next[phase];
    if (!next.hidden) next.textContent = text.next[phase];
    const primary = { intro: next, legend: play, listen: play, decode: submit, reveal: restart }[phase];
    for (const button of [next, play, submit, restart]) button.toggleAttribute("data-primary", button === primary);
    submit.hidden = phase !== "decode";
    restart.hidden = phase !== "reveal";
    evidence.hidden = phase !== "reveal";

    byId("map-key").textContent = phase === "reveal" ? text.mapKey : "";
    details.open = false;
    if (phase !== "reveal") {
      for (const button of cellButtons) button.removeAttribute("data-evidence");
      byId("finding").textContent = "";
      byId("svs-card").hidden = true;
      figure.hidden = true;
      image.removeAttribute("src");
      byId("readings").replaceChildren();
      for (const element of [source, context, frame]) element.removeAttribute("href");
      byId("context-note").textContent = "";
      byId("source-details").textContent = "";
      byId("score").textContent = "";
      return;
    }

    byId("score").textContent = t("reveal.scoreSummary", snapshot.score);
    const { rows, cols, cells } = snapshot.grid;
    const rowCounts = Array(rows).fill(0);
    let available = 0;
    for (const { row, col, status } of cells) {
      cellButtons[row * cols + col].dataset.evidence = status;
      if (status !== "missing") available++;
      if (status === "measured") rowCounts[row]++;
    }
    byId("finding").textContent = fill(text.findings, {
      available: cellNumber(available),
      above: cellNumber(rowCounts.reduce((sum, count) => sum + count, 0)),
      threshold: thresholdFormat(caseData.levels[snapshot.level].truth.threshold),
      counts: new Intl.ListFormat(language).format(rowCounts.map(cellNumber)),
    });
    byId("readings").replaceChildren(...evidenceRows(document, snapshot.grid.cells, text, t, format));
    const { product, version, time } = caseData.source;
    byId("source-details").textContent = text.evidence
      .replace("{start}", time.start).replace("{end}", time.end) + " " + product + " · " + version;
    source.hidden = !caseData.source.url;
    if (!source.hidden) source.href = caseData.source.url;
    const visualLink = snapshot.visualLink;
    context.hidden = !visualLink.svs;
    if (!context.hidden) context.href = visualLink.svs;
    frame.hidden = !/^https:\/\//.test(visualLink.image);
    if (!frame.hidden) frame.href = visualLink.image;
    const showFrame = !caseData.fixture && caseData.id === dustCaseId && visualLink.relation === "RELATED_CONTEXT" &&
      visualLink.image === "https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png";
    byId("svs-card").hidden = !visualLink.svs;
    figure.hidden = !showFrame;
    if (showFrame) image.src = dustFrame.href;
    const contextNote = language === "ar" ? t("note." + dustCaseId) : text.contextNote;
    byId("context-note").textContent = showFrame ? contextNote : visualLink.note;

    // Pair the one-shot renderer callback with this exact, locked submission.
    const applyReveal = visual?.prepareReveal?.();
    applyReveal?.(revealOutcomes(snapshot), outcomeLabels, (outcome, row, col) =>
      t("grid.position", { row: row + 1, col: col + 1 }) + ". " + t(revealLabels[outcome]) + ".");
  }

  function dispose() {
    handlers.abort();
    stopRendering?.();
    visual?.dispose();
    grid?.dispose();
    transport.pause();
    playback.dispose();
    interfaceRoot.hidden = true;
    notice.hidden = true;
    delete map.dataset.live;
    mapTop.hidden = true;
    setPhase({ phase: "intro" });
  }

  try {
    await session.ready;
    byId("region").textContent = caseData.fixture ? "" : text.region;
    byId("question").textContent = text.question;
    notice.textContent = [
      caseData.fixture && t("explore.fixtureDisclaimer"),
      testPlayback && text.testAudio,
    ].filter(Boolean).join(" ");
    notice.hidden = !notice.textContent;
    byId("date").textContent = caseData.fixture ? "" : new Intl.DateTimeFormat(language, {
      dateStyle: "long", timeZone: "UTC",
    }).format(new Date(caseData.source.time.start));
    byId("method").textContent = fill(text.method, { threshold: thresholdFormat(caseData.levels.quick.truth.threshold) });
    map.dataset.live = "";
    mapTop.hidden = false;
    for (const [index, direction] of ["west", "north", "east", "south"].entries()) {
      byId(direction).textContent = text.directions[index];
    }
    steps.setAttribute("aria-label", text.stepList);
    steps.replaceChildren(...text.shortSteps.map(label => {
      const item = document.createElement("li");
      item.textContent = label;
      return item;
    }));
    byId("legend").replaceChildren(...text.cues.map(([icon, label]) => {
      const item = document.createElement("li");
      const glyph = document.createElement("span");
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = icon;
      item.append(glyph, label);
      return item;
    }));
    byId("probe").textContent = text.probe;
    progress.setAttribute("aria-label", text.playbackLabel);
    byId("evidence-title").textContent = text.evidenceTitle;
    byId("limits").textContent = text.limits;
    byId("details-title").textContent = text.details;
    byId("context-title").textContent = text.contextTitle;
    byId("context-credit").textContent = text.credit;
    image.alt = text.contextAlt;
    stage.setAttribute("aria-label", t("stage.decode"));
    pause.textContent = t("listen.pause");
    replay.textContent = t("listen.replay");
    mute.textContent = text.mute;
    submit.textContent = t("grid.submit");
    restart.textContent = t("general.restart");
    source.textContent = text.source;
    context.textContent = text.context;
    frame.textContent = text.frame;
    byId("positions").textContent = text.positions;
    byId("values").textContent = text.values;
    byId("classifications").textContent = text.classifications;

    const rendererSession = {
      dispatch(intent) {
        if (intent.type === "reset" || intent.type === "select-case") visual?.clearReveal?.();
        if (intent.type === "next" || intent.type === "submit") session.dispatch({ type: "pause" });
        return session.dispatch(intent);
      },
      getState: () => playback.withActiveCell(session.getState()),
      subscribe: listener => session.subscribe(snapshot => listener(playback.withActiveCell(snapshot))),
    };
    // Fixtures have no visual source. Supply their test-data label through the grid's translator.
    const translateGrid = caseData.fixture ? (key, params) => {
      if (key === "note." + caseData.id) return text.fixtureNote;
      if (key === "reveal.relation.RELATED_CONTEXT") return "";
      return t(key, params);
    } : t;
    // Keep one interactive grid and decorate its existing buttons from the session.
    grid = mountDecodeGrid(byId("grid"), rendererSession, { t: translateGrid });
    const gridRoot = byId("grid");
    function labelCells(cols) {
      cellButtons.splice(0, cellButtons.length, ...gridRoot.querySelectorAll(".dg-cell"));
      for (const [index, button] of cellButtons.entries()) {
        const label = document.createElement("span");
        label.setAttribute("aria-hidden", "true");
        label.textContent = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index % cols] + cellNumber(Math.floor(index / cols) + 1);
        button.append(label);
      }
    }
    labelCells(rendererSession.getState().grid.cols);
    if (mountVisual) {
      visual = mountVisual(byId("visual"), rendererSession, {
        t, geography: {
          caseId: caseData.id, bounds: { ...caseData.bounds }, projection: "plate-carree",
        },
      });
    }

    let previousPhase;
    let previousGridSize = cellButtons.length;
    stopRendering = rendererSession.subscribe(snapshot => {
      const { phase, activeCell, transport: state } = snapshot;
      if (previousGridSize !== snapshot.grid.cells.length) {
        labelCells(snapshot.grid.cols);
        previousGridSize = cellButtons.length;
      }
      const active = activeCell && cellButtons[activeCell[0] * snapshot.grid.cols + activeCell[1]];
      if (active !== activeButton) {
        activeButton?.removeAttribute("data-playing");
        active?.setAttribute("data-playing", "");
        activeButton = active;
      }
      const choiceText = phase === "decode" ? fill(text.choices, { count: cellNumber(snapshot.guesses.length) }) : "";
      if (choiceText !== lastChoiceText) {
        selectionLabel.textContent = choiceText;
        lastChoiceText = choiceText;
      }
      const [row, col] = snapshot.focus;
      const probeText = snapshot.lastProbe?.row === row && snapshot.lastProbe.col === col
        ? t("discovery.cellReadout", { row, col, lastProbe: snapshot.lastProbe })
        : t("grid.position", { row: row + 1, col: col + 1 });
      if (probeText !== lastProbeText) {
        probeReading.textContent = probeText;
        lastProbeText = probeText;
      }
      if (previousPhase !== phase) {
        const focusedControl = [next, submit, restart].includes(document.activeElement);
        setPhase(snapshot);
        previousPhase = phase;
        if (focusedControl) heading.focus();
      }
      const hasPlayback = ["legend", "listen", "decode"].includes(phase);
      pause.hidden = replay.hidden = mute.hidden = !hasPlayback;
      playbackPanel.hidden = !hasPlayback;
      const matchingPlan = (phase === "legend") === ((snapshot.playMode ?? playback.mode) === "legend");
      replay.disabled = !matchingPlan;
      progress.max = (matchingPlan ? playback.durationS : 0) || 1;
      progress.value = matchingPlan ? state.positionS : 0;
      const status = !matchingPlan || (state.status === "paused" && state.positionS === 0) ? "idle" : state.status;
      if (status !== lastTransportLabel) {
        playbackLabel.textContent = text.playbackStatus[status];
        lastTransportLabel = status;
      }
      pause.disabled = !["playing", "starting"].includes(state.status);
      mute.setAttribute("aria-pressed", state.muted ? "true" : "false");
      busy.textContent = hasPlayback && state.audioUnavailable ? text.unavailable : "";
    });
    const onClick = (element, handler) => element.addEventListener("click", handler, { signal: handlers.signal });
    onClick(play, () => rendererSession.dispatch({
      type: "play", mode: rendererSession.getState().phase === "legend" ? "legend" : "sweep",
    }));
    for (const [button, type] of [[next, "next"], [pause, "pause"], [replay, "replay"], [submit, "submit"], [restart, "reset"]]) {
      onClick(button, () => rendererSession.dispatch({ type }));
    }
    onClick(mute, () => transport.setMuted(!transport.snapshot().muted));
    onClick(byId("probe"), () => {
      const [row, col] = rendererSession.getState().focus;
      rendererSession.dispatch({ type: "probe", row, col });
    });
    interfaceRoot.hidden = false;
    return { session: rendererSession, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

async function loadOptionalModule(path) {
  const url = new URL(path, import.meta.url);
  try {
    return await import(url.href);
  } catch (error) {
    if (error instanceof TypeError && (await fetch(url, { method: "HEAD" })).status === 404) return null;
    throw error;
  }
}

export async function startDecode(root) {
  const document = root.ownerDocument;
  const language = new URL(document.URL).searchParams.get("lang") === "ar" ? "ar" : "en";
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = copy[language].title + " · EARTHPULSE";
  root.querySelector("#decode-title").textContent = copy[language].title;
  const home = root.querySelector("#decode-home");

  home.href = language === "ar" ? "./?lang=ar" : "./";
  const switchLanguage = root.querySelector("#decode-language");
  const alternate = language === "ar" ? "en" : "ar";
  switchLanguage.href = "?lang=" + alternate;
  switchLanguage.hreflang = switchLanguage.lang = alternate;
  switchLanguage.textContent = alternate === "ar" ? "العربية" : "English";
  const state = root.querySelector("#decode-state");
  const retry = root.querySelector("#decode-retry");
  const t = key => decodeMessage(language, key);
  retry.textContent = t("general.retry");

  async function start() {
    retry.hidden = true;
    state.textContent = t("general.loading");
    try {
      const sound = await loadOptionalModule("./audio/spatial-plan.js");
      if (!sound) {
        state.textContent = systemCopy[language].awaitingAudio;
        return;
      }
      if (typeof sound.makeSpatialPlan !== "function" || typeof sound.heardClass !== "function") {
        throw new Error("Decode spatial plan exports do not conform to v2.");
      }
      const visual = await loadOptionalModule("./visual/decode-visual.js");
      if (visual && typeof visual.mountDecodeVisual !== "function") {
        throw new Error("Decode visual export does not conform to v2.");
      }
      await mountDecode(root, {
        language, makePlan: sound.makeSpatialPlan, heardClass: sound.heardClass, mountVisual: visual?.mountDecodeVisual,
      });
      switchLanguage.hidden = false;
    } catch (error) {
      console.error(error);
      state.textContent = t("general.error");
      retry.hidden = false;
    }
  }

  retry.addEventListener("click", start);
  await start();
}
