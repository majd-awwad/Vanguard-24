import { mountDecodeGrid } from "./accessibility/decode-grid.js";
import { createTransport } from "./audio/transport.js";
import { createDecodeSession } from "./experiences/decode/session.js";
import { decodeMessage } from "./i18n/decode-messages.js";
import { loadDecodeCase } from "./sources/decode/index.js";

const dustCaseId = "dust-geos-fp-20250819-1930-north-africa-med";
const stages = { intro: "explore", legend: "legend", listen: "listen", decode: "decode", reveal: "reveal" };
const nextStage = { intro: "legend", legend: "listen", listen: "decode" };
const copy = {
  en: {
    home: "Sound Atlas",
    title: "Decode the dust",
    awaitingAudio: "The dust case is ready. This experience is waiting for the spatial audio module.",
    playbackComplete: "Playback complete.",
    unavailable: "Audio could not start. Check your audio settings and try again.",
    testAudio: "Integration test: simulated playback. It does not represent the sound of NASA data.",
    region: "North Africa and the Mediterranean",
    question: "Which cells show modelled dust aerosol optical depth at 550 nm of at least {threshold}?",
    mute: "Mute",
    playLegend: "Play sound legend",
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
    contextNote: "SVS 5669 shows a separate 2 km GEOS-FP Replay frame at 20:00 UTC. Use it as context for the dust event.",
  },
  ar: {
    home: "أطلس الصوت",
    title: "فكّ إشارات الغبار",
    awaitingAudio: "حالة الغبار جاهزة. التجربة بانتظار توصيل وحدة الصوت المكاني.",
    playbackComplete: "اكتمل التشغيل.",
    unavailable: "تعذّر تشغيل الصوت. تحقّق من إعدادات الصوت وحاول مرة ثانية.",
    testAudio: "اختبار دمج: التشغيل محاكى. هذا التشغيل لا يمثّل صوت بيانات ناسا.",
    region: "شمال أفريقيا والبحر الأبيض المتوسط",
    question: "في أي خلايا بلغ العمق البصري للغبار في النموذج، عند طول موجي ٥٥٠ نانومتر، {threshold} أو أكثر؟",
    mute: "كتم الصوت",
    playLegend: "تشغيل معايرة الصوت",
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
    contextNote: "يعرض SVS 5669 إطارًا منفصلًا من تشغيل GEOS-FP Replay بدقّة ٢ كم عند الساعة ٢٠:٠٠ بالتوقيت العالمي. الإطار للسياق العلمي لحدث الغبار.",
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
  const text = copy[language];
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
  const source = byId("source");
  const context = byId("context");
  const frame = byId("frame");
  const format = new Intl.NumberFormat(language, { maximumSignificantDigits: 17 }).format;
  let caseData;
  let grid, visual, stopRendering, stopEndAnnouncement;
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
    heading.textContent = t("stage." + stages[phase]);
    const descriptionKeys = { intro: "explore.journey", legend: "legend.intro", listen: "listen.navigation",
      decode: "grid.submitInstructions", reveal: "reveal.intro" };
    description.textContent = t(descriptionKeys[phase]);
    stage.hidden = !["listen", "decode", "reveal"].includes(phase);
    play.hidden = !["legend", "listen", "decode"].includes(phase);
    play.textContent = phase === "legend" ? text.playLegend : t("listen.start");
    next.hidden = !nextStage[phase];
    if (!next.hidden) next.textContent = t("stage." + nextStage[phase]);
    submit.hidden = phase !== "decode";
    restart.hidden = phase !== "reveal";
    evidence.hidden = phase !== "reveal";

    if (phase !== "reveal") {
      byId("readings").replaceChildren();
      for (const element of [source, context, frame]) element.removeAttribute("href");
      byId("context-note").textContent = "";
      byId("source-details").textContent = "";
      byId("score").textContent = "";
      return;
    }

    byId("score").textContent = t("reveal.scoreSummary", snapshot.score);
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
    byId("context-note").textContent = caseData.fixture ? visualLink.note : text.contextNote;

    // Pair the one-shot renderer callback with this exact, locked submission.
    const applyReveal = visual?.prepareReveal?.();
    applyReveal?.(revealOutcomes(snapshot), outcomeLabels, (outcome, row, col) =>
      t("grid.position", { row: row + 1, col: col + 1 }) + ". " + t(revealLabels[outcome]) + ".");
  }

  function dispose() {
    handlers.abort();
    stopRendering?.();
    stopEndAnnouncement?.();
    visual?.dispose();
    grid?.dispose();
    transport.pause();
    playback.dispose();
    interfaceRoot.hidden = true;
    notice.hidden = true;
    setPhase({ phase: "intro" });
  }

  try {
    await session.ready;
    byId("region").textContent = caseData.fixture ? "" : text.region;
    byId("question").textContent = text.question.replace("{threshold}", format(caseData.levels.quick.truth.threshold));
    notice.textContent = [
      caseData.fixture && t("explore.fixtureDisclaimer"),
      testPlayback && text.testAudio,
    ].filter(Boolean).join(" ");
    notice.hidden = !notice.textContent;
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
    grid = mountDecodeAccessibility(byId("grid"), rendererSession, { language });
    if (mountVisual) {
      visual = mountVisual(byId("visual"), rendererSession, {
        t, geography: {
          caseId: caseData.id, bounds: { ...caseData.bounds }, projection: "plate-carree",
        },
      });
    }

    let previousPhase;
    let previousStatus;
    let previousRevision;
    stopEndAnnouncement = rendererSession.subscribe(({ phase, planRevision, transport: state }) => {
      if (state.status === "ended" && previousStatus !== "ended" && planRevision === previousRevision) {
        byId("status").textContent = phase === "legend" ? t("legend.completed") : text.playbackComplete;
      }
      previousStatus = state.status;
      previousRevision = planRevision;
    });
    stopRendering = rendererSession.subscribe(snapshot => {
      const { phase, transport: state } = snapshot;
      if (previousPhase !== phase) {
        const focusedControl = [next, submit, restart].includes(document.activeElement);
        setPhase(snapshot);
        previousPhase = phase;
        if (focusedControl) heading.focus();
      }
      const hasPlayback = ["legend", "listen", "decode"].includes(phase);
      pause.hidden = replay.hidden = mute.hidden = !hasPlayback;
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
  home.textContent = copy[language].home;
  home.href = language === "ar" ? "./?lang=ar" : "./";
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
        state.textContent = copy[language].awaitingAudio;
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
    } catch (error) {
      console.error(error);
      state.textContent = t("general.error");
      retry.hidden = false;
    }
  }

  retry.addEventListener("click", start);
  await start();
}
