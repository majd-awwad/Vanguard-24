import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mountDecodeGrid } from '../web/accessibility/decode-grid.js';
import { createTransport } from '../web/audio/transport.js';
import * as decodeMessages from '../web/i18n/decode-messages.js';

const { decodeMessage } = decodeMessages;
const languages = ['ar', 'en'];

const requiredKeys = [
  'stage.explore', 'stage.legend', 'stage.listen', 'stage.decode', 'stage.reveal',
  'explore.welcome', 'explore.intro', 'explore.journey', 'explore.eyesFree',
  'explore.controls', 'explore.source', 'explore.fixtureDisclaimer',
  'legend.intro', 'legend.direction', 'legend.pitch', 'legend.loudness',
  'legend.beforeSweep', 'legend.started', 'legend.completed',
  'listen.start', 'listen.pause', 'listen.replay', 'listen.started',
  'listen.completed', 'listen.spatial', 'listen.mutedFallback', 'listen.navigation',
  'grid.row', 'grid.column', 'grid.position', 'grid.focused',
  'grid.selected', 'grid.deselected', 'grid.probeRequested', 'grid.noReading',
  'grid.heard.low', 'grid.heard.mid', 'grid.heard.high', 'grid.heard.silent',
  'grid.submitInstructions', 'grid.submit', 'grid.submitted',
  'grid.shortcut.arrows', 'grid.shortcut.space', 'grid.shortcut.enter',
  'grid.shortcut.p', 'grid.shortcut.l', 'grid.shortcut.r', 'grid.shortcut.s',
  'discovery.cellReadout', 'discovery.lastHeard',
  'reveal.intro', 'reveal.hits', 'reveal.misses', 'reveal.falseAlarms',
  'reveal.nearHits', 'reveal.precision', 'reveal.recall', 'reveal.f1',
  'reveal.scoreSummary', 'reveal.selection.correct', 'reveal.selection.missed',
  'reveal.selection.false', 'reveal.cellValue', 'learning.cellValue', 'reveal.source',
  'reveal.relation.SAME_DATA', 'reveal.relation.SAME_MODEL_DIFFERENT_RUN',
  'reveal.relation.RELATED_CONTEXT', 'reveal.visualLinkNote',
  'general.loading', 'general.error', 'general.retry', 'general.restart',
  'level.quick', 'level.advanced', 'mode.discovery', 'mode.learning',
  'condition.sound', 'condition.text', 'condition.both', 'accessibility.instructions',
];

test('exports only the v2 translator and resolves the same required keys in both languages', () => {
  assert.deepEqual(Object.keys(decodeMessages), ['decodeMessage']);
  assert.equal(new Set(requiredKeys).size, requiredKeys.length);

  for (const lang of languages) {
    const params = { row: 1, col: 2, heard: 'high', note: 'Synthetic test note' };
    const availableKeys = requiredKeys.filter((key) => {
      const message = decodeMessage(lang, key, params);
      return typeof message === 'string' && message.trim() !== '' && message !== key;
    });

    assert.deepEqual(availableKeys, requiredKeys, `Missing or empty messages for ${lang}`);
    assert.match(decodeMessage(lang, 'explore.fixtureDisclaimer'), lang === 'ar' ? /اصطناعية/ : /synthetic/);
  }
});

test('interpolates named parameters and keeps supplied text literal', () => {
  const params = { product: 'Synthetic product {version}', version: '02.1', start: 'T0', end: 'T1' };
  assert.equal(
    decodeMessage('en', 'explore.source', params),
    'Data source: Synthetic product {version}, version 02.1. Observation period: T0 to T1.',
  );
  assert.equal(
    decodeMessage('ar', 'explore.source', params),
    'مصدر البيانات: Synthetic product {version}، الإصدار 02.1. فترة الرصد: من T0 إلى T1.',
  );
});

test('uses the requested locale for numeric parameters and preserves zero', () => {
  for (const lang of languages) {
    const format = new Intl.NumberFormat(lang);
    const expected = lang === 'ar'
      ? `الصف ${format.format(1234)}، العمود ${format.format(0)}`
      : `Row ${format.format(1234)}, column ${format.format(0)}`;

    assert.equal(decodeMessage(lang, 'grid.position', { row: 1234, col: 0 }), expected);
  }
});

test('falls back to English for unsupported locales and handles missing keys predictably', () => {
  assert.equal(decodeMessage('fr', 'stage.explore'), 'Explore');
  assert.equal(decodeMessage(undefined, 'stage.explore'), 'Explore');
  assert.equal(decodeMessage('ar-PS', 'stage.explore'), 'استكشاف');
  assert.equal(decodeMessage('en', 'missing.example'), 'missing.example');
  assert.equal(decodeMessage('ar', 'constructor'), 'constructor');
  assert.equal(decodeMessage('ar', '__proto__'), '__proto__');
  assert.equal(decodeMessage('en', 'grid.row'), 'Row {row}');
  assert.equal(decodeMessage('en', 'grid.row', Object.create({ row: 77 })), 'Row {row}');
});

test('localizes the four allowed heard categories', () => {
  const categories = [
    ['low', 'Low', 'منخفض'],
    ['mid', 'Medium', 'متوسط'],
    ['high', 'High', 'مرتفع'],
    ['silent', 'Silent', 'صامت'],
  ];

  for (const [category, en, ar] of categories) {
    assert.equal(decodeMessage('en', `grid.heard.${category}`), en);
    assert.equal(decodeMessage('ar', `grid.heard.${category}`), ar);
    assert.equal(decodeMessage('en', 'discovery.lastHeard', { heard: category }), `Last heard: ${en}.`);
    assert.equal(decodeMessage('ar', 'discovery.lastHeard', { heard: category }), `آخر ما سمعت: ${ar}.`);
  }
});

test('Discovery readout has only the position and a matching qualitative probe', () => {
  // The extra synthetic fields simulate a snapshot that accidentally exposes measurements.
  const focused = {
    row: 1,
    col: 2,
    value: 918273.45,
    unit: 'HIDDEN_UNIT',
    status: 'HIDDEN_STATUS',
    truth: 'HIDDEN_TRUTH',
    reading: 'HIDDEN_READING',
    heard: 'HIDDEN_HEARD',
  };
  const lastProbe = { ...focused, heard: 'high' };
  const invalidProbes = [
    null,
    { ...lastProbe, row: 0 },
    { ...lastProbe, col: 0 },
    { ...lastProbe, heard: 'HIDDEN_CATEGORY' },
    { ...lastProbe, heard: focused.value },
  ];

  for (const lang of languages) {
    const format = new Intl.NumberFormat(lang);
    const position = lang === 'ar'
      ? `الصف ${format.format(2)}، العمود ${format.format(3)}`
      : `Row ${format.format(2)}, column ${format.format(3)}`;
    const heard = lang === 'ar' ? 'آخر ما سمعت: مرتفع.' : 'Last heard: High.';
    const noReading = lang === 'ar' ? 'ما في قراءة متاحة.' : 'No reading available.';

    assert.equal(decodeMessage(lang, 'discovery.cellReadout', { ...focused, lastProbe }), `${position}. ${heard}`);
    for (const probe of invalidProbes) {
      assert.equal(decodeMessage(lang, 'discovery.cellReadout', { ...focused, lastProbe: probe }), `${position}. ${noReading}`);
    }
    assert.equal(decodeMessage(lang, 'discovery.cellReadout', { ...focused, row: 'HIDDEN_ROW' }), noReading);
    assert.equal(decodeMessage(lang, 'discovery.lastHeard', focused), noReading);
  }
});

test('Reveal and Learning accept explicit measurements, and score messages format counts and rates', () => {
  const score = { hits: 12, misses: 5, falseAlarms: 4, nearHits: 3, precision: 0.75, recall: 0.71, f1: 0.73 };
  const measurement = { row: 2, col: 3, value: 0.00001234, unit: 'synthetic-unit' };

  for (const lang of languages) {
    const format = new Intl.NumberFormat(lang);
    const rateFormat = new Intl.NumberFormat(lang, { style: 'percent' });

    for (const name of ['hits', 'misses', 'falseAlarms', 'nearHits']) {
      const value = format.format(score[name]);
      assert.ok(decodeMessage(lang, `reveal.${name}`, score).endsWith(value));
      assert.ok(decodeMessage(lang, 'reveal.scoreSummary', score).includes(value));
    }

    for (const name of ['precision', 'recall', 'f1']) {
      assert.ok(decodeMessage(lang, `reveal.${name}`, score).endsWith(rateFormat.format(score[name])));
    }

    const preciseFormat = new Intl.NumberFormat(lang, { maximumSignificantDigits: 21 });
    for (const key of ['reveal.cellValue', 'learning.cellValue']) {
      assert.ok(decodeMessage(lang, key, measurement).endsWith(`${preciseFormat.format(measurement.value)} synthetic-unit.`));
      assert.ok(decodeMessage(lang, key, { ...measurement, value: 0 }).endsWith(`${format.format(0)} synthetic-unit.`));
    }
  }
});

test('Reveal preserves the supplied visualLink note without translating or interpreting it', () => {
  const note = 'Synthetic test note: {product} & <context>';
  for (const lang of languages) {
    assert.equal(decodeMessage(lang, 'reveal.visualLinkNote', { note }), note);
    assert.notEqual(
      decodeMessage(lang, 'reveal.relation.SAME_DATA'),
      decodeMessage(lang, 'reveal.relation.RELATED_CONTEXT'),
    );
  }
});

// A minimal DOM with bubbling, focus, and button default-action simulation.
// It cannot verify browser rendering or assistive technology behavior.
class TestElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  append(...children) {
    for (const child of children) child.parent = this;
    this.children.push(...children);
  }

  replaceChildren(...children) {
    for (let node = this.ownerDocument.activeElement; node; node = node.parent) {
      if (node.parent === this) {
        this.ownerDocument.activeElement = null;
        break;
      }
    }
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...children);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, properties = {}) {
    const event = {
      target: this,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...properties,
    };
    for (let node = this; node; node = node.parent) {
      for (const listener of node.listeners.get(type) ?? []) listener(event);
    }
    const activatesButton = (type === 'keydown' && event.key === 'Enter') ||
      (type === 'keyup' && event.key === ' ');
    if (this.tagName === 'button' && activatesButton && !event.defaultPrevented) this.emit('click');
    return event;
  }

  focus() {
    if (this.ownerDocument.activeElement === this) return;
    this.ownerDocument.activeElement = this;
    this.emit('focusin');
  }
}

function syntheticGrid(rows, cols) {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows * cols }, (_, index) => ({
      row: Math.floor(index / cols), col: index % cols, lat: 0, lon: 0,
    })),
  };
}

function gridHarness({ lang = 'en', snapshot = {}, confirmFocus = true } = {}) {
  const document = {
    activeElement: null,
    createElement: (tagName) => new TestElement(tagName, document),
    getElementById: (id) => page.children.find((element) => element.getAttribute('id') === id) ?? null,
  };
  const page = document.createElement('main');
  const root = document.createElement('div');
  const status = document.createElement('p');
  const outside = document.createElement('input');
  page.append(root, status, outside);
  root.setAttribute('id', 'decode-grid');
  status.setAttribute('id', 'decode-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const announcements = [];
  let liveText = '';
  Object.defineProperty(status, 'textContent', {
    get: () => liveText,
    set: (text) => {
      liveText = text;
      announcements.push(text);
    },
  });

  let state = {
    caseId: 'synthetic-test', behavior: 'continuous',
    phase: 'decode', level: 'quick', mode: 'discovery', condition: 'both',
    grid: syntheticGrid(3, 4), focus: [0, 0], guesses: [[0, 1], [2, 3]],
    expectedCount: 4, lastProbe: null, visualLink: null, score: null, planRevision: 0,
    transport: {
      status: 'idle', positionS: 0, activeEventId: null, planRevision: 0, awaitingOnset: false,
      speed: 1, volume: 0, muted: true, playback: 'silent', audioUnavailable: false,
    },
    ...snapshot,
  };
  const intents = [];
  const subscribers = new Set();
  function update(changes) {
    state = { ...state, ...changes };
    for (const listener of subscribers) listener(state);
  }
  const session = {
    getState: () => state,
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    dispatch(intent) {
      intents.push(intent);
      if (intent.type === 'focus' && confirmFocus) update({ focus: [intent.row, intent.col] });
    },
  };
  const messages = [];
  const { dispose } = mountDecodeGrid(root, session, {
    t(key, params) {
      messages.push({ key, params });
      return decodeMessage(lang, key, params);
    },
  });
  const cell = (row, col) => root.children[row].children[col];
  const press = (key, properties) => document.activeElement.emit('keydown', { key, ...properties });
  return { document, page, root, cell, status, outside, press, intents, update, subscribers, dispose, messages, announcements };
}

function assertGrid(root, rows, cols, focus, guesses) {
  assert.equal(root.getAttribute('id'), 'decode-grid');
  assert.equal(root.getAttribute('role'), 'grid');
  assert.equal(root.getAttribute('data-rows'), String(rows));
  assert.equal(root.getAttribute('data-cols'), String(cols));
  assert.equal(root.children.length, rows);
  let tabStops = 0;
  let count = 0;
  for (const [row, element] of root.children.entries()) {
    assert.equal(element.tagName, 'div');
    assert.equal(element.getAttribute('role'), 'row');
    assert.equal(element.className, 'dg-row');
    assert.equal(element.children.length, cols);
    for (const [col, button] of element.children.entries()) {
      assert.equal(button.tagName, 'button');
      assert.equal(button.type, 'button');
      assert.equal(button.className, 'dg-cell');
      assert.equal(button.getAttribute('role'), 'gridcell');
      assert.deepEqual(button.dataset, { row: String(row), col: String(col) });
      assert.equal(button.getAttribute('aria-pressed'), String(guesses.some(([r, c]) => r === row && c === col)));
      const tabIndex = button.getAttribute('tabindex');
      assert.equal(tabIndex, row === focus[0] && col === focus[1] ? '0' : '-1');
      if (tabIndex === '0') tabStops += 1;
      count += 1;
    }
  }
  assert.equal(count, rows * cols);
  assert.equal(tabStops, 1);
}

test('the existing mount directly owns the CSS rows and buttons in both grid sizes', () => {
  const { root, cell, document, update } = gridHarness({
    lang: 'ar', snapshot: { focus: [2, 3] },
  });
  assertGrid(root, 3, 4, [2, 3], [[0, 1], [2, 3]]);
  assert.equal(root.getAttribute('aria-label'), decodeMessage('ar', 'stage.decode'));
  assert.equal(cell(2, 3).getAttribute('aria-label'), decodeMessage('ar', 'grid.position', { row: 3, col: 4 }));

  const quickCell = cell(2, 3);
  quickCell.focus();
  update({ level: 'advanced', grid: syntheticGrid(6, 8), focus: [5, 7], guesses: [[5, 6]] });
  assertGrid(root, 6, 8, [5, 7], [[5, 6]]);
  assert.equal(document.activeElement, cell(5, 7));
  assert.equal(quickCell.parent.parent, null);

  update({ level: 'quick', grid: syntheticGrid(3, 4), focus: [0, 0], guesses: [] });
  assertGrid(root, 3, 4, [0, 0], []);
  assert.equal(document.activeElement, cell(0, 0));
});

test('click, Space and Enter dispatch a single toggle or probe and preserve session-owned guesses', () => {
  const { cell, intents, press, status, update } = gridHarness();
  const target = cell(1, 2);
  target.focus();
  assert.deepEqual(intents.splice(0), [{ type: 'focus', row: 1, col: 2 }]);
  assert.equal(status.textContent, 'Focused row 2, column 3.');
  target.emit('click');
  assert.deepEqual(intents.splice(0), [{ type: 'toggle', row: 1, col: 2 }]);
  assert.equal(target.getAttribute('aria-pressed'), 'false');
  update({ guesses: [[0, 1], [2, 3], [1, 2]] });
  assert.equal(target.getAttribute('aria-pressed'), 'true');
  assert.equal(status.textContent, 'Selected row 2, column 3.');

  assert.equal(press(' ').defaultPrevented, true);
  press(' ', { repeat: true });
  assert.equal(target.emit('keyup', { key: ' ' }).defaultPrevented, true);
  assert.deepEqual(intents.splice(0), [{ type: 'toggle', row: 1, col: 2 }]);
  update({ guesses: [[0, 1], [2, 3]] });
  assert.equal(target.getAttribute('aria-pressed'), 'false');
  assert.equal(status.textContent, 'Deselected row 2, column 3.');

  assert.equal(press('Enter').defaultPrevented, true);
  assert.deepEqual(intents, [{ type: 'probe', row: 1, col: 2 }]);
  assert.equal(status.textContent, 'Probing row 2, column 3.');
});

test('arrows stay within bounds and DOM focus follows confirmed updates without stealing focus', () => {
  const { cell, document, outside, intents, press, update } = gridHarness({ confirmFocus: false });
  const first = cell(0, 0);
  first.focus();
  press('ArrowUp');
  press('ArrowLeft');
  assert.deepEqual(intents, []);

  for (const [key, row, col] of [
    ['ArrowRight', 0, 1], ['ArrowDown', 1, 1], ['ArrowLeft', 1, 0], ['ArrowUp', 0, 0],
  ]) {
    const previous = document.activeElement;
    assert.equal(press(key).defaultPrevented, true);
    assert.deepEqual(intents.splice(0), [{ type: 'focus', row, col }]);
    assert.equal(document.activeElement, previous);
    update({ focus: [row, col] });
    assert.equal(document.activeElement, cell(row, col));
    assert.equal(cell(row, col).getAttribute('tabindex'), '0');
  }

  assert.equal(press('Tab').defaultPrevented, false);
  press('ArrowDown');
  outside.focus();
  update({ focus: [1, 0] });
  assert.equal(document.activeElement, outside);
  assert.equal(cell(1, 0).getAttribute('tabindex'), '0');
  assert.equal(first.getAttribute('tabindex'), '-1');
  outside.emit('keydown', { key: 's' });
  assert.deepEqual(intents, [{ type: 'focus', row: 1, col: 0 }]);
});

test('grid shortcuts play and submit through v2 intents and respect mode and Reveal', () => {
  const { cell, intents, press, status, update } = gridHarness();
  cell(0, 0).focus();
  press('p');
  assert.equal(status.textContent, 'Start the spatial sweep');
  press('L');
  assert.equal(status.textContent, 'Legend');
  press('ح', { code: 'KeyP' });
  press('s', { ctrlKey: true });
  press('s');
  assert.deepEqual(intents.splice(0), [
    { type: 'play', mode: 'sweep' }, { type: 'play', mode: 'legend' },
    { type: 'play', mode: 'sweep' }, { type: 'submit' },
  ]);
  update({ phase: 'reveal' });
  assert.equal(status.textContent, 'Guesses submitted.');
  press('s');
  press(' ');
  cell(0, 0).emit('click');
  update({ mode: 'learning', phase: 'decode' });
  press('s');
  assert.deepEqual(intents, []);
});

test('the mounted grid and Discovery readout exclude hidden evidence even when muted', () => {
  const grid = syntheticGrid(3, 4);
  Object.assign(grid.cells[0], { value: 918273.45, status: 'HIDDEN_STATUS', unit: 'HIDDEN_UNIT' });
  const { cell, intents, messages, press, status, update } = gridHarness({
    snapshot: { grid, lastProbe: { row: 0, col: 0, heard: 'high', value: 918273.45 } },
  });
  cell(0, 0).focus();
  press('r');
  assert.equal(status.textContent, 'Row 1, column 1. Last heard: High.');
  assert.deepEqual(messages.at(-1), {
    key: 'discovery.cellReadout', params: { row: 0, col: 0, lastProbe: { row: 0, col: 0, heard: 'high' } },
  });
  assert.equal(cell(0, 0).textContent, '');
  assert.equal(cell(0, 0).getAttribute('aria-label'), 'Row 1, column 1');
  assert.doesNotMatch([...cell(0, 0).attributes.values()].join(' '), /918273|HIDDEN_/);

  for (const lastProbe of [
    null, { row: 1, col: 0, heard: 'high' }, { row: 0, col: 1, heard: 'high' },
    { row: 0, col: 0, heard: '918273.45' },
  ]) {
    update({ lastProbe });
    press('R');
    assert.equal(status.textContent, 'Row 1, column 1. No reading available.');
  }
  update({ condition: 'text', lastProbe: { row: 0, col: 0, heard: 'high' } });
  press('r');
  assert.equal(status.textContent, 'Row 1, column 1. Last heard: High.');
  assert.deepEqual(intents, []);
});

test('transport updates keep existing rows, active focus and the live-region message', () => {
  const { cell, document, status, press, update } = gridHarness();
  const target = cell(0, 0);
  target.focus();
  press('p');
  const announcement = status.textContent;
  update({ transport: { status: 'playing', activeEventId: 'synthetic-tone', positionS: 1 } });
  assert.equal(cell(0, 0), target);
  assert.equal(document.activeElement, target);
  assert.equal(status.textContent, announcement);
});

test('dispose removes grid listeners, rows and subscription while leaving page mounts in place', () => {
  const { page, root, cell, status, intents, subscribers, dispose, update } = gridHarness();
  const previous = cell(0, 0);
  previous.focus();
  previous.emit('keydown', { key: 'r' });
  assert.equal(subscribers.size, 1);
  dispose();
  dispose();
  assert.equal(subscribers.size, 0);
  assert.ok([...root.listeners.values()].every((listeners) => listeners.size === 0));
  assert.deepEqual(root.children, []);
  assert.equal(root.getAttribute('role'), null);
  assert.equal(root.parent, page);
  assert.equal(status.parent, page);
  assert.equal(status.textContent, '');
  update({ focus: [1, 0] });
  previous.emit('click');
  assert.deepEqual(root.children, []);
  assert.deepEqual(intents, []);
});

test('R reads matching qualitative probes in both languages across all conditions with audio on or muted', () => {
  const categories = [
    ['low', 'Low', 'منخفض'],
    ['mid', 'Medium', 'متوسط'],
    ['high', 'High', 'مرتفع'],
    ['silent', 'Silent', 'صامت'],
  ];
  const grid = syntheticGrid(3, 4);
  Object.assign(grid.cells[1], { value: 918273.45, unit: 'HIDDEN_UNIT', status: 'HIDDEN_STATUS' });

  for (const lang of languages) {
    const { cell, intents, press, status, update } = gridHarness({
      lang, snapshot: { grid, focus: [0, 1] },
    });
    const number = new Intl.NumberFormat(lang);
    for (const condition of ['sound', 'text', 'both']) {
      for (const muted of [false, true]) {
        for (const [heard, en, ar] of categories) {
          update({
            condition,
            lastProbe: { row: 0, col: 1, heard, value: 918273.45, unit: 'HIDDEN_UNIT' },
            transport: { status: 'paused', muted, playback: condition === 'text' ? 'silent' : 'audio' },
          });
          cell(0, 1).focus();
          if (lang === 'ar') press('ق', { code: 'KeyR' });
          else press('r');

          const expected = lang === 'ar'
            ? `الصف ${number.format(1)}، العمود ${number.format(2)}. آخر ما سمعت: ${ar}.`
            : `Row 1, column 2. Last heard: ${en}.`;
          assert.equal(status.textContent, expected, `${lang}, ${condition}, muted=${muted}, ${heard}`);
          assert.deepEqual(cell(0, 1).dataset, { row: '0', col: '1' });
        }
      }
    }
    press('ArrowLeft');
    assert.deepEqual(intents, [{ type: 'focus', row: 0, col: 0 }]);
    assert.equal(cell(0, 0).getAttribute('tabindex'), '0');
  }
});

const syntheticScore = {
  hits: 2, misses: 1, falseAlarms: 3, nearHits: 0, precision: 0.4, recall: 2 / 3, f1: 0.5,
};
const syntheticVisualLink = {
  svs: '', image: '', relation: 'RELATED_CONTEXT',
  note: '  Synthetic note: <context> & {verbatim}.\nSecond line.  ',
};

test('entering Reveal announces all score counts and the literal provenance note together', () => {
  for (const lang of languages) {
    const { announcements, status, update } = gridHarness({ lang });
    update({ phase: 'reveal', score: syntheticScore, visualLink: syntheticVisualLink });
    const number = new Intl.NumberFormat(lang);
    const summary = lang === 'ar'
      ? `النتيجة: التخمينات الصحيحة ${number.format(2)}، الخلايا الفائتة ${number.format(1)}، الاختيارات الخاطئة ${number.format(3)}، والتخمينات القريبة ${number.format(0)}.`
      : 'Results: 2 hits, 1 misses, 3 false alarms, and 0 near hits.';
    assert.deepEqual(announcements, [
      `${decodeMessage(lang, 'grid.submitted')} ${summary} ${syntheticVisualLink.note}`,
    ]);
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
  }
});

test('late Reveal results are announced independently and transport ticks do not rewrite the live region', () => {
  const { announcements, status, update } = gridHarness();
  update({ phase: 'reveal' });
  update({ visualLink: syntheticVisualLink });
  assert.equal(status.textContent, syntheticVisualLink.note);
  update({ score: syntheticScore });

  for (const positionS of [0, 1, 2, 3]) {
    update({
      score: { ...syntheticScore },
      visualLink: { ...syntheticVisualLink },
      transport: { status: 'playing', positionS, activeEventId: `synthetic-${positionS}` },
    });
  }
  assert.deepEqual(announcements, [
    'Guesses submitted.', syntheticVisualLink.note, 'Results: 2 hits, 1 misses, 3 false alarms, and 0 near hits.',
  ]);
});

test('results stay private before Reveal and the live region clears on exit', () => {
  const { announcements, messages, status, update } = gridHarness();
  for (const phase of ['intro', 'legend', 'listen', 'decode']) {
    update({ phase, score: syntheticScore, visualLink: syntheticVisualLink });
  }
  assert.deepEqual(announcements, []);
  assert.equal(messages.some(({ key }) => key.startsWith('reveal.')), false);

  update({ phase: 'reveal' });
  assert.ok(status.textContent.includes(syntheticVisualLink.note));
  update({ phase: 'intro', score: null, visualLink: null });
  assert.equal(status.textContent, '');
  update({ phase: 'decode' });
  update({ phase: 'reveal', score: syntheticScore });
  assert.equal(status.textContent, 'Guesses submitted. Results: 2 hits, 1 misses, 3 false alarms, and 0 near hits.');
});

test('transport completion without a published plan mode cannot identify a Legend or Sweep', async () => {
  const endedSnapshots = [];
  for (const mode of ['legend', 'sweep', 'cell']) {
    let now = 0;
    let nextFrame;
    const transport = createTransport({
      now: () => now,
      requestFrame: (callback) => { nextFrame = callback; },
      cancelFrame: () => { nextFrame = undefined; },
    });
    const { announcements, cell, press, update } = gridHarness();
    const unsubscribe = transport.subscribe((snapshot) => update({ transport: snapshot }));
    cell(0, 0).focus();
    press(mode === 'legend' ? 'l' : 'p');
    const commandAnnouncement = announcements[0];
    transport.load({ mode, durationS: 2, events: [] });
    await transport.play('silent');
    transport.pause();
    await transport.replay('silent');
    now = 2;
    nextFrame();

    const ended = transport.snapshot();
    assert.equal(ended.status, 'ended');
    endedSnapshots.push(ended);
    assert.deepEqual(announcements, [commandAnnouncement]);
    unsubscribe();
  }
  assert.deepEqual(endedSnapshots[0], endedSnapshots[1]);
  assert.deepEqual(endedSnapshots[1], endedSnapshots[2]);
});
