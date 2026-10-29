import type { FurnitureItem, FurnitureShape } from '../../types';

export { polygonArea } from '../rooms';

/** Build a furniture item with sensible defaults (1px = 1mm when pxPerMm = 1). */
export function item(
  x: number,
  y: number,
  widthMm: number,
  depthMm: number,
  opts: { rotation?: number; shape?: FurnitureShape; id?: string } = {}
): FurnitureItem {
  return {
    id: opts.id ?? `${x},${y},${widthMm},${depthMm}`,
    name: 'test',
    x,
    y,
    widthMm,
    depthMm,
    heightMm: 0,
    rotation: opts.rotation ?? 0,
    shape: opts.shape,
    source: 'manual',
    confidence: 'user-entered',
    color: '#000',
  };
}
