const arrowSteps = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

const heardCategories = new Set(["low", "mid", "high", "silent"]);
const arabicShortcutKeys = { KeyP: "p", KeyL: "l", KeyR: "r", KeyS: "s" };
const scoreFields = ["hits", "misses", "falseAlarms", "nearHits"];
const positionKey = ([row, col]) => `${row}:${col}`;

function setAttribute(element, name, value) {
  const text = String(value);
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}

export function mountDecodeGrid(root, session, { t }) {
  const document = root.ownerDocument;
  const status = document.getElementById("decode-status");
  let current;
  let buttons = [];
  let disposed = false;
  let revealedScore;
  let revealedNote;
  let revealAnnouncement;

  const announce = (key, params) => {
    if (status) status.textContent = t(key, params);
  };

  function coordinates(button) {
    if (!button?.dataset) return null;
    const row = Number(button?.dataset?.row);
    const col = Number(button?.dataset?.col);
    return buttons[row]?.[col] === button ? { row, col } : null;
  }

  function buildRows(rows, cols) {
    buttons = [];
    const elements = [];
    for (let row = 0; row < rows; row += 1) {
      const element = document.createElement("div");
      element.className = "dg-row";
      element.setAttribute("role", "row");
      const cells = [];
      for (let col = 0; col < cols; col += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dg-cell";
        button.setAttribute("role", "gridcell");
        button.dataset.row = String(row);
        button.dataset.col = String(col);
        cells.push(button);
      }
      element.append(...cells);
      elements.push(element);
      buttons.push(cells);
    }
    root.replaceChildren(...elements);
  }

  function renderReveal(snapshot, previous) {
    if (!status) return;
    const sameReveal = snapshot.phase === "reveal" && previous?.phase === "reveal" &&
      snapshot.caseId === previous.caseId && snapshot.level === previous.level && snapshot.mode === previous.mode;
    if (!sameReveal) {
      if (revealAnnouncement && status.textContent === revealAnnouncement) status.textContent = "";
      revealedScore = undefined;
      revealedNote = undefined;
      revealAnnouncement = undefined;
    }
    if (snapshot.phase !== "reveal") return;

    const parts = [];
    if (previous?.phase === "decode" && snapshot.mode === "discovery") parts.push(t("grid.submitted"));

    const counts = scoreFields.map((field) => snapshot.score?.[field]);
    if (counts.every(Number.isFinite)) {
      const signature = counts.join(":");
      if (signature !== revealedScore) {
        const params = Object.fromEntries(scoreFields.map((field, index) => [field, counts[index]]));
        parts.push(t("reveal.scoreSummary", params));
        revealedScore = signature;
      }
    }

    const note = snapshot.visualLink?.note;
    if (typeof note === "string" && note.trim() && note !== revealedNote) {
      parts.push(note);
      revealedNote = note;
    }
    if (parts.length) {
      revealAnnouncement = parts.join(" ");
      status.textContent = revealAnnouncement;
    }
  }

  function render(snapshot) {
    const previous = current;
    const { rows, cols } = snapshot.grid;
    const [focusRow, focusCol] = snapshot.focus;
    const activeCell = coordinates(document.activeElement);
    const resized = !previous || previous.grid.rows !== rows || previous.grid.cols !== cols;
    const focusChanged = !previous || positionKey(previous.focus) !== positionKey(snapshot.focus);
    current = snapshot;

    if (resized) buildRows(rows, cols);
    setAttribute(root, "aria-label", t("stage.decode"));
    setAttribute(root, "data-rows", rows);
    setAttribute(root, "data-cols", cols);

    const selected = new Set(snapshot.guesses.map(positionKey));
    for (const [row, cells] of buttons.entries()) {
      for (const [col, button] of cells.entries()) {
        setAttribute(button, "tabindex", row === focusRow && col === focusCol ? 0 : -1);
        setAttribute(button, "aria-pressed", selected.has(positionKey([row, col])));
        setAttribute(button, "aria-label", t("grid.position", { row: row + 1, col: col + 1 }));
      }
    }

    if (activeCell && (resized || focusChanged)) {
      const target = buttons[focusRow]?.[focusCol];
      if (target && target !== document.activeElement) target.focus();
      if (focusChanged) announce("grid.focused", { row: focusRow + 1, col: focusCol + 1 });
    }

    renderReveal(snapshot, previous);

    if (previous?.phase === "decode" && snapshot.phase === "decode" &&
      previous.caseId === snapshot.caseId && previous.level === snapshot.level) {
      const before = new Set(previous.guesses.map(positionKey));
      const added = snapshot.guesses.filter((guess) => !before.has(positionKey(guess)));
      const removed = previous.guesses.filter((guess) => !selected.has(positionKey(guess)));
      if (added.length + removed.length === 1) {
        const [row, col] = added[0] ?? removed[0];
        announce(added.length ? "grid.selected" : "grid.deselected", { row: row + 1, col: col + 1 });
      }
    }
  }

  function onFocus(event) {
    const position = coordinates(event.target);
    if (position && (position.row !== current.focus[0] || position.col !== current.focus[1])) {
      session.dispatch({ type: "focus", ...position });
    }
  }

  function toggle(position) {
    if (current.phase !== "reveal") session.dispatch({ type: "toggle", ...position });
  }

  function onClick(event) {
    const position = coordinates(event.target);
    if (position && !event.defaultPrevented) toggle(position);
  }

  function readFocusedCell(row, col) {
    const probe = current.lastProbe;
    const lastProbe = probe?.row === row && probe?.col === col && heardCategories.has(probe.heard)
      ? { row, col, heard: probe.heard }
      : null;
    // v2 provides no renderer-facing unit. Use the safe qualitative readout in every phase.
    announce("discovery.cellReadout", { row, col, lastProbe });
  }

  function onKeyDown(event) {
    if (!coordinates(event.target) || event.defaultPrevented || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey) return;

    const key = /\p{Script=Arabic}/u.test(event.key)
      ? arabicShortcutKeys[event.code]
      : event.key.toLowerCase();
    const [row, col] = current.focus;
    if (Object.hasOwn(arrowSteps, event.key)) {
      event.preventDefault();
      const [rowStep, colStep] = arrowSteps[event.key];
      const nextRow = row + rowStep;
      const nextCol = col + colStep;
      if (buttons[nextRow]?.[nextCol]) session.dispatch({ type: "focus", row: nextRow, col: nextCol });
      return;
    }

    if (![" ", "enter", "p", "l", "r", "s"].includes(key)) return;
    event.preventDefault();
    if (event.repeat) return;

    switch (key) {
      case " ":
        toggle({ row, col });
        break;
      case "enter":
        announce("grid.probeRequested", { row: row + 1, col: col + 1 });
        session.dispatch({ type: "probe", row, col });
        break;
      case "p":
        announce("listen.start");
        session.dispatch({ type: "play", mode: "sweep" });
        break;
      case "l":
        announce("stage.legend");
        session.dispatch({ type: "play", mode: "legend" });
        break;
      case "r":
        readFocusedCell(row, col);
        break;
      case "s":
        if (current.mode === "discovery" && current.phase === "decode") session.dispatch({ type: "submit" });
        break;
    }
  }

  function onKeyUp(event) {
    // Space is handled on keydown. Suppress the button's native keyup click.
    if (event.key === " " && coordinates(event.target)) event.preventDefault();
  }

  root.setAttribute("role", "grid");
  render(session.getState());
  root.addEventListener("focusin", onFocus);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("keyup", onKeyUp);
  const unsubscribe = session.subscribe(render);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("keyup", onKeyUp);
      root.replaceChildren();
      for (const name of ["role", "aria-label", "data-rows", "data-cols"]) root.removeAttribute(name);
      if (status) status.textContent = "";
    },
  };
}
