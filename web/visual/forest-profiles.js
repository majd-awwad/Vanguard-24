import { svg } from "./atlas-map.js";

export function mountProfiles(panel, session) {
  const { edges, footprints } = session.data;
  const lower = edges[0], upper = edges.at(-1);
  const ceiling = Math.max(...footprints.flatMap(shot => shot.profile.filter(Number.isFinite)));
  const strip = panel.querySelector("#profile-strip");
  const height = 100, top = 6, bottom = 92;
  const y = h => top + (upper - h) / (upper - lower) * (bottom - top);
  const profiles = footprints.map((shot) => {
    const unit = document.createElement("div");
    unit.className = "profile-panel";
    const chart = svg("svg", { viewBox: `0 0 100 ${height}`, focusable: "false" });
    const selectedBand = svg("rect", { class: "profile-band", x: 9, width: 77 });
    chart.append(selectedBand, svg("line", { class: "profile-ground", x1: 9, x2: 86, y1: y(0), y2: y(0) }));
    shot.profile.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      chart.append(svg("rect", {
        x: 12, y: y(edges[index + 1]), width: value / ceiling * 65,
        height: y(edges[index]) - y(edges[index + 1]), class: "profile-return",
      }));
    });
    const caption = document.createElement("bdi");
    unit.append(chart, caption);
    strip.append(unit);
    return { unit, selectedBand, caption, index: shot.index, id: shot.id };
  });
  panel.hidden = false;
  let signature;
  function render({ selection, event, observation, inTrackGap }) {
    const band = selection.axis === "horizontal" ? selection.bandM : event.evidence.band;
    const key = [band.join(","), observation.id, inTrackGap].join("|");
    if (key === signature) return;
    signature = key;
    for (const { unit, selectedBand, id } of profiles) {
      unit.classList.toggle("current", id === observation.id && !inTrackGap);
      selectedBand.setAttribute("y", y(band[1]));
      selectedBand.setAttribute("height", y(band[0]) - y(band[1]));
    }
  }
  const unsubscribe = session.subscribe(render);
  function refresh() {
    const index = new Intl.NumberFormat(document.documentElement.lang, { minimumIntegerDigits: 2 });
    for (const { caption, index: position } of profiles) caption.textContent = index.format(position + 1);
  }
  refresh();
  return { refresh, dispose: unsubscribe };
}
