# EARTHPULSE | Submission and demo copy

## English

**Project summary**

EARTHPULSE is a bilingual Earth-science jukebox from Team Vanguard. It turns a verified NASA model output into a question anyone can investigate. Which of three regions had the strongest modeled dust signal on August 19, 2025? Listen to the bands, make a prediction, then inspect the measurements behind the answer. Explore the same event on a finer map, follow one cell across 13 verified snapshots, or try the spatial sound challenge with a keyboard, with sound or text.

**What we built**

- **Guided Discovery:** Compare north, middle and south. The number of notes represents the rank of each band’s mean. Reveal shows the cell values, the arithmetic and a link from each Quick cell to its centre on the finer map.
- **Dust Observatory:** Inspect the 25 × 40 map. Compare two selected three-hour windows from the same model build. Share a link that opens the dates and location needed to reproduce the displayed reading.
- **Earth Detective:** Find individual cells using north/south pitch, west/east stereo position and tone strength. The text-cue mode runs the same challenge without audio.
- **Sound Atlas:** The original ocean heat, precipitation, fire and forest instruments are also available in the same application.

## العربي

**ملخّص المشروع**

EARTHPULSE هو أطلس علوم أرض مسموع بالعربي والإنجليزي من فريق Vanguard. حوّلنا نتائج نموذج موثّق من ناسا إلى سؤال ممكن لأي شخص يستكشفه. أيّ منطقة من ثلاث مناطق كانت فيها إشارة الغبار الأقوى في النموذج يوم ١٩ أغسطس ٢٠٢٥؟ اسمع الإشارات، توقّع الجواب، وبعدين افتح الدليل وشوف القياسات اللي انحسبت منها النتيجة. بتقدر تكمل على خريطة أدقّ، تتابع خلية عبر ١٣ لقطة موثّقة، أو تلعب تحدّي الصوت المكاني بالكيبورد بالصوت أو بالنص.

**مسار العرض**

افتح «استكشف الغبار بالصوت» وقارن الشمال والوسط والجنوب. كلما زاد عدد النغمات، ارتفع ترتيب المنطقة في المقارنة. خلّي الجمهور يختار، وبعد الكشف افتح حساب المتوسط لخلايا المنطقة الأقوى. اضغط «افحص المركز» على إحدى الخلايا حتى تفتح نفس الموقع في المرصد. اعرض تاريخ الخلية، واختر نافذة زمنية من نفس إصدار النموذج للمقارنة.

## A 90-second demonstration

| Time | Action and narration |
| --- | --- |
| 0–12 s | Open the dust challenge. “These sounds are generated from NASA model values. Which region had the strongest dust signal?” |
| 12–35 s | Play the comparison or use the equivalent text-cue path. Let the viewer make a prediction. Explain that note count represents rank. |
| 35–60 s | Reveal. Show the winning band, its mean and the terms of the calculation. Follow one cell’s centre into the Observatory. |
| 60–82 s | Open the cell’s date history and compare two same-build periods. Explain the direction of change and show the granule links. |
| 82–90 s | Point out the keyboard and text-cue route, then close with the scientific boundary: column optical depth describes light attenuation and does not measure exposure at the ground. |

## Scientific statements that belong in the submission

- The source is standard GEOS-FP dust aerosol optical depth at 550 nm. The reference is the 18:00–21:00 UTC three-hour mean on August 19, 2025. The Reveal links to the original granule.
- The regional decision uses arithmetic means over the available Quick cells with equal weight. The finer Observatory cells use the independently aggregated 25 × 40 grid. Following a Quick-cell centre preserves geography and time, while changing the averaging footprint.
- NASA SVS 5669 is a separate 2 km GEOS-FP Replay frame at 20:00 UTC. It is related scientific context. Neither pixel alignment nor numerical identity with the reference case is asserted.
- Each plotted date represents a selected three-hour window. A two-date difference is second minus first, for the same model build. The windows do not establish a trend, seasonal mean or climatology.
- Dust optical depth describes light attenuation through the atmospheric column. The 0.20 cutoff is a game rule. Neither the level nor the cutoff measures surface PM2.5 or human health risk.

## Evidence and delivery

- [Source and processing ledger](decode-data.md)
- [Dust catalog validation and extraction](dust-v2-data.md)
- [Guided calculation and mapping method](guided-dust.md)
- [Live walkthrough and explicit accessibility checks](dust-demo.md)

Build from this checkout with Node.js 22 or later. The verification results and release archive should correspond to the same commit. Record the deployed URL and the actual browser and assistive technology used before pasting the final submission. Automated browser evidence covers rendered labels and keyboard interaction. Record independent listening or screen-reader speech only after observing it.
