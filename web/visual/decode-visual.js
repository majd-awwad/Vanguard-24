import { drawDustMapBase } from "./dust-basemap.js";
import { renderReveal } from "./reveal.js";

const stages = ["intro", "legend", "listen", "decode", "reveal"];

const svgNamespace = "http://www.w3.org/2000/svg";
const highlightContexts = new WeakMap();

export function getDecodeStep(phase) {
  return stages.indexOf(phase);
}

// Supply a visible mount and map each phase to an agreed translation key.
// The intro key should resolve to Explore in English.
export function createDecodeProgress(document, phase, { label, keys, t }) {
  const list = document.createElement("ol");
  list.className = "decode-progress";
  list.setAttribute("aria-label", label);
  const current = getDecodeStep(phase);

  for (const [index, stage] of stages.entries()) {
    const item = document.createElement("li");
    item.textContent = t(keys[stage]);
    if (index < current) item.className = "decode-progress-complete";
    if (index === current) item.setAttribute("aria-current", "step");
    list.append(item);
  }

  return list;
}

// Project WGS84 coordinates into the SVG viewBox (0, 0, cols, rows).
// Bounds must be ordered and non-wrapping. Clip geometry separately.
export function projectPlateCarree({ lon, lat }, { west, east, north, south }, { cols, rows }) {
  return {
    x: (lon - west) / (east - west) * cols,
    y: (north - lat) / (north - south) * rows,
  };
}

function svgElement(document, name, attributes) {
  const element = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

// Draw a resolved cell for the current plan in SVG grid coordinates.
// The caller supplies the cell, or null when there is no active cell.
export function drawPlaybackHighlight(layer, cell) {
  const [row, col] = Array.isArray(cell) ? cell : [];
  const bounds = highlightContexts.get(layer);
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 ||
      (bounds && (row >= bounds.rows || col >= bounds.cols))) {
    layer.replaceChildren();
    return;
  }

  layer.replaceChildren(svgElement(layer.ownerDocument, "rect", {
    x: col + 0.08,
    y: row + 0.08,
    width: 0.84,
    height: 0.84,
    "vector-effect": "non-scaling-stroke",
  }));
}

/** @satisfies {import("../contracts/decode.d.ts").MountDecodeVisual} */
export const mountDecodeVisual = (root, session, { geography }) => {
  const document = root.ownerDocument;
  const svg = svgElement(document, "svg", {
    class: "decode-map",
    "aria-hidden": "true",
    focusable: "false",
    direction: "ltr",
    "pointer-events": "none",
    preserveAspectRatio: "none",
  });
  const gridLayer = svgElement(document, "g", { class: "decode-map-grid" });
  const geographyLayer = svgElement(document, "g", { class: "decode-map-geography" });
  const highlightLayer = svgElement(document, "g", {
    class: "decode-map-highlight",
    "aria-hidden": "true",
    "pointer-events": "none",
  });
  svg.append(geographyLayer, gridLayer, highlightLayer);
  root.append(svg);

  let disposed = false;
  let phase;
  let pendingReveal;
  let mountedReveal;
  let coastlineVisible = false;
  let highlightedCell;

  function clearReveal() {
    pendingReveal = undefined;
    mountedReveal?.layer.remove();
    mountedReveal?.labels.remove();
    mountedReveal = undefined;
  }

  // Take a one-shot callback before requesting approved outcomes. Integrators
  // can also clear explicitly on reset if the session does not publish a phase exit.
  function prepareReveal() {
    if (disposed || phase !== "reveal") return null;
    clearReveal();
    const bounds = highlightContexts.get(highlightLayer);
    const apply = (outcomes, evidenceRoot, formatLabel) => {
      if (pendingReveal !== apply) return false;
      if (!evidenceRoot || evidenceRoot.closest("[inert], [aria-hidden='true']") || root.contains(evidenceRoot)) {
        pendingReveal = undefined;
        return false;
      }
      const presentation = renderReveal(document, { phase, outcomes }, formatLabel, bounds);
      if (pendingReveal !== apply) return false;
      pendingReveal = undefined;
      if (!presentation.labels.childElementCount) return false;
      svg.append(presentation.layer);
      evidenceRoot.append(presentation.labels);
      mountedReveal = presentation;
      return true;
    };
    pendingReveal = apply;
    return apply;
  }

  function render({ phase: nextPhase, caseId, level, planRevision, grid, activeCell }) {
    if (disposed) return;
    const { rows, cols } = grid;
    const previous = highlightContexts.get(highlightLayer);
    // Compare dimensions too for callers that supply only grid geometry.
    const gridChanged = previous && (previous.caseId !== caseId || previous.level !== level ||
      previous.rows !== rows || previous.cols !== cols);
    if (gridChanged || nextPhase !== "reveal") clearReveal();
    phase = nextPhase;
    const planChanged = gridChanged || (previous && previous.planRevision !== planRevision);
    highlightContexts.set(highlightLayer, { caseId, level, planRevision, rows, cols });
    if (!previous || gridChanged) {
      svg.setAttribute("viewBox", `0 0 ${cols} ${rows}`);
      const cells = grid.cells.map(({ row, col }) => svgElement(document, "rect", {
        x: col,
        y: row,
        width: 1,
        height: 1,
        fill: "none",
        "vector-effect": "non-scaling-stroke",
      }));
      gridLayer.replaceChildren(...cells);
    }
    const matchesGeography = geography?.projection === "plate-carree" && geography.caseId === caseId;
    if (coastlineVisible !== matchesGeography) {
      geographyLayer.replaceChildren();
      if (matchesGeography) drawDustMapBase(geographyLayer, geography.bounds, { imagery: true });
      coastlineVisible = matchesGeography;
    }
    if (coastlineVisible && (!previous || gridChanged)) {
      geographyLayer.setAttribute("transform", `scale(${cols} ${rows})`);
    }

    // The renderer session resolves case and plan revision before publishing activeCell.
    const [row, col] = Array.isArray(activeCell) ? activeCell : [];
    if (planChanged || highlightedCell?.[0] !== row || highlightedCell?.[1] !== col) {
      drawPlaybackHighlight(highlightLayer, activeCell);
      highlightedCell = [row, col];
    }
  }

  render(session.getState());
  const unsubscribe = session.subscribe(render);

  return {
    prepareReveal,
    clearReveal,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearReveal();
      unsubscribe();
      drawPlaybackHighlight(highlightLayer, null);
      svg.remove();
    },
  };
};
