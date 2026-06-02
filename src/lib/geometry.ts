import type { FurnitureItem, Point, Wall } from '../types';

/**
 * Collision geometry, all in image pixel-space.
 *
 * Furniture rectangles can be rotated, so axis-aligned bounding-box tests
 * aren't good enough — we use the Separating Axis Theorem (SAT) for
 * oriented box vs oriented box, and segment-vs-polygon tests for walls.
 */

/** The 4 corners of a furniture rectangle, in pixel-space, accounting for rotation. */
export function getCorners(item: FurnitureItem, pxPerMm: number): Point[] {
  const w = item.widthMm * pxPerMm;
  const d = item.depthMm * pxPerMm;
  const hw = w / 2;
  const hd = d / 2;
  const r = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const local: Point[] = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
  return local.map(p => ({
    x: item.x + p.x * cos - p.y * sin,
    y: item.y + p.x * sin + p.y * cos,
  }));
}

function project(poly: Point[], axis: Point): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const dot = p.x * axis.x + p.y * axis.y;
    if (dot < min) min = dot;
    if (dot > max) max = dot;
  }
  return [min, max];
}

function edgeNormals(poly: Point[]): Point[] {
  const axes: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const normal = { x: -edge.y, y: edge.x };
    const len = Math.hypot(normal.x, normal.y) || 1;
    axes.push({ x: normal.x / len, y: normal.y / len });
  }
  return axes;
}

/** SAT intersection test for two convex polygons (touching counts as intersecting). */
export function convexPolysIntersect(a: Point[], b: Point[]): boolean {
  const axes = [...edgeNormals(a), ...edgeNormals(b)];
  for (const axis of axes) {
    const [amin, amax] = project(a, axis);
    const [bmin, bmax] = project(b, axis);
    if (amax < bmin || bmax < amin) return false; // separating axis found
  }
  return true;
}

function pointInConvexPoly(pt: Point, poly: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

function ccw(a: Point, b: Point, c: Point): boolean {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

/** Do segments p1p2 and p3p4 cross? */
function segSegIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/** Does segment p1p2 touch/cross the convex polygon? */
function segmentIntersectsPoly(p1: Point, p2: Point, poly: Point[]): boolean {
  if (pointInConvexPoly(p1, poly) || pointInConvexPoly(p2, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (segSegIntersect(p1, p2, a, b)) return true;
  }
  return false;
}

/** Does any segment of the wall polyline touch/cross the polygon? */
function wallIntersectsPoly(wall: Wall, poly: Point[]): boolean {
  for (let i = 0; i < wall.points.length - 1; i++) {
    if (segmentIntersectsPoly(wall.points[i], wall.points[i + 1], poly)) return true;
  }
  return false;
}

/**
 * Compute which furniture items overlap something — another item or a wall.
 * Returns the set of offending furniture ids.
 */
export function computeOverlaps(
  furniture: FurnitureItem[],
  walls: Wall[],
  pxPerMm: number
): Set<string> {
  const ids = new Set<string>();
  const corners = furniture.map(f => getCorners(f, pxPerMm));

  // furniture vs furniture
  for (let i = 0; i < furniture.length; i++) {
    for (let j = i + 1; j < furniture.length; j++) {
      if (convexPolysIntersect(corners[i], corners[j])) {
        ids.add(furniture[i].id);
        ids.add(furniture[j].id);
      }
    }
  }

  // furniture vs walls
  for (let i = 0; i < furniture.length; i++) {
    if (ids.has(furniture[i].id)) continue; // already flagged
    for (const wall of walls) {
      if (wallIntersectsPoly(wall, corners[i])) {
        ids.add(furniture[i].id);
        break;
      }
    }
  }

  return ids;
}
