import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { NAV_ITEMS } from "../web/cinematic/site/nav.js";
import { defaults, sanitize } from "../web/cinematic/site/settings.js";

const text = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("nav: exactly five links, every target exists, Decode is the home page", () => {
  assert.deepEqual(NAV_ITEMS.map((i) => i.id), ["decode", "explore", "studio", "science", "about"]);
  for (const item of NAV_ITEMS) assert.ok(existsSync(new URL("../web/" + item.path, import.meta.url)), item.path + " must exist (no 404)");
  assert.equal(NAV_ITEMS[0].path, "index.html");
  assert.match(text("web/index.html"), /cinematic/);
  assert.ok(existsSync(new URL("../web/atlas.html", import.meta.url)), "the old atlas stays as the archive");
});

test("nav: active page is marked with aria-current", () => {
  const nav = text("web/cinematic/site/nav.js");
  assert.match(nav, /"aria-current": item\.id === active \? "page" : null/);
  for (const [file, id] of [["web/pages/studio.html", "studio"], ["web/pages/science.html", "science"], ["web/pages/about.html", "about"], ["web/pages/explore.html", "explore"]]) {
    assert.match(readFileSync(new URL("../" + file, import.meta.url), "utf8"), /id="site-nav"/, id);
  }
});

test("sound-lab redirects to Science #sound and Science hosts How it sounds", () => {
  assert.match(text("web/pages/sound-lab.html"), /science\.html#sound/);
  assert.match(text("web/cinematic/site/science.js"), /howItSounds/);
  assert.match(text("web/cinematic/site/science-sound.js"), /id: "sound"/);
});

test("Studio opens on a real value: default centre cell, sound off, inspector", () => {
  const studio = text("web/studio/studio.js");
  assert.match(studio, /function selectDefaultCell\(\)/);
  assert.match(studio, /selectDefaultCell\(\);/);
  assert.match(studio, /setSound\(false\)/);
  assert.match(studio, /el\.inspector/);
});

test("Studio shows one flyout at a time and closes it with Escape returning focus", () => {
  const studio = text("web/studio/studio.js");
  assert.equal((studio.match(/class: "st-flyout"/g) ?? []).length, 1);
  assert.match(studio, /el\.flyoutBody\.replaceChildren\(\.\.\.nodes\)/);
  assert.match(studio, /const closeFlyout = \(\) => \{ const opener = railButtons\[currentTool\]; openTool\("explore"\); opener\?\.focus\(\); \}/);
});

test("settings drawer values persist and sanitize (speech volume included)", () => {
  assert.equal(defaults.speechVolume, 1);
  assert.equal(sanitize({ speechVolume: 7 }).speechVolume, 1);
  assert.match(text("web/cinematic/site/nav.js"), /earthpulse:settings/);
});

test("one layer, one tool: layer chip, tool memory, map card, clustered pins", () => {
  const studio = text("web/studio/studio.js");
  assert.match(studio, /function renderLayerChip\(\)/);
  assert.match(studio, /function leaveTool\(prev\)/);
  assert.match(studio, /function enterTool\(id\)/);
  assert.ok(studio.includes("function computeInsets()"), "the whole coverage fits the free area");
  assert.match(studio, /st-pin-cluster/);
  assert.ok(studio.includes("setFlyout(nodes.length > 0)"), "the flyout exists only for the active tool");
});

test("spoiler lock is enforced in the timeline, Compare and Find signals", () => {
  assert.match(text("web/studio/studio.js"), /"aria-disabled": locked \? "true" : null/);
  assert.match(text("web/studio/compare.js"), /disabled: locked\.has\(entry\.date\)/);
  assert.match(text("web/studio/hunter-ui.js"), /disabled: lock\.has\(entry\.date\)/);
});

test("Find signals is a short question with human results and no anomaly option", () => {
  const hunter = text("web/studio/hunter-ui.js");
  assert.match(hunter, /const ORDER = \[QUERY\.HIGHEST, QUERY\.THRESHOLD, QUERY\.INCREASE, QUERY\.DECREASE\]/);
  assert.match(hunter, /class: "em-result st-row"/);
  assert.match(hunter, /s\.header/);
});
