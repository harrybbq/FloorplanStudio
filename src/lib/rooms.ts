import type { Point, Room, RoomRole, UnitSystem } from '../types';
import { formatLength } from './units';

/** Roles that map onto one HouseHunter field each, so a plan has at most one of each. */
export const ROOM_ROLES: { value: RoomRole; label: string }[] = [
  { value: 'other', label: 'Room' },
  { value: 'flat', label: 'Whole flat' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bedroom2', label: 'Bedroom 2' },
];

export function roomLabel(room: Room, index: number): string {
  return room.role === 'other' ? `Room ${index + 1}` : ROOM_ROLES.find(r => r.value === room.role)!.label;
}

/** Shoelace area (absolute), in the points' units squared. */
export function polygonArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
}

/** Convex hull, Andrew's monotone chain. */
function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const h: Point[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/**
 * Length × width of the smallest rectangle around the shape (any orientation), so
 * a rectangular room gives its real sides however it's drawn, and an L-shaped
 * room gives its overall extent. Length ≥ width.
 */
export function minAreaRect(points: Point[]): { length: number; width: number } {
  const hull = convexHull(points);
  let best = { area: Infinity, a: 0, b: 0 };
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i];
    const q = hull[(i + 1) % hull.length];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len === 0) continue;
    // Project every hull point onto this edge's direction and its normal.
    const ux = (q.x - p.x) / len;
    const uy = (q.y - p.y) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const h of hull) {
      const u = h.x * ux + h.y * uy;
      const v = -h.x * uy + h.y * ux;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const a = maxU - minU;
    const b = maxV - minV;
    if (a * b < best.area) best = { area: a * b, a, b };
  }
  if (!Number.isFinite(best.area)) return { length: 0, width: 0 };
  return { length: Math.max(best.a, best.b), width: Math.min(best.a, best.b) };
}

export type RoomMetrics = { areaMm2: number; lengthMm: number; widthMm: number };

/** Real-world size of a traced room. Points are image pixels. */
export function roomMetrics(points: Point[], pxPerMm: number): RoomMetrics {
  const mm = points.map(p => ({ x: p.x / pxPerMm, y: p.y / pxPerMm }));
  const { length, width } = minAreaRect(mm);
  return { areaMm2: polygonArea(mm), lengthMm: length, widthMm: width };
}

const MM2_PER_SQFT = 304.8 * 304.8;

export const mm2ToSqft = (mm2: number) => mm2 / MM2_PER_SQFT;

export function formatArea(mm2: number, units: UnitSystem): string {
  return units === 'imperial' ? `${Math.round(mm2ToSqft(mm2))} sq ft` : `${(mm2 / 1e6).toFixed(1)} m²`;
}

/** "4.93 m × 3.91 m · 19.3 m²" in the user's units. */
export function roomSummary(points: Point[], pxPerMm: number, units: UnitSystem): string {
  const m = roomMetrics(points, pxPerMm);
  return `${formatLength(m.lengthMm, units)} × ${formatLength(m.widthMm, units)} · ${formatArea(m.areaMm2, units)}`;
}

/** Bend the edge from `from` to `p` to exactly horizontal/vertical when it's within `deg` of one. */
export function straighten(from: Point | undefined, p: Point, deg: number): Point {
  if (!from) return p;
  const adx = Math.abs(p.x - from.x);
  const ady = Math.abs(p.y - from.y);
  if (adx === 0 && ady === 0) return p;
  const angle = (Math.atan2(ady, adx) * 180) / Math.PI; // 0 = horizontal
  if (angle < deg) return { x: p.x, y: from.y };
  if (angle > 90 - deg) return { x: from.x, y: p.y };
  return p;
}
