const messages = {
  'stage.explore': { en: 'Explore', ar: 'استكشاف' },
  'stage.legend': { en: 'Legend', ar: 'معايرة الصوت' },
  'stage.listen': { en: 'Listen', ar: 'استماع' },
  'stage.decode': { en: 'Decode', ar: 'فكّ الإشارات' },
  'stage.reveal': { en: 'Reveal', ar: 'كشف النتيجة' },
  'explore.welcome': {
    en: 'Welcome to EARTHPULSE: Hear the Unseen.',
    ar: 'أهلًا بك في EARTHPULSE: اسمع ما لا تراه.',
  },
  'explore.intro': {
    en: 'Explore patterns in NASA Earth observations through sound.',
    ar: 'استكشف الأنماط في بيانات رصد الأرض من ناسا من خلال الصوت.',
  },
  'explore.journey': {
    en: 'Explore the case, learn the sound cues in Legend, listen to the sweep, mark your guesses in Decode, then compare them with the data in Reveal.',
    ar: 'استكشف الحالة، وتعرّف على الإشارات في معايرة الصوت، واستمع إلى المسح، وحدّد تخميناتك في مرحلة فكّ الإشارات، ثم قارنها بالبيانات عند كشف النتيجة.',
  },
  'explore.eyesFree': {
    en: 'Use the keyboard and screen reader announcements to follow the experience without looking at the map.',
    ar: 'استخدم لوحة المفاتيح وإعلانات قارئ الشاشة لمتابعة التجربة بدون النظر إلى الخريطة.',
  },
  'explore.controls': {
    en: 'Click a cell to select or deselect it. With the keyboard, use the arrow keys to move between cells and Space to select or deselect.',
    ar: 'انقر على الخلية لتحديدها أو إلغاء تحديدها. بلوحة المفاتيح، استخدم الأسهم للتنقّل بين الخلايا ومفتاح المسافة للتحديد أو إلغائه.',
  },
  'explore.source': {
    en: 'Data source: {product}, version {version}. Observation period: {start} to {end}.',
    ar: 'مصدر البيانات: {product}، الإصدار {version}. فترة الرصد: من {start} إلى {end}.',
  },
  'explore.fixtureDisclaimer': {
    en: 'This case uses synthetic demonstration data. The values are for testing and do not represent NASA observations.',
    ar: 'تستخدم هذه الحالة بيانات اصطناعية للعرض والاختبار. القيم لا تمثّل أرصاد ناسا.',
  },
  'legend.intro': {
    en: 'Listen to examples of direction, pitch, and loudness before the map sweep.',
    ar: 'استمع إلى أمثلة على اتجاه الصوت ودرجة النغمة وشدّة الصوت قبل مسح الخريطة.',
  },
  'legend.direction': {
    en: 'Listen for sounds on your left and right.',
    ar: 'انتبه إلى الأصوات القادمة من اليسار واليمين.',
  },
  'legend.pitch': {
    en: 'Compare the low-pitched tone with the high-pitched tone.',
    ar: 'قارن بين النغمة منخفضة الحدة والنغمة عالية الحدة.',
  },
  'legend.loudness': {
    en: 'Compare the quiet sound with the louder sound.',
    ar: 'قارن بين الصوت الخافت والصوت الأعلى شدّة.',
  },
  'legend.beforeSweep': {
    en: 'Replay the sound examples if you need to, then start the first sweep.',
    ar: 'أعد تشغيل الأمثلة الصوتية إذا احتجت، ثم ابدأ المسح الأول.',
  },
  'legend.started': { en: 'Sound calibration started.', ar: 'بدأت معايرة الصوت.' },
  'legend.completed': { en: 'Sound calibration complete.', ar: 'اكتملت معايرة الصوت.' },
  'listen.start': { en: 'Start the spatial sweep', ar: 'ابدأ المسح الصوتي' },
  'listen.pause': { en: 'Pause', ar: 'إيقاف مؤقت' },
  'listen.replay': { en: 'Replay', ar: 'إعادة التشغيل' },
  'listen.started': { en: 'Spatial sweep started.', ar: 'بدأ المسح الصوتي.' },
  'listen.completed': { en: 'Spatial sweep complete.', ar: 'اكتمل المسح الصوتي.' },
  'listen.spatial': {
    en: 'The sweep moves across the map from west to east. Listen for changes in direction, pitch, and loudness as it moves.',
    ar: 'ينتقل المسح عبر الخريطة من الغرب إلى الشرق. انتبه إلى تغيّر اتجاه الصوت ودرجة النغمة وشدّتها خلال المسح.',
  },
  'listen.mutedFallback': {
    en: 'If sound is muted, follow the text instructions. Press Enter to probe a cell, then R to read its sound category.',
    ar: 'إذا كان الصوت مكتومًا، اتبع التعليمات المكتوبة. اضغط Enter لفحص الخلية، ثم R لقراءة فئة الصوت.',
  },
  'listen.navigation': {
    en: 'After the sweep, continue to Decode. You can replay the sweep or probe individual cells before submitting.',
    ar: 'بعد المسح، انتقل إلى مرحلة فكّ الإشارات. بإمكانك إعادة المسح أو فحص الخلايا واحدة واحدة قبل إرسال تخميناتك.',
  },
  'grid.row': { en: 'Row {row}', ar: 'الصف {row}' },
  'grid.column': { en: 'Column {col}', ar: 'العمود {col}' },
  'grid.position': { en: 'Row {row}, column {col}', ar: 'الصف {row}، العمود {col}' },
  'grid.focused': {
    en: 'Focused row {row}, column {col}.',
    ar: 'التركيز الآن على الصف {row}، العمود {col}.',
  },
  'grid.selected': {
    en: 'Selected row {row}, column {col}.',
    ar: 'تم اختيار الخلية في الصف {row}، العمود {col}.',
  },
  'grid.deselected': {
    en: 'Deselected row {row}, column {col}.',
    ar: 'تم إلغاء اختيار الخلية في الصف {row}، العمود {col}.',
  },
  'grid.probeRequested': {
    en: 'Probing row {row}, column {col}.',
    ar: 'جارٍ فحص الخلية في الصف {row}، العمود {col}.',
  },
  'grid.noReading': { en: 'No reading available.', ar: 'ما في قراءة متاحة.' },
  'grid.heard.low': { en: 'Low', ar: 'منخفض' },
  'grid.heard.mid': { en: 'Medium', ar: 'متوسط' },
  'grid.heard.high': { en: 'High', ar: 'مرتفع' },
  'grid.heard.silent': { en: 'Silent', ar: 'صامت' },
  'grid.submitInstructions': {
    en: 'Mark the cells where you detected the phenomenon, then submit your guesses.',
    ar: 'حدّد الخلايا اللي لاحظت فيها الظاهرة، وبعدين أرسل تخميناتك.',
  },
  'grid.submit': { en: 'Submit guesses', ar: 'إرسال التخمينات' },
  'grid.submitted': { en: 'Guesses submitted.', ar: 'تم إرسال التخمينات.' },
  'grid.shortcut.arrows': {
    en: 'Arrow keys: move between cells.',
    ar: 'مفاتيح الأسهم: تنقّل بين الخلايا.',
  },
  'grid.shortcut.space': {
    en: 'Space: select or deselect the focused cell.',
    ar: 'مفتاح المسافة: اختَر الخلية اللي عليها التركيز أو ألغِ اختيارها.',
  },
  'grid.shortcut.enter': { en: 'Enter: probe the focused cell.', ar: 'Enter: افحص الخلية اللي عليها التركيز.' },
  'grid.shortcut.p': { en: 'P: play the sweep.', ar: 'P: شغّل المسح الصوتي.' },
  'grid.shortcut.l': { en: 'L: play the sound legend.', ar: 'L: شغّل معايرة الصوت.' },
  'grid.shortcut.r': { en: 'R: read the focused cell.', ar: 'R: اقرأ الخلية اللي عليها التركيز.' },
  'grid.shortcut.s': { en: 'S: submit your guesses.', ar: 'S: أرسل تخميناتك.' },
  'discovery.cellReadout': {
    en: 'Row {row}, column {col}. {reading}',
    ar: 'الصف {row}، العمود {col}. {reading}',
  },
  'discovery.lastHeard': { en: 'Last heard: {heard}.', ar: 'آخر ما سمعت: {heard}.' },
  'reveal.intro': {
    en: 'Compare your selections with the data for this case.',
    ar: 'قارن اختياراتك ببيانات هذه الحالة.',
  },
  'reveal.hits': { en: 'Hits: {hits}', ar: 'التخمينات الصحيحة: {hits}' },
  'reveal.misses': { en: 'Misses: {misses}', ar: 'الخلايا الفائتة: {misses}' },
  'reveal.falseAlarms': { en: 'False alarms: {falseAlarms}', ar: 'الاختيارات الخاطئة: {falseAlarms}' },
  'reveal.nearHits': { en: 'Near hits: {nearHits}', ar: 'التخمينات القريبة: {nearHits}' },
  'reveal.precision': { en: 'Precision: {precision}', ar: 'الدقة: {precision}' },
  'reveal.recall': { en: 'Recall: {recall}', ar: 'الاسترجاع: {recall}' },
  'reveal.f1': { en: 'F1 score: {f1}', ar: 'درجة F1: {f1}' },
  'reveal.scoreSummary': {
    en: 'Results: {hits} hits, {misses} misses, {falseAlarms} false alarms, and {nearHits} near hits.',
    ar: 'النتيجة: التخمينات الصحيحة {hits}، الخلايا الفائتة {misses}، الاختيارات الخاطئة {falseAlarms}، والتخمينات القريبة {nearHits}.',
  },
  'reveal.selection.correct': { en: 'Correct selection', ar: 'اختيار صحيح' },
  'reveal.selection.missed': { en: 'Missed cell', ar: 'خلية فائتة' },
  'reveal.selection.false': { en: 'False selection', ar: 'اختيار خاطئ' },
  'reveal.cellValue': {
    en: 'Row {row}, column {col}. Measurement: {value} {unit}.',
    ar: 'الصف {row}، العمود {col}. القياس: {value} {unit}.',
  },
  'learning.cellValue': {
    en: 'Row {row}, column {col}. Measurement: {value} {unit}.',
    ar: 'الصف {row}، العمود {col}. القياس: {value} {unit}.',
  },
  'reveal.source': {
    en: 'NASA data attribution: {product}, version {version}.',
    ar: 'إسناد بيانات ناسا: {product}، الإصدار {version}.',
  },
  'reveal.relation.SAME_DATA': {
    en: 'The image and measurements use the same data.',
    ar: 'تستند الصورة والقياسات إلى البيانات نفسها.',
  },
  'reveal.relation.SAME_MODEL_DIFFERENT_RUN': {
    en: 'The image and measurements use different runs of the same model.',
    ar: 'تستند الصورة والقياسات إلى تشغيلين مختلفين للنموذج نفسه.',
  },
  'reveal.relation.RELATED_CONTEXT': {
    en: 'The image provides related context for this case.',
    ar: 'توفّر الصورة سياقًا مرتبطًا بهذه الحالة.',
  },
  'reveal.visualLinkNote': { en: '{note}', ar: '{note}' },
  'general.loading': { en: 'Loading case…', ar: 'جارٍ تحميل الحالة…' },
  'general.error': { en: 'The case could not be loaded.', ar: 'تعذّر تحميل الحالة.' },
  'general.retry': { en: 'Try again', ar: 'حاول مرة ثانية' },
  'general.restart': { en: 'Restart', ar: 'ابدأ من جديد' },
  'level.quick': { en: 'Quick ({rows} × {cols})', ar: 'سريع ({rows} × {cols})' },
  'level.advanced': { en: 'Advanced ({rows} × {cols})', ar: 'متقدّم ({rows} × {cols})' },
  'mode.discovery': { en: 'Discovery', ar: 'الاكتشاف' },
  'mode.learning': { en: 'Learning', ar: 'التعلّم' },
  'condition.sound': { en: 'Sound', ar: 'الصوت' },
  'condition.text': { en: 'Text', ar: 'النص' },
  'condition.both': { en: 'Sound and text', ar: 'الصوت والنص' },
  'accessibility.instructions': {
    en: 'Use Tab to reach the grid and the page controls. Inside the grid, use the arrow keys to move. Screen reader users can follow announcements for actions and results.',
    ar: 'استخدم مفتاح Tab للوصول إلى الشبكة وأزرار الصفحة، ثم تنقّل داخل الشبكة بمفاتيح الأسهم. إذا كنت تستخدم قارئ شاشة، تابع إعلانات الإجراءات والنتائج.',
  },
};

const numberFormats = {
  en: new Intl.NumberFormat('en', { maximumSignificantDigits: 21 }),
  ar: new Intl.NumberFormat('ar', { maximumSignificantDigits: 21 }),
};

const percentFormats = {
  en: new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 2 }),
  ar: new Intl.NumberFormat('ar', { style: 'percent', maximumFractionDigits: 2 }),
};

const scoreRates = new Set(['precision', 'recall', 'f1']);
const heardCategories = new Set(['low', 'mid', 'high', 'silent']);

function interpolate(template, locale, params) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (placeholder, name) => {
    if (!Object.hasOwn(params, name)) return placeholder;

    const value = params[name];
    if (typeof value === 'number' && Number.isFinite(value)) {
      const format = scoreRates.has(name) ? percentFormats[locale] : numberFormats[locale];
      return format.format(value);
    }
    return typeof value === 'string' ? value : placeholder;
  });
}

function heardMessage(locale, heard) {
  if (!heardCategories.has(heard)) return messages['grid.noReading'][locale];

  return interpolate(messages['discovery.lastHeard'][locale], locale, {
    heard: messages[`grid.heard.${heard}`][locale],
  });
}

/**
 * Returns plain text. Unknown languages use English, unknown keys return the key,
 * and missing generic parameters remain visible as placeholders.
 *
 * For discovery.cellReadout, pass zero-based snapshot row and col plus lastProbe.
 * Other grid messages take one-based display positions. Only call measurement
 * templates in the corresponding Reveal or Learning state. Pass the source
 * visualLink.note as note, and render returned strings as text. Score rates
 * (precision, recall, and f1) are ratios formatted as percentages.
 */
export function decodeMessage(lang, key, params = {}) {
  const locale = typeof lang === 'string' && /^ar(?:-|$)/i.test(lang) ? 'ar' : 'en';
  if (typeof key !== 'string') return '';
  if (!Object.hasOwn(messages, key)) return key;

  const values = params ?? {};
  if (key === 'discovery.cellReadout') {
    const { row, col, lastProbe } = values;
    if (!Number.isSafeInteger(row) || row < 0 || !Number.isSafeInteger(col) || col < 0) {
      return messages['grid.noReading'][locale];
    }

    const heard = lastProbe?.row === row && lastProbe?.col === col ? lastProbe.heard : null;
    return interpolate(messages[key][locale], locale, {
      row: row + 1,
      col: col + 1,
      reading: heardMessage(locale, heard),
    });
  }

  if (key === 'discovery.lastHeard') return heardMessage(locale, values.heard);

  return interpolate(messages[key][locale], locale, values);
}
