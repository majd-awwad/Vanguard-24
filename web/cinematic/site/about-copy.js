// Words for web/pages/about.html. No data values here. Team names are the six first names given by the team; roles
// and bios are deliberately absent because the repository documents none.

export const TEAM = Object.freeze(["Mohammad", "Andreh", "Yaman", "Roaa", "Israa", "Majd"]);
export const TEAM_AR = Object.freeze(["محمد", "أندريه", "يمان", "رؤى", "إسراء", "مجد"]);

export const aboutCopy = {
  en: {
    title: "About",
    eyebrow: "About EARTHPULSE",
    titleLead: "EARTHPULSE", titleAccent: "Hear the unseen",
    lede: "A sonification experience that turns real NASA Earth science data into sound, so that environmental patterns can be explored by listening as well as by looking.",
    decode: "Start the Decode challenge", explore: "Explore Earth by sound", mission: "Our mission",
    decorLabel: "Decorative", decorWave: "Decorative waveform and Earth. They show no data.",
    what: { title: "What is EARTHPULSE?", p1: "EARTHPULSE maps measured or modelled Earth data to sound. Today it covers one case: atmospheric dust over North Africa and the Eastern Mediterranean, from NASA GMAO GEOS-FP model data.", p2: "You listen across a map, work out where the dust is, and then see the measured answer. Every number and sound on the site comes from that dataset or from the rules that turn it into sound.", link: "See the data and method" },
    why: { title: "Why sonification matters", p1: "Maps and charts depend on sight. Sound lets a pattern be explored over time and space by ear: pitch, loudness and left-to-right position can carry the same information a colour map does.", p2: "It is also a second channel for everyone: a way to notice structure that is easy to miss in a picture." },
    study: "A listening study with blind and low-vision participants is planned. Until it has been done, we make no claim about how much EARTHPULSE helps.",
    missionText: "Make NASA Earth science data something people can hear, explore and question, with every sound traceable to real data and every limit stated openly.",
    cards: [
      { title: "Inclusive access", text: "Built so the whole challenge can be played by keyboard and with sound. Testing with screen-reader users is still to be done." },
      { title: "Interactive learning", text: "Listen, guess where the dust is, then reveal the measured answer and compare." },
      { title: "Environmental awareness", text: "One place and one day of real dust data, shown honestly, as a starting point for curiosity about the atmosphere." },
      { title: "Scientific exploration", text: "Every value traces back to a NASA data file, with its processing and limits written down." },
    ],
    team: { photoAlt: "Team Vanguard with event organizers in front of the NASA Space Apps Nablus banner", caption: "Team Vanguard at NASA Space Apps Challenge 2026 — Nablus, An-Najah National University", title: "Meet the team", name: "Team Vanguard", place: "An-Najah National University, Palestine", text: "We are computer science students building EARTHPULSE for the NASA Space Apps Challenge 2026.", members: "Team members" },
    credit: "Data: NASA GMAO GEOS-FP. Earth imagery: NASA Earth Observatory, Blue Marble. EARTHPULSE is a student project and is not endorsed by NASA.",
  },
  ar: {
    title: "حول",
    eyebrow: "حول EARTHPULSE",
    titleLead: "EARTHPULSE", titleAccent: "اسمع ما لا يُرى",
    lede: "تجربة تحويل البيانات إلى صوت، تحوّل بيانات علوم الأرض الحقيقية من ناسا إلى أصوات، لتُستكشف الأنماط البيئية بالاستماع كما بالنظر.",
    decode: "ابدأ تحدي فك الشيفرة", explore: "استكشف الأرض بالصوت", mission: "رسالتنا",
    decorLabel: "زخرفي", decorWave: "الموجة الصوتية والأرض زخرفيتان ولا تعرضان أي بيانات.",
    what: { title: "ما هو EARTHPULSE؟", p1: "يحوّل EARTHPULSE بيانات الأرض المقيسة أو المحسوبة بنموذج إلى صوت. وهو يغطي اليوم حالة واحدة: الغبار الجوي فوق شمال أفريقيا وشرق البحر المتوسط، من بيانات نموذج NASA GMAO GEOS-FP.", p2: "تستمع عبر الخريطة، وتستنتج أين الغبار، ثم ترى الإجابة المقيسة. كل رقم وصوت في الموقع يأتي من هذه البيانات أو من القواعد التي تحوّلها إلى صوت.", link: "اطّلع على البيانات والمنهج" },
    why: { title: "لماذا يهم التحويل إلى صوت؟", p1: "تعتمد الخرائط والرسوم على البصر. أما الصوت فيتيح استكشاف النمط عبر الزمن والمكان بالأذن: يمكن للنغمة وشدة الصوت والموضع من اليسار إلى اليمين أن تحمل المعلومة التي تحملها خريطة الألوان.", p2: "وهو قناة ثانية للجميع: طريقة للانتباه إلى بنية قد يسهل تفويتها في الصورة." },
    study: "نخطط لدراسة استماع مع مشاركين مكفوفين وضعاف البصر. وإلى أن تُجرى، لا ندّعي شيئًا عن مقدار ما يفيده EARTHPULSE.",
    missionText: "أن نجعل بيانات علوم الأرض من ناسا شيئًا يمكن للناس سماعه واستكشافه ومساءلته، مع إمكانية تتبّع كل صوت إلى بيانات حقيقية وذكر كل حدّ بوضوح.",
    cards: [
      { title: "وصول شامل", text: "صُمّم ليمكن لعب التحدي كاملًا بلوحة المفاتيح وبالصوت. ولم يُجرَ بعد الاختبار مع مستخدمي قارئات الشاشة." },
      { title: "تعلّم تفاعلي", text: "استمع، وخمّن أين الغبار، ثم اكشف الإجابة المقيسة وقارن." },
      { title: "وعي بيئي", text: "مكان واحد ويوم واحد من بيانات الغبار الحقيقية، تُعرض بأمانة، كنقطة بداية للفضول حول الغلاف الجوي." },
      { title: "استكشاف علمي", text: "كل قيمة تعود إلى ملف بيانات من ناسا، مع توثيق معالجتها وحدودها." },
    ],
    team: { photoAlt: "فريق Vanguard مع منظمي الفعالية أمام لافتة NASA Space Apps نابلس", caption: "فريق Vanguard في تحدي ناسا Space Apps 2026 — نابلس، جامعة النجاح الوطنية", title: "تعرّف على الفريق", name: "فريق Vanguard", place: "جامعة النجاح الوطنية، فلسطين", text: "نحن طلبة علوم حاسوب نبني EARTHPULSE لتحدي ناسا Space Apps 2026.", members: "أعضاء الفريق" },
    credit: "البيانات: NASA GMAO GEOS-FP. صور الأرض: مرصد الأرض التابع لناسا، Blue Marble. EARTHPULSE مشروع طلابي ولا تتبنّاه ناسا.",
  },
};
