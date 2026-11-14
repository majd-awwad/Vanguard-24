import { formatEvidence, renderEvidence } from "./evidence.js";

export function mountAccessible(session, getLanguage, text) {
  const { data } = session;
  const byId = (id) => document.getElementById(id);
  const controls = Object.fromEntries([
    "horizontal", "vertical", "footprint", "band-min", "band-max", "band-controls", "vertical-controls",
    "height-step", "play", "pause", "replay", "previous", "next", "speed", "volume", "mute", "sound", "silent",
    "instruction", "plot-key", "position-text", "playback-status", "reveal",
    "guide", "guide-step", "guide-title", "guide-pulse", "guide-track", "guide-outcome", "guide-result", "guide-result-heading",
    "question-description", "guide-vertical", "evidence-low", "evidence-high",
    "open", "discovery-open", "reading-title", "current-value", "current-label", "inspect", "observation", "evidence-content", "close-evidence",
    "announcer", "begin", "begin-silent", "lens",
  ].map((id) => [id, byId(id)]));
  const send = session.dispatch;
  let current, bandLocale, evidenceTrigger, renderedEvidence, evidenceLocale, rendered;
  let playbackKey;
  let stage = "reveal";
  const visited = new Set();
  const bandName = (band, number) => text("bandLabel")
    .replace("{low}", number(band[0])).replace("{high}", number(band[1]));
  const footprintNumber = (row) => new Intl.NumberFormat(getLanguage(), { minimumIntegerDigits: 2 }).format(row.index + 1);
  const footprintName = (row) => `${text("footprint")} ${footprintNumber(row)}`;
  const selectOptions = (name, options) => controls[name].replaceChildren(
    ...options.map(([value, label]) => new Option(label, value)),
  );
  const on = (id, event, fn) => controls[id].addEventListener(event, fn);
  const activate = (id, action) => on(id, "click", (event) => {
    if (controls[id].getAttribute("aria-disabled") === "true") return;
    action(event);
  });

  function announce(message) {
    controls.announcer.textContent = message;
  }

  function placeFocus(element, block = "nearest") {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block });
  }

  function optionsForBand(band, number) {
    if (bandLocale !== getLanguage()) {
      bandLocale = getLanguage();
      selectOptions("band-min", data.edges.slice(0, -1).map((edge) => [edge, number(edge)]));
      selectOptions("band-max", data.edges.slice(1).map((edge) => [edge, number(edge)]));
    }
    controls["band-min"].value = band[0];
    controls["band-max"].value = band[1];
  }

  function renderGuide({ revealed }, number, percent) {
    const [low, high] = session.comparison;
    const targets = [low.observation, high.observation];
    const compared = targets.every((row) => visited.has(row.id));
    const atTrack = stage === "track";
    controls.guide.hidden = stage === "free";
    controls["guide-pulse"].hidden = atTrack;
    controls["guide-track"].hidden = atTrack;
    controls.reveal.hidden = !atTrack || !compared || revealed;
    controls.open.hidden = revealed;
    controls.reveal.setAttribute("aria-expanded", String(revealed));
    controls["guide-outcome"].hidden = !revealed || stage === "free";
    controls["guide-step"].textContent = text(atTrack ? "trackStep" : "pulseStep");
    controls["guide-title"].textContent = text(atTrack ? "trackTitle" : "pulseTitle");
    controls["question-description"].textContent = atTrack
      ? text(revealed ? "trackResult" : compared ? "trackCompared" : "trackPrompt").replace("{low}", footprintNumber(targets[0]))
        .replace("{high}", footprintNumber(targets[1])).replace("{band}", bandName(data.guide.band, number))
      : text("pulsePrompt");
    if (!revealed || controls["guide-result"].dataset.locale === getLanguage()) return;
    const result = controls["guide-result"];
    const comparison = document.createElement("div");
    comparison.className = "result-values";
    for (const { observation, evidence } of [low, high]) {
      const item = document.createElement("div");
      const title = document.createElement("span");
      const value = document.createElement("strong");
      const bar = document.createElement("i");
      title.textContent = footprintName(observation);
      value.textContent = percent(evidence.value);
      bar.setAttribute("aria-hidden", "true");
      bar.style.setProperty("--share", `${100 * evidence.value / high.evidence.value}%`);
      item.append(title, value, bar);
      comparison.append(item);
    }
    const detail = document.createElement("p");
    const margin = number(data.guide.margin * 100);
    detail.textContent = text("comparisonResult").replace("{shot}", footprintNumber(high.observation)).replace("{margin}", margin);
    result.replaceChildren(comparison, detail);
    result.dataset.locale = getLanguage();
  }

  function render(state) {
    current = state;
    const reading = state.event.evidence;
    const sameBand = reading.band[0] === data.guide.band[0] && reading.band[1] === data.guide.band[1];
    if (stage === "track" && state.selection.axis === "horizontal" && sameBand && !state.inTrackGap && !state.transport.awaitingOnset) {
      visited.add(state.observation.id);
    }
    const lang = getLanguage();
    const { transport } = state;
    const renderKey = [lang, state.event.id, state.selection.axis, transport.status, transport.playback,
      transport.audioUnavailable, transport.speed, transport.volume, transport.muted, state.revealed,
      stage, visited.size, state.inTrackGap, controls.observation.open].join("|");
    if (renderKey === rendered && renderedEvidence === state.inspected) return;
    rendered = renderKey;
    const { number, percent } = formatEvidence(lang);
    const horizontal = state.selection.axis === "horizontal";
    const index = state.plan.events.indexOf(state.event);
    const active = state.transport.status;
    const activated = active === "playing" || active === "starting";
    controls.horizontal.setAttribute("aria-pressed", String(horizontal));
    controls.vertical.setAttribute("aria-pressed", String(!horizontal));
    controls["band-controls"].hidden = !horizontal;
    controls["vertical-controls"].hidden = horizontal;
    controls.footprint.value = state.observation.id;
    controls["height-step"].value = horizontal ? "0" : index;
    if (horizontal) optionsForBand(state.selection.bandM, number);
    controls.instruction.textContent = text(horizontal ? "axisHorizontal" : "axisVertical");
    controls["plot-key"].textContent = text(horizontal ? "keyHorizontal" : "keyVertical");
    const where = `${footprintName(state.observation)} · ${bandName(reading.band, number)}`;
    controls["position-text"].textContent = `${where} · ${number(index + 1)} ${text("of")} ${number(state.plan.events.length)}`;
    const value = reading.value === null ? "—" : percent(reading.value);
    controls["reading-title"].textContent = text(state.inTrackGap ? "lastReturn" : "currentReturn");
    controls["current-value"].textContent = value;
    controls["current-value"].dataset.event = state.event.id;
    const qualifier = reading.observationStatus === "below_threshold" ? text("below") : reading.value === null ? text("missing") : "";
    controls["current-label"].textContent = qualifier ? `${where} · ${qualifier}` : where;
    controls.play.setAttribute("aria-disabled", String(activated));
    controls.pause.setAttribute("aria-disabled", String(!activated));
    controls.previous.setAttribute("aria-disabled", String(index === 0));
    controls.next.setAttribute("aria-disabled", String(index === state.plan.events.length - 1));
    controls.speed.value = state.transport.speed;
    controls.volume.value = Math.round(state.transport.volume * 100);
    controls.mute.checked = state.transport.muted;
    const status = state.transport.audioUnavailable && active === "playing" ? "fallback"
      : active === "playing" && state.transport.playback === "silent" ? "playingSilent"
      : active === "idle" ? "ready" : active;
    const playbackLabel = active === "playing" && transport.playback === "audio" && (transport.muted || transport.volume === 0)
      ? text("playingMuted") : text(status);
    controls["playback-status"].textContent = state.inTrackGap ? `${playbackLabel} · ${text("trackGap")}` : playbackLabel;
    const key = `${lang}:${playbackLabel}:${activated ? "" : state.event.id}`;
    if (key !== playbackKey) {
      playbackKey = key;
      announce(activated ? playbackLabel : `${playbackLabel}. ${where}. ${qualifier || value}`);
    }
    renderGuide(state, number, percent);
    if (controls.observation.open && state.inspected && (renderedEvidence !== state.inspected || evidenceLocale !== lang)) {
      renderEvidence(controls["evidence-content"], state.inspected, data, lang, text);
      evidenceLocale = lang;
    }
    renderedEvidence = state.inspected;
  }

  function refresh() {
    const { number } = formatEvidence(getLanguage());
    const [low, high] = session.comparison;
    controls["guide-vertical"].textContent = text("scanHigh").replace("{shot}", footprintNumber(high.observation));
    for (const [id, { observation }] of [["evidence-low", low], ["evidence-high", high]]) {
      controls[id].textContent = text("evidenceFor").replace("{shot}", footprintNumber(observation));
    }
    selectOptions("footprint", data.footprints.map((row) => [row.id, footprintName(row)]));
    selectOptions("height-step", data.edges.slice(0, -1).map((edge, index) => [index, bandName([edge, data.edges[index + 1]], number)]));
    rendered = undefined;
    render(session.snapshot());
  }

  const start = (mode) => {
    stage = "reveal";
    visited.clear();
    document.body.dataset.entered = "true";
    if (mode === "audio") {
      send({ type: "mute", value: false });
      if (current.transport.volume === 0) send({ type: "volume", value: 0.72 });
    }
    send({ type: "guide-vertical", mode, restart: true });
    placeFocus(controls.lens, "start");
  };
  activate("begin", () => start("audio"));
  activate("begin-silent", () => start("silent"));
  activate("horizontal", () => send({ type: "axis", axis: "horizontal" }));
  activate("vertical", () => send({ type: "axis", axis: "vertical" }));
  on("footprint", "change", () => send({ type: "footprint", shotId: controls.footprint.value, preview: true }));
  on("height-step", "change", () => send({ type: "height", index: +controls["height-step"].value, preview: true }));
  for (const id of ["band-min", "band-max"]) {
    on(id, "change", () => {
      let low = +controls["band-min"].value;
      let high = +controls["band-max"].value;
      if (low >= high && id === "band-min") high = low + 1;
      else if (low >= high) low = high - 1;
      send({ type: "band", band: [low, high], preview: true });
    });
  }
  activate("play", () => send({ type: "play", mode: current.transport.playback }));
  activate("pause", () => send({ type: "pause" }));
  activate("replay", () => send({ type: "replay", mode: current.transport.playback }));
  activate("previous", () => send({ type: "step", direction: -1, preview: true }));
  activate("next", () => send({ type: "step", direction: 1, preview: true }));
  for (const [id, mode] of [["silent", "silent"], ["sound", "audio"]]) {
    activate(id, () => {
      if (mode === "audio") {
        send({ type: "mute", value: false });
        if (current.transport.volume === 0) send({ type: "volume", value: 0.72 });
      }
      if (current.transport.status === "playing" && current.transport.playback === mode) return;
      send({ type: "pause" });
      send({ type: "play", mode });
    });
  }
  on("speed", "change", () => send({ type: "speed", value: +controls.speed.value }));
  on("volume", "input", () => send({ type: "volume", value: +controls.volume.value / 100 }));
  on("mute", "change", () => send({ type: "mute", value: controls.mute.checked }));
  activate("guide-pulse", () => send({ type: "guide-vertical" }));
  activate("guide-track", () => {
    stage = "track";
    send({ type: "compare", shotId: data.guide.low, preview: true });
    placeFocus(controls["guide-title"]);
  });
  activate("guide-vertical", () => {
    send({ type: "guide-vertical" });
    placeFocus(controls.vertical);
  });
  activate("reveal", () => {
    send({ type: "pause" });
    send({ type: "reveal" });
    placeFocus(controls["guide-result-heading"], "center");
  });
  const explore = () => {
    stage = "free";
    send({ type: "explore" });
    placeFocus(current.selection.axis === "horizontal" ? controls.horizontal : controls.vertical);
  };
  activate("open", explore);
  activate("discovery-open", explore);
  function inspect(trigger, shotId) {
    evidenceTrigger = trigger;
    controls.observation.open = true;
    send({ type: "inspect", shotId });
    placeFocus(controls["evidence-content"]);
  }
  activate("inspect", () => inspect(controls.inspect));
  activate("evidence-low", () => inspect(controls["evidence-low"], data.guide.low));
  activate("evidence-high", () => inspect(controls["evidence-high"], data.guide.high));
  const summary = controls.observation.querySelector("summary");
  function closeEvidence() {
    controls.observation.open = false;
    placeFocus(evidenceTrigger?.getClientRects().length ? evidenceTrigger : summary);
    evidenceTrigger = null;
  }
  activate("close-evidence", closeEvidence);
  on("observation", "keydown", (event) => {
    if (event.key === "Escape" && controls.observation.open) closeEvidence();
  });
  on("observation", "toggle", () => {
    if (controls.observation.open && !controls["evidence-content"].firstChild) {
      evidenceTrigger = summary;
      send({ type: "inspect" });
    } else render(session.snapshot());
  });
  send({ type: "guide-vertical", prepare: true });
  refresh();
  const dispose = session.subscribe(render);
  return { refresh, dispose };
}
