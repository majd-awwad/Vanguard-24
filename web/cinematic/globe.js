import { renderReveal } from "../visual/reveal.js";
import { sanitizeOutcomes } from "./overlay.js";

const GLYPHS = { correct: "✓", incorrect: "×", missed: "–" };
const KEY_PARTS = [["correct", "reveal.selection.correct"], ["incorrect", "reveal.selection.false"], ["missed", "reveal.selection.missed"]];

/**
 * Builds a MountDecodeVisual that connects the shared Decode session to the page's cinematic scene. The scene (one
 * fixed canvas behind the page) is created by the page, so the hero Earth exists before any case has loaded; this
 * mount only feeds it the public snapshot, the case's geography and the reveal outcomes, and places the outcome key
 * and the particle caption. Without a scene (no WebGL, or context lost) it mounts `fallback`, the flat SVG visual.
 */
export function createGlobeMount({ scene = null, fallback, captionFor = () => "", onLost = () => {} } = {}) {
  if (typeof fallback !== "function") throw new TypeError("createGlobeMount needs a fallback visual mount.");

  return function mountGlobeVisual(root, session, options = {}) {
    const document = root.ownerDocument;
    const stage = root.parentElement;

    const useFallback = () => {
      if (stage?.dataset) stage.dataset.renderer = "svg";
      return fallback(root, session, options);
    };
    if (!scene) return useFallback();

    if (stage?.dataset) stage.dataset.renderer = "webgl";
    scene.setStage(stage?.querySelector("#decode-grid") ?? stage);

    const bottom = stage?.closest("#decode-map")?.querySelector(".decode-map-bottom");
    // The shared map key says teal cells reached the threshold, which would contradict outcome colours here,
    // so this page supplies its own key (glyph plus the same translated label the evidence list uses).
    const key = document.createElement("p");
    key.className = "cinematic-key";
    key.hidden = true;
    key.setAttribute("aria-hidden", "true");
    for (const [outcome, messageKey] of KEY_PARTS) {
      const item = document.createElement("span");
      item.className = "cinematic-key-" + outcome;
      item.textContent = GLYPHS[outcome] + " " + String(options.t?.(messageKey) ?? "").replace(/\.$/, "");
      key.append(item);
    }
    const caption = document.createElement("p");
    caption.className = "cinematic-caption";
    caption.hidden = true;
    bottom?.append(key, caption);

    let snapshot = session.getState();
    let revealOutcomes = [];
    let pendingReveal;
    let mountedLabels;
    let disposed = false;

    const geographyFor = (next) => (options.geography && options.geography.caseId === next.caseId ? options.geography : null);

    function showReveal(next) {
      const revealed = next.phase === "reveal" && revealOutcomes.length > 0;
      key.hidden = !revealed;
      caption.hidden = next.phase !== "reveal";
      if (!caption.hidden) caption.textContent = captionFor();
    }

    function clearReveal() {
      pendingReveal = undefined;
      revealOutcomes = [];
      scene.clearOutcomes();
      mountedLabels?.remove();
      mountedLabels = undefined;
      key.hidden = true;
    }

    function prepareReveal() {
      if (disposed || snapshot.phase !== "reveal") return null;
      clearReveal();
      const apply = (outcomes, evidenceRoot, formatLabel) => {
        if (pendingReveal !== apply) return false;
        if (!evidenceRoot || evidenceRoot.closest("[inert], [aria-hidden='true']") || root.contains(evidenceRoot)) {
          pendingReveal = undefined;
          return false;
        }
        const { rows, cols } = snapshot.grid;
        const clean = sanitizeOutcomes(outcomes, rows, cols);
        pendingReveal = undefined;
        if (!clean.length) return false;
        // The labelled list is the accessible form of the same outcomes; the 3D marks are decoration.
        const { labels } = renderReveal(document, { phase: "reveal", outcomes: clean }, formatLabel, { rows, cols });
        if (!labels.childElementCount) return false;
        evidenceRoot.append(labels);
        mountedLabels = labels;
        revealOutcomes = clean;
        scene.setOutcomes(clean);
        showReveal(snapshot);
        return true;
      };
      pendingReveal = apply;
      return apply;
    }

    function render(next) {
      if (disposed) return;
      const gridChanged = next.caseId !== snapshot.caseId || next.level !== snapshot.level ||
        next.grid.rows !== snapshot.grid.rows || next.grid.cols !== snapshot.grid.cols;
      if (gridChanged || next.phase !== "reveal") {
        pendingReveal = undefined;
        if (revealOutcomes.length) clearReveal();
      }
      snapshot = next;
      scene.setGeography(geographyFor(next));
      scene.setSnapshot(next);
      showReveal(next);
    }

    let impl;
    function teardown() {
      disposed = true;
      unsubscribe();
      key.remove();
      caption.remove();
      mountedLabels?.remove();
      scene.clearOutcomes();
      scene.setStage(null);
      if (stage?.dataset) delete stage.dataset.renderer;
    }

    // Context loss: hand the stage back to the flat SVG visual so the page keeps working.
    scene.onLost(() => {
      if (disposed) return;
      teardown();
      onLost();
      impl = { handle: useFallback() };
    });

    const unsubscribe = session.subscribe(render);
    impl = { prepareReveal, clearReveal, dispose: () => { if (!disposed) teardown(); } };
    return {
      prepareReveal: () => (impl.handle ? impl.handle.prepareReveal?.() : impl.prepareReveal()) ?? null,
      clearReveal: () => (impl.handle ? impl.handle.clearReveal?.() : impl.clearReveal()),
      dispose: () => (impl.handle ? impl.handle.dispose?.() : impl.dispose()),
    };
  };
}
