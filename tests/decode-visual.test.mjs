import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderReveal } from "../web/visual/reveal.js";
import { createDecodeProgress, drawPlaybackHighlight, getDecodeStep, mountDecodeVisual, projectPlateCarree } from "../web/visual/decode-visual.js";

class Element {
  constructor(name) {
    this.name = name;
    this.ownerDocument = document;
    this.attributes = {};
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  append(...children) {
    for (const child of children) child.parent = this;
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = undefined;
    }
  }

  get childElementCount() {
    return this.children.length;
  }

  contains(element) {
    return this === element || this.children.some((child) => child.contains(element));
  }

  closest() {
    return null;
  }
}

const document = {
  createElement: (name) => new Element(name),
  createElementNS: (_namespace, name) => new Element(name),
};

const dustCaseId = "dust-geos-fp-20250819-1930-north-africa-med";
const dustBounds = { north: 45, south: 15, east: 50, west: -20 };

function fixture(rows, cols) {
  return {
    mode: "discovery",
    phase: "decode",
    grid: {
      rows,
      cols,
      cells: Array.from({ length: rows * cols }, (_, index) => ({
        row: Math.floor(index / cols),
        col: index % cols,
      })),
    },
  };
}

test("Test data: browser grid buttons align with the SVG in both directions and at text zoom", {
  skip: !process.env.EARTHPULSE_PLAYWRIGHT && !process.env.EARTHPULSE_BROWSER &&
    "Set EARTHPULSE_PLAYWRIGHT or EARTHPULSE_BROWSER to run browser layout checks",
}, async (t) => {
  const browserModule = process.env.EARTHPULSE_PLAYWRIGHT;
  const playwright = await import(browserModule ? pathToFileURL(browserModule).href : "playwright");
  const browser = await (playwright.chromium ?? playwright.default.chromium).launch({
    executablePath: process.env.EARTHPULSE_BROWSER,
    headless: true,
    args: ["--disable-gpu", "--in-process-gpu"],
  });

  try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    const web = new URL("../web/", import.meta.url);
    await page.route("http://earthpulse.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname.slice(1);
      switch (path) {
        case "decode.html":
        case "visual/platform.css":
        case "visual/decode.css":
        case "visual/decode-visual.js":
        case "visual/reveal.js":
        case "assets/fonts/instrument-sans.woff2":
          await route.fulfill({ path: fileURLToPath(new URL(path, web)) });
          break;
        default:
          await route.abort();
      }
    });

    let largestEdgeError = 0;
    let largestProjectionError = 0;
    let visibleMarkers = 0;
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const direction of ["ltr", "rtl"]) {
        for (const zoom of [100, 200]) {
          for (const [rows, cols] of [[3, 4], [6, 8]]) {
            for (const grouped of [false, true]) {
              const scenario = `${rows}x${cols}, ${width}px, ${direction}, ${zoom}% text, grouped=${grouped}`;
              await page.goto("http://earthpulse.test/decode.html");
              await page.addStyleTag({ url: "/visual/decode.css" });
              const snapshot = { ...fixture(rows, cols), caseId: dustCaseId };
              await page.evaluate(async ({ snapshot, direction, zoom, grouped }) => {
                const { mountDecodeVisual } = await import("/visual/decode-visual.js");
                const grid = document.querySelector("#decode-grid");
                const rtl = direction === "rtl";
                document.documentElement.dir = direction;
                document.documentElement.lang = rtl ? "ar" : "en";
                document.documentElement.style.fontSize = `${zoom}%`;
                document.body.style.fontSize = "1rem";
                document.querySelector("h1 + p").textContent = "Test data";
                grid.setAttribute("role", "grid");
                grid.setAttribute("aria-label", "Test data");
                const rowParent = grouped ? document.createElement("div") : grid;
                if (grouped) {
                  rowParent.setAttribute("role", "rowgroup");
                  grid.append(rowParent);
                }
                const { rows, cols } = snapshot.grid;
                for (let row = 0; row < rows; row++) {
                  const rowElement = document.createElement("div");
                  rowElement.setAttribute("role", "row");
                  rowParent.append(rowElement);
                  for (let col = 0; col < cols; col++) {
                    const cell = document.createElement("div");
                    cell.setAttribute("role", "gridcell");
                    const button = document.createElement("button");
                    button.className = "dg-cell";
                    button.dataset.row = row;
                    button.dataset.col = col;
                    button.tabIndex = row === 0 && col === 0 ? 0 : -1;
                    button.setAttribute("aria-pressed", "false");
                    button.textContent = row === 1 && col === 0
                      ? (rtl ? "خلية ذات تسمية طويلة تلتف على أسطر متعددة" : "Long cell label that wraps across several lines")
                      : String(col + 1);
                    cell.append(button);
                    rowElement.append(cell);
                  }
                }
                const stage = document.querySelector("#decode-stage");
                const mount = mountDecodeVisual(document.querySelector("#decode-visual"), {
                  getState: () => ({ ...snapshot, phase: "reveal" }),
                  subscribe: () => () => {},
                }, { t: (key) => key });
                if (zoom === 100 && !grouped) {
                  const evidence = document.createElement("section");
                  stage.after(evidence);
                  const labels = rtl ? ["صحيح", "خطأ", "فائت"] : ["Correct", "Incorrect", "Missed"];
                  const outcomes = ["correct", "incorrect", "missed"].map((outcome, col) => ({ row: 0, col, outcome }));
                  if (!mount.prepareReveal()(outcomes, evidence, (_outcome, _row, col) => labels[col])) {
                    throw new Error("Test Reveal failed to mount");
                  }
                }
              }, { snapshot, direction, zoom, grouped });

              const first = page.locator(".dg-cell").first();
              await page.evaluate(() => document.fonts.ready.then(() => {}));
              await first.scrollIntoViewIfNeeded();
              const audit = await page.evaluate(async (bounds) => {
                const { projectPlateCarree } = await import("/visual/decode-visual.js");
                const buttons = [...document.querySelectorAll(".dg-cell")];
                const visual = document.querySelector("#decode-visual");
                const svg = visual.querySelector("svg");
                const matrix = svg.getScreenCTM();
                const { width: cols, height: rows } = svg.viewBox.baseVal;
                const viewport = svg.getBoundingClientRect();
                const cornerError = Math.max(...[
                  [bounds.west, bounds.north, viewport.left, viewport.top],
                  [bounds.east, bounds.north, viewport.right, viewport.top],
                  [bounds.west, bounds.south, viewport.left, viewport.bottom],
                  [bounds.east, bounds.south, viewport.right, viewport.bottom],
                ].map(([lon, lat, screenX, screenY]) => {
                  const { x, y } = projectPlateCarree({ lon, lat }, bounds, { rows, cols });
                  const screen = new DOMPoint(x, y).matrixTransform(matrix);
                  return Math.max(Math.abs(screen.x - screenX), Math.abs(screen.y - screenY));
                }));
                const svgCells = [...svg.querySelectorAll(".decode-map-grid > rect")];
                const maxEdgeError = Math.max(...buttons.map((button, index) => {
                  const bounds = button.getBoundingClientRect();
                  const cell = svgCells[index];
                  const x = cell.x.baseVal.value;
                  const y = cell.y.baseVal.value;
                  const topLeft = new DOMPoint(x, y).matrixTransform(matrix);
                  const bottomRight = new DOMPoint(x + 1, y + 1).matrixTransform(matrix);
                  return Math.max(Math.abs(bounds.left - topLeft.x), Math.abs(bounds.top - topLeft.y),
                    Math.abs(bounds.right - bottomRight.x), Math.abs(bounds.bottom - bottomRight.y));
                }));
                const west = buttons[0].getBoundingClientRect();
                const east = buttons[1].getBoundingClientRect();
                return {
                  maxEdgeError,
                  cornerError,
                  noOverflow: document.documentElement.scrollWidth === innerWidth,
                  direction: getComputedStyle(buttons[0]).direction,
                  westToEast: west.left < east.left && matrix.a > 0,
                  pointerTransparent: [visual, svg, ...svgCells, ...svg.querySelectorAll("text")]
                    .every((node) => getComputedStyle(node).pointerEvents === "none"),
                  inert: visual.inert && visual.getAttribute("aria-hidden") === "true" && svg.getAttribute("focusable") === "false",
                  hit: document.elementFromPoint(west.x + west.width / 2, west.y + west.height / 2) === buttons[0],
                };
              }, dustBounds);
              largestEdgeError = Math.max(largestEdgeError, audit.maxEdgeError);
              largestProjectionError = Math.max(largestProjectionError, audit.cornerError);
              assert.ok(audit.maxEdgeError <= 0.5, `${scenario}: largest edge error ${audit.maxEdgeError}px`);
              assert.ok(audit.cornerError <= 0.5, `${scenario}: dust corner projection error ${audit.cornerError}px`);
              assert.equal(audit.direction, direction, scenario);
              for (const check of ["noOverflow", "westToEast", "pointerTransparent", "inert", "hit"]) {
                assert.ok(audit[check], `${scenario}: ${check}`);
              }

              const size = () => first.evaluate((button) => {
                const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = button;
                return { offsetLeft, offsetTop, offsetWidth, offsetHeight };
              });
              const before = await size();
              await page.keyboard.press("Tab");
              await page.keyboard.press("Tab");
              assert.ok(await first.evaluate((button) => button.matches(":focus-visible") &&
                getComputedStyle(button).outlineStyle === "solid"), `${scenario}: visible keyboard focus`);
              assert.deepEqual(await size(), before, `${scenario}: focus shifted the button`);
              await first.evaluate((button) => button.setAttribute("aria-pressed", "true"));
              assert.deepEqual(await size(), before, `${scenario}: pressed state shifted the button`);
              if (zoom === 100 && !grouped) {
                const markers = page.locator(".decode-reveal-markers");
                const labels = page.locator(".decode-reveal-labels");
                const expectedLabels = direction === "rtl" ? ["صحيح", "خطأ", "فائت"] : ["Correct", "Incorrect", "Missed"];
                assert.deepEqual(await labels.locator("li").allTextContents(), expectedLabels, scenario);
                assert.equal(await labels.evaluate((list) => getComputedStyle(list).direction), direction, scenario);
                assert.equal(await markers.evaluate((group) => group.getAnimations({ subtree: true }).length), 0, scenario);
                for (let col = 0; col < 3; col++) {
                  const button = page.locator(`.dg-cell[data-row="0"][data-col="${col}"]`);
                  await button.click({ trial: true });
                  const visible = await button.screenshot();
                  await markers.evaluate((group) => { group.style.visibility = "hidden"; });
                  const hidden = await button.screenshot();
                  await markers.evaluate((group) => { group.style.visibility = ""; });
                  assert.ok(!visible.equals(hidden), `${scenario}: marker ${col} is obscured`);
                  visibleMarkers++;
                }
              }
            }
          }
        }
      }
    }
    t.diagnostic(`Largest button-to-SVG edge difference: ${largestEdgeError}px`);
    t.diagnostic(`Largest production dust bound projection error: ${largestProjectionError}px`);
    t.diagnostic(`${visibleMarkers} Reveal glyphs changed button screenshot pixels when toggled`);
  } finally {
    await browser.close();
  }
});

test("maps contract phases to five presentation steps", () => {
  const phases = ["intro", "legend", "listen", "decode", "reveal"];
  assert.deepEqual(phases.map(getDecodeStep), [0, 1, 2, 3, 4]);
  assert.equal(getDecodeStep("unknown"), -1);
  const keys = Object.fromEntries(phases.map((phase) => [phase, `test.progress.${phase}`]));
  const labels = ["Explore", "Legend", "Listen", "Decode", "Reveal"];
  const translated = new Map(phases.map((phase, index) => [keys[phase], labels[index]]));
  const list = createDecodeProgress(document, "listen", {
    label: "Decode progress",
    keys,
    t(...args) {
      assert.equal(args.length, 1);
      assert.ok(translated.has(args[0]));
      return translated.get(args[0]);
    },
  });
  assert.deepEqual(list.children.map((item) => item.textContent),
    labels);
  assert.deepEqual(list.children.filter((item) => item.attributes["aria-current"] === "step"),
    [list.children[2]]);
});

test("mounts neutral Quick geometry, updates to Advanced, and disposes once", () => {
  const root = new Element("div");
  root.ownerDocument = document;
  let update;
  let unsubscribed = 0;
  const session = {
    getState: () => fixture(3, 4),
    subscribe(listener) {
      update = listener;
      return () => { unsubscribed++; };
    },
  };
  const mount = mountDecodeVisual(root, session, { t: (key) => key });
  const [svg] = root.children;
  const [geography, grid] = svg.children;

  assert.equal(svg.attributes["aria-hidden"], "true");
  assert.equal(svg.attributes["pointer-events"], "none");
  assert.equal(svg.attributes.focusable, "false");
  assert.equal(svg.attributes.direction, "ltr");
  assert.equal(geography.attributes.class, "decode-map-geography");
  for (const [rows, cols] of [[3, 4], [6, 8]]) {
    if (rows === 6) update(fixture(rows, cols));
    assert.equal(svg.attributes.viewBox, `0 0 ${cols} ${rows}`);
    assert.equal(grid.children.length, rows * cols);
    grid.children.forEach(({ name, attributes }, index) => {
      assert.equal(name, "rect");
      assert.equal(attributes.x, String(index % cols));
      assert.equal(attributes.y, String(Math.floor(index / cols)));
    });
  }

  mount.dispose();
  mount.dispose();
  update(fixture(3, 4));
  assert.equal(unsubscribed, 1);
  assert.equal(root.children.length, 0);
  assert.equal(svg.attributes.viewBox, "0 0 8 6");
});

function guardedDiscovery(rows, cols) {
  const snapshot = fixture(rows, cols);
  function forbid(target, fields) {
    for (const field of fields) {
      Object.defineProperty(target, field, {
        get() { assert.fail(`Read hidden field ${field}`); },
      });
    }
  }
  forbid(snapshot, ["truth", "score", "visualLink", "transport"]);
  forbid(snapshot.grid, ["truth"]);
  for (const cell of snapshot.grid.cells) {
    forbid(cell, ["value", "status", "eventCount"]);
  }
  return snapshot;
}

test("Discovery emits only neutral geometry on mount and subscribed updates", () => {
  const root = new Element("div");
  root.ownerDocument = document;
  let update;
  const mount = mountDecodeVisual(root, {
    getState: () => guardedDiscovery(3, 4),
    subscribe(listener) {
      update = listener;
      return () => {};
    },
  }, { t: (key) => key });
  const [svg] = root.children;
  for (const [rows, cols] of [[3, 4], [6, 8]]) {
    if (rows === 6) update(guardedDiscovery(rows, cols));
    assert.deepEqual(root.children, [svg]);
    assert.equal(svg.name, "svg");
    assert.equal(svg.textContent, undefined);
    assert.deepEqual(svg.attributes, {
      class: "decode-map",
      "aria-hidden": "true",
      focusable: "false",
      direction: "ltr",
      "pointer-events": "none",
      preserveAspectRatio: "none",
      viewBox: `0 0 ${cols} ${rows}`,
    });
    assert.equal(svg.children.length, 3);
    const [geography, grid, highlight] = svg.children;
    assert.deepEqual(highlight.attributes, {
      class: "decode-map-highlight",
      "aria-hidden": "true",
      "pointer-events": "none",
    });
    assert.equal(highlight.children.length, 0);
    assert.equal(geography.name, "g");
    assert.deepEqual(geography.attributes, { class: "decode-map-geography" });
    assert.equal(geography.children.length, 0);
    assert.equal(geography.textContent, undefined);
    assert.equal(grid.name, "g");
    assert.deepEqual(grid.attributes, { class: "decode-map-grid" });
    assert.equal(grid.textContent, undefined);
    assert.equal(grid.children.length, rows * cols);
    grid.children.forEach((cell, index) => {
      assert.equal(cell.name, "rect");
      assert.deepEqual(cell.attributes, {
        x: String(index % cols),
        y: String(Math.floor(index / cols)),
        width: "1",
        height: "1",
        fill: "none",
        "vector-effect": "non-scaling-stroke",
      });
      assert.equal(cell.textContent, undefined);
      assert.equal(cell.children.length, 0);
    });
  }
  const lastCells = svg.children[1].children;
  mount.dispose();
  update(guardedDiscovery(3, 4));
  assert.equal(root.children.length, 0);
  assert.equal(svg.children[1].children, lastCells);
});

test("Test data: decorative playback highlight follows grid coordinates and clears", () => {
  const root = new Element("div");
  const quick = { rows: 3, cols: 4, cell: [0, 3] };
  const advanced = { rows: 6, cols: 8, cell: [5, 0] };
  let update;
  const mount = mountDecodeVisual(root, {
    getState: () => guardedDiscovery(quick.rows, quick.cols),
    subscribe(listener) {
      update = listener;
      return () => {};
    },
  }, { t: (key) => key });
  const [svg] = root.children;
  const highlight = svg.children[2];

  for (const { rows, cols, cell } of [quick, advanced]) {
    update(guardedDiscovery(rows, cols));
    assert.equal(svg.attributes.viewBox, `0 0 ${cols} ${rows}`);
    assert.equal(highlight.children.length, 0);
    drawPlaybackHighlight(highlight, cell);
    assert.equal(highlight.children.length, 1);
    const [rect] = highlight.children;
    assert.equal(rect.name, "rect");
    assert.deepEqual(rect.attributes, {
      x: String(cell[1] + 0.08),
      y: String(cell[0] + 0.08),
      width: "0.84",
      height: "0.84",
      "vector-effect": "non-scaling-stroke",
    });
    assert.equal(rect.children.length, 0);
    assert.equal(rect.textContent, undefined);
  }

  drawPlaybackHighlight(highlight, null);
  assert.equal(highlight.children.length, 0);
  drawPlaybackHighlight(highlight, advanced.cell);
  mount.dispose();
  update(guardedDiscovery(quick.rows, quick.cols));
  assert.equal(highlight.children.length, 0);
  assert.equal(root.children.length, 0);
});

function mountPlaybackFixture(initialSnapshot) {
  const root = new Element("div");
  let update;
  const { dispose } = mountDecodeVisual(root, {
    getState: () => initialSnapshot,
    subscribe(listener) {
      update = listener;
      return () => {};
    },
  }, { t: (key) => key });
  return { highlight: root.children[0].children[2], update, dispose };
}

const quickPlayback = {
  ...fixture(3, 4),
  caseId: "test-case",
  level: "quick",
  planRevision: 1,
  transport: { activeEventId: "test-event", planRevision: 1 },
};
const advancedPlayback = { ...quickPlayback, ...fixture(6, 8), level: "advanced" };

for (const [name, initial, next] of [
  ["Advanced to Quick", advancedPlayback, quickPlayback],
  ["Quick to Advanced", quickPlayback, advancedPlayback],
  ["case replacement", quickPlayback, { ...quickPlayback, caseId: "test-replacement" }],
  ["plan replacement with a reused event ID", quickPlayback, {
    ...quickPlayback,
    planRevision: 2,
    transport: { ...quickPlayback.transport, planRevision: 2 },
  }],
]) {
  test(`Test data: playback highlight clears on ${name}`, () => {
    const { highlight, update, dispose } = mountPlaybackFixture(initial);
    drawPlaybackHighlight(highlight, [0, 3]); // In bounds on both grids.
    assert.equal(highlight.children.length, 1);

    update(next);
    assert.equal(highlight.children.length, 0);
    drawPlaybackHighlight(highlight, [1, 0]);
    assert.equal(highlight.children.length, 1);
    assert.equal(highlight.children[0].attributes.y, "1.08");
    dispose();
  });
}

test("Test data: ordinary playback updates preserve a highlight until a new cell is supplied", () => {
  const { highlight, update, dispose } = mountPlaybackFixture(quickPlayback);
  drawPlaybackHighlight(highlight, [0, 3]);
  const [original] = highlight.children;

  update({
    ...quickPlayback,
    grid: fixture(3, 4).grid,
    transport: { ...quickPlayback.transport, positionS: 1 },
  });
  assert.equal(highlight.children[0], original);

  drawPlaybackHighlight(highlight, [2, 1]);
  assert.equal(highlight.children.length, 1);
  assert.equal(highlight.children[0].attributes.x, "1.08");
  assert.equal(highlight.children[0].attributes.y, "2.08");
  dispose();
});

test("Test data: a null or out-of-bounds playback cell clears the mounted highlight", () => {
  const { highlight, update, dispose } = mountPlaybackFixture(advancedPlayback);
  update(quickPlayback);

  for (const cell of [null, [-1, 0], [0, -1], [3, 0], [0, 4]]) {
    drawPlaybackHighlight(highlight, [2, 3]);
    assert.equal(highlight.children.length, 1);
    drawPlaybackHighlight(highlight, cell);
    assert.equal(highlight.children.length, 0, `Expected no highlight for ${JSON.stringify(cell)}`);
  }
  dispose();
});

test("Plate Carree maps the production dust bounds into Quick and Advanced SVG coordinates", () => {
  for (const grid of [{ cols: 4, rows: 3 }, { cols: 8, rows: 6 }]) {
    const { cols, rows } = grid;
    const project = (lon, lat) => projectPlateCarree({ lon, lat }, dustBounds, grid);

    assert.deepEqual(project(-20, 45), { x: 0, y: 0 });
    assert.deepEqual(project(50, 45), { x: cols, y: 0 });
    assert.deepEqual(project(-20, 15), { x: 0, y: rows });
    assert.deepEqual(project(50, 15), { x: cols, y: rows });
    assert.deepEqual(project(15, 30), { x: cols / 2, y: rows / 2 });
    assert.deepEqual(project(-20 + 35 / cols, 45 - 15 / rows), { x: 0.5, y: 0.5 });
    assert.deepEqual(project(-37.5, 52.5), { x: -cols / 4, y: -rows / 4 });
  }
});

test("Test data: the legacy mount leaves geography empty without a verified source across case changes", () => {
  const root = new Element("div");
  const dust = Object.assign(guardedDiscovery(3, 4), { caseId: dustCaseId });
  let update;
  const mount = mountDecodeVisual(root, {
    getState: () => dust,
    subscribe(listener) {
      update = listener;
      return () => {};
    },
  }, { t: (key) => key });
  const [svg] = root.children;
  const [geography, grid] = svg.children;
  assert.equal(geography.childElementCount, 0);
  assert.equal(grid.childElementCount, 12);

  update(Object.assign(guardedDiscovery(6, 8), { caseId: "test-other-case" }));
  assert.equal(geography.childElementCount, 0);
  assert.equal(grid.childElementCount, 48);
  update(dust);
  assert.equal(geography.childElementCount, 0);
  assert.equal(grid.childElementCount, 12);

  mount.dispose();
  assert.equal(root.childElementCount, 0);
});

test("Reveal keeps markers and labels empty before grading is public", () => {
  for (const phase of ["intro", "legend", "listen", "decode"]) {
    const { layer, labels } = renderReveal(document, {
      phase,
      get outcomes() { assert.fail("Read outcomes before Reveal"); },
    }, () => assert.fail("Formatted a label before Reveal"));
    assert.equal(layer.children.length, 0);
    assert.equal(labels.children.length, 0);
  }
});

const validOutcome = { row: 0, col: 0, outcome: "correct" };

test("Reveal renders an empty presentation for an absent, empty or invalid outcome batch", () => {
  const invalid = [undefined, null, {}, "correct", [], [validOutcome, null], [validOutcome, { ...validOutcome, row: -1 }],
    [validOutcome, { ...validOutcome, col: 4 }], [validOutcome, { ...validOutcome, row: 3 }],
    [validOutcome, { ...validOutcome, row: 1.5 }], [validOutcome, { ...validOutcome, col: "1" }],
    [validOutcome, { ...validOutcome, col: 1, outcome: "unknown" }],
    [validOutcome, { ...validOutcome, outcome: "missed" }]];
  for (const outcomes of invalid) {
    const { layer, labels } = renderReveal(document, { phase: "reveal", outcomes },
      () => assert.fail("Formatted a label for an invalid batch"), { rows: 3, cols: 4 });
    assert.equal(layer.children.length, 0);
    assert.equal(labels.children.length, 0);
  }
});

function mountRevealFixture() {
  const root = new Element("div");
  const evidence = new Element("section");
  const snapshot = { ...quickPlayback, phase: "reveal" };
  let update;
  const mount = mountDecodeVisual(root, {
    getState: () => snapshot,
    subscribe(listener) {
      update = listener;
      return () => {};
    },
  }, { t: (key) => key });
  const [svg] = root.children;
  return { root, svg, evidence, snapshot, mount, update };
}

for (const [name, invalidate] of [
  ["leaving Reveal", ({ update, snapshot }) => {
    update({ ...snapshot, phase: "decode" });
    update(snapshot);
  }],
  ["changing case", ({ update, snapshot }) => update({ ...snapshot, caseId: "new-case" })],
  ["changing level", ({ update }) => update({ ...advancedPlayback, phase: "reveal" })],
  ["reset", ({ mount }) => mount.clearReveal()],
  ["disposal", ({ mount }) => mount.dispose()],
]) {
  test(`Test data: Reveal removes both mounted nodes and rejects pending results after ${name}`, () => {
    const view = mountRevealFixture();
    const { mount, svg, evidence } = view;
    const outcomes = [validOutcome];
    const format = () => "Correct";
    const show = mount.prepareReveal();
    assert.equal(show(outcomes, evidence, format), true);
    assert.equal(svg.children.length, 4);
    assert.equal(evidence.children.length, 1);
    invalidate(view);
    assert.equal(svg.children.length, 3);
    assert.equal(evidence.children.length, 0);
    assert.equal(show(outcomes, evidence, format), false);

    const pendingView = mountRevealFixture();
    const pending = pendingView.mount.prepareReveal();
    invalidate(pendingView);
    assert.equal(pending(outcomes, pendingView.evidence, format), false);
    assert.equal(pendingView.svg.children.length, 3);
    assert.equal(pendingView.evidence.children.length, 0);
  });
}

test("Reveal rejects superseded callbacks and requires a visible evidence mount", () => {
  const { mount, root, svg, evidence, update, snapshot } = mountRevealFixture();
  const outcomes = [validOutcome];
  const format = () => "Correct";
  const old = mount.prepareReveal();
  const show = mount.prepareReveal();
  assert.equal(old(outcomes, evidence, format), false);
  assert.equal(show(outcomes, root, format), false);
  assert.equal(svg.children.length, 3);
  assert.equal(evidence.children.length, 0);
  assert.equal(mount.prepareReveal()(outcomes, evidence, format), true);
  update({ ...snapshot, planRevision: snapshot.planRevision + 1 });
  assert.equal(svg.children.length, 4);
  assert.equal(evidence.children.length, 1);
  update({ ...snapshot, phase: "decode" });
  assert.equal(mount.prepareReveal(), null);
});

test("Test data: Reveal renders public outcomes at Quick and Advanced cell centers", () => {
  for (const [rows, cols] of [[3, 4], [6, 8]]) {
    const outcomes = [
      { row: 0, col: 0, outcome: "correct" },
      { row: 0, col: cols - 1, outcome: "incorrect" },
      { row: rows - 1, col: cols - 1, outcome: "missed" },
    ];
    const translations = { correct: "Correct", incorrect: "Incorrect", missed: "Missed" };
    const { layer, labels } = renderReveal(document, {
      phase: "reveal",
      outcomes,
      get score() { assert.fail("Read score in visual renderer"); },
    }, (outcome, row, col) => `${translations[outcome]} (${row + 1}, ${col + 1})`, { rows, cols });

    assert.deepEqual(layer.attributes, {
      class: "decode-reveal-markers",
      "aria-hidden": "true",
      "pointer-events": "none",
      focusable: "false",
    });
    assert.deepEqual(layer.children.map((marker) => marker.textContent), ["\u2713", "\u00d7", "\u2013"]);
    assert.deepEqual(layer.children.map(({ name, attributes }) => [
      name, attributes.x, attributes.y, attributes.class,
    ]), [
      ["text", "0.5", "0.5", "decode-reveal-correct"],
      ["text", String(cols - 0.5), "0.5", "decode-reveal-incorrect"],
      ["text", String(cols - 0.5), String(rows - 0.5), "decode-reveal-missed"],
    ]);
    assert.equal(labels.name, "ul");
    assert.deepEqual(labels.children.map((label) => label.textContent), [
      "Correct (1, 1)", `Incorrect (1, ${cols})`, `Missed (${rows}, ${cols})`,
    ]);
    const localized = renderReveal(document, { phase: "reveal", outcomes: outcomes.slice(0, 1) },
      () => "\u0635\u062d\u064a\u062d", { rows, cols });
    assert.equal(localized.labels.children[0].textContent, "\u0635\u062d\u064a\u062d");
  }
});
