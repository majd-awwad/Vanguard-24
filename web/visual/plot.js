const svgNS = "http://www.w3.org/2000/svg";

function svg(name, attributes, content) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (content !== undefined) element.textContent = content;
  return element;
}

function line(x1, y1, x2, y2, className) {
  return svg("line", { x1, y1, x2, y2, class: className });
}

function label(x, y, value, className = "axis-label", anchor = "start") {
  return svg("text", { x, y, class: className, "text-anchor": anchor }, value);
}

function rawSamples({ raw }) {
  const adc = raw.l1b_rxwaveform_adc_descending_height;
  const top = raw.l1b_elevation_bin0_m_ellipsoid - raw.l2a_elev_lowestmode_m_ellipsoid;
  const span = raw.l1b_elevation_lastbin_m_ellipsoid - raw.l1b_elevation_bin0_m_ellipsoid;
  return adc.map((value, index) => ({ value, meters: top + span * index / (adc.length - 1) }));
}

export function mountVisual(root, session, translate) {
  const { data } = session;
  const floor = data.edges[0];
  const ceiling = data.edges.at(-1);
  const rawWindow = new Map(data.footprints.map((row) => [row.id,
    rawSamples(row).filter(({ meters }) => meters >= floor && meters < ceiling),
  ]));
  const maxADC = Math.ceil(Math.max(...[...rawWindow.values()].flat().map(({ value }) => value)) / 50) * 50;
  let compact = false;
  let revision, shot, axis, scene, geometry, marks, cursor, beam, playhead, highlight, detail, echo, markedIndex;
  const number = (value) => new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 0 }).format(value);
  const indexLabel = (row) => new Intl.NumberFormat(document.documentElement.lang, { minimumIntegerDigits: 2 }).format(row.index + 1);
  const meterLabel = (value) => `${number(value)} ${translate("meters")}`;

  function scaffold() {
    const width = compact ? 430 : 1130;
    const height = compact ? 368 : 428;
    const top = compact ? 59 : 62;
    const bottom = height - 49;
    const split = width * (compact ? 0.47 : 0.49);
    const right = width - (compact ? 28 : 77);
    const sampleRight = right - (compact ? 20 : 48);
    geometry = {
      width, height, top, bottom, split, right, sampleRight,
      y: (meters) => top + (ceiling - meters) / (ceiling - floor) * (bottom - top),
      adcX: (value) => split + value / maxADC * (sampleRight - split),
    };
    scene = svg("svg", { viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true", focusable: "false" });
    const image = document.createElement("div");
    image.className = "scene-forest";
    root.replaceChildren(image, scene);
  }

  function vertical(observation) {
    const { width, height, top, bottom, split, right, sampleRight, y, adcX } = geometry;
    const beamX = width * (compact ? 0.205 : 0.23);
    scene.append(svg("rect", { x: split, y: 0, width: width - split, height, class: "scope-plane" }));
    scene.append(label(beamX, 29, translate("beamLabel"), "scene-label", "middle"));
    scene.append(label(split + 9, 29, translate("waveLabel"), "scene-label"));
    scene.append(svg("ellipse", { cx: beamX, cy: y(0), rx: compact ? 49 : 106, ry: compact ? 14 : 24, class: "beam-base" }));
    scene.append(svg("path", {
      d: `M ${beamX} 41 L ${beamX - (compact ? 49 : 106)} ${y(0)} Q ${beamX} ${y(0) + 29} ${beamX + (compact ? 49 : 106)} ${y(0)} Z`,
      class: "beam-volume",
    }));
    scene.append(line(beamX, 41, beamX, bottom, "beam-axis"));
    for (const meters of [-10, 0, 10, 20]) {
      scene.append(line(split, y(meters), right, y(meters), meters === 0 ? "ground-line" : "plot-line"),
        label(split - 8, y(meters) + 4, meterLabel(meters), "axis-label", "end"));
    }
    scene.append(line(split, top, split, bottom, "plot-line"));
    for (const adc of [0, maxADC / 2, maxADC]) {
      scene.append(line(adcX(adc), top, adcX(adc), bottom, "plot-line"),
        label(adcX(adc), bottom + 21, number(adc), "axis-label", "middle"));
    }
    scene.append(label((split + sampleRight) / 2, height - 9, translate("adcAxis"), "axis-label", "middle"));
    highlight = svg("rect", { x: split, width: right - split, class: "slice" });
    scene.append(highlight);
    const points = rawWindow.get(observation.id).map(({ value, meters }) =>
      `${adcX(value).toFixed(2)},${y(meters).toFixed(2)}`);
    const waveform = svg("polyline", { points: points.join(" "), class: "waveform" });
    const clipId = "active-return-slice";
    const clip = svg("clipPath", { id: clipId });
    detail = svg("rect", { x: split, width: right - split });
    clip.append(detail);
    scene.append(waveform, clip, svg("polyline", {
      points: points.join(" "), "clip-path": `url(#${clipId})`, class: "waveform-active",
    }));
    cursor = line(beamX, top, right, top, "slice-line");
    beam = svg("circle", { cx: beamX, cy: top, r: 4, class: "beam-point" });
    echo = svg("circle", { cx: beamX, cy: top, r: 14, class: "echo-ring" });
    scene.append(cursor, echo, beam);
    const hit = svg("rect", { x: split, y: top, width: right - split, height: bottom - top, class: "wave-hit" });
    hit.addEventListener("click", (event) => {
      const rect = scene.getBoundingClientRect();
      const svgY = (event.clientY - rect.top) / rect.height * height;
      const index = Math.floor((bottom - svgY) / (bottom - top) * (data.edges.length - 1));
      session.dispatch({ type: "height", index: Math.max(0, Math.min(index, data.edges.length - 2)), preview: true });
    });
    scene.append(hit);
  }

  function horizontal(plan) {
    const { width, height } = geometry;
    const total = data.footprints.at(-1).distance;
    const point = (distance) => {
      const fraction = distance / total;
      return [width * (0.115 + fraction * 0.77), height * (0.73 - fraction * (compact ? 0.46 : 0.42))];
    };
    const first = point(0), last = point(total);
    scene.append(line(...first, ...last, "track-line"));
    scene.append(label(width * .035, 29, translate("trackScene"), "scene-label"));
    scene.append(label(width * .035, height - 14, translate("trackArtwork")));
    const buttonLayer = document.createElement("div");
    buttonLayer.className = "track-buttons";
    buttonLayer.setAttribute("role", "group");
    buttonLayer.setAttribute("aria-label", translate("plotDistance"));
    marks = data.footprints.map((row, index) => {
      const [x, y] = point(row.distance);
      const value = plan.events[index].evidence.value ?? 0;
      const ring = svg("ellipse", { cx: x, cy: y, rx: 18 + Math.sqrt(value) * 39, ry: 9 + Math.sqrt(value) * 24, class: "site-ring" });
      scene.append(ring, label(x, y + 36, meterLabel(row.distance), "track-distance", "middle"));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "site-button";
      button.textContent = indexLabel(row);
      button.setAttribute("aria-label", `${translate("footprint")} ${indexLabel(row)} · ${meterLabel(row.distance)}`);
      button.style.left = `${x / width * 100}%`;
      button.style.top = `${y / height * 100}%`;
      button.addEventListener("click", () => session.dispatch({ type: "footprint", shotId: row.id, preview: true }));
      buttonLayer.append(button);
      return { x, y, ring, button };
    });
    cursor = svg("ellipse", { cx: 0, cy: 0, rx: 41, ry: 24, class: "site-cursor" });
    echo = svg("ellipse", { cx: 0, cy: 0, rx: 35, ry: 20, class: "echo-ring" });
    beam = line(0, 0, 0, 0, "track-beam");
    playhead = svg("circle", { r: 3.5, class: "playhead" });
    scene.append(beam, cursor, echo, playhead);
    root.append(buttonLayer);
    geometry.trackPoint = point;
    markedIndex = undefined;
  }

  function render(state) {
    const { selection, plan, event, observation, transport, inTrackGap } = state;
    const nextAxis = selection.axis;
    const rerenderTrack = nextAxis === "horizontal" && revision !== transport.planRevision;
    if (axis !== nextAxis || (nextAxis === "vertical" && shot !== observation.id) || rerenderTrack) {
      const focused = marks?.findIndex(({ button }) => button === document.activeElement);
      scaffold();
      if (nextAxis === "vertical") vertical(observation);
      else {
        horizontal(plan);
        if (Number.isInteger(focused) && focused >= 0) marks[focused]?.button.focus({ preventScroll: true });
      }
      axis = nextAxis;
      shot = observation.id;
      revision = transport.planRevision;
    }
    root.dataset.axis = axis;
    root.dataset.event = event.id;
    const fraction = event.evidence.value ?? 0;
    const offset = transport.positionS - event.onsetS;
    const tone = event.tone;
    const active = tone && !transport.awaitingOnset && transport.status === "playing" && offset >= 0 && offset < tone.durationS;
    const envelope = active ? Math.min(1, offset / tone.attackS, (tone.durationS - offset) / tone.releaseS) : 0;
    const response = Math.sqrt(fraction) * envelope;
    echo.setAttribute("opacity", Math.min(1, response * 3));
    if (axis === "horizontal") {
      const { x, y } = marks[observation.index];
      const total = data.footprints.at(-1).distance;
      const routeProgress = Math.min(1, transport.positionS / plan.events.at(-1).onsetS);
      const [gapX, gapY] = geometry.trackPoint(total * routeProgress);
      playhead.setAttribute("cx", gapX);
      playhead.setAttribute("cy", gapY);
      playhead.style.display = inTrackGap ? "" : "none";
      cursor.setAttribute("cx", x);
      cursor.setAttribute("cy", y);
      cursor.setAttribute("opacity", inTrackGap ? "0.35" : "1");
      echo.setAttribute("cx", x);
      echo.setAttribute("cy", y);
      echo.setAttribute("rx", 35 + response * 24);
      beam.setAttribute("x1", x);
      beam.setAttribute("x2", x);
      beam.setAttribute("y1", y - (compact ? 41 : 70));
      beam.setAttribute("y2", y);
      beam.setAttribute("opacity", inTrackGap ? "0" : "1");
      if (markedIndex !== observation.index) {
        markedIndex = observation.index;
        for (const [index, mark] of marks.entries()) {
          const selected = index === markedIndex;
          mark.button.setAttribute("aria-pressed", String(selected));
          mark.ring.classList.toggle("selected", selected);
        }
      }
    } else {
      const [lower, upper] = event.evidence.band;
      const y = geometry.y((lower + upper) / 2);
      for (const rect of [highlight, detail]) {
        rect.setAttribute("y", geometry.y(upper));
        rect.setAttribute("height", geometry.y(lower) - geometry.y(upper));
      }
      cursor.setAttribute("y1", y);
      cursor.setAttribute("y2", y);
      beam.setAttribute("cy", y);
      echo.setAttribute("cy", y);
      echo.setAttribute("r", 8 + response * 23);
    }
  }

  const unsubscribe = session.subscribe(render);
  const resize = new ResizeObserver(([entry]) => {
    const next = entry.contentRect.width < 650;
    if (!entry.contentRect.width || next === compact) return;
    compact = next;
    refresh();
  });
  resize.observe(root);

  function refresh() {
    axis = undefined;
    render(session.snapshot());
  }

  return { refresh, dispose() { resize.disconnect(); unsubscribe(); } };
}
