const ar = {
  skip: "انتقل إلى أداة الاستماع", navCanvas: "لوحة الاستماع", navMethod: "كيف تعمل",
  edition: "صندوق الموسيقى لمعلومات الأرض", title1: "استمع إلى", title2: "ما تقوله الأرض.",
  intro: "أين ازداد الليل إضاءة؟ استمع إلى خريطة من ناسا ترصد تغيّر الأضواء، ثم تتبّع كل نغمة إلى موضعها في الصورة.",
  listen: "ابدأ الاستماع إلى الأرض", silentEntry: "استكشف دون صوت",
  visualLabel: "مركز معلومات الأرض لدى ناسا · SVS 5313", case: "عقد من أضواء الليل",
  loading: "جارٍ تحميل القياسات المستخرجة من الإطار…", retry: "أعد المحاولة",
  frameAlt: "خريطة ناسا لتغيّر أضواء الليل بين 2012 و2023. البنفسجي للمناطق التي تظهر أكثر إضاءة والبرتقالي للأقل إضاءة. تضم الخريطة أربع لقطات إقليمية مكبّرة.",
  brighter: "أكثر إضاءة في الصورة", dimmer: "أقل إضاءة في الصورة",
  tapInset: "اختر نافذة مكبّرة لمسحها",
  sourceCredit: "استوديو التصوّر العلمي في ناسا ↗", region: "منطقة الاستماع", playback: "التشغيل",
  play: "شغّل المسح", pause: "أوقف مؤقتًا", replay: "أعد التشغيل", mute: "اكتم", unmute: "ألغِ الكتم",
  scan: "مسح الصورة من اليسار إلى اليمين", previous: "الشريط السابق", next: "الشريط التالي", frameReading: "الشريط الحالي · حصة من البكسلات",
  chooseInset: "اختر نافذة مكبّرة من إطار ناسا",
  compareLabel: "اسمع الفرق", compareTitle: "منطقتان بمقياس واحد.", first: "المنطقة الأولى", second: "المنطقة الثانية",
  playComparison: "اسمع الأولى ثم الثانية", signatureLabel: "البصمة الصوتية", signatureTitle: "بصمة للتغيّر.",
  signatureNote: "كل عمود يمثّل شريطًا من الصورة. يظهر البنفسجي فوق الخط والبرتقالي تحته بمقياس موحّد من صفر إلى 24٪. اختر عمودًا لتجد شريطه في الإطار.",
  openValues: "اقرأ قيم الشرائط وإعدادات النغمات", band: "الشريط", sound: "مستويات الصوت",
  methodTitle: "من البكسل إلى النغمة.",
  method1: "يمثّل البنفسجي والبرتقالي اتجاهين متعاكسين للتغيّر في عرض ناسا. يحصي إيرث بالس البكسلات الملوّنة في 12 شريطًا رأسيًا من كل لقطة مكبّرة، ويضيء الشريط لحظة تشغيل نغمته.",
  method2: "النغمة الأعلى للبنفسجي والأخفض للبرتقالي. كلما زادت حصة لون ارتفع صوت نغمته. يمكن أن تُسمع النغمتان معًا، ويسود الصمت عندما يخلو الشريط من اللونين المصنّفين.",
  method3: "تصف النسب الصورة المنشورة. يؤثّر التصيير والضغط في الألوان، وتختلف مقاييس الخرائط المكبّرة. تنطبق المقارنة على حصة اللون في نوافذ الصورة المختارة.",
  volume: "مستوى الصوت", speed: "سرعة المسح", stereo: "فعّل الفصل بين قناتي الستيريو",
  audioSettings: "إعدادات الصوت والتشغيل", useAudio: "شغّل نغمات البيانات",
  quickLegend: "نغمة البنفسجي بتردد 392 هرتز في القناة اليمنى، والبرتقالي بتردد 261.626 هرتز في اليسرى. تتبع النغمتان مقياس الكسب نفسه.",
  viewSource: "شاهد عرض ناسا الأصلي ↗", viewData: "اطّلع على أعداد البكسلات ↗",
  europe: "أوروبا الغربية", med: "شرق المتوسط", ukraine: "أوكرانيا", india: "الهند",
  ready: "جاهز للمسح.", starting: "جارٍ بدء التشغيل…", playing: "المسح الصوتي جارٍ.", silent: "المسح البصري جارٍ.",
  fallback: "تعذّر تشغيل الصوت. يستمر المسح البصري.", paused: "المسح متوقف مؤقتًا.", complete: "انتهى المسح.",
  error: "تعذّر تحميل بيانات الإطار. أعد المحاولة أو افتح المصدر الرسمي أدناه.",
  imageError: "الصورة غير متاحة. يمكنك متابعة قراءة القيم.",
  gain: "الكسب", same: "اختر منطقتين مختلفتين للمقارنة.",
};

const en = {
  mute: "Mute", unmute: "Unmute", europe: "Western Europe", med: "Eastern Mediterranean", ukraine: "Ukraine", india: "India",
  ready: "Ready to scan.", starting: "Starting playback…", playing: "Listening scan in progress.", silent: "Visual scan in progress.",
  fallback: "Audio is unavailable. The visual scan is running.", paused: "Scan paused.", complete: "Scan complete.",
  error: "The frame data could not load. Try again or use the original source below.",
  imageError: "The image is unavailable. The readings remain available.",
  gain: "gain", same: "Choose two different regions to compare.",
};

export function createLanguage() {
  const button = document.getElementById("language");
  let current = new URL(document.URL).searchParams.get("lang") === "ar" ? "ar" : "en";
  function say(key) { return (current === "ar" ? ar : en)[key] ?? key; }
  function apply() {
    document.documentElement.lang = current;
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
    document.title = current === "ar" ? "إيرث بالس · صندوق الموسيقى لمعلومات الأرض" : "EARTHPULSE — The Earth Information Jukebox";
    button.textContent = current === "ar" ? "English" : "العربية";
    button.lang = current === "ar" ? "en" : "ar";
    for (const [name, attribute] of [["copy", null], ["label", "aria-label"], ["alt", "alt"]]) {
      for (const target of document.querySelectorAll("[data-" + name + "]")) {
        const fallback = attribute ? target.getAttribute(attribute) : target.textContent;
        if (target.dataset.english === undefined) target.dataset.english = fallback;
        const translated = current === "ar" ? ar[target.dataset[name]] ?? target.dataset.english : target.dataset.english;
        if (attribute) target.setAttribute(attribute, translated);
        else target.textContent = translated;
      }
    }
  }
  function toggle() {
    current = current === "ar" ? "en" : "ar";
    const url = new URL(document.URL);
    if (current === "ar") url.searchParams.set("lang", "ar"); else url.searchParams.delete("lang");
    history.replaceState(null, "", url);
    apply();
  }
  apply();
  return { say, toggle, get arabic() { return current === "ar"; }, get locale() { return current; } };
}
