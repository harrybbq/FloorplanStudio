import type { FurnitureShape, LShapeCorner, Point } from '../types';

/**
 * Furniture footprint geometry, in LOCAL millimetre space centred on the item's
 * origin (the rotation/translation to world space happens elsewhere).
 *
 * Two views of every shape:
 *   - localOutline()      → the single polygon to draw (may be concave, e.g. an L)
 *   - localConvexParts()  → 1+ CONVEX polygons whose union is the footprint,
 *                           used for SAT collision (which requires convex inputs)
 *
 * Adding a new shape kind = add a case to each function. Nothing else changes.
 */

function rectCorners(hw: number, hd: number): Point[] {
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
}

/** Keep the L arm thickness strictly inside the bounding box. */
function clampArm(armMm: number, widthMm: number, depthMm: number): number {
  const maxArm = Math.min(widthMm, depthMm) - 1;
  return Math.max(1, Math.min(armMm, maxArm));
}

/** The drawable outline polygon (centred, mm). Rect = 4 pts, L = 6 pts. */
export function localOutline(widthMm: number, depthMm: number, shape?: FurnitureShape): Point[] {
  const hw = widthMm / 2;
  const hd = depthMm / 2;
  if (!shape || shape.kind === 'rect') return rectCorners(hw, hd);
  if (shape.kind === 'polygon') return shape.points;

  const t = clampArm(shape.armThicknessMm, widthMm, depthMm);
  switch (shape.cutCorner) {
    case 'tr':
      return [
        { x: -hw, y: -hd }, { x: -hw + t, y: -hd }, { x: -hw + t, y: hd - t },
        { x: hw, y: hd - t }, { x: hw, y: hd }, { x: -hw, y: hd },
      ];
    case 'tl':
      return [
        { x: hw, y: -hd }, { x: hw - t, y: -hd }, { x: hw - t, y: hd - t },
        { x: -hw, y: hd - t }, { x: -hw, y: hd }, { x: hw, y: hd },
      ];
    case 'br':
      return [
        { x: -hw, y: hd }, { x: -hw + t, y: hd }, { x: -hw + t, y: -hd + t },
        { x: hw, y: -hd + t }, { x: hw, y: -hd }, { x: -hw, y: -hd },
      ];
    case 'bl':
      return [
        { x: hw, y: hd }, { x: hw - t, y: hd }, { x: hw - t, y: -hd + t },
        { x: -hw, y: -hd + t }, { x: -hw, y: -hd }, { x: hw, y: -hd },
      ];
  }
}

/** Convex pieces whose union equals the footprint (centred, mm). */
export function localConvexParts(widthMm: number, depthMm: number, shape?: FurnitureShape): Point[][] {
  const hw = widthMm / 2;
  const hd = depthMm / 2;
  if (!shape || shape.kind === 'rect') return [rectCorners(hw, hd)];
  if (shape.kind === 'polygon') {
    const tris = triangulate(shape.points);
    return tris.length > 0 ? tris : [boundingRect(shape.points)];
  }

  const t = clampArm(shape.armThicknessMm, widthMm, depthMm);
  const cutRight = shape.cutCorner === 'tr' || shape.cutCorner === 'br';
  const cutTop = shape.cutCorner === 'tl' || shape.cutCorner === 'tr';

  // Vertical arm runs full depth on the side OPPOSITE the cut.
  const vx0 = cutRight ? -hw : hw - t;
  const vx1 = cutRight ? -hw + t : hw;
  const vertical: Point[] = [
    { x: vx0, y: -hd }, { x: vx1, y: -hd }, { x: vx1, y: hd }, { x: vx0, y: hd },
  ];

  // Horizontal arm runs full width on the side OPPOSITE the cut.
  const hy0 = cutTop ? hd - t : -hd;
  const hy1 = cutTop ? hd : -hd + t;
  const horizontal: Point[] = [
    { x: -hw, y: hy0 }, { x: hw, y: hy0 }, { x: hw, y: hy1 }, { x: -hw, y: hy1 },
  ];

  return [vertical, horizontal];
}

/** A guaranteed-solid corner to anchor small badges on (centred, mm). */
export function badgeAnchor(widthMm: number, depthMm: number, shape?: FurnitureShape): Point {
  const hw = widthMm / 2;
  const hd = depthMm / 2;
  if (!shape || shape.kind === 'rect') return { x: hw, y: -hd };
  if (shape.kind === 'polygon') {
    // The vertex nearest the top-right is always on the boundary (solid).
    return shape.points.reduce((best, p) => (p.x - p.y > best.x - best.y ? p : best), shape.points[0]);
  }
  // The corner diagonally opposite the cut is always solid.
  const cutRight = shape.cutCorner === 'tr' || shape.cutCorner === 'br';
  const cutTop = shape.cutCorner === 'tl' || shape.cutCorner === 'tr';
  return { x: cutRight ? -hw : hw, y: cutTop ? hd : -hd };
}

/** Mirror a shape horizontally (x → -x) in its own local frame. */
export function flipShapeX(shape?: FurnitureShape): FurnitureShape | undefined {
  if (!shape || shape.kind === 'rect') return shape; // a rectangle mirrors to itself
  if (shape.kind === 'lshape') {
    const mirror: Record<LShapeCorner, LShapeCorner> = { tl: 'tr', tr: 'tl', bl: 'br', br: 'bl' };
    return { ...shape, cutCorner: mirror[shape.cutCorner] };
  }
  return { kind: 'polygon', points: shape.points.map(p => ({ x: -p.x, y: p.y })) };
}

/* ── Polygon helpers ─────────────────────────────────────────────────── */

function boundingRect(points: Point[]): Point[] {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return [
    { x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY },
  ];
}

function signedArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Ear-clipping triangulation of a simple polygon → list of triangles (each
 * a convex 3-point polygon). Returns [] if the polygon is degenerate; callers
 * fall back to the bounding rectangle so collision still works coarsely.
 */
function triangulate(input: Point[]): Point[][] {
  if (input.length < 3) return [];
  const poly = input.slice();
  if (signedArea(poly) < 0) poly.reverse(); // normalise to CCW

  const idx = poly.map((_, i) => i);
  const tris: Point[][] = [];
  let guard = 0;

  while (idx.length > 3 && guard++ < 5000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = poly[idx[(i - 1 + idx.length) % idx.length]];
      const b = poly[idx[i]];
      const c = poly[idx[(i + 1) % idx.length]];
      // Convex (CCW) vertex?
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= 0) continue; // reflex or collinear — not an ear
      // No other vertex inside triangle a-b-c?
      let contains = false;
      for (let j = 0; j < idx.length; j++) {
        const q = poly[idx[j]];
        if (q === a || q === b || q === c) continue;
        if (pointInTriangle(q, a, b, c)) {
          contains = true;
          break;
        }
      }
      if (contains) continue;
      tris.push([a, b, c]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) return []; // degenerate / self-intersecting — bail
  }
  if (idx.length === 3) tris.push([poly[idx[0]], poly[idx[1]], poly[idx[2]]]);
  return tris;
}
