// The meaning phrase of a value: a short, RELATIVE statement ("high compared with this dataset"), never a weather claim.
// It uses the same level as the recording (low / mid / high from the documented breakpoints), so what is said matches what is heard.
// Pure functions: no DOM, no audio. Documented in docs/earth-map/SONIFICATION_MAPPING.md.
import { AMBIENCE_PHENOMENA, DOCUMENTED_BREAKPOINTS, MIN_VALUE } from "./ambience-core.js";


const valid = (v) => typeof v === "number" && Number.isFinite(v);

/** "missing" | "none" (no measurable rain) | "low" | "mid" | "high" | null (a phenomenon without a meaning phrase). */
export function meaningLevel({ phenomenon, value, breakpoints = DOCUMENTED_BREAKPOINTS[phenomenon] }) {
  if (!AMBIENCE_PHENOMENA.includes(phenomenon)) return null;
  if (!valid(value)) return "missing";
  if (value < (MIN_VALUE[phenomenon] ?? -Infinity)) return "none";
  if (!breakpoints) return null;
  if (value <= breakpoints.low) return "low";
  if (value <= breakpoints.high) return "mid";
  return "high";
}

export const meaningCopy = {
  en: {
    dust: { low: "Dust: low compared with this dataset", mid: "Dust: moderate compared with this dataset", high: "Dust: high compared with this dataset" },
    rainfall: { none: "Rain: no measurable rain", low: "Rain: light compared with this dataset", mid: "Rain: moderate compared with this dataset", high: "Rain: high compared with this dataset" },
    wind: { low: "Wind: low compared with this dataset", mid: "Wind: moderate compared with this dataset", high: "Wind: high compared with this dataset" },
    missing: "no data here",
  },
  ar: {
    dust: { low: "غبار منخفض مقارنة ببقية البيانات", mid: "غبار متوسط مقارنة ببقية البيانات", high: "غبار مرتفع مقارنة ببقية البيانات" },
    rainfall: { none: "لا يوجد مطر يُقاس", low: "مطر قليل مقارنة ببقية البيانات", mid: "مطر متوسط مقارنة ببقية البيانات", high: "مطر مرتفع مقارنة ببقية البيانات" },
    wind: { low: "رياح ضعيفة مقارنة ببقية البيانات", mid: "رياح متوسطة مقارنة ببقية البيانات", high: "رياح قوية مقارنة ببقية البيانات" },
    missing: "لا توجد بيانات هنا",
  },
};

/** The phrase for a value, or null when the phenomenon has none. */
export function meaningPhrase({ phenomenon, value, breakpoints, language = "en" }) {
  const level = meaningLevel({ phenomenon, value, breakpoints });
  if (level === null) return null;
  const copy = meaningCopy[language] ?? meaningCopy.en;
  return level === "missing" ? copy.missing : copy[phenomenon][level];
}

/** Sensible spoken rounding: dust and rain 2 decimals, wind 1. */
const SPOKEN_DECIMALS = Object.freeze({ dust: 2, rainfall: 2, wind: 1 });
export const spokenNumber = (phenomenon, value) => {
  const n = Number(value.toFixed(SPOKEN_DECIMALS[phenomenon] ?? 2));
  return String(Object.is(n, -0) ? 0 : n);
};
