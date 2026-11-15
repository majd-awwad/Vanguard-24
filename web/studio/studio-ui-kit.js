import { h } from "../cinematic/site/dom.js";

// Small shared pieces for the tool panels: a designed state box (idle, loading, empty, unavailable, error) and an info icon.
const svg = (body) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const STATE_ICON = {
  idle: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  loading: svg('<path d="M12 3a9 9 0 1 0 9 9" />'),
  empty: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>'),
  unavailable: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  error: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>'),
};

/** kind: idle | loading | empty | unavailable | error. One sentence and up to two actions. */
export function stateBox(document, kind, text, actions = []) {
  const icon = h(document, "span", { class: "st-state-icon", "aria-hidden": "true" });
  icon.innerHTML = STATE_ICON[kind];
  return h(document, "div", { class: "st-state", "data-kind": kind, role: kind === "error" ? "alert" : "status", "aria-live": "polite" }, icon, h(document, "p", { text }), ...(actions.length ? [h(document, "div", { class: "st-state-actions" }, ...actions)] : []));
}

/** A focusable info icon whose text opens as a tooltip (hover and keyboard focus). */
export function infoIcon(document, text) {
  const button = h(document, "button", { type: "button", class: "st-info", "aria-label": text, "data-tip": text, "data-tip-pos": "below" });
  button.innerHTML = svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>');
  return button;
}
