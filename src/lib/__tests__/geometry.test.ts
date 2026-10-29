import { describe, expect, it } from 'vitest';
import { computeOverlaps } from '../geometry';
import type { FurnitureShape, Wall } from '../../types';
import { item } from './helpers';

const overlaps = (...items: ReturnType<typeof item>[]) => computeOverlaps(items, [], 1);

describe('computeOverlaps — rectangles', () => {
  it('ignores boxes far apart', () => {
    expect(overlaps(item(0, 0, 100, 100, { id: 'a' }), item(500, 500, 100, 100, { id: 'b' })).size).toBe(0);
  });

  it('flags overlapping boxes', () => {
    const ids = overlaps(item(0, 0, 100, 100, { id: 'a' }), item(50, 50, 100, 100, { id: 'b' }));
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('treats furniture pushed flush together as clear, not overlapping', () => {
    expect(overlaps(item(0, 0, 100, 100, { id: 'a' }), item(100, 0, 100, 100, { id: 'b' })).size).toBe(0);
    // Same after rotation, where float error would otherwise make it flicker.
    expect(overlaps(item(0, 0, 100, 100, { rotation: 90, id: 'a' }), item(100, 0, 100, 100, { rotation: 90, id: 'b' })).size).toBe(0);
  });

  it('treats a 1px gap as clear', () => {
    expect(overlaps(item(0, 0, 100, 100, { id: 'a' }), item(101, 0, 100, 100, { id: 'b' })).size).toBe(0);
  });

  it('uses the rotated footprint, not the bounding box', () => {
    // 40x40 rotated 45° at (75,75): its bounding box overlaps A's corner, the diamond does not.
    expect(overlaps(item(0, 0, 100, 100, { id: 'a' }), item(75, 75, 40, 40, { rotation: 45, id: 'b' })).size).toBe(0);
    expect(overlaps(item(0, 0, 100, 100, { id: 'a' }), item(55, 55, 40, 40, { rotation: 45, id: 'b' })).size).toBe(2);
  });
});

describe('computeOverlaps — concave shapes', () => {
  const lshape: FurnitureShape = { kind: 'lshape', cutCorner: 'tr', armThicknessMm: 600 };
  // Same L as an explicit polygon (centred mm).
  const polygon: FurnitureShape = {
    kind: 'polygon',
    points: [
      { x: -800, y: -600 }, { x: -200, y: -600 }, { x: -200, y: 0 },
      { x: 800, y: 0 }, { x: 800, y: 600 }, { x: -800, y: 600 },
    ],
  };

  for (const [label, shape] of [['L-shape', lshape], ['polygon', polygon]] as const) {
    describe(label, () => {
      const desk = () => item(0, 0, 1600, 1200, { shape, id: 'desk' });

      it('lets a box sit in the notch', () => {
        expect(overlaps(desk(), item(300, -300, 200, 200, { id: 'box' })).size).toBe(0);
      });
      it('flags a box on either arm', () => {
        expect(overlaps(desk(), item(300, 300, 200, 200, { id: 'box' })).size).toBe(2);
        expect(overlaps(desk(), item(-500, -300, 200, 200, { id: 'box' })).size).toBe(2);
      });
      it('flags a box straddling the notch edge', () => {
        expect(overlaps(desk(), item(-150, -300, 200, 200, { id: 'box' })).size).toBe(2);
      });
    });
  }

  it('moves the notch when the L is rotated 180°', () => {
    const desk = item(0, 0, 1600, 1200, { shape: lshape, rotation: 180, id: 'desk' });
    expect(overlaps(desk, item(300, -300, 200, 200, { id: 'box' })).size).toBe(2);
  });
});

describe('computeOverlaps — walls', () => {
  const wall: Wall = { id: 'w', points: [{ x: -1000, y: 0 }, { x: 1000, y: 0 }] };

  it('flags furniture crossing a wall', () => {
    expect(computeOverlaps([item(0, 0, 100, 100, { id: 'a' })], [wall], 1).has('a')).toBe(true);
  });
  it('ignores furniture clear of a wall', () => {
    expect(computeOverlaps([item(0, 200, 100, 100, { id: 'a' })], [wall], 1).size).toBe(0);
  });
  it('respects the L notch for walls too', () => {
    const lshape: FurnitureShape = { kind: 'lshape', cutCorner: 'tr', armThicknessMm: 600 };
    const notchWall: Wall = { id: 'n', points: [{ x: 200, y: -500 }, { x: 600, y: -500 }] };
    expect(computeOverlaps([item(0, 0, 1600, 1200, { shape: lshape, id: 'd' })], [notchWall], 1).size).toBe(0);
  });
});
