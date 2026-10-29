import { usePlanStore } from './planStore';
import { computeOverlaps } from '../lib/geometry';
import type { FurnitureItem, Wall } from '../types';

const NONE = new Set<string>();

/**
 * Last computed result, shared by every caller (canvas + sidebar) so the SAT
 * pass runs once per change. The store replaces these arrays on every edit,
 * so reference equality is a reliable "nothing changed" check.
 */
let cache: { furniture: FurnitureItem[]; walls: Wall[]; pxPerMm: number; result: Set<string> } | null = null;

function overlapsFor(furniture: FurnitureItem[], walls: Wall[], pxPerMm: number): Set<string> {
  if (cache && cache.furniture === furniture && cache.walls === walls && cache.pxPerMm === pxPerMm) {
    return cache.result;
  }
  const result = computeOverlaps(furniture, walls, pxPerMm);
  cache = { furniture, walls, pxPerMm, result };
  return result;
}

/** Ids of furniture currently overlapping another item or a wall. Refreshes on drag-end. */
export function useOverlaps(): Set<string> {
  const furniture = usePlanStore(s => s.active()?.furniture);
  const walls = usePlanStore(s => s.active()?.walls);
  const pxPerMm = usePlanStore(s => s.active()?.calibration?.pxPerMm);
  if (!furniture || !walls || !pxPerMm) return NONE;
  return overlapsFor(furniture, walls, pxPerMm);
}
