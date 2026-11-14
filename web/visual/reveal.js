const svgNamespace = "http://www.w3.org/2000/svg";
const icons = new Map([
  ["correct", "✓"],
  ["incorrect", "×"],
  ["missed", "–"],
]);

// The caller supplies resolved public outcomes, current grid bounds and a
// localized label for each cell. Mount labels in the visible evidence layer.
export function renderReveal(document, result, formatLabel, bounds) {
  const layer = document.createElementNS(svgNamespace, "g");
  layer.setAttribute("class", "decode-reveal-markers");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("pointer-events", "none");
  layer.setAttribute("focusable", "false");

  const labels = document.createElement("ul");
  labels.className = "decode-reveal-labels";

  if (result?.phase !== "reveal") return { layer, labels };
  const { outcomes } = result;
  const { rows, cols } = bounds ?? {};
  if (!Array.isArray(outcomes) || typeof formatLabel !== "function" ||
      !Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) {
    return { layer, labels };
  }

  // Reject the batch before drawing or formatting any partial result.
  const seen = new Set();
  for (const entry of outcomes) {
    const { row, col, outcome } = entry ?? {};
    if (!Number.isInteger(row) || row < 0 || row >= rows ||
        !Number.isInteger(col) || col < 0 || col >= cols || !icons.has(outcome)) {
      return { layer, labels };
    }
    const index = row * cols + col;
    if (seen.has(index)) return { layer, labels };
    seen.add(index);
  }

  for (const { row, col, outcome } of outcomes) {
    const marker = document.createElementNS(svgNamespace, "text");
    marker.setAttribute("x", String(col + 0.5));
    marker.setAttribute("y", String(row + 0.5));
    marker.setAttribute("text-anchor", "middle");
    marker.setAttribute("dominant-baseline", "central");
    marker.setAttribute("class", `decode-reveal-${outcome}`);
    marker.textContent = icons.get(outcome);
    layer.append(marker);

    const label = document.createElement("li");
    label.textContent = formatLabel(outcome, row, col);
    labels.append(label);
  }

  return { layer, labels };
}
