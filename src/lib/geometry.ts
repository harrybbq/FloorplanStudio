import type { FurnitureItem, Point, Wall } from '../types';
import { localConvexParts } from './footprint';

/**
 * Collision geometry, all in image pixel-space.
 *
 * Furniture can be rotated AND non-rectangular (e.g. an L), so each item's
 * footprint is represented as one or more CONVEX polygons (its "parts").
 * We test part-against-part with the Separating Axis Theorem (SAT) for
 * furniture overlap, and segment-against-part for walls.
 */

/** Transform an item's convex parts from local mm space into world pixel-space. */
function getWorldParts(item: FurnitureItem, pxPerMm: number): Point[][] {
  const r = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return localConvexParts(item.widthMm, item.depthMm, item.shape).map(part =>
    part.map(p => {
      const lx = p.x * pxPerMm;
      const ly = p.y * pxPerMm;
      return {
        x: item.x + lx * cos - ly * sin,
        y: item.y + lx * sin + ly * cos,
      };
    })
  );
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

/** Separation smaller than this (px) is treated as touching, not overlapping. */
const TOUCH_EPSILON = 1e-6;

/** SAT intersection test for two convex polygons. Touching edges do NOT count. */
function convexPolysIntersect(a: Point[], b: Point[]): boolean {
  const axes = [...edgeNormals(a), ...edgeNormals(b)];
  for (const axis of axes) {
    const [amin, amax] = project(a, axis);
    const [bmin, bmax] = project(b, axis);
    if (amax <= bmin + TOUCH_EPSILON || bmax <= amin + TOUCH_EPSILON) return false; // separating axis
  }
  return true;
}

/** Do any convex parts of A intersect any convex parts of B? */
function partsIntersect(a: Point[][], b: Point[][]): boolean {
  return a.some(pa => b.some(pb => convexPolysIntersect(pa, pb)));
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

/** Does the wall polyline touch/cross any of the item's convex parts? */
function wallIntersectsParts(wall: Wall, parts: Point[][]): boolean {
  for (let i = 0; i < wall.points.length - 1; i++) {
    const p1 = wall.points[i];
    const p2 = wall.points[i + 1];
    for (const part of parts) {
      if (segmentIntersectsPoly(p1, p2, part)) return true;
    }
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
  const parts = furniture.map(f => getWorldParts(f, pxPerMm));

  // furniture vs furniture
  for (let i = 0; i < furniture.length; i++) {
    for (let j = i + 1; j < furniture.length; j++) {
      if (partsIntersect(parts[i], parts[j])) {
        ids.add(furniture[i].id);
        ids.add(furniture[j].id);
      }
    }
  }

  // furniture vs walls
  for (let i = 0; i < furniture.length; i++) {
    if (ids.has(furniture[i].id)) continue; // already flagged
    for (const wall of walls) {
      if (wallIntersectsParts(wall, parts[i])) {
        ids.add(furniture[i].id);
        break;
      }
    }
  }

  return ids;
}
