import type { UnitSystem } from '../types';

/**
 * Conversion + formatting helpers. Storage stays in mm — UI converts on display.
 */

const MM_PER_INCH = 25.4;

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

/** Format a mm value for display in the chosen unit system. */
export function formatLength(mm: number, units: UnitSystem): string {
  if (units === 'metric') {
    if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
    return `${Math.round(mm)} mm`;
  }
  // imperial — show feet and inches if >= 12in
  const totalInches = mmToInches(mm);
  if (totalInches >= 12) {
    const ft = Math.floor(totalInches / 12);
    const inches = totalInches - ft * 12;
    return `${ft}′${inches.toFixed(1)}″`;
  }
  return `${totalInches.toFixed(1)}″`;
}

/**
 * Parse a user-entered length string into mm.
 * Accepts: "1500", "1500mm", "1.5m", "12in", "12\"", "3ft", "3'6\"", "3'6"
 * Returns null on parse failure.
 */
export function parseLength(input: string, defaultUnits: UnitSystem): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // feet + inches like 3'6" or 3'6
  const ftInMatch = s.match(/^(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)?\s*["″]?$/);
  if (ftInMatch) {
    const ft = parseFloat(ftInMatch[1]);
    const inches = ftInMatch[2] ? parseFloat(ftInMatch[2]) : 0;
    return inchesToMm(ft * 12 + inches);
  }

  // explicit unit suffix
  const unitMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|in|"|″|ft|'|′)?$/);
  if (!unitMatch) return null;

  const value = parseFloat(unitMatch[1]);
  const unit = unitMatch[2];

  if (!unit) {
    // bare number — interpret in defaultUnits' base unit (mm for metric, inches for imperial)
    return defaultUnits === 'metric' ? value : inchesToMm(value);
  }
  switch (unit) {
    case 'mm': return value;
    case 'cm': return value * 10;
    case 'm':  return value * 1000;
    case 'in':
    case '"':
    case '″': return inchesToMm(value);
    case 'ft':
    case "'":
    case '′': return inchesToMm(value * 12);
  }
  return null;
}

/** Placeholder hint shown next to length inputs. */
export function lengthPlaceholder(units: UnitSystem): string {
  return units === 'metric' ? 'e.g. 1500 or 1.5m' : 'e.g. 60 or 5\'';
}
