import { describe, expect, it } from 'vitest';
import { badgeAnchor, flipShapeX, localConvexParts, localOutline } from '../footprint';
import type { FurnitureShape } from '../../types';
import { polygonArea } from './helpers';

const L: FurnitureShape = { kind: 'lshape', cutCorner: 'tr', armThicknessMm: 600 };
const T: FurnitureShape = {
  kind: 'polygon',
  // A concave T, centred: 1200 wide top bar, 400 wide stem.
  points: [
    { x: -600, y: -400 }, { x: 600, y: -400 }, { x: 600, y: -100 },
    { x: 200, y: -100 }, { x: 200, y: 400 }, { x: -200, y: 400 },
    { x: -200, y: -100 }, { x: -600, y: -100 },
  ],
};

describe('localOutline', () => {
  it('is 4 points for a rectangle and 6 for an L', () => {
    expect(localOutline(100, 50)).toHaveLength(4);
    expect(localOutline(1600, 1200, L)).toHaveLength(6);
  });
});

describe('localConvexParts', () => {
  it('triangulates a concave polygon into n-2 triangles covering its area', () => {
    if (T.kind !== 'polygon') throw new Error();
    const tris = localConvexParts(1200, 800, T);
    expect(tris).toHaveLength(T.points.length - 2);
    const total = tris.reduce((s, t) => s + polygonArea(t), 0);
    expect(total).toBeCloseTo(polygonArea(T.points), 6);
  });

  it('handles clockwise and counter-clockwise input the same way', () => {
    if (T.kind !== 'polygon') throw new Error();
    const reversed: FurnitureShape = { kind: 'polygon', points: [...T.points].reverse() };
    expect(localConvexParts(1200, 800, reversed)).toHaveLength(T.points.length - 2);
  });

  it('falls back to the bounding box for a degenerate polygon', () => {
    const line: FurnitureShape = { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }] };
    expect(localConvexParts(20, 0, line)).toHaveLength(1);
  });
});

describe('flipShapeX', () => {
  it('leaves rectangles alone', () => {
    expect(flipShapeX(undefined)).toBeUndefined();
    expect(flipShapeX({ kind: 'rect' })).toEqual({ kind: 'rect' });
  });
  it('mirrors the L cut corner left/right', () => {
    expect(flipShapeX(L)).toMatchObject({ cutCorner: 'tl' });
    expect(flipShapeX({ kind: 'lshape', cutCorner: 'bl', armThicknessMm: 1 })).toMatchObject({ cutCorner: 'br' });
  });
  it('is its own inverse', () => {
    expect(flipShapeX(flipShapeX(L))).toEqual(L);
    expect(flipShapeX(flipShapeX(T))).toEqual(T);
  });
});

describe('badgeAnchor', () => {
  it('sits on a solid corner of an L (opposite the cut)', () => {
    expect(badgeAnchor(1600, 1200, L)).toEqual({ x: -800, y: 600 });
  });
});
