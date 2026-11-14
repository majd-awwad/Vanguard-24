const routes = [
  ["./index.html", "EarthPulse", "إيرث بالس"],
  ["./index.html#lens", "Sonic Lens", "عدسة الاستماع"],
  ["./decode-3d.html", "Earth Detective", "محقّق الأرض"],
  ["./forest.html", "Invisible Forest", "الغابة غير المرئية"],
  ["./dust-observatory.html", "Dust Observatory", "مرصد الغبار"],
  ["./decode.html?condition=text", "Text cues", "الإشارات النصيّة"],
];
const nav = document.createElement("nav");
nav.className = "field-navigation";
document.body.append(nav);

function render() {
  const ar = document.documentElement.lang === "ar";
  const current = new URL(document.URL);
  nav.setAttribute("aria-label", ar ? "تنقّل بين معارض إيرث بالس" : "EarthPulse experiences");
  nav.replaceChildren(...routes.map(([path, en, arabic]) => {
    const link = document.createElement("a");
    const url = new URL(path, current);
    if (ar) url.searchParams.set("lang", "ar");
    if (url.pathname === current.pathname && url.searchParams.get("condition") === current.searchParams.get("condition")
        && url.hash === current.hash) link.setAttribute("aria-current", "page");
    link.href = url;
    link.textContent = ar ? arabic : en;
    return link;
  }));
}
render();
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
window.addEventListener("hashchange", render);
