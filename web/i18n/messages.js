const ar = {
  skip: "انتقل إلى الاستكشاف", nav: "المعرض", navExplore: "استكشف", navScience: "العلم",
  heroLabel: "رصد ميداني من ناسا GEDI", titleLine: "الغابة", titleAccent: "غير المرئية.",
  intro: "تخفي مظلّة الغابة طبقات لا نراها من الأعلى. تتبّع نبضة ليزر من ناسا في منطقة السيرادو بالبرازيل، واستمع إلى ما يكشفه الضوء المنعكس.",
  begin: "ادخل بالصوت", beginSilent: "ادخل دون صوت", location: "السيرادو، البرازيل",
  photo: "مشهد توضيحي مولّد بالذكاء الاصطناعي", sonicLens: "عدسة الاستماع",
  acquired: "18 أبريل 2019 · البرازيل", modes: "محور المسح", horizontal: "على امتداد المسار",
  vertical: "عبر ارتفاعات البصمة", footprint: "البصمة", heightRange: "نطاق الارتفاع", from: "من (م)", to: "إلى (م)",
  heightStep: "شريحة الارتفاع", play: "تشغيل", pause: "إيقاف مؤقت", replay: "إعادة", previous: "الخطوة السابقة",
  next: "الخطوة التالية", speed: "سرعة التشغيل", reveal: "اكشف الفرق", open: "استكشف بحرية",
  guidePulse: "شغّل مسح الارتفاع", guideTrack: "ثبّت طبقة على امتداد المسار",
  discoveryHeading: "صدى مختلف عند الارتفاع نفسه.", comparisonEvidence: "أدلة المقارنة",
  inspect: "افحص القياس", closeEvidence: "أغلق الدليل", studio: "استوديو الصوت",
  loading: "جارٍ تحميل أرصاد GEDI الستة المتحققة…", retry: "أعد محاولة التحميل",
  volume: "مستوى الصوت", mute: "اكتم نغمات البيانات", runSound: "شغّل المسح بالصوت", runSilent: "شغّل المسح دون صوت",
  mapping: "تردد النغمة ثابت عند 440 هرتز. الكسب يساوي 0.32 مضروبًا في الجذر التربيعي لحصّة العائد. عند سرعة 1×، يمر المسح العمودي بمعدل 0.13 ثانية لكل متر، والمسح الأفقي بمعدل 65 مترًا لكل ثانية تشغيل.",
  evidence: "أدلة الرصد ومصادره", science: "ماذا عاد إلى المستشعر؟",
  scienceBody: "يقيس GEDI ضوء الليزر المنعكس من البصمة. تمثّل النغمات حصّة من الإشارة المصحّحة فوق عتبة الضجيج، ضمن نافذة ثابتة من −10 إلى 22 مترًا قياسًا إلى سطح الأرض المقدّر.",
  scienceLimits: "تؤثر التضاريس والانعكاسية والغطاء النباتي في العائد. لا تحدد هذه الإشارة وحدها كثافة الأوراق أو عدد الأشجار أو الكتلة الحيوية. لا توجد قياسات في الفجوات بين بصمات هذا المرور.",
  scienceMethod: "نطرح تقدير خلفية الجهاز وثلاثة انحرافات معيارية للضجيج، ثم نجمع الباقي الموجب في شرائح بعرض متر. نقسم الناتج على مجموع النافذة نفسها لكل بصمة.",
  dictionary: "توثيق موجة GEDI", returnToLens: "استكشف البصمات الست",
  frameAlt: "خريطة ناسا لارتفاعات الغطاء النباتي من GEDI، مع مسارات رصد ملوّنة ومقياس للارتفاع.",
  frameLink: "ارتفاع الغابات من GEDI · استوديو التصور العلمي في ناسا",
  frameScope: "سياق المهمة بمقياس RH100 من L2B. لم تتحقق مطابقة هذا الإطار مع البصمات الست من L1B وL2A.",
  footer: "الغابة غير المرئية · فريق Vanguard",
};

const strings = {
  axisHorizontal: ["Fixed height band · discrete footprints", "نطاق ارتفاع ثابت · بصمات منفصلة"],
  axisVertical: ["Fixed footprint · one-metre height bins", "بصمة ثابتة · شرائح ارتفاع بعرض متر"],
  keyHorizontal: ["Select a sampled footprint to hear its return in the fixed band. Larger rings show a greater share. The dashed line indicates the route between samples.", "اختر بصمة لسماع عائدها ضمن النطاق المثبّت. الحلقة الأكبر تعني حصّة أكبر. يوضّح الخط المتقطّع المسار بين البصمات."],
  keyVertical: ["Select a height on the waveform to hear that layer. The trace shows L1B receiver counts. The tone represents the corrected return share for the highlighted metre.", "اختر ارتفاعًا على الموجة لتسمع نغمة طبقته. يعرض الخط عدّادات المستقبِل من L1B، وتمثّل النغمة حصّة العائد المصحّح في شريحة المتر المحدّدة."],
  footprint: ["Footprint", ar.footprint],
  plotDistance: ["Sampled footprints in acquisition order", "البصمات حسب ترتيب الرصد"],
  trackScene: ["Six footprints · measured spacing", "ست بصمات · المسافات مقاسة"],
  trackArtwork: ["Illustrative landscape · schematic placement", "مشهد توضيحي · توزيع تخطيطي للبصمات"],
  beamLabel: ["Illustrated lidar pulse", "نبضة ليدار توضيحية"],
  waveLabel: ["GEDI return waveform", "موجة عائد GEDI"],
  adcAxis: ["Receiver signal (ADC counts)", "إشارة المستقبِل (عدّادات ADC)"],
  pulseStep: ["Guided discovery · The pulse", "الاستكشاف الموجّه · النبضة"],
  pulseTitle: ["Light returns in layers.", "يعود الضوء من طبقات مختلفة."],
  pulsePrompt: ["GEDI measures how much reflected light arrives at different times. The height scale aligns the recorded return with estimated ground at 0 m. Listen for where the return concentrates.", "يقيس GEDI مقدار الضوء المنعكس الواصل في أزمنة مختلفة. يضع مقياس الارتفاع الأرض المقدّرة عند صفر متر. استمع إلى الطبقات التي يتركّز فيها العائد."],
  trackStep: ["Guided discovery · The track", "الاستكشاف الموجّه · المسار"],
  trackTitle: ["Same height. Different echoes.", "الارتفاع نفسه، وصدى مختلف."],
  trackPrompt: ["Keep the band at {band} above estimated ground. Explore the track from footprint {low} to {high}, and notice how the tone and readout change.", "أبقِ نطاق الارتفاع {band} فوق الأرض المقدّرة. استكشف المسار من البصمة {low} إلى البصمة {high} ولاحظ تغيّر النغمة والقراءة."],
  trackCompared: ["You’ve explored both footprints. The louder tone carries a greater share of the return. Uncover the difference in the same height band.", "استكشفت بصمتَي المقارنة. تدلّ النغمة الأعلى صوتًا على حصّة أكبر من العائد. اكشف الفرق ضمن نطاق الارتفاع نفسه."],
  trackResult: ["Listen to either footprint again or inspect the measurements below the scene.", "استمع إلى أيّ من البصمتين مجددًا أو افحص القياسات أسفل المشهد."],
  currentReturn: ["Return share", "حصّة العائد"], lastReturn: ["Last sampled return share", "حصّة العائد عند آخر بصمة مرّ بها المسح"],
  trackGap: ["Between footprints", "بين بصمتين"],
  bandLabel: ["{low}–{high} m", "من {low} إلى {high} م"],
  comparisonResult: ["Footprint {shot} remained at least {margin} percentage points higher across the ground-reference and noise-processing tests.", "بقيت البصمة {shot} أعلى بفارق لا يقل عن {margin} نقاط مئوية في اختبارات تغيّر المرجع الأرضي ومعالجة الضجيج."],
  evidenceFor: ["Evidence for footprint {shot}", "دليل البصمة {shot}"],
  scanHigh: ["Scan footprint {shot} by height", "امسح ارتفاعات البصمة {shot}"],
  starting: ["Starting audio…", "تهيئة الصوت…"], playing: ["Playing", "التشغيل جارٍ"],
  playingMuted: ["Playing · tones muted", "التشغيل جارٍ · النغمات مكتومة"],
  playingSilent: ["Visual playback", "تشغيل مرئي"], paused: ["Paused", "متوقف مؤقتًا"],
  ended: ["Scan complete", "اكتمل المسح"], ready: ["Ready", "جاهز"],
  fallback: ["Audio unavailable. Visual playback is active.", "الصوت غير متاح. التشغيل المرئي يعمل."],
  below: ["Below processing threshold", "دون عتبة المعالجة"],
  missing: ["Measurement unavailable", "الرصد غير متاح"], excluded: ["Excluded by quality screening", "مستبعد حسب فحص الجودة"],
  measured: ["Derived from verified GEDI return", "مشتق من إشارة GEDI المتحققة"],
  observationId: ["GEDI shot number", "معرّف لقطة GEDI"], heightBand: ["Height range", "نطاق الارتفاع"],
  returnShare: ["Return share", "حصّة العائد"], exactFraction: ["Derived fraction", "الكسر المشتق"],
  granuleRows: ["L1B / L2A row (zero-based)", "صف L1B / L2A (ترقيم من صفر)"], time: ["Acquisition (UTC)", "وقت الرصد (UTC)"],
  center: ["Footprint centre (WGS84)", "مركز البصمة (WGS84)"], orbit: ["Orbit / track / beam", "المدار / المسار / الشعاع"],
  distance: ["Distance along track", "المسافة على المسار"], rh100: ["L2A RH100", "مقياس RH100 من L2A"],
  ground: ["Estimated ground (WGS84 ellipsoid)", "الأرض المقدّرة (إهليلج WGS84)"],
  acquisitionQuality: ["Quality / degrade / sensitivity", "الجودة / التدهور / الحساسية"],
  rxIndex: ["L1B waveform start (one-based) / count", "بداية موجة L1B (ترقيم من 1) / عدد العينات"],
  evidenceStatus: ["Evidence status", "حالة الدليل"], mappingVersion: ["Mapping version", "إصدار التحويل"],
  sampleLink: ["Verified sample JSON", "ملف العيّنة المتحققة JSON"], manifestLink: ["Provenance manifest and checksums", "سجل المصادر والبصمات الرقمية"],
  sourceNote: ["Historical release V001, preserved in checksummed rGEDI subsets of NASA granules.", "الإصدار التاريخي V001 محفوظ في مقتطفات rGEDI من ملفات ناسا، مع بصمات رقمية متحققة."],
  windowNote: ["Percentages use the same −10 to 22 m normalization window for every footprint.", "تستخدم النسب نافذة التطبيع نفسها لكل بصمة، من −10 إلى 22 مترًا."],
  error: ["The verified GEDI data could not be loaded. Try again to open the exhibit.", "تعذّر تحميل بيانات GEDI المتحققة. حاول مجددًا لفتح المعرض."],
  meters: ["m", "م"], of: ["of", "من"],
};

export function messages(language) {
  return (key) => strings[key]?.[language === "ar" ? 1 : 0] ?? key;
}

export function localizePage(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = language === "ar" ? "الغابة غير المرئية · EARTHPULSE" : "The Invisible Forest · EARTHPULSE";
  for (const [attribute, target] of [["copy", null], ["label", "aria-label"], ["alt", "alt"]]) {
    for (const element of document.querySelectorAll(`[data-${attribute}]`)) {
      if (!element.dataset.english) element.dataset.english = target ? element.getAttribute(target) : element.textContent;
      const text = language === "ar" ? ar[element.dataset[attribute]] ?? element.dataset.english : element.dataset.english;
      if (target) element.setAttribute(target, text);
      else element.textContent = text;
    }
  }
  const toggle = document.querySelector("#locale");
  toggle.textContent = language === "ar" ? "English" : "العربية";
  toggle.lang = language === "ar" ? "en" : "ar";
}
