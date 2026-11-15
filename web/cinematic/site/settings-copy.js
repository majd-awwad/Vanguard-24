// Words for web/pages/settings.html. Keyboard shortcuts are not listed here: they are read from the Decode grid's own
// message table (web/i18n/decode-messages.js), which describes what web/accessibility/decode-grid.js actually does.
// The Sound Lab and Explore grids' keys are listed below and are implemented in sound.js and explore.js.

export const settingsCopy = {
  en: {
    title: "Accessibility & Settings",
    eyebrow: "Accessibility & Settings",
    titleLead: "Settings", lede: "Comfort and access options. They are saved in this browser only and apply to every EARTHPULSE page, including the Decode challenge.",
    saved: "Saved in this browser.", noStorage: "This browser blocks storage, so settings apply to this page view only.",
    language: { title: "Language", help: "Text switches between English and Arabic. The map never mirrors: west stays on the left in both.", en: "English (EN)", ar: "العربية (AR)" },
    volume: { title: "Volume", help: "Sets the master volume for all sound.", label: "Volume", sample: "Play a sample sound", sampleHelp: "Plays the first second of the sound legend: a tone on the left.", playing: "Playing the sample." },
    speed: { title: "Playback speed", help: "Changes how fast listening plays.", label: "Playback speed", unit: "×" },
    contrast: { title: "High contrast", help: "Stronger text and borders on a pure black background.", label: "High contrast" },
    text: { title: "Text size", help: "Scales text on every page.", label: "Text size", sizes: { sm: "Small", md: "Medium", lg: "Large", xl: "Extra large" } },
    captions: { title: "Captions", help: "Shows a text line describing each sound that plays, in the Sound Lab and Explore Earth.", label: "Show captions", preview: "Preview: captions appear here when you play a sample." },
    motion: { title: "Reduced motion", help: "EARTHPULSE follows your device setting. There is no separate switch here.", on: "Your device asks for reduced motion: camera flights and animations are off.", off: "Your device does not ask for reduced motion." },
    guidance: { title: "Spoken instructions", label: "Guided Voice in the Studio (spoken guidance with the recordings)", help: "Reads the instructions aloud with a voice installed on your device. The switch is the same as Guided Voice / Pure Sonification in the Sound Studio.", read: "Read instructions aloud", stop: "Stop reading", unavailable: "No voice for this language is installed on this device, so instructions are shown as text only." },
    instructionsTitle: "Instructions",
    instructions: ["Decode: listen to the map, mark the cells where you hear dust, then submit your guesses.", "Cells are named by letter and number. The letter is the row from the north (A is the northernmost). The number is the column from the west (1 is the westernmost).", "Left to right in the sound is west to east. Higher pitch is farther north. Louder is more dust.", "Sound Lab and Explore Earth let you pick any cell and hear it."],
    keys: { title: "Keyboard guide", decode: "Decode challenge grid", sound: "Sound Lab and Explore Earth grids", items: ["Arrow keys: move between cells (left is always west).", "Home / End: first or last column of the row.", "Enter or Space: select the cell and play it."], note: "Tab moves between controls. Every control on every page can be used without a mouse." },
    reset: { label: "Reset all settings", done: "Settings reset to the defaults." },
    credit: "Data: NASA GMAO GEOS-FP. EARTHPULSE is a student project and is not endorsed by NASA.",
  },
  ar: {
    title: "إمكانية الوصول والإعدادات",
    eyebrow: "إمكانية الوصول والإعدادات",
    titleLead: "الإعدادات", lede: "خيارات للراحة وسهولة الوصول. تُحفظ في هذا المتصفح فقط وتنطبق على كل صفحات EARTHPULSE، بما فيها تحدي فك الشيفرة.",
    saved: "حُفظت في هذا المتصفح.", noStorage: "يمنع هذا المتصفح التخزين، لذلك تنطبق الإعدادات على هذه الصفحة فقط.",
    language: { title: "اللغة", help: "يتبدّل النص بين العربية والإنجليزية. لا تنعكس الخريطة أبدًا: يبقى الغرب على اليسار في اللغتين.", en: "English (EN)", ar: "العربية (AR)" },
    volume: { title: "مستوى الصوت", help: "يضبط مستوى الصوت العام لكل الأصوات.", label: "مستوى الصوت", sample: "شغّل صوتًا تجريبيًا", sampleHelp: "يشغّل أول ثانية من الدليل الصوتي: نغمة على اليسار.", playing: "يجري تشغيل الصوت التجريبي." },
    speed: { title: "سرعة التشغيل", help: "يغيّر سرعة تشغيل الاستماع.", label: "سرعة التشغيل", unit: "×" },
    contrast: { title: "تباين عالٍ", help: "نص وحدود أوضح على خلفية سوداء خالصة.", label: "تباين عالٍ" },
    text: { title: "حجم النص", help: "يكبّر أو يصغّر النص في كل الصفحات.", label: "حجم النص", sizes: { sm: "صغير", md: "متوسط", lg: "كبير", xl: "كبير جدًا" } },
    captions: { title: "التعليقات النصية", help: "تعرض سطرًا نصيًا يصف كل صوت يُشغَّل، في مختبر الصوت واستكشاف الأرض.", label: "أظهر التعليقات", preview: "معاينة: تظهر التعليقات هنا عند تشغيل صوت تجريبي." },
    motion: { title: "تقليل الحركة", help: "يتبع EARTHPULSE إعداد جهازك. لا يوجد مفتاح منفصل هنا.", on: "جهازك يطلب تقليل الحركة: رحلات الكاميرا والحركات متوقفة.", off: "جهازك لا يطلب تقليل الحركة." },
    guidance: { title: "التعليمات المنطوقة", label: "الإرشاد الصوتي في الاستوديو (إرشاد منطوق مع التسجيلات)", help: "تقرأ التعليمات بصوت مثبّت على جهازك. المفتاح نفسه هو «إرشاد بالكلام / أصوات البيانات فقط» في استوديو الصوت.", read: "اقرأ التعليمات بصوت عالٍ", stop: "أوقف القراءة", unavailable: "لا يوجد صوت لهذه اللغة على هذا الجهاز، لذلك تُعرض التعليمات نصًا فقط." },
    instructionsTitle: "التعليمات",
    instructions: ["فك الشيفرة: استمع إلى الخريطة، وعلّم الخلايا التي تسمع فيها غبارًا، ثم أرسل تخميناتك.", "تُسمّى الخلايا بحرف ورقم. الحرف هو الصف من الشمال (A هو الأقصى شمالًا)، والرقم هو العمود من الغرب (1 هو الأقصى غربًا).", "من اليسار إلى اليمين في الصوت هو من الغرب إلى الشرق. النغمة الأعلى أبعد شمالًا. والصوت الأعلى غبار أكثر.", "يتيح مختبر الصوت واستكشاف الأرض اختيار أي خلية والاستماع إليها."],
    keys: { title: "دليل لوحة المفاتيح", decode: "شبكة تحدي فك الشيفرة", sound: "شبكتا مختبر الصوت واستكشاف الأرض", items: ["مفاتيح الأسهم: التنقل بين الخلايا (اليسار هو الغرب دائمًا).", "Home / End: أول عمود في الصف أو آخره.", "Enter أو المسافة: اختيار الخلية وتشغيلها."], note: "يتنقل Tab بين عناصر التحكم. يمكن استخدام كل عنصر في كل صفحة دون فأرة." },
    reset: { label: "إعادة ضبط كل الإعدادات", done: "أُعيدت الإعدادات إلى القيم الافتراضية." },
    credit: "البيانات: NASA GMAO GEOS-FP. EARTHPULSE مشروع طلابي ولا تتبنّاه ناسا.",
  },
};
