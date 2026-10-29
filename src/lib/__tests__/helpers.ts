import type { FurnitureItem, FurnitureShape, Point } from '../../types';

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

export function polygonArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
}
