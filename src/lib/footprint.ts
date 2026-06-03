import type { FurnitureShape, Point } from '../types';

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
  // The corner diagonally opposite the cut is always solid.
  const cutRight = shape.cutCorner === 'tr' || shape.cutCorner === 'br';
  const cutTop = shape.cutCorner === 'tl' || shape.cutCorner === 'tr';
  return { x: cutRight ? -hw : hw, y: cutTop ? hd : -hd };
}
