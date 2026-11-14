// Tiny element builder shared by the site pages. Text always goes through textContent, never innerHTML.
export function h(document, tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    // ARIA states are strings: aria-pressed="true", never an empty attribute.
    if (key.startsWith("aria-") && typeof value === "boolean") { node.setAttribute(key, String(value)); continue; }
    if (value == null || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else if (key === "style") node.style.cssText = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) if (child != null) node.append(child);
  return node;
}

/** A badge that says what kind of content a block is: real data, related NASA visualization, or decorative. */
export function badge(document, kind, label) {
  return h(document, "span", { class: "badge badge-" + kind, text: label });
}
