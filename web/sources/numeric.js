const numericField = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Parse an explicit ASCII CSV number. Empty or malformed fields are never zero. */
export function csvNumber(field) {
  return numericField.test(field ?? "") ? Number(field) : NaN;
}

export function isRegularCoordinate(value, origin, spacing) {
  const offset = (value - origin) / spacing;
  return Number.isFinite(offset) && Math.abs(offset - Math.round(offset)) < 1e-8;
}

/** UTC calendar round-trip rejects dates that Date.parse silently rolls over. */
export function isCanonicalUtc(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value.replace("Z", ".000Z");
}
