const STORAGE_KEY = "earthpulse.decode.attempts";
const LIMIT = 500;
const FIELDS = ["at", "caseId", "behavior", "level", "condition", "expectedCount", "guessCount", "guesses",
  "hits", "misses", "falseAlarms", "nearHits", "precision", "recall", "f1"];

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** One anonymous attempt from a revealed Discovery snapshot; null for anything else. */
export function attemptFromSnapshot(snapshot, { now = () => new Date() } = {}) {
  if (snapshot?.mode !== "discovery" || snapshot.phase !== "reveal" || !snapshot.score) return null;
  const { hits, misses, falseAlarms, nearHits, precision, recall, f1 } = snapshot.score;
  return {
    at: now().toISOString(),
    caseId: snapshot.caseId,
    behavior: snapshot.behavior,
    level: snapshot.level,
    condition: snapshot.condition,
    expectedCount: snapshot.expectedCount,
    guessCount: snapshot.guesses.length,
    guesses: snapshot.guesses.map(([row, col]) => [row, col]),
    hits, misses, falseAlarms, nearHits, precision, recall, f1,
  };
}

function csvCell(value) {
  let text = Array.isArray(value) ? value.map(([row, col]) => `${row}:${col}`).join(";") : String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Anonymous attempt log. Storage is optional and every access is guarded; memory is the fallback. */
export function createAttemptLog({ storage = defaultStorage(), key = STORAGE_KEY, limit = LIMIT, now } = {}) {
  let attempts = [];
  try {
    const parsed = JSON.parse(storage?.getItem(key) ?? "[]");
    if (Array.isArray(parsed)) attempts = parsed.slice(-limit);
  } catch {
    attempts = [];
  }

  function persist() {
    try {
      storage?.setItem(key, JSON.stringify(attempts));
    } catch {
      // Storage may be full, blocked or unavailable; the in-memory log keeps working.
    }
  }

  return {
    record(attempt) {
      if (!attempt) return false;
      attempts.push(attempt);
      if (attempts.length > limit) attempts = attempts.slice(-limit);
      persist();
      return true;
    },
    recordSnapshot(snapshot) {
      return this.record(attemptFromSnapshot(snapshot, now ? { now } : undefined));
    },
    list: () => attempts.map((attempt) => ({ ...attempt })),
    clear() {
      attempts = [];
      try {
        storage?.removeItem(key);
      } catch {
        // Nothing to clean up if storage is unavailable.
      }
    },
    exportJson: () => JSON.stringify(attempts, null, 2),
    exportCsv: () => [FIELDS.join(","), ...attempts.map((attempt) =>
      FIELDS.map((field) => csvCell(attempt[field])).join(","))].join("\n"),
  };
}
