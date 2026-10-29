import type { UnitSystem } from '../types';

/**
 * Conversion + formatting helpers. Storage stays in mm — UI converts on display.
 */

const MM_PER_INCH = 25.4;

const mmToInches = (mm: number) => mm / MM_PER_INCH;
const inchesToMm = (inches: number) => inches * MM_PER_INCH;

/** Format a mm value for display in the chosen unit system. */
export function formatLength(mm: number, units: UnitSystem): string {
  if (units === 'metric') {
    const r = Math.round(mm);
    return r >= 1000 ? `${(r / 1000).toFixed(2)} m` : `${r} mm`;
  }
  // Round to tenths of an inch first so 23.96″ shows as 2′0.0″, not 1′12.0″.
  const tenths = Math.round(mmToInches(mm) * 10);
  if (tenths >= 120) return `${Math.floor(tenths / 120)}′${((tenths % 120) / 10).toFixed(1)}″`;
  return `${(tenths / 10).toFixed(1)}″`;
}

/** A value for pre-filling a length input (no unit suffix — parseLength reads it back). */
export function toInputValue(mm: number, units: UnitSystem): string {
  return units === 'metric' ? String(Math.round(mm)) : mmToInches(mm).toFixed(1);
}

const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const FEET_INCHES = new RegExp(String.raw`^${NUM}\s*(?:'|′|ft)\s*-?\s*(?:${NUM}\s*(?:"|″|in)?)?$`);
const VALUE_UNIT = new RegExp(String.raw`^${NUM}\s*(mm|cm|m|in|"|″)?$`);

/**
 * Parse a user-entered length into mm. Returns null if it can't be read.
 *
 * Accepts: 1500 · 1,500 · 1500mm · 150cm · 1.5m · 12in · 12" · 3ft · 3' · 3'6" ·
 * 3ft 6in · 3 feet 6 inches · 3'-6" · smart quotes (3’6”). A bare number uses
 * the active system's base unit (mm for metric, inches for imperial).
 */
export function parseLength(input: string, defaultUnits: UnitSystem): number | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[’‘´`]/g, "'")
    .replace(/[”“]|''/g, '"')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/\s*\b(?:feet|foot)\b/g, 'ft')
    .replace(/\s*\b(?:inches|inch)\b/g, 'in');
  if (!s) return null;

  const ftIn = s.match(FEET_INCHES);
  if (ftIn) {
    const inches = ftIn[2] ? parseFloat(ftIn[2]) : 0;
    if (inches >= 12) return null; // 3'14" is almost certainly a typo
    return inchesToMm(parseFloat(ftIn[1]) * 12 + inches);
  }

  const m = s.match(VALUE_UNIT);
  if (!m) return null;
  const value = parseFloat(m[1]);
  switch (m[2]) {
    case undefined:
      return defaultUnits === 'metric' ? value : inchesToMm(value);
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
    default: // in, ", ″
      return inchesToMm(value);
  }
}

/** Placeholder hint shown in length inputs. */
export function lengthPlaceholder(units: UnitSystem): string {
  return units === 'metric' ? 'e.g. 1500 or 1.5m' : `e.g. 60 or 5'`;
}
