import { badge, h } from "./dom.js";
import { aboutCopy, TEAM, TEAM_AR } from "./about-copy.js";
import { mountNav } from "./nav.js";

const TEXTURE = "../assets/earth/blue-marble-4096.jpg";
const SVG = "http://www.w3.org/2000/svg";

/** Purely decorative waveform: a fixed envelope, not derived from any data. */
export function decorativeWavePath(width = 420, height = 80, bars = 60) {
  const mid = height / 2;
  let d = "";
  for (let i = 0; i < bars; i++) {
    const x = (i + 0.5) * (width / bars);
    const envelope = Math.sin((i / (bars - 1)) * Math.PI) ** 1.5;
    const amp = Math.max(1.5, mid * 0.9 * envelope * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7))));
    d += `M${x.toFixed(1)} ${(mid - amp).toFixed(1)}V${(mid + amp).toFixed(1)}`;
  }
  return d;
}

export function renderAbout(document, root, language, hrefs) {
  const c = aboutCopy[language];
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 420 80");
  svg.setAttribute("class", "about-wave");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", decorativeWavePath());
  svg.append(path);

  const hero = h(document, "section", { class: "about-hero", "aria-labelledby": "about-title" },
    h(document, "div", { class: "about-hero-copy" },
      h(document, "p", { class: "eyebrow", text: c.eyebrow }),
      h(document, "h1", { id: "about-title" }, h(document, "span", { class: "ltr", text: c.titleLead }), h(document, "br"), h(document, "em", { text: c.titleAccent })),
      h(document, "p", { class: "lede", text: c.lede }),
      h(document, "div", { class: "actions" },
        h(document, "a", { class: "button", href: hrefs.decode, text: c.decode }),
        h(document, "a", { class: "button ghost", href: hrefs.explore, text: c.explore }),
        h(document, "a", { class: "button ghost", href: "#about-mission", text: c.mission }))),
    h(document, "figure", { class: "about-visual" },
      h(document, "div", { class: "about-globe", "aria-hidden": "true", style: `background-image:url("${TEXTURE}")` }), svg,
      h(document, "figcaption", {}, badge(document, "decor", c.decorLabel), h(document, "span", { text: c.decorWave }))));

  const FLOW = language === "ar" ? ["بيانات ناسا", "قواعد التحويل", "الصوت"] : ["NASA data", "Mapping rules", "Sound"];
  const flow = h(document, "ol", { class: "about-flow", "aria-label": FLOW.join(" → ") }, ...FLOW.map((word) => h(document, "li", { text: word })));
  const what = h(document, "section", { class: "panel about-what" }, h(document, "h2", { text: c.what.title }),
    h(document, "p", { text: c.what.p1 }), flow, h(document, "p", { text: c.what.p2 }),
    h(document, "p", {}, h(document, "a", { href: hrefs.science, text: c.what.link + (language === "ar" ? " ←" : " →") })));
  const why = h(document, "section", { class: "panel about-why" }, h(document, "h2", { text: c.why.title }),
    h(document, "p", { text: c.why.p1 }), h(document, "p", { text: c.why.p2 }),
    h(document, "p", { class: "callout", text: c.study }));
  const mission = h(document, "section", { class: "panel about-mission", id: "about-mission", "aria-labelledby": "about-mission-title" },
    h(document, "h2", { id: "about-mission-title", text: c.mission }), h(document, "p", { class: "mission-text", text: c.missionText }));
  const cards = h(document, "ul", { class: "about-cards" });
  for (const card of c.cards) cards.append(h(document, "li", { class: "panel" }, h(document, "h3", { text: card.title }), h(document, "p", { text: card.text })));
  const members = h(document, "ul", { class: "members", "aria-label": c.team.members });
  for (const name of language === "ar" ? TEAM_AR : TEAM) members.append(h(document, "li", { text: name }));
  const PHOTO = "../assets/team/team-vanguard-nablus-2026";
  const photo = h(document, "figure", { class: "team-photo" },
    h(document, "img", { src: PHOTO + "-800.jpg", srcset: PHOTO + "-800.jpg 800w, " + PHOTO + ".jpg 1600w", sizes: "(max-width: 900px) 92vw, 58vw", width: 1600, height: 1066, alt: c.team.photoAlt, loading: "lazy", decoding: "async" }),
    h(document, "figcaption", { text: c.team.caption }));
  const team = h(document, "section", { class: "panel about-team", "aria-labelledby": "about-team-title" }, photo,
    h(document, "div", { class: "team-info" }, h(document, "p", { class: "eyebrow", text: c.team.title }),
      h(document, "h2", { id: "about-team-title" }, h(document, "bdi", { text: c.team.name }), " — ", c.team.place),
      h(document, "p", { text: c.team.text }), members));

  root.replaceChildren(hero, h(document, "div", { class: "about-two" }, what, why), mission, cards, team, h(document, "p", { class: "credit", text: c.credit }));
}

export function startAbout(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "about", from: "pages" });
  document.title = aboutCopy[language].title + " · EARTHPULSE";
  renderAbout(document, document.getElementById("about-root"), language, { decode: "../", explore: "./explore.html", science: "./science.html" });
}
