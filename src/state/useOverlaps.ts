import { useMemo } from 'react';
import { usePlanStore } from './planStore';
import { computeOverlaps } from '../lib/geometry';

/**
 * Returns the set of furniture ids that currently overlap another item or a wall.
 * Recomputed when furniture, walls, or the calibration scale change.
 * (Overlaps refresh on drag-END, since positions only commit then.)
 */
export function useOverlaps(): Set<string> {
  const furniture = usePlanStore(s => s.active()?.furniture);
  const walls = usePlanStore(s => s.active()?.walls);
  const pxPerMm = usePlanStore(s => s.active()?.calibration?.pxPerMm ?? null);

  return useMemo(() => {
    if (!furniture || !pxPerMm) return new Set<string>();
    return computeOverlaps(furniture, walls ?? [], pxPerMm);
  }, [furniture, walls, pxPerMm]);
}
