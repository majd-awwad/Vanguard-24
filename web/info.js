// Supporting information lives in the current interface.
const messages = {
  en: {
    close: "Close", about: "About EarthPulse", science: "How the sound works", dataset: "The dataset",
    intro: "Explore NASA Earth model data through a 3D globe and spatial sound. Listen, select the cells you hear, then reveal the modeled dust signal.",
    credits: "EarthPulse · Team Vanguard. Earth textures: NASA Blue Marble and Black Marble. Rendering: three.js (MIT).",
    mapping: "The scan moves west to east. Stereo position follows longitude; higher pitch points north. Louder tones indicate stronger dust optical depth. Each cell lasts 0.8 seconds. The sound guide uses synthetic examples to explain the mapping.",
    limits: "Dust optical depth is dimensionless and describes how dust dims light at 550 nm. The challenge cutoff is a project rule. Quiet cells can still contain dust. NASA’s related SVS image uses a separate model run.",
    product: "Product", version: "Version", time: "Scientific time (UTC)", grid: "Grid", bounds: "Bounds (degrees)",
    source: "NASA source granule", context: "Related NASA visualization", loading: "The dataset is loading. Please try again shortly.",
  },
  ar: {
    close: "إغلاق", about: "حول EarthPulse", science: "كيف يتحوّل الغبار إلى صوت؟", dataset: "البيانات",
    intro: "استكشف بيانات نماذج ناسا من خلال كرة أرضية ثلاثية الأبعاد وصوت مكاني. اسمع، واختر الخلايا التي تسمعها، ثم اكشف إشارة الغبار في النموذج.",
    credits: "EarthPulse · فريق Vanguard. صور الأرض: NASA Blue Marble وBlack Marble. العرض ثلاثي الأبعاد: three.js بترخيص MIT.",
    mapping: "يتحرّك المسح من الغرب للشرق. موضع الصوت يتبع خط الطول، والنغمة الأعلى تدلّ على الشمال. الصوت الأقوى يعني عمقًا بصريًا أكبر للغبار. مدة كل خلية 0.8 ثانية. دليل الصوت يستخدم أمثلة اصطناعية لشرح العلاقة.",
    limits: "العمق البصري للغبار مقدار بلا وحدة يصف تعتيم الضوء عند طول موجي 550 نانومتر. حدّ التحدّي قاعدة وضعها المشروع؛ الخلايا الصامتة قد تحتوي غبارًا. صورة ناسا المرتبطة تستخدم تشغيلًا مختلفًا للنموذج.",
    product: "المنتج", version: "الإصدار", time: "وقت البيانات (UTC)", grid: "الشبكة", bounds: "الحدود بالدرجات",
    source: "ملف البيانات الأصلي من ناسا", context: "عرض ناسا المرتبط", loading: "جارٍ تحميل البيانات. حاول مجددًا بعد قليل.",
  },
};

export function mountInfo(document, language) {
  const text = messages[language];
  const dialog = document.querySelector("#site-info");
  const title = document.querySelector("#site-info-title");
  const content = document.querySelector("#site-info-body");
  const close = document.querySelector("#site-info-close");
  let data;
  close.textContent = text.close;
  close.addEventListener("click", () => dialog.close());
  function paragraph(value) {
    const node = document.createElement("p");
    node.textContent = value;
    content.append(node);
  }
  function open(section) {
    title.textContent = text[section];
    content.replaceChildren();
    if (section === "about") {
      paragraph(text.intro);
      paragraph(text.credits);
    } else if (section === "science") {
      paragraph(text.mapping);
      paragraph(text.limits);
    } else if (!data) {
      paragraph(text.loading);
    } else {
      const list = document.createElement("dl");
      const entries = [
        [text.product, data.source.product], [text.version, data.source.version],
        [text.time, `${data.source.time.start} – ${data.source.time.end}`],
        [text.grid, `${data.levels.quick.rows} × ${data.levels.quick.cols}`],
        [text.bounds, `W ${data.bounds.west} · E ${data.bounds.east} · S ${data.bounds.south} · N ${data.bounds.north}`],
      ];
      for (const [label, value] of entries) {
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = label;
        description.textContent = value;
        description.dir = "auto";
        list.append(term, description);
      }
      content.append(list);
      for (const [label, url] of [[text.source, data.source.url], [text.context, data.visualLink.svs]]) {
        const link = document.createElement("a");
        link.textContent = label;
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        content.append(link);
      }
    }
    dialog.showModal();
  }
  for (const section of ["about", "science", "dataset"]) {
    document.querySelector(`#cine-nav-${section}`).addEventListener("click", event => {
      event.preventDefault();
      open(section);
    });
  }
  return { setCase(next) { data = next; } };
}
