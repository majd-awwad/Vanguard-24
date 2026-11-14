// An accessible grid of cell buttons used as the selection surface over a map (roving tabindex, arrow keys).
// Geography never mirrors: ArrowLeft always means west and ArrowRight east, in Arabic too.
import { cellId } from "./cells.js";
import { h } from "./dom.js";

const STEPS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

export function mountCellGrid(document, host, { rows, cols, label, describe, onChoose, helpId }) {
  host.replaceChildren();
  host.setAttribute("role", "grid");
  host.setAttribute("aria-label", label);
  host.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  host.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  const buttons = [];
  for (let row = 0; row < rows; row++) {
    const rowNode = h(document, "div", { class: "xp-row", role: "row" });
    for (let col = 0; col < cols; col++) {
      const button = h(document, "button", {
        type: "button", role: "gridcell", class: "xp-cell", tabindex: row === 0 && col === 0 ? "0" : "-1", "aria-selected": false,
        "aria-label": describe(row, col), "aria-describedby": helpId, "data-row": row, "data-col": col,
      }, h(document, "span", { "aria-hidden": "true", text: cellId(row, col) }));
      (buttons[row] ??= [])[col] = button;
      rowNode.append(button);
    }
    host.append(rowNode);
  }
  const focusCell = (row, col) => {
    for (const line of buttons) for (const button of line) button.tabIndex = -1;
    buttons[row][col].tabIndex = 0;
    buttons[row][col].focus();
  };
  host.addEventListener("click", (event) => {
    const button = event.target.closest(".xp-cell");
    if (button) onChoose(Number(button.dataset.row), Number(button.dataset.col));
  });
  host.addEventListener("keydown", (event) => {
    const button = event.target.closest(".xp-cell");
    if (!button) return;
    let row = Number(button.dataset.row);
    let col = Number(button.dataset.col);
    if (STEPS[event.key]) {
      row = Math.max(0, Math.min(rows - 1, row + STEPS[event.key][0]));
      col = Math.max(0, Math.min(cols - 1, col + STEPS[event.key][1]));
    } else if (event.key === "Home") col = 0;
    else if (event.key === "End") col = cols - 1;
    else return;
    event.preventDefault();
    focusCell(row, col);
  });
  return {
    buttons,
    focusCell,
    /** roles: { a: [row, col] | null, b: [row, col] | null } */
    setSelected({ a, b }) {
      buttons.forEach((line, row) => line.forEach((button, col) => {
        const isA = a && a[0] === row && a[1] === col;
        const isB = b && b[0] === row && b[1] === col;
        button.setAttribute("aria-selected", String(Boolean(isA || isB)));
        if (isA) button.dataset.role = "a"; else if (isB) button.dataset.role = "b"; else delete button.dataset.role;
      }));
    },
  };
}
